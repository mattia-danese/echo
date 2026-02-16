import { logger } from "@trigger.dev/sdk/v3";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  friends,
  playlistSongs,
  playlists,
  songLinkCacheMappings,
  userAuth,
  userEchoSessions,
  users,
} from "@/db/schema";
import { AppleMusicPlatform } from "@/platforms/apple_music_platform";
import { SpotifyPlatform } from "@/platforms/spotify_platform";
import type { FriendSong } from "@/trigger/generate-playlists";
import { sendMessagesTask } from "@/trigger/send-messages";
import { CONTACT_CARD_PLACEHOLDER, Platform } from "@/types";

export type PlaylistUser = {
  userId: number;
  firstName: string;
  phoneNumber: string;
  friendLinkToken: string;
  platform: Platform;

  platformUserId: string | null;
  accessToken: string | null;

  platformOfEchoSession: Platform;
  trackId: string;
  trackAlbumImageUrl: string;

  sendContactCard: boolean;
  firstSharedSessionId: number; // Used to identify onboarding users
  hasLessThanThreeFriendsAfterTwoEchoes?: boolean; // Only computed for regular users
};

export type LowFriendsNoShareUser = {
  userId: number;
  phoneNumber: string;
  friendLinkToken: string;
};

export type PlaylistRecord = {
  userId: number;
  platform: Platform;
  sessionId: number;
  platformPlaylistId: string;
  playlistName: string;
  playlistImageUrl: string;
  isGeneric?: boolean;
};

export type PlaylistSongRecord = {
  playlistId: number;
  trackId: string;
  submittedByUserId: number;
  platformPlaylistId: string;
};

/**
 * Get ALL users who shared a song in the given echo session (regular + onboarding).
 */
export const getAllUsersWhoSharedSongs = async (
  echoSessionId: number,
): Promise<{
  ok: boolean;
  data: PlaylistUser[];
  error: unknown;
}> => {
  try {
    const userData = await db
      .select({
        // user data
        userId: userEchoSessions.userId,
        firstName: users.firstName,
        phoneNumber: users.phoneNumber,
        friendLinkToken: users.friendLinkToken,
        platform: users.platform,

        // auth data (apple music only)
        platformUserId: userAuth.platformUserId,
        accessToken: userAuth.accessToken,

        // shared song data
        platformOfEchoSession: userEchoSessions.platform,
        trackId: userEchoSessions.trackId,
        trackAlbumImageUrl: userEchoSessions.trackAlbumImageUrl,

        // extra
        firstSharedSessionId: users.firstSharedSessionId,
        sendContactCard: eq(users.firstSharedSessionId, echoSessionId),
        hasLessThanThreeFriendsAfterTwoEchoes: sql<boolean>`
          CASE 
            WHEN ${users.firstSharedSessionId} != ${echoSessionId} THEN
              (
                (SELECT COUNT(*) FROM ${userEchoSessions} WHERE ${userEchoSessions.userId} = ${users.id}) = 2
                AND
                (SELECT COUNT(*) FROM ${friends} WHERE ${friends.userId} = ${users.id} AND ${friends.active} = true) < 3
              )
            ELSE false
          END
        `.as("has_less_than_three_friends_after_two_echoes"),
      })
      .from(userEchoSessions)
      .innerJoin(users, eq(userEchoSessions.userId, users.id))
      .leftJoin(userAuth, eq(userAuth.userId, users.id))
      .where(
        and(
          eq(userEchoSessions.sessionId, echoSessionId),
          eq(users.isDeleted, false),
          isNotNull(userEchoSessions.trackId), // Only users who shared
        ),
      );

    return {
      ok: true,
      data: userData as PlaylistUser[],
      error: null,
    };
  } catch (error) {
    return { ok: false, data: [], error };
  }
};

/**
 * Get users who did NOT share a song in the given echo session,
 * have less than 3 friends, and this is their second echo session.
 * These users will receive a reminder to invite more friends.
 */
export const getLowFriendsNoShareUsers = async (
  echoSessionId: number,
): Promise<{
  ok: boolean;
  data: LowFriendsNoShareUser[];
  error: unknown;
}> => {
  try {
    const userData = await db
      .select({
        userId: userEchoSessions.userId,
        phoneNumber: users.phoneNumber,
        friendLinkToken: users.friendLinkToken,
      })
      .from(userEchoSessions)
      .innerJoin(users, eq(userEchoSessions.userId, users.id))
      .where(
        and(
          eq(userEchoSessions.sessionId, echoSessionId),
          eq(users.isDeleted, false),
          // Track ID is null (didn't share)
          sql`${userEchoSessions.trackId} IS NULL`,
          // This is their second session
          sql`(SELECT COUNT(*) FROM ${userEchoSessions} WHERE ${userEchoSessions.userId} = ${users.id}) = 2`,
          // They have less than 3 active friends
          sql`(SELECT COUNT(*) FROM ${friends} WHERE ${friends.userId} = ${users.id} AND ${friends.active} = true) < 3`,
        ),
      );

    return {
      ok: true,
      data: userData,
      error: null,
    };
  } catch (error) {
    return { ok: false, data: [], error };
  }
};

export const createUserToSongLookupTable = (userData: PlaylistUser[]) => {
  // userId -> [trackId, trackAlbumImageUrl]
  const userToSongLookup: Record<number, [string, string]> = {};

  for (const user of userData) {
    userToSongLookup[user.userId] = [user.trackId, user.trackAlbumImageUrl];
  }

  return userToSongLookup;
};

export const createUserToPlatformOfSharedSongLookupTable = (
  userData: PlaylistUser[],
) => {
  // userId -> platformOfEchoSession
  const userToPlatformOfEchoSessionLookup: Record<number, Platform> = {};

  for (const user of userData) {
    userToPlatformOfEchoSessionLookup[user.userId] = user.platformOfEchoSession;
  }

  return userToPlatformOfEchoSessionLookup;
};

/**
 * Get ALL friend relationships for a list of users.
 * This eliminates N+1 queries by fetching all friendships at once.
 * Returns a lookup table: userId -> [friendId1, friendId2, ...]
 * Friends who didn't share will be filtered out naturally when looking up their songs.
 */
export const getUserFriendships = async (
  userIds: number[],
): Promise<{
  ok: boolean;
  data: Record<number, number[]>;
  error: unknown;
}> => {
  try {
    if (userIds.length === 0) {
      return { ok: true, data: {}, error: null };
    }

    // Fetch all active friend relationships for these users
    const friendships = await db
      .select({
        userId: friends.userId,
        friendId: friends.friendId,
      })
      .from(friends)
      .where(
        and(
          inArray(friends.userId, userIds),
          eq(friends.active, true),
          eq(friends.muted, false),
        ),
      );

    // Build lookup table: userId -> [friendId1, friendId2, ...]
    const friendshipLookup: Record<number, number[]> = {};

    for (const friendship of friendships) {
      if (!friendshipLookup[friendship.userId]) {
        friendshipLookup[friendship.userId] = [];
      }
      friendshipLookup[friendship.userId].push(friendship.friendId);
    }

    return {
      ok: true,
      data: friendshipLookup,
      error: null,
    };
  } catch (error) {
    logger.error("ERROR IN getUserFriendships", { error, userIds });
    return { ok: false, data: {}, error };
  }
};

export const compilePlaylist = async (
  userData: PlaylistUser[],
  userPlatform: Platform,
  friends: number[],
  numSongsPerPlaylist: number,
) => {
  const playlist: Set<FriendSong> = new Set();

  if (!friends || friends.length === 0) {
    return playlist;
  }

  for (const friend of friends) {
    if (playlist.size === numSongsPerPlaylist) break;

    const friendData = userData.find((u) => u.userId === friend);

    if (!friendData) continue;
    if (!friendData.trackId || !friendData.trackAlbumImageUrl) continue;

    if (userPlatform !== friendData.platform) {
      const { ok: convertTrackOk, trackId: convertedTrackId } =
        await convertTrack(friendData.trackId, userPlatform);

      if (!convertTrackOk || !convertedTrackId) continue;

      playlist.add([friend, [convertedTrackId, friendData.trackAlbumImageUrl]]);
    } else {
      playlist.add([
        friend,
        [friendData.trackId, friendData.trackAlbumImageUrl],
      ]);
    }
  }

  return playlist;
};

/**
 * Compile playlist for onboarding users using friends' songs from ANY previous session.
 * This is a fallback when friends haven't shared in the current session.
 */
export const compileOnboardingFallbackPlaylist = async (
  userPlatform: Platform,
  friendIds: number[],
  maxSongs: number,
): Promise<Set<FriendSong>> => {
  const playlist: Set<FriendSong> = new Set();

  if (!friendIds || friendIds.length === 0) {
    return playlist;
  }

  // Get the most recent song each friend has EVER shared
  const friendsSongs = await db
    .select({
      userId: userEchoSessions.userId,
      trackId: userEchoSessions.trackId,
      trackAlbumImageUrl: userEchoSessions.trackAlbumImageUrl,
      platform: userEchoSessions.platform,
      createdAt: userEchoSessions.createdAt,
    })
    .from(userEchoSessions)
    .where(
      and(
        inArray(userEchoSessions.userId, friendIds),
        isNotNull(userEchoSessions.trackId),
      ),
    )
    .orderBy(desc(userEchoSessions.createdAt)); // Most recent first

  // Group by userId and take the most recent song per friend
  const latestSongPerFriend = new Map<number, (typeof friendsSongs)[0]>();
  for (const song of friendsSongs) {
    if (!latestSongPerFriend.has(song.userId)) {
      latestSongPerFriend.set(song.userId, song);
    }
  }

  // Build playlist (already in recency order from the query)
  for (const [friendId, friendSong] of latestSongPerFriend) {
    if (playlist.size >= maxSongs) break;
    if (!friendSong.trackId || !friendSong.trackAlbumImageUrl) continue;

    // Convert track if platforms differ
    if (userPlatform !== friendSong.platform) {
      const { ok, trackId: convertedTrackId } = await convertTrack(
        friendSong.trackId,
        userPlatform,
      );

      if (ok && convertedTrackId) {
        playlist.add([
          friendId,
          [convertedTrackId, friendSong.trackAlbumImageUrl],
        ]);
      }
    } else {
      playlist.add([
        friendId,
        [friendSong.trackId, friendSong.trackAlbumImageUrl],
      ]);
    }
  }

  return playlist;
};

const convertTrack = async (trackId: string, platform: Platform) => {
  try {
    const sourceMapping = alias(songLinkCacheMappings, "source");
    const targetMapping = alias(songLinkCacheMappings, "target");

    const [result] = await db
      .select({ trackId: targetMapping.trackId })
      .from(sourceMapping)
      .innerJoin(
        targetMapping,
        eq(sourceMapping.songlinkCacheId, targetMapping.songlinkCacheId),
      )
      .where(
        and(
          eq(sourceMapping.trackId, trackId),
          eq(targetMapping.platform, platform),
        ),
      )
      .limit(1);

    if (!result) {
      return {
        ok: false,
        trackId: null,
        error: `Track conversion failed for trackId ${trackId} to ${platform}`,
      };
    }

    return { ok: true, trackId: result.trackId, error: null };
  } catch (error) {
    return { ok: false, trackId: null, error: error };
  }
};

export const createPlaylistOnPlatformForUser = async (
  userFirstName: string,
  userPlatform: Platform,
  userPlatformUserId: string | null, // only for spotify
  userAccessToken: string,
  playlistDate: string,
  songs: string[],
) => {
  const playlistNameAbbreviation = userFirstName.endsWith("s") ? "'" : "'s";

  const playlistName = `${userFirstName}${playlistNameAbbreviation} echo ${playlistDate}`;

  const playlistDescription = `here are the songs your friends shared for the ${playlistDate} echo`;

  if (userPlatform === Platform.SPOTIFY) {
    const {
      ok: createPlaylistOk,
      data: createPlaylistData,
      error: createPlaylistError,
    } = await SpotifyPlatform.createPlaylist({
      userId: userPlatformUserId as string,
      accessToken: userAccessToken,
      playlistName: playlistName,
      playlistDescription: playlistDescription,
      playlistDate: playlistDate,
    });

    if (!createPlaylistOk) {
      return { ok: false, data: null, error: createPlaylistError };
    }

    const { ok: populatePlaylistOk, error: populatePlaylistError } =
      await populatePlatformPlaylist(
        userPlatform,
        userAccessToken,
        songs,
        createPlaylistData?.playlistId as string,
      );

    if (!populatePlaylistOk) {
      return { ok: false, data: null, error: populatePlaylistError };
    }

    return {
      ok: true,
      data: {
        playlistId: createPlaylistData?.playlistId as string,
        playlistName: playlistName,
      },
      error: null,
    };
  } else if (userPlatform === Platform.APPLE_MUSIC) {
    const {
      ok: createPlaylistOk,
      data: createPlaylistData,
      error: createPlaylistError,
    } = await AppleMusicPlatform.createAndPopulatePlaylist({
      accessToken: userAccessToken,
      playlistName: playlistName,
      playlistDescription: playlistDescription,
      playlistDate: playlistDate,
      songs: songs,
    });

    if (!createPlaylistOk) {
      return { ok: false, data: null, error: createPlaylistError };
    }

    return {
      ok: true,
      data: {
        playlistId: createPlaylistData?.playlistId as string,
        playlistName: playlistName,
      },
      error: null,
    };
  }

  return {
    ok: false,
    data: null,
    error: `invalid platform ${userPlatform}`,
  };
};

export const populatePlatformPlaylist = async (
  userPlatform: Platform,
  userAccessToken: string,
  songs: string[],
  playlistId: string,
) => {
  if (userPlatform === Platform.SPOTIFY) {
    const songURIs = songs.map((song) => `spotify:track:${song}`);

    return await SpotifyPlatform.populatePlaylist({
      accessToken: userAccessToken,
      trackURIs: songURIs,
      playlistId: playlistId,
    });
  }

  return {
    ok: false,
    error: `invalid platform ${userPlatform} in populatePlatformPlaylist()`,
  };
};

export const persistPlaylistsToDatabase = async (
  newPlaylists: PlaylistRecord[],
  newPlaylistSongs: PlaylistSongRecord[],
): Promise<{
  ok: boolean;
  error: unknown;
  skippedUserIds: number[];
}> => {
  try {
    if (newPlaylists.length === 0) {
      logger.info("no playlists to save to database, skipping");
      return { ok: true, error: null, skippedUserIds: [] };
    }

    logger.log("saving playlists to database", {
      numPlaylists: newPlaylists.length,
    });

    const playlistsInserted = await db
      .insert(playlists)
      .values(newPlaylists)
      .onConflictDoNothing()
      .returning({
        id: playlists.id,
        platformPlaylistId: playlists.platformPlaylistId,
      });

    const playlistIdByPlatformPlaylistId = new Map(
      playlistsInserted.map((r) => [r.platformPlaylistId, r.id]),
    );

    // Determine which playlists were skipped due to conflict
    const insertedPlatformIds = new Set(
      playlistsInserted.map((r) => r.platformPlaylistId),
    );
    const skippedPlaylists = newPlaylists.filter(
      (p) => !insertedPlatformIds.has(p.platformPlaylistId),
    );
    const skippedUserIds = skippedPlaylists.map((p) => p.userId);

    if (skippedPlaylists.length > 0) {
      logger.warn("some playlists were skipped due to conflict", {
        numSkipped: skippedPlaylists.length,
        skippedPlaylists,
      });
    }

    logger.log("saving playlists to database done", {
      numInserted: playlistsInserted.length,
      numSkipped: skippedPlaylists.length,
    });

    // Filter out playlist songs whose parent playlist was skipped
    const validPlaylistSongs = newPlaylistSongs.filter((ps) =>
      playlistIdByPlatformPlaylistId.has(ps.platformPlaylistId),
    );

    if (validPlaylistSongs.length > 0) {
      for (const playlistSong of validPlaylistSongs) {
        playlistSong.playlistId = playlistIdByPlatformPlaylistId.get(
          playlistSong.platformPlaylistId,
        ) as number;
      }

      logger.log("saving playlist songs to database");

      await db.insert(playlistSongs).values(validPlaylistSongs);

      logger.log("saving playlist songs to database done", {
        numPlaylistSongs: validPlaylistSongs.length,
      });
    } else {
      logger.log("no playlist songs to save (playlists are generic)");
    }

    return { ok: true, error: null, skippedUserIds };
  } catch (error) {
    return { ok: false, error: error, skippedUserIds: [] };
  }
};

export const textUsers = async (
  playlists: PlaylistRecord[],
  userData: PlaylistUser[],
  noShareSecondSessionUsers: {
    userId: number;
    phoneNumber: string;
    friendLinkToken: string;
  }[],
  userErrors: Record<number, (string | unknown)[]>,
  usersWithNoFriendSongs: number[],
) => {
  const data: Record<string, Array<string>> = {};

  const contactCardMessages: string[] = [
    "save our contact for easy access",
    CONTACT_CARD_PLACEHOLDER,
  ];

  for (const playlist of playlists) {
    // Skip users who encountered errors
    if (userErrors[playlist.userId]) {
      continue;
    }

    const user = userData.find((u) => u.userId === playlist.userId);

    if (!user) continue;
    if (!user.phoneNumber) continue;

    let playlistLink = "";

    switch (playlist.platform) {
      case Platform.SPOTIFY:
        playlistLink = SpotifyPlatform.createPlaylistLink(
          playlist.platformPlaylistId,
        );
        break;
      case Platform.APPLE_MUSIC:
        playlistLink = AppleMusicPlatform.createPlaylistLink(
          playlist.platformPlaylistId,
        );
        break;
    }

    const lowFriendsMessages: string[] = [
      "looks like you don't have many songs coming in :( invite more friends with your link",
      `https://text-echo.com/${user.friendLinkToken}`,
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
      `https://text-echo.com/${user.friendLinkToken}`,
    ];
  }

  for (const userId of usersWithNoFriendSongs) {
    if (userErrors[userId]) continue;

    const user = userData.find((u) => u.userId === userId);
    if (!user?.phoneNumber) continue;

    data[user.phoneNumber] = [
      "unfortunately none of your friends shared. great song though :)",
    ];
  }

  await sendMessagesTask.trigger({
    data: data,
  });
};
