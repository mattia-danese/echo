import * as Sentry from "@sentry/nextjs";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import { isSameDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { echoSessions } from "@/db/schema";
import { Platform } from "@/db/types";
import { SpotifyPlatform } from "@/platforms";

import {
  compileOnboardingFallbackPlaylist,
  compilePlaylist,
  createPlaylistOnPlatformForUser,
  getAllUsersWhoSharedSongs,
  getLowFriendsNoShareUsers,
  getUserFriendships,
  type PlaylistRecord,
  type PlaylistSongRecord,
  persistPlaylistsToDatabase,
  textUsers,
} from "@/trigger/utils/playlist-helpers";
import { createNewEchoSessionTask } from "./create-new-echo-session";

export type FriendSong = [
  friendId: number,
  trackData: [trackId: string, albumImageUrl: string],
];

const NUM_SONGS_PER_PLAYLIST = 10;

// Generic onboarding playlists (pre-made, one per platform)
const GENERIC_ONBOARDING_PLAYLISTS = {
  [Platform.SPOTIFY]: {
    id: "2KLJ5yYkos95iFVIAPH95e",
    name: "your first echo",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b27372296030f87da7500d01e113",
  },
  [Platform.APPLE_MUSIC]: {
    id: "pl.u-NpXmzeWFljKPga",
    name: "your first echo",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b27372296030f87da7500d01e113",
  },
};

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

    // Check if we should run today by checking if a session ends today
    const [echoSession] = await db
      .select({ id: echoSessions.id, end: echoSessions.end })
      .from(echoSessions)
      .orderBy(desc(echoSessions.createdAt))
      .limit(1);

    if (!echoSession) {
      logger.log("Skipping execution - no sessions found in database");
      return { message: "Skipped - no sessions found" };
    }

    const sessionEndDate = new Date(echoSession.end);
    const now = new Date();

    // Convert both dates to EST for comparison
    const timezone = "America/New_York";
    const sessionEndDateEST = toZonedTime(sessionEndDate, timezone);
    const nowEST = toZonedTime(now, timezone);

    const playlistDate = sessionEndDateEST.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    });

    // Check if the most recent session ends today (same calendar day in EST)
    if (!isSameDay(sessionEndDateEST, nowEST)) {
      logger.log("Skipping execution - no session ends today", {
        sessionEndDate: sessionEndDate.toISOString(),
        sessionEndDateEST: sessionEndDateEST.toISOString(),
        nowEST: nowEST.toISOString(),
      });
      return {
        message: "Skipped - no session ends today",
      };
    }

    logger.log("Executing - session ends today", {
      sessionEndDate: sessionEndDate.toISOString(),
    });

    const userErrors: Record<number, (string | unknown)[]> = {};
    const usersWithNoFriendSongs: number[] = [];
    const playlistRecords: PlaylistRecord[] = [];
    const playlistSongRecords: PlaylistSongRecord[] = [];

    // getting playlist data
    const userData = await getAllUsersWhoSharedSongs(echoSession.id);
    const lowFriendsNoShareUsers = await getLowFriendsNoShareUsers(
      echoSession.id,
    );

    if (!userData.ok) {
      logger.error("Failed to get users who shared songs", {
        error: userData.error,
      });
      throw new Error("Failed to get users who shared songs");
    }

    if (!lowFriendsNoShareUsers.ok) {
      logger.error("Failed to get low friends no share users", {
        error: lowFriendsNoShareUsers.error,
      });
      throw new Error("Failed to get low friends no share users");
    }

    const userFriendships = await getUserFriendships(
      userData.data.map((user) => user.userId),
    );

    if (!userFriendships.ok) {
      logger.error("Failed to get user friendships", {
        error: userFriendships.error,
      });
      throw new Error("Failed to get user friendships");
    }

    const userFriendshipsLookup = userFriendships.data;

    const {
      ok: spotifyAuthOk,
      data: spotifyAuthData,
      error: spotifyAuthError,
    } = await SpotifyPlatform.getValidToken();

    if (!spotifyAuthOk || !spotifyAuthData) {
      logger.error("Failed to get Spotify auth token", {
        error: spotifyAuthError,
      });
      throw new Error("Failed to get Spotify auth token");
    }

    const userToPlaylists: Record<number, Set<FriendSong>> = {};

    // compile playlists for each user
    for (const user of userData.data) {
      if (user.platform === Platform.SPOTIFY) {
        user.platformUserId = spotifyAuthData.userId;
        user.accessToken = spotifyAuthData.accessToken;
      }

      const friends = userFriendshipsLookup[user.userId] || [];

      const playlist = await compilePlaylist(
        userData.data,
        user.platform,
        friends,
        NUM_SONGS_PER_PLAYLIST,
      );

      if (playlist.size === 0 && user.firstSharedSessionId !== echoSession.id) {
        usersWithNoFriendSongs.push(user.userId);
      }

      if (playlist.size === 0) {
        continue;
      }

      userToPlaylists[user.userId] = playlist;
    }

    // Handle onboarding users who ended up with empty playlists (fallback logic)
    for (const user of userData.data) {
      // Skip if not onboarding user
      if (user.firstSharedSessionId !== echoSession.id) continue;
      // Skip if already has playlist
      if (userToPlaylists[user.userId]?.size > 0) continue;

      logger.log("onboarding user has no songs, trying fallback", {
        userId: user.userId,
      });

      // Fallback 1: Try to get friends' songs from ANY previous session
      try {
        const fallbackPlaylist = await compileOnboardingFallbackPlaylist(
          user.platform,
          userFriendshipsLookup[user.userId] ?? [],
          NUM_SONGS_PER_PLAYLIST,
        );

        if (fallbackPlaylist.size > 0) {
          userToPlaylists[user.userId] = fallbackPlaylist;

          logger.log("onboarding user fallback playlist created from history", {
            userId: user.userId,
            numSongs: fallbackPlaylist.size,
          });

          continue;
        }

        logger.log("onboarding user fallback playlist empty, trying generic", {
          userId: user.userId,
        });
      } catch (error) {
        userErrors[user.userId] ??= [];
        userErrors[user.userId].push(error);
        logger.error("Error creating onboarding fallback playlist", {
          userId: user.userId,
          error,
        });
      }

      // Fallback 2: Use generic pre-made playlist (just the link, no creation needed)
      const genericPlaylist = GENERIC_ONBOARDING_PLAYLISTS[user.platform];

      if (!genericPlaylist || !genericPlaylist.id) {
        userErrors[user.userId] ??= [];
        userErrors[user.userId].push(
          `No generic playlist configured for platform ${user.platform}`,
        );

        continue;
      }

      // Add PlaylistRecord directly (no need to create playlist on platform)
      playlistRecords.push({
        userId: user.userId,
        platform: user.platform,
        sessionId: echoSession.id,
        platformPlaylistId: genericPlaylist.id,
        playlistName: genericPlaylist.name,
        playlistImageUrl: genericPlaylist.imageUrl,
        isGeneric: true,
      });

      logger.log("onboarding user using generic playlist", {
        userId: user.userId,
        platform: user.platform,
        playlistId: genericPlaylist.id,
      });
    }

    // create and populate playlists for each user
    for (const [userId, userPlaylist] of Object.entries(userToPlaylists)) {
      const user = userData.data.find((user) => user.userId === Number(userId));

      const songs = Array.from(userPlaylist).map((song) => song[1][0]);

      if (!user) continue;

      const {
        ok: createPlaylistOk,
        data: createPlaylistData,
        error: createPlaylistError,
      } = await createPlaylistOnPlatformForUser(
        user.firstName,
        user.platform,
        user.platformUserId,
        user.accessToken as string,
        playlistDate,
        songs,
      );

      if (!createPlaylistOk) {
        userErrors[user.userId] ??= [];
        userErrors[user.userId].push(createPlaylistError);
        continue;
      }

      if (!createPlaylistData) {
        userErrors[user.userId] ??= [];
        userErrors[user.userId].push(
          `no data returned from createPlaylistOnPlatformForUser()`,
        );
        continue;
      }

      logger.log("playlist created", { user, createPlaylistData });

      const playlistSongsData = Array.from(userPlaylist);

      /* 
      this matches how Spotify generates playlist images - uses first 4 track 
      album images or first track album image if less than 4
      
      we need to track this ourselves because, once we generate a playlist, we
      do not get back the playlist image url since it's initially empty

      NOTE: Apple Music DOES provide playlist image url, but it is boring 
      */
      const playlistImageUrl =
        playlistSongsData.length >= 4
          ? playlistSongsData
              .slice(0, 4)
              .map((song) => song[1][1])
              .join("|")
          : playlistSongsData[0][1][1];

      playlistRecords.push({
        userId: user.userId,
        platform: user.platform,
        sessionId: echoSession.id,
        platformPlaylistId: createPlaylistData.playlistId,
        playlistName: createPlaylistData.playlistName,
        playlistImageUrl: playlistImageUrl,
      });

      playlistSongRecords.push(
        ...Array.from(userPlaylist).map((song) => ({
          playlistId: 0,
          trackId: song[1][0],
          submittedByUserId: song[0],
          platformPlaylistId: createPlaylistData.playlistId, // will not be persisted to database, just used to get Playlist.id in persistPlaylistsToDatabase
        })),
      );
    }

    logger.log("all playlist records and playlist song records", {
      numPlaylistRecords: playlistRecords.length,
      numPlaylistSongRecords: playlistSongRecords.length,
    });

    const { ok: persistPlaylistsOk, error: persistPlaylistsError } =
      await persistPlaylistsToDatabase(playlistRecords, playlistSongRecords);
    if (!persistPlaylistsOk) {
      logger.error("error persisting playlists to database", {
        persistPlaylistsError,
      });
      // throwing error here because we want to fail the task if we cannot persist playlists to database
      throw persistPlaylistsError;
    }

    logger.log("playlists persisted to database");

    // text each user their playlist
    await textUsers(
      playlistRecords,
      userData.data,
      lowFriendsNoShareUsers.data,
      userErrors,
      usersWithNoFriendSongs,
    );

    // Log all encountered errors
    if (Object.keys(userErrors).length > 0) {
      logger.error("errors encountered during generate playlists task", {
        userErrors,
      });

      // Serialize errors for Sentry (Error objects don't serialize to JSON)
      const serializableUserErrors: Record<number, unknown[]> = {};
      for (const [userId, errors] of Object.entries(userErrors)) {
        serializableUserErrors[Number(userId)] = errors.map((err) =>
          err instanceof Error
            ? { name: err.name, message: err.message, stack: err.stack }
            : err,
        );
      }

      // Manually capture in Sentry
      Sentry.captureException(
        new Error("errors encountered during generate playlists task"),
        {
          extra: { userErrors: serializableUserErrors },
        },
      );
    }

    await createNewEchoSessionTask.trigger();

    return {
      message: `generate playlists task completed`,
    };
  },
});
