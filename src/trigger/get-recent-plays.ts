import { logger, task } from "@trigger.dev/sdk/v3";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { SpotifyPlatform } from "@/platforms";
import type { RecentTrackPlay, User } from "@/types";

const supabase = supabaseAdmin;

export const getRecentPlaysTask = task({
  id: "get-recent-plays",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute

  run: async (payload: { user?: User }) => {
    logger.log("get recent plays task starting ...");

    let data = payload.user ? [payload.user] : [];

    if (!payload.user) {
      const { data: users, error } = await supabase.from("users").select(`
            id,
            platform,
            spotify_access_token, 
            spotify_refresh_token, 
            spotify_token_expires_at,
            apple_music_access_token,
            apple_music_refresh_token,
            apple_music_token_expires_at,
        `);

      if (error) {
        logger.error("error getting recent plays", { error });
        throw error;
      }

      if (!users) {
        logger.error("no users found");
        throw new Error("no users found");
      }

      data = users as unknown as User[];
    }

    for (const user of data) {
      if (user.platform === "spotify") {
        if (
          !user.spotify_access_token ||
          !user.spotify_refresh_token ||
          !user.spotify_token_expires_at
        ) {
          logger.error("missing spotify tokens", { user });
          continue;
        }

        const { ok: handleSpotifyUserOk, error: handleSpotifyUserError } =
          await handleSpotifyUser(
            user.id,
            user.spotify_access_token,
            user.spotify_refresh_token,
            user.spotify_token_expires_at,
          );

        if (!handleSpotifyUserOk) {
          logger.error("error handling spotify user", {
            user,
            handleSpotifyUserError,
          });
        }
      } else if (user.platform === "apple-music") {
        if (
          !user.apple_music_access_token ||
          !user.apple_music_refresh_token ||
          !user.apple_music_token_expires_at
        ) {
          logger.error("missing apple music tokens", { user });
          continue;
        }

        const { ok: handleAppleMusicUserOk, error: handleAppleMusicUserError } =
          await handleAppleMusicUser(
            user.id,
            user.apple_music_access_token,
            user.apple_music_refresh_token,
            user.apple_music_token_expires_at,
          );

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
  user_id: string,
  access_token: string,
  refresh_token: string,
  token_expires_at: string,
) => {
  // refresh spotify access token if it's expired
  if (new Date(token_expires_at) < new Date()) {
    logger.log("spotify token expired, refreshing ...", { user_id });

    const {
      ok: refreshTokensOk,
      data: refreshTokensData,
      error: refreshTokensError,
    } = await SpotifyPlatform.refreshTokens({
      user_id: user_id,
      refresh_token: refresh_token,
    });

    if (!refreshTokensOk) {
      logger.error("error refreshing spotify token", {
        user_id,
        refreshTokensError,
      });
      return { ok: false, error: refreshTokensError };
    }

    if (!refreshTokensData) {
      logger.error("no data returned from refreshAccessToken", {
        user_id,
        refreshTokensData,
      });
      return { ok: false, error: `no data returned from refreshAccessToken` };
    }

    access_token = refreshTokensData.access_token;
    refresh_token = refreshTokensData.refresh_token;
    token_expires_at = refreshTokensData.expires_in;

    logger.log("user update complete", { user_id });
  }

  logger.log("getting recent plays", { user_id });

  const {
    ok: recentPlaysOk,
    data: recentPlaysData,
    error: recentPlaysError,
  } = await SpotifyPlatform.getRecentTracks({
    user_id: user_id,
    access_token: access_token,
    platform: "spotify",
  });

  if (!recentPlaysOk) {
    logger.error("error getting recent plays", { user_id, recentPlaysError });
    return { ok: false, error: recentPlaysError };
  }

  if (!recentPlaysData) {
    logger.error("no data returned from getRecentPlays", {
      user_id,
      recentPlaysData,
    });
    return { ok: false, error: `no data returned from getRecentPlays` };
  }

  logger.log("recent plays fetched", { recentPlaysData });

  const { ok: storeTracksOk, error: storeTracksError } = await storeTracks(
    recentPlaysData.tracks,
    user_id,
  );

  if (!storeTracksOk) {
    logger.error("error storing recent plays", { user_id, storeTracksError });
    return { ok: false, error: storeTracksError };
  }

  logger.log("stored recent plays");

  return { ok: true, error: null };
};

const handleAppleMusicUser = async (
  user_id: string,
  user_access_token: string,
  refresh_token: string,
  token_expires_at: string,
) => {
  return { ok: false, error: "apple music auth not implemented yet" };
};

const refreshAppleMusicAccessToken = async (
  apple_music_refresh_token: string,
) => {
  return { data: null, error: null };
};

const getRecentAppleMusicPlays = async (apple_music_access_token: string) => {
  return { data: null, error: null };
};

const storeTracks = async (trackPlays: RecentTrackPlay[], user_id: string) => {
  const { error: writeRecentPlaysError } = await supabase
    .from("user_track_plays")
    .upsert(trackPlays, {
      onConflict: "user_id, track_id, played_at",
      ignoreDuplicates: true,
    });

  if (writeRecentPlaysError) {
    logger.error("error writing recent plays", {
      user_id,
      writeRecentPlaysError,
    });
    return { ok: false, error: writeRecentPlaysError };
  }

  return { ok: true, error: null };
};
