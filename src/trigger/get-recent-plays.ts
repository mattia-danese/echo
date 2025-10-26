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

    for (const user of data) {
      if (user.platform === Platform.SPOTIFY) {
        if (!user.accessToken || !user.refreshToken || !user.tokenExpiresAt) {
          logger.error("missing spotify tokens", { user });
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
          logger.error("error handling spotify user", {
            user,
            handleSpotifyUserError,
          });
        }
      } else if (user.platform === Platform.APPLE_MUSIC) {
        if (!user.accessToken) {
          logger.error("missing apple music access token", { user });
          continue;
        }

        const { ok: handleAppleMusicUserOk, error: handleAppleMusicUserError } =
          await handleAppleMusicUser(user.userId, user.accessToken);

        if (!handleAppleMusicUserOk) {
          logger.error("error handling apple music user", {
            user,
            handleAppleMusicUserError,
          });
        }
      } else {
        logger.error("invalid platform", { user });
      }
    }

    return {
      message: `get recent plays task completed`,
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
      sampleTrack: trackPlays[0], // Log first track for debugging
    });

    // Try to insert tracks one by one to identify which one fails
    for (let i = 0; i < trackPlays.length; i++) {
      try {
        await db.insert(userTrackPlays).values([trackPlays[i]]);
        logger.log(
          `Successfully inserted track ${i + 1}/${trackPlays.length}`,
          {
            trackId: trackPlays[i].trackId,
            trackName: trackPlays[i].trackName,
          },
        );
      } catch (singleTrackError: unknown) {
        logger.error(`Failed to insert track ${i + 1}/${trackPlays.length}`, {
          trackIndex: i,
          track: trackPlays[i],
          error: singleTrackError,
          errorMessage:
            singleTrackError instanceof Error
              ? singleTrackError.message
              : String(singleTrackError),
          errorStack:
            singleTrackError instanceof Error
              ? singleTrackError.stack
              : undefined,
        });
        throw singleTrackError; // Re-throw to maintain original behavior
      }
    }

    return { ok: true, error: null };
  } catch (error: unknown) {
    // Log detailed error information
    logger.error("Database insertion failed", {
      userId,
      trackCount: trackPlays.length,
      error: error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      sampleTrack: trackPlays[0], // Log first track for debugging
      allTracks: trackPlays, // Log all tracks for debugging
    });

    return { ok: false, error: error };
  }
};
