import { logger, schedules } from "@trigger.dev/sdk/v3";

// import { twilioAdmin } from "@/lib/twilioAdmin";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  echoSessions,
  friends,
  playlistSongs,
  playlists,
  userAuth,
  userEchoSessions,
  users,
} from "@/db/schema";
import type { Platform } from "@/db/types";
import { SpotifyPlatform } from "@/platforms";

// eslint-disable-next-line @typescript-eslint/no-require-imports
// const twilio = require("twilio");

// const accountSid = twilioAdmin.accountSid;
// const authToken = twilioAdmin.authToken;
// const fromNumber = twilioAdmin.phoneNumber;
// const client = twilio(accountSid, authToken);

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
  platformUserId: string;
  platform: Platform;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  platformOfEchoSession: Platform;
  trackId: string;
  trackAlbumImageUrl: string;
};

const NUM_SONGS_PER_PLAYLIST = 10;

export const generatePlaylistsTask = schedules.task({
  id: "generate-playlists",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute

  cron: {
    // echo sessions are every Tues and Fri at 6:00 PM
    pattern: "30 18 * * 3,7", // run every Wed and Sun at 6:30 PM EST
    timezone: "America/New_York",
    environments: ["DEVELOPMENT"],
  },

  run: async () => {
    logger.log("generate playlists task starting ...");

    const { ok, data, error } = await getEchoSessionAndUsers();

    if (!ok) {
      logger.error("error getting echo session and users", { error });
      throw error;
    }

    if (!data) {
      logger.error("no data returned from getEchoSessionAndUsers", { error });
      throw error;
    }

    const { userSongData, echoSessionId, playlistDate } = data;

    logger.log("echo session and users fetched", {
      numUsers: userSongData.length,
      echoSessionId,
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
      } = await getUserFriends(user.userId);

      if (!ok) {
        // logger.error("error getting user's friends", { user, error });
        usersThatEncounteredErrors[user.userId] ??= [];
        usersThatEncounteredErrors[user.userId].push(error);
        continue;
      }

      logger.log("user's friends fetched", { userFriendData });

      playlists[user.userId] = await compilePlaylistSongs(
        user.platform,
        userFriendData,
        userSongLookup,
        userToPlatformOfEchoSessionLookup,
        NUM_SONGS_PER_PLAYLIST,
      );

      if (playlists[user.userId].length === 0) {
        // logger.error("no songs to add to playlist for user", { user });
        usersThatEncounteredErrors[user.userId] ??= [];
        usersThatEncounteredErrors[user.userId].push(
          "compileSongs() found 0 songs to add to playlist",
        );
        continue;
      }

      const playlistNameAbbreviation = user.firstName.endsWith("s")
        ? "'"
        : "'s";

      const playlistName = `${user.firstName}${playlistNameAbbreviation} echo ${playlistDate}`;
      const playlistDescription = `here are the songs your friends shared for the ${playlistDate} echo`;

      const {
        ok: createPlaylistOk,
        data: playlistData,
        error: createPlaylistError,
      } = await createPlaylistOnPlatformForUser(
        user,
        playlistName,
        playlistDescription,
        playlistDate,
      );

      if (!createPlaylistOk) {
        // logger.error("error creating playlist", { user, createPlaylistError });
        usersThatEncounteredErrors[user.userId] ??= [];
        usersThatEncounteredErrors[user.userId].push(createPlaylistError);
        continue;
      }

      if (!playlistData) {
        // logger.error("no data returned from createPlaylist", {
        //   user,
        //   playlistData,
        // });
        usersThatEncounteredErrors[user.userId] ??= [];
        usersThatEncounteredErrors[user.userId].push(
          "no data returned from createPlaylist()",
        );
        continue;
      }

      const { ok: populatePlaylistOk, error: populatePlaylistError } =
        await populatePlatformPlaylist(
          user,
          playlists[user.userId].map((song) => song[1][0]),
          playlistData.playlistId,
        );

      if (!populatePlaylistOk) {
        // logger.error("error populating playlist", {
        //   user,
        //   populatePlaylistError,
        // });
        usersThatEncounteredErrors[user.userId] ??= [];
        usersThatEncounteredErrors[user.userId].push(populatePlaylistError);
        continue;
      }

      /* 
      this matches how Spotify generates playlist images - uses first 4 track 
      album images or first track album image if less than 4
      
      we need to track this ourselves because, once we generate a playlist, we
      do not get back the playlist image url since it's initially empty
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
        sessionId: echoSessionId,
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
    await textUsersPlaylists(
      playlistRecords,
      userSongData,
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
const getEchoSessionAndUsers = async () => {
  try {
    // get most recent echo session
    const [echoSession] = await db
      .select({ id: echoSessions.id, start: echoSessions.start })
      .from(echoSessions)
      .orderBy(desc(echoSessions.start))
      .limit(1);

    if (!echoSession) {
      throw new Error("no echo session found");
    }

    const playlistDate = new Date(echoSession.start).toLocaleDateString(
      "en-US",
      {
        month: "2-digit",
        day: "2-digit",
      },
    );

    // get all users that submitted a song in the last session (userId, phoneNumber, trackId)
    // FIXME: fix shape of selected data
    const userSongData = (await db
      .select({
        userId: userEchoSessions.userId,
        firstName: users.firstName,
        phoneNumber: users.phoneNumber,
        platform: users.platform,
        platformUserId: userAuth.platformUserId,

        accessToken: userAuth.accessToken,
        refreshToken: userAuth.refreshToken,
        tokenExpiresAt: userAuth.tokenExpiresAt,

        platformOfEchoSession: userEchoSessions.platform,
        trackId: userEchoSessions.trackId,
        trackAlbumImageUrl: userEchoSessions.trackAlbumImageUrl,

        // users: {
        //   platform: users.platform,
        //   firstName: users.firstName,
        //   phoneNumber: users.phoneNumber,
        //   platformUserId: userAuth.platformUserId,
        //   accessToken: userAuth.accessToken,
        //   refreshToken: userAuth.refreshToken,
        //   tokenExpiresAt: userAuth.tokenExpiresAt,
        // },
      })
      .from(userEchoSessions)
      .innerJoin(users, eq(userEchoSessions.userId, users.id))
      .innerJoin(userAuth, eq(userAuth.userId, users.id))
      .where(
        and(
          eq(userEchoSessions.sessionId, echoSession.id),
          isNotNull(userEchoSessions.trackId),
        ),
      )) as UserSongData[];

    if (userSongData.length === 0) {
      throw new Error(`no users found for echo session ${echoSession.id}`);
    }

    return {
      ok: true,
      data: { userSongData, echoSessionId: echoSession.id, playlistDate },
      error: null,
    };
  } catch (error) {
    return { ok: false, data: null, error: error };
  }
};

const getUserFriends = async (userId: number) => {
  try {
    const userFriendData = await db
      .select({ friendId: friends.friendId })
      .from(friends)
      .where(eq(friends.userId, userId));

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
  const playlist: Array<[number, [string, string]]> = []; // [friendId, [trackId, trackAlbumImageUrl]]

  for (const friendId of userFriendData) {
    const [friendSongTrackId, friendSongAlbumImageUrl] =
      userSongLookup[friendId];
    const friendSongPlatformOfEchoSession =
      userToPlatformOfEchoSessionLookup[friendId];

    if (!friendSongTrackId || !friendSongAlbumImageUrl) continue;

    // FIXME: use set instead of array
    if (playlist.map((p) => p[1][0]).includes(friendSongTrackId)) continue;

    if (playlist.length === numSongsPerPlaylist) break;

    playlist.push([
      friendId,
      [
        await matchFriendSongToUserPlatform(
          userPlatform,
          friendSongPlatformOfEchoSession,
          friendSongTrackId,
        ),
        friendSongAlbumImageUrl,
      ],
    ]);
  }

  return playlist;
};

const createPlaylistOnPlatformForUser = async (
  user: UserSongData,
  playlistName: string,
  playlistDescription: string,
  playlistDate: string,
) => {
  if (user.platform === "spotify") {
    return await createSpotifyPlaylistForUser(
      user,
      playlistName,
      playlistDescription,
      playlistDate,
    );
  } else if (user.platform === "apple-music") {
    return await createAppleMusicPlaylistForUser(
      user,
      playlistName,
      playlistDescription,
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
      userId: user.userId,
      refreshToken: user.refreshToken,
    });

    if (!refreshTokensOk) {
      // logger.error("error refreshing spotify token", {
      //   user,
      //   refreshTokensError,
      // });
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
    // logger.error("error creating playlist", { user, createPlaylistError });
    return { ok: false, data: null, error: createPlaylistError };
  }

  return { ok: true, data: createPlaylistData, error: null };
};

const createAppleMusicPlaylistForUser = async (
  user: UserSongData,
  playlistName: string,
  playlistDescription: string,
) => {
  return { ok: true, data: null, error: null };
};

const populatePlatformPlaylist = async (
  user: UserSongData,
  songs: string[],
  playlistId: string,
) => {
  if (user.platform === "spotify") {
    const songURIs = songs.map((song) => `spotify:track:${song}`);

    return await SpotifyPlatform.populatePlaylist({
      accessToken: user.accessToken,
      trackURIs: songURIs,
      playlistId: playlistId,
    });
  } else if (user.platform === "apple-music") {
    return {
      ok: false,
      error:
        "platform apple-music not implemented in populatePlatformPlaylist()",
    };
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

const textUsersPlaylists = async (
  playlists: PlaylistRecords,
  userSongData: UserSongData[],
  usersThatEncounteredErrors: Record<number, (string | unknown)[]>,
) => {
  for (const playlist of playlists) {
    if (usersThatEncounteredErrors[playlist.userId]) {
      continue;
    }

    const userPhoneNumber = userSongData.find(
      (user) => user.userId === playlist.userId,
    )?.phoneNumber;

    if (!userPhoneNumber) {
      // logger.error("phone number not found for user", {
      //   playlist,
      //   userSongData,
      // });
      usersThatEncounteredErrors[playlist.userId] ??= [];
      usersThatEncounteredErrors[playlist.userId].push(
        "NO TEXT send to user because phone number not found",
      );
      continue;
    }

    let playlistLink = "";

    switch (playlist.platform) {
      case "spotify":
        playlistLink = `https://open.spotify.com/playlist/${playlist.platformPlaylistId}`;
        break;
      case "apple-music":
        playlistLink = `https://music.apple.com/playlist/${playlist.platformPlaylistId}`;
        break;
    }

    // const message = await client.messages.create({
    //   body: `
    //   ${playlistLink}
    //   `,
    //   from: fromNumber,
    //   to: userPhoneNumber,
    // });

    const message = "";

    logger.log("texted user their playlist", {
      userId: playlist.userId,
      playlistLink,
      message,
    });
  }
};

const matchFriendSongToUserPlatform = async (
  userPlatform: Platform,
  songSubmittedPlatform: Platform,
  submittedSong: string,
) => {
  if (userPlatform === songSubmittedPlatform) {
    return submittedSong;
  }

  return convertSong(submittedSong, userPlatform);
};

// TODO: use SongLink API to convert song to target user platform
const convertSong = async (song: string, platform: Platform) => {
  throw new Error(`Not implemented: convertSong for ${platform}`);
};
