import { logger, schedules } from "@trigger.dev/sdk/v3";

import { isSameDay } from "date-fns";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  echoSessions,
  friends,
  playlistSongs,
  playlists,
  songLinkCacheMappings,
  spotifyAuth,
  userAuth,
  userEchoSessions,
  users,
} from "@/db/schema";
import { CONTACT_CARD_PLACEHOLDER, Platform } from "@/db/types";
import { AppleMusicPlatform, SpotifyPlatform } from "@/platforms";
import { sendMessagesTask } from "./send-messages";

type PlaylistRecords = {
  userId: number;
  platform: Platform;
  sessionId: number;
  platformPlaylistId: string;
  playlistName: string;
  playlistImageUrl: string;
}[];

type PlaylistSongRecords = {
  playlistId: number;
  trackId: string;
  submittedByUserId: number;
  platformPlaylistId: string;
}[];

type UserSongData = {
  userId: number;
  firstName: string;
  phoneNumber: string;
  friendLinkToken: string;
  platformUserId: string;
  platform: Platform;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  platformOfEchoSession: Platform;
  trackId: string;
  trackAlbumImageUrl: string;
  sendContactCard: boolean;
  hasLessThanThreeFriendsAfterTwoEchoes: boolean;
};

const NUM_SONGS_PER_PLAYLIST = 10;

export const generatePlaylistsTask = schedules.task({
  id: "generate-playlists",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute

  cron: {
    pattern: "30 21 * * *", // run daily at 9:30 PM EST, with conditional logic inside
    timezone: "America/New_York",
    environments: ["DEVELOPMENT"],
  },

  run: async () => {
    logger.log("generate playlists task starting ...");

    // Check if we should run today by checking if a session was created today
    const [echoSession] = await db
      .select({ id: echoSessions.id, createdAt: echoSessions.createdAt })
      .from(echoSessions)
      .orderBy(desc(echoSessions.createdAt))
      .limit(1);

    if (!echoSession) {
      logger.log("Skipping execution - no sessions found in database");
      return { message: "Skipped - no sessions found" };
    }

    const lastSessionDate = new Date(echoSession.createdAt);
    const now = new Date();
    const playlistDate = new Date(lastSessionDate).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
    });

    // Check if the last session was created today (same calendar day)
    if (!isSameDay(lastSessionDate, now)) {
      logger.log("Skipping execution - no session created today", {
        lastSessionDate: lastSessionDate.toISOString(),
      });
      return {
        message: "Skipped - no session created today",
      };
    }

    logger.log("Executing - session was created today", {
      lastSessionDate: lastSessionDate.toISOString(),
    });

    const { ok, data, error } = await getUserEchoSessions(echoSession.id);

    if (!ok) {
      logger.error("error getting echo session and users", { error });
      throw error;
    }

    if (!data) {
      logger.error("no data returned from getEchoSessionAndUsers", { error });
      throw error;
    }

    const { userSongData, noShareSecondSessionUsers } = data;

    logger.log("echo session and users fetched", {
      numUsers: userSongData.length,
      echoSessionId: echoSession.id,
      playlistDate,
    });

    // create lookup table mapping userId to [trackId, trackAlbumImageUrl]
    const userSongLookup: Record<number, [string, string]> = {};
    for (const user of userSongData) {
      userSongLookup[user.userId] = [user.trackId, user.trackAlbumImageUrl];
    }

    logger.log("user to song lookup created");

    // create lookup table mapping userId to platform (used to determine which platform to create playlist on)
    const userToPlatformOfEchoSessionLookup: Record<number, Platform> = {};
    for (const user of userSongData) {
      userToPlatformOfEchoSessionLookup[user.userId] =
        user.platformOfEchoSession;
    }

    logger.log("user to song platform lookup created");

    // userId -> [friendId, trackId]
    const playlists: Record<number, Array<[number, [string, string]]>> = {}; // userId -> [friendId, [trackId, trackAlbumImageUrl]]

    const playlistRecords: PlaylistRecords = [];
    const playlistSongRecords: PlaylistSongRecords = [];

    const usersThatEncounteredErrors: Record<number, (string | unknown)[]> = {};

    for (const user of userSongData) {
      logger.log("processing user", { user });

      const {
        ok,
        data: userFriendData,
        error,
      } = await getUserFriends(user.userId, echoSession.id);

      if (!ok) {
        usersThatEncounteredErrors[user.userId] ??= [];
        usersThatEncounteredErrors[user.userId].push(error);
        continue;
      }

      logger.log("user's friends fetched", { userFriendData });

      const {
        ok: compilePlaylistSongsOk,
        data: compiledPlaylistSongs,
        errors: compilePlaylistSongsErrors,
      } = await compilePlaylistSongs(
        user.platform,
        userFriendData,
        userSongLookup,
        userToPlatformOfEchoSessionLookup,
        NUM_SONGS_PER_PLAYLIST,
      );

      if (!compilePlaylistSongsOk || compilePlaylistSongsErrors.length > 0) {
        usersThatEncounteredErrors[user.userId] ??= [];
        usersThatEncounteredErrors[user.userId].push(
          ...compilePlaylistSongsErrors,
        );
        continue;
      }

      playlists[user.userId] = compiledPlaylistSongs;

      if (playlists[user.userId].length === 0) {
        usersThatEncounteredErrors[user.userId] ??= [];
        usersThatEncounteredErrors[user.userId].push(
          "compilePlaylistSongs() found 0 songs to add to playlist",
        );
        continue;
      }

      const playlistNameAbbreviation = user.firstName.endsWith("s")
        ? "'"
        : "'s";

      const playlistName = `${user.firstName}${playlistNameAbbreviation} echo ${playlistDate}`;
      const playlistDescription = `here are the songs your friends shared for the ${playlistDate} echo`;

      if (user.firstName === "lucas") continue;

      const {
        ok: createPlaylistOk,
        data: playlistData,
        error: createPlaylistError,
      } = await createPlaylistOnPlatformForUser(
        user,
        playlistName,
        playlistDescription,
        playlistDate,
        playlists[user.userId].map((song) => song[1][0]),
      );

      if (!createPlaylistOk) {
        usersThatEncounteredErrors[user.userId] ??= [];
        usersThatEncounteredErrors[user.userId].push(createPlaylistError);
        continue;
      }

      if (!playlistData) {
        usersThatEncounteredErrors[user.userId] ??= [];
        usersThatEncounteredErrors[user.userId].push(
          "no data returned from createPlaylist()",
        );
        continue;
      }

      // only doing this for Spotify because Apple Music populates playlist upon creation
      if (user.platform === Platform.SPOTIFY) {
        const { ok: populatePlaylistOk, error: populatePlaylistError } =
          await populatePlatformPlaylist(
            user,
            playlists[user.userId].map((song) => song[1][0]),
            playlistData.playlistId,
          );

        if (!populatePlaylistOk) {
          usersThatEncounteredErrors[user.userId] ??= [];
          usersThatEncounteredErrors[user.userId].push(populatePlaylistError);
          continue;
        }
      }

      /* 
      this matches how Spotify generates playlist images - uses first 4 track 
      album images or first track album image if less than 4
      
      we need to track this ourselves because, once we generate a playlist, we
      do not get back the playlist image url since it's initially empty

      NOTE: Apple Music DOES provide playlist image url, but it is boring 
      */
      const playlistImageUrl =
        playlists[user.userId].length >= 4
          ? playlists[user.userId]
              .slice(0, 4)
              .map((song) => song[1][1])
              .join("|")
          : playlists[user.userId][0][1][1];

      playlistRecords.push({
        userId: user.userId,
        platform: user.platform,
        sessionId: echoSession.id,
        platformPlaylistId: playlistData.playlistId,
        playlistName: playlistName,
        playlistImageUrl: playlistImageUrl,
      });

      playlistSongRecords.push(
        ...playlists[user.userId].map((song) => ({
          playlistId: 0,
          trackId: song[1][0],
          submittedByUserId: song[0],
          platformPlaylistId: playlistData.playlistId, // will not be persisted to database, just used to get Playlist.id in persistPlaylistsToDatabase
        })),
      );
    }

    logger.log("playlist records and playlist song records", {
      playlistRecords,
      playlistSongRecords,
    });

    const { ok: persistPlaylistsOk, error: persistPlaylistsError } =
      await persistPlaylistsToDatabase(playlistRecords, playlistSongRecords);
    if (!persistPlaylistsOk) {
      logger.error("error persisting playlists to database", {
        persistPlaylistsError,
      });
      throw persistPlaylistsError;
    }

    // text each user their playlist
    await textUsers(
      playlistRecords,
      userSongData,
      noShareSecondSessionUsers,
      usersThatEncounteredErrors,
    );

    // logging all encountered errors
    if (Object.keys(usersThatEncounteredErrors).length > 0) {
      logger.error("ERRORS", { usersThatEncounteredErrors });
    }

    return {
      message: `generate playlists task completed`,
    };
  },
});

// FIXME: make 2 db calls into 1?
const getUserEchoSessions = async (echoSessionId: number) => {
  try {
    const [spotifyAuthData] = await db
      .select({
        userId: spotifyAuth.userId,
        accessToken: spotifyAuth.accessToken,
        refreshToken: spotifyAuth.refreshToken,
        tokenExpiresAt: spotifyAuth.tokenExpiresAt,
      })
      .from(spotifyAuth)
      .limit(1);

    // get all users that submitted a song in the last session (userId, phoneNumber, trackId)
    const userData = await db
      .select({
        userId: userEchoSessions.userId,
        firstName: users.firstName,
        phoneNumber: users.phoneNumber,
        friendLinkToken: users.friendLinkToken,
        platform: users.platform,
        platformUserId: userAuth.platformUserId,

        accessToken: userAuth.accessToken,
        refreshToken: userAuth.refreshToken,
        tokenExpiresAt: userAuth.tokenExpiresAt,

        platformOfEchoSession: userEchoSessions.platform,
        trackId: userEchoSessions.trackId,
        trackAlbumImageUrl: userEchoSessions.trackAlbumImageUrl,
        sendContactCard: eq(users.firstSharedSessionId, echoSessionId),
        hasLessThanThreeFriendsAfterTwoEchoes: sql<boolean>`(
          (SELECT COUNT(*) FROM ${userEchoSessions} WHERE ${userEchoSessions.userId} = ${users.id}) = 2
          AND
          (SELECT COUNT(*) FROM ${friends} WHERE ${friends.userId} = ${users.id} AND ${friends.active} = true) < 3
        )`.as("has_less_than_three_friends_after_two_echoes"),
      })
      .from(userEchoSessions)
      .innerJoin(users, eq(userEchoSessions.userId, users.id))
      .leftJoin(userAuth, eq(userAuth.userId, users.id))
      .where(
        and(
          eq(userEchoSessions.sessionId, echoSessionId),
          eq(users.isDeleted, false),
        ),
      );

    const userSongData: UserSongData[] = [];
    const noShareSecondSessionUsers: {
      userId: number;
      phoneNumber: string;
      friendLinkToken: string;
    }[] = [];

    for (const user of userData) {
      if (!user.trackId && user.hasLessThanThreeFriendsAfterTwoEchoes) {
        noShareSecondSessionUsers.push({
          userId: user.userId,
          phoneNumber: user.phoneNumber,
          friendLinkToken: user.friendLinkToken,
        });
        continue;
      }

      if (!user.trackId) continue;

      if (user.platform === Platform.SPOTIFY) {
        user.platformUserId = spotifyAuthData.userId;
        user.accessToken = spotifyAuthData.accessToken;
        user.refreshToken = spotifyAuthData.refreshToken;
        user.tokenExpiresAt = spotifyAuthData.tokenExpiresAt;
      }

      userSongData.push(user as UserSongData);
    }

    logger.log("user song data", { userSongData });

    if (userSongData.length === 0) {
      throw new Error(`no users found for echo session ${echoSessionId}`);
    }

    return {
      ok: true,
      data: { userSongData, noShareSecondSessionUsers },
      error: null,
    };
  } catch (error) {
    return { ok: false, data: null, error: error };
  }
};

const getUserFriends = async (userId: number, echoSessionId: number) => {
  try {
    const userFriendData = await db
      .select({ friendId: friends.friendId })
      .from(friends)
      .innerJoin(
        userEchoSessions,
        eq(friends.friendId, userEchoSessions.userId),
      )
      .where(
        and(
          eq(friends.userId, userId),
          eq(userEchoSessions.sessionId, echoSessionId),
          isNotNull(userEchoSessions.trackId),
        ),
      );

    if (userFriendData.length === 0) {
      throw new Error(`no friends found for user ${userId}`);
    }

    return {
      ok: true,
      data: userFriendData.map((friend) => friend.friendId),
      error: null,
    };
  } catch (error) {
    return { ok: false, data: [], error: error };
  }
};

const compilePlaylistSongs = async (
  userPlatform: Platform,
  userFriendData: number[],
  userSongLookup: Record<number, [string, string]>, // userId -> [trackId, trackAlbumImageUrl]
  userToPlatformOfEchoSessionLookup: Record<number, Platform>,
  numSongsPerPlaylist: number,
) => {
  try {
    const playlist: Array<[number, [string, string]]> = []; // [friendId, [trackId, trackAlbumImageUrl]]

    const errors: (string | unknown)[] = [];

    for (const friendId of userFriendData) {
      if (playlist.length === numSongsPerPlaylist) break;

      if (!userSongLookup[friendId]) continue;

      const [friendSongTrackId, friendSongAlbumImageUrl] =
        userSongLookup[friendId];
      const friendSongPlatformOfEchoSession =
        userToPlatformOfEchoSessionLookup[friendId];

      if (!friendSongTrackId || !friendSongAlbumImageUrl) continue;

      if (playlist.map((p) => p[1][0]).includes(friendSongTrackId))
        // FIXME: use set instead of array
        continue;

      const {
        ok: matchFriendSongToUserPlatformOk,
        trackId: matchedTrackId,
        error: matchFriendSongToUserPlatformError,
      } = await matchFriendSongToUserPlatform(
        userPlatform,
        friendSongPlatformOfEchoSession,
        friendSongTrackId,
      );

      // FIXME: handle error better
      if (!matchFriendSongToUserPlatformOk) {
        errors.push(matchFriendSongToUserPlatformError);
        continue;
      }

      if (!matchedTrackId) {
        errors.push(
          `No track returned from matchFriendSongToUserPlatform() for friend ${friendId} when converting track to ${userPlatform}`,
        );
        continue;
      }

      playlist.push([friendId, [matchedTrackId, friendSongAlbumImageUrl]]);
    }

    return {
      ok: true,
      data: playlist,
      errors: errors,
    };
  } catch (error) {
    return { ok: false, data: [], errors: [error] };
  }
};

const createPlaylistOnPlatformForUser = async (
  user: UserSongData,
  playlistName: string,
  playlistDescription: string,
  playlistDate: string,
  songs: string[],
) => {
  if (user.platform === Platform.SPOTIFY) {
    return await createSpotifyPlaylistForUser(
      user,
      playlistName,
      playlistDescription,
      playlistDate,
    );
  } else if (user.platform === Platform.APPLE_MUSIC) {
    return await createAppleMusicPlaylistForUser(
      user,
      playlistName,
      playlistDescription,
      playlistDate,
      songs,
    );
  }

  return {
    ok: false,
    data: null,
    error: `invalid platform ${user.platform}`,
  };
};

const createSpotifyPlaylistForUser = async (
  user: UserSongData,
  playlistName: string,
  playlistDescription: string,
  playlistDate: string,
) => {
  if (new Date(user.tokenExpiresAt) < new Date()) {
    logger.log("spotify token expired, refreshing ...", { user });

    const {
      ok: refreshTokensOk,
      data: refreshTokensData,
      error: refreshTokensError,
    } = await SpotifyPlatform.refreshTokens({
      userId: user.platformUserId,
      refreshToken: user.refreshToken,
    });

    if (!refreshTokensOk) {
      return { ok: false, data: null, error: refreshTokensError };
    }

    if (!refreshTokensData) {
      logger.error("no data returned from refreshAccessToken", {
        user,
        refreshTokensData,
      });
      return {
        ok: false,
        data: null,
        error: `no data returned from refreshAccessToken`,
      };
    }

    user.accessToken = refreshTokensData.accessToken;
    user.refreshToken = refreshTokensData.refreshToken;
    user.tokenExpiresAt = refreshTokensData.expiresIn;

    logger.log("user update complete", { user });
  }

  logger.log("creating spotify playlist for user", { user });

  const {
    ok: createPlaylistOk,
    data: createPlaylistData,
    error: createPlaylistError,
  } = await SpotifyPlatform.createPlaylist({
    userId: user.platformUserId,
    accessToken: user.accessToken,
    playlistName: playlistName,
    playlistDescription: playlistDescription,
    playlistDate: playlistDate,
  });

  if (!createPlaylistOk) {
    return { ok: false, data: null, error: createPlaylistError };
  }

  return { ok: true, data: createPlaylistData, error: null };
};

const createAppleMusicPlaylistForUser = async (
  user: UserSongData,
  playlistName: string,
  playlistDescription: string,
  playlistDate: string,
  songs: string[],
) => {
  logger.log("creating apple music playlist for user", { user });

  const {
    ok: createPlaylistOk,
    data: createPlaylistData,
    error: createPlaylistError,
  } = await AppleMusicPlatform.createAndPopulatePlaylist({
    accessToken: user.accessToken,
    playlistName: playlistName,
    playlistDescription: playlistDescription,
    playlistDate: playlistDate,
    songs: songs,
  });

  if (!createPlaylistOk) {
    return { ok: false, data: null, error: createPlaylistError };
  }

  return { ok: true, data: createPlaylistData, error: null };
};

const populatePlatformPlaylist = async (
  user: UserSongData,
  songs: string[],
  playlistId: string,
) => {
  if (user.platform === Platform.SPOTIFY) {
    const songURIs = songs.map((song) => `spotify:track:${song}`);

    return await SpotifyPlatform.populatePlaylist({
      accessToken: user.accessToken,
      trackURIs: songURIs,
      playlistId: playlistId,
    });
  }

  return {
    ok: false,
    error: `invalid platform ${user.platform} in populatePlatformPlaylist()`,
  };
};

const persistPlaylistsToDatabase = async (
  newPlaylists: PlaylistRecords,
  newPlaylistSongs: PlaylistSongRecords,
) => {
  try {
    if (newPlaylists.length === 0 || newPlaylistSongs.length === 0) {
      logger.log(
        "no playlists or playlist songs to save to database, skipping",
      );
      return { ok: true, error: null };
    }

    logger.log("saving playlists to database");
    const playlistsInserted = await db
      .insert(playlists)
      .values(newPlaylists)
      .returning({
        id: playlists.id,
        platformPlaylistId: playlists.platformPlaylistId,
      });
    logger.log("saving playlists to database done", {});

    const playlistIdByPlatformPlaylistId = new Map(
      playlistsInserted.map((r) => [r.platformPlaylistId, r.id]),
    );

    logger.log("saving playlists to database done", {
      numPlaylists: playlistIdByPlatformPlaylistId.size,
    });

    // save each playlistSong to database
    for (const playlistSong of newPlaylistSongs) {
      playlistSong.playlistId = playlistIdByPlatformPlaylistId.get(
        playlistSong.platformPlaylistId,
      ) as number;
    }

    logger.log("saving playlist songs to database");
    await db.insert(playlistSongs).values(newPlaylistSongs);
    logger.log("saving playlist songs to database done", {
      numPlaylistSongs: newPlaylistSongs.length,
    });

    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error };
  }
};

const textUsers = async (
  playlists: PlaylistRecords,
  userSongData: UserSongData[],
  noShareSecondSessionUsers: {
    userId: number;
    phoneNumber: string;
    friendLinkToken: string;
  }[],
  usersThatEncounteredErrors: Record<number, (string | unknown)[]>,
) => {
  const data: Record<string, Array<string>> = {};

  const contactCardMessages: string[] = [
    "save our contact for easy access",
    CONTACT_CARD_PLACEHOLDER,
  ];

  for (const playlist of playlists) {
    if (usersThatEncounteredErrors[playlist.userId]) {
      continue;
    }

    const user = userSongData.find((u) => u.userId === playlist.userId);

    if (!user?.phoneNumber) {
      usersThatEncounteredErrors[playlist.userId] ??= [];
      usersThatEncounteredErrors[playlist.userId].push(
        "NO TEXT send to user because phone number not found",
      );
      continue;
    }

    let playlistLink = "";

    switch (playlist.platform) {
      case Platform.SPOTIFY:
        playlistLink = `https://open.spotify.com/playlist/${playlist.platformPlaylistId}`;
        break;
      case Platform.APPLE_MUSIC:
        playlistLink = AppleMusicPlatform.createPlaylistLink(
          playlist.platformPlaylistId,
        );
        break;
    }

    const lowFriendsMessages: string[] = [
      "looks like you don't have many songs coming in :( invite more friends with your link",
      user.friendLinkToken ?? "",
    ];

    data[user.phoneNumber] = [
      "you ready? here's the songs your friends shared:",
      playlistLink,
      ...(user.hasLessThanThreeFriendsAfterTwoEchoes ? lowFriendsMessages : []),
      ...(user.sendContactCard ? contactCardMessages : []),
    ];
  }

  for (const user of noShareSecondSessionUsers) {
    data[user.phoneNumber] = [
      `echo is more fun with friends :) invite more friends with your link`,
      user.friendLinkToken,
    ];
  }

  await sendMessagesTask.trigger({
    data: data,
  });

  return {
    message: `sent playlists to ${Object.keys(data).length} users`,
  };
};

const matchFriendSongToUserPlatform = async (
  userPlatform: Platform,
  songSubmittedPlatform: Platform,
  submittedSong: string,
) => {
  if (userPlatform === songSubmittedPlatform) {
    return { ok: true, trackId: submittedSong, error: null };
  }

  return await convertTrack(submittedSong, userPlatform);
};

const convertTrack = async (trackId: string, platform: Platform) => {
  try {
    const [submittedTrack] = await db
      .select({ songlinkCacheId: songLinkCacheMappings.songlinkCacheId })
      .from(songLinkCacheMappings)
      .where(eq(songLinkCacheMappings.trackId, trackId))
      .limit(1);

    if (!submittedTrack) {
      return {
        ok: false,
        trackId: null,
        error: `TrackId ${trackId} not found in songlink_cache_mappings when converting track to ${platform}`,
      };
    }

    const [convertedTrack] = await db
      .select({ trackId: songLinkCacheMappings.trackId })
      .from(songLinkCacheMappings)
      .where(
        and(
          eq(
            songLinkCacheMappings.songlinkCacheId,
            submittedTrack.songlinkCacheId,
          ),
          eq(songLinkCacheMappings.platform, platform),
        ),
      )
      .limit(1);

    if (!convertedTrack) {
      return {
        ok: false,
        trackId: null,
        error: `Track with songlinkCacheId ${submittedTrack.songlinkCacheId} not found in songlink_cache_mappings when converting track to ${platform}`,
      };
    }

    return { ok: true, trackId: convertedTrack.trackId, error: null };
  } catch (error) {
    return { ok: false, trackId: null, error: error };
  }
};
