import { logger, task } from "@trigger.dev/sdk/v3";
import { db } from "@/db";
import { userAuth, userTrackPlays } from "@/db/schema";
import { Platform } from "@/db/types";
import { AppleMusicPlatform, SpotifyPlatform } from "@/platforms";
import type { RecentTrackPlay, User } from "@/types";

export const getRecentPlaysTask = task({
  id: "get-recent-plays",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute

  run: async (payload: { user?: User }) => {
    logger.log("get recent plays task starting ...");

    const data = payload.user
      ? [payload.user]
      : await db
          .select({
            userId: userAuth.userId,
            platform: userAuth.platform,
            platformUserId: userAuth.platformUserId,
            accessToken: userAuth.accessToken,
            refreshToken: userAuth.refreshToken,
            tokenExpiresAt: userAuth.tokenExpiresAt,
          })
          .from(userAuth);

    logger.log("processing users", { numUsers: data.length });

    const errors: Array<{
      userId: number;
      platform: string;
      error: unknown;
      context?: string;
    }> = [];

    for (const user of data) {
      if (user.platform === Platform.SPOTIFY) {
        if (!user.accessToken || !user.refreshToken || !user.tokenExpiresAt) {
          errors.push({
            userId: user.userId,
            platform: Platform.SPOTIFY,
            error: "missing spotify tokens",
          });
          continue;
        }

        const { ok: handleSpotifyUserOk, error: handleSpotifyUserError } =
          await handleSpotifyUser(
            user.userId,
            user.accessToken,
            user.refreshToken,
            user.tokenExpiresAt,
          );

        if (!handleSpotifyUserOk) {
          errors.push({
            userId: user.userId,
            platform: Platform.SPOTIFY,
            error: handleSpotifyUserError,
            context: "error handling spotify user",
          });
        }
      } else if (user.platform === Platform.APPLE_MUSIC) {
        if (!user.accessToken) {
          errors.push({
            userId: user.userId,
            platform: Platform.APPLE_MUSIC,
            error: "missing apple music access token",
          });
          continue;
        }

        const { ok: handleAppleMusicUserOk, error: handleAppleMusicUserError } =
          await handleAppleMusicUser(user.userId, user.accessToken);

        if (!handleAppleMusicUserOk) {
          errors.push({
            userId: user.userId,
            platform: Platform.APPLE_MUSIC,
            error: handleAppleMusicUserError,
            context: "error handling apple music user",
          });
        }
      } else {
        errors.push({
          userId: user.userId,
          platform: user.platform,
          error: "invalid platform",
        });
      }
    }

    // Log all errors at the end for easy debugging
    if (errors.length > 0) {
      logger.error("Task completed with errors", {
        totalUsers: data.length,
        successfulUsers: data.length - errors.length,
        failedUsers: errors.length,
      });

      // Log each error individually for visibility
      for (const errorEntry of errors) {
        logger.error(`Failed for user ${errorEntry.userId}`, {
          userId: errorEntry.userId,
          platform: errorEntry.platform,
          context: errorEntry.context,
          error: errorEntry.error,
          errorMessage:
            errorEntry.error instanceof Error
              ? errorEntry.error.message
              : String(errorEntry.error),
        });
      }

      // Throw to mark run as failed in dashboard
      throw new Error(
        `Task failed for ${errors.length} out of ${data.length} user(s). Check logs above for details.`,
      );
    }

    logger.log("Task completed successfully", { totalUsers: data.length });
    return {
      message: `get recent plays task completed successfully for ${data.length} user(s)`,
    };
  },
});

const handleSpotifyUser = async (
  userId: number,
  accessToken: string,
  refreshToken: string,
  tokenExpiresAt: string,
) => {
  // refresh spotify access token if it's expired
  if (new Date(tokenExpiresAt) < new Date()) {
    logger.log("spotify token expired, refreshing ...", { userId });

    const {
      ok: refreshTokensOk,
      data: refreshTokensData,
      error: refreshTokensError,
    } = await SpotifyPlatform.refreshTokens({
      userId: userId,
      refreshToken: refreshToken,
    });

    if (!refreshTokensOk) {
      logger.error("error refreshing spotify token", {
        userId,
        refreshTokensError,
      });
      return { ok: false, error: refreshTokensError };
    }

    if (!refreshTokensData) {
      logger.error("no data returned from refreshAccessToken", {
        userId,
        refreshTokensData,
      });
      return { ok: false, error: `no data returned from refreshAccessToken` };
    }

    accessToken = refreshTokensData.accessToken;
    refreshToken = refreshTokensData.refreshToken;
    tokenExpiresAt = refreshTokensData.expiresIn;

    logger.log("user update complete", { userId });
  }

  logger.log("getting recent plays", { userId });

  const {
    ok: recentPlaysOk,
    data: recentPlaysData,
    error: recentPlaysError,
  } = await SpotifyPlatform.getRecentTracks({
    userId: userId,
    accessToken: accessToken,
    platform: Platform.SPOTIFY,
  });

  if (!recentPlaysOk) {
    logger.error("error getting recent plays", { userId, recentPlaysError });
    return { ok: false, error: recentPlaysError };
  }

  if (!recentPlaysData) {
    logger.error("no data returned from getRecentPlays", {
      userId,
      recentPlaysData,
    });
    return { ok: false, error: `no data returned from getRecentPlays` };
  }

  logger.log("recent plays fetched", { recentPlaysData });

  const { ok: storeTracksOk, error: storeTracksError } = await storeTracks(
    recentPlaysData.tracks,
    userId,
  );

  if (!storeTracksOk) {
    logger.error("error storing recent plays", { userId, storeTracksError });
    return { ok: false, error: storeTracksError };
  }

  logger.log("stored recent plays");

  return { ok: true, error: null };
};

const handleAppleMusicUser = async (userId: number, accessToken: string) => {
  logger.log("getting recent plays", { userId });

  const {
    ok: recentPlaysOk,
    data: recentPlaysData,
    error: recentPlaysError,
  } = await AppleMusicPlatform.getRecentTracks(userId, accessToken);

  if (!recentPlaysOk) {
    logger.error("error getting recent plays", { userId, recentPlaysError });
    return { ok: false, error: recentPlaysError };
  }

  if (!recentPlaysData) {
    logger.error("no data returned from getRecentPlays", {
      userId,
      recentPlaysData,
    });
    return { ok: false, error: `no data returned from getRecentPlays` };
  }

  logger.log("recent plays fetched", { recentPlaysData });

  const { ok: storeTracksOk, error: storeTracksError } = await storeTracks(
    recentPlaysData.tracks,
    userId,
  );

  if (!storeTracksOk) {
    logger.error("error storing recent plays", { userId, storeTracksError });
    return { ok: false, error: storeTracksError };
  }

  logger.log("stored recent plays");

  return { ok: true, error: null };
};

const storeTracks = async (trackPlays: RecentTrackPlay[], userId: number) => {
  try {
    logger.log("Attempting to store tracks", {
      userId,
      trackCount: trackPlays.length,
    });

    // Bulk insert all tracks, skipping duplicates
    await db.insert(userTrackPlays).values(trackPlays).onConflictDoNothing();

    logger.log("Successfully stored tracks", {
      userId,
      trackCount: trackPlays.length,
    });

    return { ok: true, error: null };
  } catch (error: unknown) {
    // Log detailed error information - this should rarely happen
    // as duplicates are handled by onConflictDoNothing
    logger.error("Database insertion failed", {
      userId,
      trackCount: trackPlays.length,
      error: error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    return { ok: false, error: error };
  }
};
