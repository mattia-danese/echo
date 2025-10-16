import { logger, task } from "@trigger.dev/sdk/v3";
import { db } from "@/db";
import { users, userTrackPlays } from "@/db/schema";
import { Platform } from "@/db/types";
import { SpotifyPlatform } from "@/platforms";
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
            id: users.id,
            platform: users.platform,
            spotifyAccessToken: users.spotifyAccessToken,
            spotifyRefreshToken: users.spotifyRefreshToken,
            spotifyTokenExpiresAt: users.spotifyTokenExpiresAt,
          })
          .from(users);

    logger.log("processing users", { numUsers: data.length });

    for (const user of data) {
      if (user.platform === "spotify") {
        if (
          !user.spotifyAccessToken ||
          !user.spotifyRefreshToken ||
          !user.spotifyTokenExpiresAt
        ) {
          logger.error("missing spotify tokens", { user });
          continue;
        }

        const { ok: handleSpotifyUserOk, error: handleSpotifyUserError } =
          await handleSpotifyUser(
            user.id,
            user.spotifyAccessToken,
            user.spotifyRefreshToken,
            user.spotifyTokenExpiresAt,
          );

        if (!handleSpotifyUserOk) {
          logger.error("error handling spotify user", {
            user,
            handleSpotifyUserError,
          });
        }
      } else if (user.platform === "apple-music") {
        logger.error("apple music auth not implemented yet", { user });
        // if (
        //   !user.appleMusicAccessToken ||
        //   !user.appleMusicRefreshToken ||
        //   !user.appleMusicTokenExpiresAt
        // ) {
        //   logger.error("missing apple music tokens", { user });
        //   continue;
        // }

        // const { ok: handleAppleMusicUserOk, error: handleAppleMusicUserError } =
        //   await handleAppleMusicUser(
        //     user.id,
        //     user.appleMusicAccessToken,
        //     user.appleMusicRefreshToken,
        //     user.appleMusicTokenExpiresAt,
        //   );

        // if (!handleAppleMusicUserOk) {
        //   logger.error("error handling apple music user", {
        //     user,
        //     handleAppleMusicUserError,
        //   });
        // }
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
      userId: userId.toString(),
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
    userId: userId.toString(),
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

const handleAppleMusicUser = async (
  userId: string,
  accessToken: string,
  refreshToken: string,
  tokenExpiresAt: string,
) => {
  return { ok: false, error: "apple music auth not implemented yet" };
};

const refreshAppleMusicAccessToken = async (appleMusicRefreshToken: string) => {
  return { data: null, error: null };
};

const getRecentAppleMusicPlays = async (appleMusicAccessToken: string) => {
  return { data: null, error: null };
};

const storeTracks = async (trackPlays: RecentTrackPlay[], userId: number) => {
  try {
    await db.insert(userTrackPlays).values(trackPlays);
    return { ok: true, error: null };
  } catch (error: unknown) {
    return { ok: false, error: error };
  }
};
