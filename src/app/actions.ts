"use server";

import crypto from "node:crypto";
import { and, count, desc, eq, gte } from "drizzle-orm";
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

export async function checkRegistrationData(payload: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
}) {
  if (!isPhoneNumberValid(payload.phoneNumber) || !payload.phoneNumber.trim()) {
    return { ok: false, message: "phone number" };
  }

  if (!isNameValid(payload.firstName) || !payload.firstName.trim()) {
    return { ok: false, message: "first name" };
  }

  if (!isNameValid(payload.lastName) || !payload.lastName.trim()) {
    return { ok: false, message: "last name" };
  }

  return { ok: true, message: "User is valid" };
}

export async function createUser(payload: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  spotifyCode: string;
  platform: string;
  referralFriendLinkToken: string | null;
}) {
  try {
    // First, check if user already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNumber, payload.phoneNumber))
      .limit(1);

    if (existingUser) {
      // User already exists, return early
      return {
        ok: true,
        userId: existingUser.id.toString(),
        onboardingToken: null,
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
      code: payload.spotifyCode,
    });

    if (!platformAuthOk) {
      return {
        ok: false,
        userId: null,
        onboardingToken: null,
        created: false,
        message: platformAuthError,
      };
    }

    if (!platformAuthData) {
      return {
        ok: false,
        userId: null,
        onboardingToken: null,
        created: false,
        message: "No data returned from platform auth",
      };
    }

    const { accessToken, refreshToken, expiresAt, spotifyUserId } =
      platformAuthData;

    const userAuth = {
      spotifyUserId: payload.platform === "spotify" ? spotifyUserId : null,
      spotifyAccessToken: payload.platform === "spotify" ? accessToken : null,
      spotifyRefreshToken: payload.platform === "spotify" ? refreshToken : null,
      spotifyTokenExpiresAt: payload.platform === "spotify" ? expiresAt : null,

      appleMusicUserId:
        payload.platform === "apple-music" ? "apple-music" : null,
      appleMusicAccessToken:
        payload.platform === "apple-music" ? accessToken : null,
      appleMusicRefreshToken:
        payload.platform === "apple-music" ? refreshToken : null,
      appleMusicTokenExpiresAt:
        payload.platform === "apple-music" ? expiresAt : null,
    };

    // Generate friend link
    const friendLinkToken = crypto.randomBytes(16).toString("base64url");

    // Generate onboarding token
    const onboardingToken = crypto.randomBytes(16).toString("base64url");

    // Create new user with Spotify tokens
    const [newUser] = await db
      .insert(users)
      .values({
        firstName: payload.firstName,
        lastName: payload.lastName,
        phoneNumber: payload.phoneNumber,
        friendLinkToken: friendLinkToken,
        onboardingToken: onboardingToken,
        isOnboardingComplete: false,
        platform: payload.platform as Platform,
        spotifyUserId: userAuth.spotifyUserId,
        spotifyAccessToken: userAuth.spotifyAccessToken,
        spotifyRefreshToken: userAuth.spotifyRefreshToken,
        spotifyTokenExpiresAt: userAuth.spotifyTokenExpiresAt,
      })
      .returning({ id: users.id, onboardingToken: users.onboardingToken });

    if (payload.referralFriendLinkToken) {
      const { ok, message } = await createFriendships({
        userId: newUser.id,
        referralFriendLinkToken: payload.referralFriendLinkToken,
      });

      if (!ok) {
        console.error("Error creating friendship:", message);
      }
    }

    // async task to get recent plays of new user
    await getRecentPlaysTask.trigger({
      user: {
        id: newUser.id,
        platform: payload.platform as Platform,
        ...(({ spotifyUserId, appleMusicUserId, ...rest }) => rest)(userAuth),
      },
    });

    return {
      ok: true,
      userId: newUser.id.toString(),
      onboardingToken: newUser.onboardingToken,
      created: true,
      message: "User created successfully with Spotify tokens.",
    };
  } catch (error: unknown) {
    console.error("Error in createUser:", error);
    return {
      ok: false,
      userId: null,
      onboardingToken: null,
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

      const { accessToken, refreshToken, expiresAt } = getTokensData;

      const {
        ok: getUserIdOk,
        data: getUserIdData,
        error: getUserIdError,
      } = await SpotifyPlatform.getUserId({
        accessToken: accessToken,
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
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiresAt: expiresAt,
        spotifyUserId: getUserIdData.spotifyUserId,
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
  userId: number;
  referralFriendLinkToken: string;
}) {
  try {
    const [friend] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.friendLinkToken, payload.referralFriendLinkToken))
      .limit(1);

    if (!friend) {
      throw new Error("Friend not found based on referral token");
    }

    if (friend.id === payload.userId) {
      throw new Error("Friend is the same as the user");
    }

    const now = new Date().toISOString();

    // Create friendship relationship (bidirectional)
    await db.insert(friends).values([
      {
        userId: payload.userId,
        friendId: friend.id,
        updatedAt: now,
      },
      {
        userId: friend.id,
        friendId: payload.userId,
        updatedAt: now,
      },
    ]);

    return { ok: true, message: "Friendship created successfully" };
  } catch (error: unknown) {
    console.error(
      `Error in createFriendships (${payload.userId}, ${payload.referralFriendLinkToken}):`,
      error,
    );
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "An error occurred while creating friendships",
    };
  }
}

export async function sendOnboardingMessage(payload: {
  phoneNumber: string;
  onboardingToken: string;
}) {
  console.log("Triggering onboarding task... ", payload.phoneNumber);
  await onboardingTask.trigger({
    phoneNumber: payload.phoneNumber,
    onboardingToken: payload.onboardingToken,
  });
  return {
    ok: true,
    message: `onboarding message sent to ${payload.phoneNumber}`,
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
  userId: number;
  numSongs: number;
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
          eq(userTrackPlays.userId, payload.userId),
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
      .limit(payload.numSongs);

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
      message: `An error occurred while getting user top songs for user ${payload.userId}: ${error}`,
    };
  }
}

export async function submitSong(payload: { token: string; trackId: string }) {
  try {
    await db
      .update(userEchoSessions)
      .set({
        trackId: payload.trackId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userEchoSessions.token, payload.token));

    return { ok: true, message: "Song submitted successfully" };
  } catch (error: unknown) {
    console.error("Error in submitSong:", error);
    return { ok: false, message: "An error occurred while submitting song" };
  }
}

export async function completeOnboarding(payload: { onboardingToken: string }) {
  try {
    const [user] = await db
      .update(users)
      .set({
        isOnboardingComplete: true,
      })
      .where(eq(users.onboardingToken, payload.onboardingToken))
      .returning();

    if (!user) {
      throw new Error("User not found");
    }

    // FIXME: this is a hack to get the user data to the onboarding completion task
    // implement codebase wide user type
    await onboardingCompletionTask.trigger({
      user: {
        id: user.id,
        firstName: user.firstName,
        phoneNumber: user.phoneNumber,
        friendLinkToken: user.friendLinkToken,
        platform: user.platform as Platform,
        spotifyUserId: user.spotifyUserId || "",
        spotifyAccessToken: user.spotifyAccessToken || "",
        spotifyRefreshToken: user.spotifyRefreshToken || "",
        spotifyTokenExpiresAt: user.spotifyTokenExpiresAt || "",
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
