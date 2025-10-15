"use server";

import { db } from "@/db";
import { friends, userEchoSessions, users, userTrackPlays } from "@/db/schema";
import type { Platform } from "@/db/types";
import { isNameValid, isPhoneNumberValid } from "@/lib/validation";
import { SpotifyPlatform } from "@/platforms";
import {
  getRecentPlaysTask,
  onboardingCompletionTask,
  onboardingTask,
} from "@/trigger";
import { and, count, desc, eq, gte } from "drizzle-orm";
import crypto from "node:crypto";

export async function checkRegistrationData(payload: {
  first_name: string;
  last_name: string;
  phone_number: string;
}) {
  if (
    !isPhoneNumberValid(payload.phone_number) ||
    !payload.phone_number.trim()
  ) {
    return { ok: false, message: "phone number" };
  }

  if (!isNameValid(payload.first_name) || !payload.first_name.trim()) {
    return { ok: false, message: "first name" };
  }

  if (!isNameValid(payload.last_name) || !payload.last_name.trim()) {
    return { ok: false, message: "last name" };
  }

  return { ok: true, message: "User is valid" };
}

export async function createUser(payload: {
  first_name: string;
  last_name: string;
  phone_number: string;
  spotify_code: string;
  platform: string;
  referral_friend_link_token: string | null;
}) {
  try {
    // First, check if user already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNumber, payload.phone_number))
      .limit(1);

    if (existingUser) {
      // User already exists, return early
      return {
        ok: true,
        user_id: existingUser.id.toString(),
        onboarding_token: null,
        created: false,
        message: "User with this phone number already exists.",
      };
    }

    // User doesn't exist, make API call to get tokens from platform
    const {
      ok: platformAuthOk,
      data: platformAuthData,
      error: platformAuthError,
    } = await getPlatformAuth({
      platform: payload.platform,
      code: payload.spotify_code,
    });

    if (!platformAuthOk) {
      return {
        ok: false,
        user_id: null,
        onboarding_token: null,
        created: false,
        message: platformAuthError,
      };
    }

    if (!platformAuthData) {
      return {
        ok: false,
        user_id: null,
        onboarding_token: null,
        created: false,
        message: "No data returned from platform auth",
      };
    }

    const { access_token, refresh_token, expires_at, platform_user_id } =
      platformAuthData;

    const userAuth = {
      spotify_user_id: payload.platform === "spotify" ? platform_user_id : null,
      spotify_access_token:
        payload.platform === "spotify" ? access_token : null,
      spotify_refresh_token:
        payload.platform === "spotify" ? refresh_token : null,
      spotify_token_expires_at:
        payload.platform === "spotify" ? expires_at : null,

      apple_music_user_id:
        payload.platform === "apple-music" ? platform_user_id : null,
      apple_music_access_token:
        payload.platform === "apple-music" ? access_token : null,
      apple_music_refresh_token:
        payload.platform === "apple-music" ? refresh_token : null,
      apple_music_token_expires_at:
        payload.platform === "apple-music" ? expires_at : null,
    };

    // Generate friend link
    const friend_link_token = crypto.randomBytes(16).toString("base64url");

    // Generate onboarding token
    const onboarding_token = crypto.randomBytes(16).toString("base64url");

    // Create new user with Spotify tokens
    const [newUser] = await db
      .insert(users)
      .values({
        firstName: payload.first_name,
        lastName: payload.last_name,
        phoneNumber: payload.phone_number,
        friendLinkToken: friend_link_token,
        onboardingToken: onboarding_token,
        isOnboardingComplete: false,
        platform: payload.platform as Platform,
        spotifyUserId: userAuth.spotify_user_id,
        spotifyAccessToken: userAuth.spotify_access_token,
        spotifyRefreshToken: userAuth.spotify_refresh_token,
        spotifyTokenExpiresAt: userAuth.spotify_token_expires_at,
      })
      .returning({ id: users.id, onboardingToken: users.onboardingToken });

    if (payload.referral_friend_link_token) {
      const { ok, message } = await createFriendships({
        user_id: newUser.id.toString(),
        referral_friend_link_token: payload.referral_friend_link_token,
      });

      if (!ok) {
        console.error("Error creating friendship:", message);
      }
    }

    // async task to get recent plays of new user
    await getRecentPlaysTask.trigger({
      user: {
        id: newUser.id.toString(),
        platform: payload.platform,
        ...(({ spotify_user_id, apple_music_user_id, ...rest }) => rest)(
          userAuth,
        ),
      },
    });

    return {
      ok: true,
      user_id: newUser.id.toString(),
      onboarding_token: newUser.onboardingToken,
      created: true,
      message: "User created successfully with Spotify tokens.",
    };
  } catch (error: unknown) {
    console.error("Error in createUser:", error);
    return {
      ok: false,
      user_id: null,
      onboarding_token: null,
      created: false,
      message: "An error occurred while creating the user.",
    };
  }
}

async function getPlatformAuth(payload: { platform: string; code: string }) {
  try {
    if (payload.platform === "spotify") {
      const {
        ok: getTokensOk,
        data: getTokensData,
        error: getTokensError,
      } = await SpotifyPlatform.getTokens({ code: payload.code });

      if (!getTokensOk) {
        return { ok: false, data: null, error: getTokensError };
      }

      if (!getTokensData) {
        return {
          ok: false,
          data: null,
          error: "No data returned from Spotify getTokens",
        };
      }

      const { access_token, refresh_token, expires_at } = getTokensData;

      const {
        ok: getUserIdOk,
        data: getUserIdData,
        error: getUserIdError,
      } = await SpotifyPlatform.getUserId({
        access_token: access_token,
      });

      if (!getUserIdOk) {
        return { ok: false, data: null, error: getUserIdError };
      }

      if (!getUserIdData) {
        return {
          ok: false,
          data: null,
          error: "No data returned from Spotify getUserId",
        };
      }

      const data = {
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: expires_at,
        platform_user_id: getUserIdData.spotify_user_id,
      };

      return { ok: true, data: data, error: null };
    }

    // TODO: implement apple music auth
    if (payload.platform === "apple-music") {
      return {
        ok: false,
        data: null,
        error: "Apple Music auth not implemented yet",
      };
    }

    return { ok: false, data: null, error: "Invalid platform" };
  } catch (error: unknown) {
    console.error("Error in getPlatformAuth:", error);
    return {
      ok: false,
      data: null,
      error: "An error occurred while getting platform auth",
    };
  }
}

export async function createFriendships(payload: {
  user_id: string;
  referral_friend_link_token: string;
}) {
  try {
    const [friend] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.friendLinkToken, payload.referral_friend_link_token))
      .limit(1);

    if (!friend) {
      throw new Error("Friend not found based on referral token");
    }

    if (friend.id.toString() === payload.user_id) {
      throw new Error("Friend is the same as the user");
    }

    const now = new Date().toISOString();

    // Create friendship relationship (bidirectional)
    await db.insert(friends).values([
      {
        userId: parseInt(payload.user_id, 10),
        friendId: friend.id,
        updatedAt: now,
      },
      {
        userId: friend.id,
        friendId: parseInt(payload.user_id, 10),
        updatedAt: now,
      },
    ]);

    return { ok: true, message: "Friendship created successfully" };
  } catch (error: unknown) {
    console.error("Error in createFriendships:", error);
    return {
      ok: false,
      message: "An error occurred while creating friendships",
    };
  }
}

export async function sendOnboardingMessage(payload: {
  phone_number: string;
  onboarding_token: string;
}) {
  console.log("Triggering onboarding task... ", payload.phone_number);
  await onboardingTask.trigger({
    phone_number: payload.phone_number,
    onboarding_token: payload.onboarding_token,
  });
  return {
    ok: true,
    message: `onboarding message sent to ${payload.phone_number}`,
  };
}

export async function searchPlatformTracks(platform: string, query: string) {
  "use server";

  try {
    // Validate input
    if (!query || query.trim().length < 2) {
      return {
        ok: false,
        tracks: [],
        message: "Query must be at least 2 characters long",
      };
    }

    if (platform === "spotify") {
      const { ok, data, error } = await SpotifyPlatform.searchTracks({
        query: query,
      });
      if (!ok) {
        return { ok: false, tracks: [], message: error };
      }
      return { ok: true, tracks: data?.tracks || [], message: error };
    } else if (platform === "apple-music") {
      const { ok, data, error } = await handleAppleMusicSearch(query);
      if (!ok) {
        return { ok: false, tracks: [], message: error };
      }

      return { ok: true, tracks: [], message: error };
    }

    return {
      ok: false,
      tracks: [],
      message: "Invalid platform",
    };
  } catch (error: unknown) {
    console.error("Error in searchPlatformTracks:", error);
    return {
      ok: false,
      tracks: [],
      message: "An error occurred while searching",
    };
  }
}

async function handleAppleMusicSearch(query: string) {
  return {
    ok: false,
    data: null,
    error: "Apple Music search not implemented yet",
  };
}

export async function getUserTopSongs(payload: {
  user_id: number;
  num_songs: number;
}) {
  try {
    const FOUR_DAYS_IN_MS = 4 * 24 * 60 * 60 * 1000;

    const topSongs = await db
      .select({
        trackId: userTrackPlays.trackId,
        trackName: userTrackPlays.trackName,
        artists: userTrackPlays.artists,
        albumImageUrl: userTrackPlays.albumImageUrl,
        playCount: count(),
      })
      .from(userTrackPlays)
      .where(
        and(
          eq(userTrackPlays.userId, payload.user_id),
          gte(
            userTrackPlays.playedAt,
            new Date(Date.now() - FOUR_DAYS_IN_MS).toISOString(),
          ),
        ),
      )
      .groupBy(
        userTrackPlays.trackId,
        userTrackPlays.trackName,
        userTrackPlays.artists,
        userTrackPlays.albumImageUrl,
      )
      .orderBy(desc(count()))
      .limit(payload.num_songs);

    return {
      ok: true,
      songs: topSongs,
      message: "User top songs fetched successfully",
    };
  } catch (error: unknown) {
    console.error("Error in getUserTopSongs:", error);
    return {
      ok: false,
      songs: [],
      message: `An error occurred while getting user top songs for user ${payload.user_id}: ${error}`,
    };
  }
}

export async function submitSong(payload: { token: string; track_id: string }) {
  try {
    await db
      .update(userEchoSessions)
      .set({
        trackId: payload.track_id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userEchoSessions.token, payload.token));

    return { ok: true, message: "Song submitted successfully" };
  } catch (error: unknown) {
    console.error("Error in submitSong:", error);
    return { ok: false, message: "An error occurred while submitting song" };
  }
}

export async function completeOnboarding(payload: {
  onboarding_token: string;
}) {
  try {
    const [user] = await db
      .update(users)
      .set({
        isOnboardingComplete: true,
      })
      .where(eq(users.onboardingToken, payload.onboarding_token))
      .returning();

    if (!user) {
      throw new Error("User not found");
    }

    // FIXME: this is a hack to get the user data to the onboarding completion task
    // implement codebase wide user type
    await onboardingCompletionTask.trigger({
      user: {
        id: user.id.toString(),
        first_name: user.firstName,
        phone_number: user.phoneNumber,
        friend_link_token: user.friendLinkToken,
        platform: user.platform as Platform,
        spotify_user_id: user.spotifyUserId || "",
        spotify_access_token: user.spotifyAccessToken || "",
        spotify_refresh_token: user.spotifyRefreshToken || "",
        spotify_token_expires_at: user.spotifyTokenExpiresAt || "",
      },
    });

    return { ok: true, message: "Onboarding completed successfully" };
  } catch (error: unknown) {
    console.error("Error in completeOnboarding:", error);
    return {
      ok: false,
      message: "An error occurred while completing onboarding",
    };
  }
}
