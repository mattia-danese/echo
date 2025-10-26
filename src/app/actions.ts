"use server";

import crypto from "node:crypto";
import { and, count, desc, eq, gte, inArray, or } from "drizzle-orm";
import { UTApi } from "uploadthing/server";
import { db } from "@/db";
import {
  friends,
  songLinkCacheMappings,
  songlinkCache,
  userAuth,
  userEchoSessions,
  users,
  userTrackPlays,
} from "@/db/schema";
import { type Gender, Platform } from "@/db/types";
import { createSession, deleteAllSessionsForUser } from "@/lib/cookieSession";
import { songLinkAdmin } from "@/lib/songLinkAdmin";
import { isNameValid, isPhoneNumberValid, isValidDate } from "@/lib/validation";
import { AppleMusicPlatform, SpotifyPlatform } from "@/platforms";
import {
  getRecentPlaysTask,
  onboardingCompletionTask,
  sendMessagesTask,
} from "@/trigger";

type UserAuthInsert = typeof userAuth.$inferInsert;

export async function checkRegistrationData(payload: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: string;
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

  if (!isValidDate(payload.dateOfBirth)) {
    return { ok: false, message: "date of birth" };
  }

  return { ok: true, message: "User is valid" };
}

export async function createUser(payload: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  gender: Gender;
  dateOfBirth: string;
  auth: string;
  platform: Platform;
  referralFriendLinkToken: string | null;
}) {
  try {
    // First, check if user already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.phoneNumber, payload.phoneNumber),
          eq(users.isDeleted, false),
        ),
      )
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

    const userAuthData: UserAuthInsert = {
      userId: 0,
      platform: payload.platform,
      platformUserId: null,
      accessToken: "",
      refreshToken: null,
      tokenExpiresAt: null,
      extra: {},
    };

    if (payload.platform === Platform.SPOTIFY) {
      // User doesn't exist, make API call to get tokens from platform
      const {
        ok: platformAuthOk,
        data: platformAuthData,
        error: platformAuthError,
      } = await getPlatformAuth({
        platform: payload.platform,
        code: payload.auth,
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

      userAuthData.accessToken = platformAuthData.accessToken;
      userAuthData.refreshToken = platformAuthData.refreshToken;
      userAuthData.tokenExpiresAt = platformAuthData.expiresAt;
      userAuthData.platformUserId = platformAuthData.platformUserId;
    } else if (payload.platform === Platform.APPLE_MUSIC) {
      userAuthData.accessToken = payload.auth;
    } else {
      return {
        ok: false,
        userId: null,
        onboardingToken: null,
        created: false,
        message: "Invalid platform",
      };
    }

    // Generate friend link
    const friendLinkToken = crypto.randomBytes(16).toString("base64url");

    // Generate onboarding token
    const onboardingToken = crypto.randomBytes(16).toString("base64url");

    // Create or reactivate user (upsert on phone number)
    const [newUser] = await db
      .insert(users)
      .values({
        firstName: payload.firstName,
        lastName: payload.lastName,
        phoneNumber: payload.phoneNumber,
        gender: payload.gender,
        dateOfBirth: payload.dateOfBirth,
        friendLinkToken: friendLinkToken,
        onboardingToken: onboardingToken,
        isOnboardingComplete: false,
        platform: payload.platform,
      })
      .onConflictDoUpdate({
        target: users.phoneNumber,
        set: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          gender: payload.gender,
          dateOfBirth: payload.dateOfBirth,
          friendLinkToken: friendLinkToken,
          onboardingToken: onboardingToken,
          platform: payload.platform,
          isDeleted: false,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning({
        id: users.id,
        onboardingToken: users.onboardingToken,
        updatedAt: users.updatedAt,
        createdAt: users.createdAt,
      });

    // Reactivate all prior friends for the user (if any)
    await db
      .update(friends)
      .set({ active: true, muted: false, updatedAt: new Date().toISOString() })
      .where(
        and(
          or(eq(friends.userId, newUser.id), eq(friends.friendId, newUser.id)),
          eq(friends.active, false),
        ),
      );

    userAuthData.userId = newUser.id;

    // Create new user auth record
    await db.insert(userAuth).values(userAuthData);

    if (payload.referralFriendLinkToken) {
      const { ok, message } = await createFriendships({
        userId: newUser.id,
        referralFriendLinkToken: payload.referralFriendLinkToken,
        userPlatform: payload.platform,
        userFirstName: payload.firstName,
        userLastName: payload.lastName,
      });

      if (!ok) {
        console.error("Error creating friendship:", message);
      }
    }

    // async task to get recent plays of new user
    await getRecentPlaysTask.trigger({
      user: {
        userId: newUser.id,
        platform: payload.platform,
        platformUserId: userAuthData.platformUserId ?? "",
        accessToken: userAuthData.accessToken,
        refreshToken: userAuthData.refreshToken ?? "",
        tokenExpiresAt: userAuthData.tokenExpiresAt ?? "",
      },
    });

    return {
      ok: true,
      user: newUser,
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
      message: `An error occurred while creating the user: ${error}`,
    };
  }
}

async function getPlatformAuth(payload: { platform: Platform; code: string }) {
  try {
    if (payload.platform === Platform.SPOTIFY) {
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
        platformUserId: getUserIdData.spotifyUserId,
      };

      return { ok: true, data: data, error: null };
    }

    // TODO: implement apple music auth
    if (payload.platform === Platform.APPLE_MUSIC) {
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
  userPlatform: Platform;
  userFirstName: string;
  userLastName: string;
  referralFriendLinkToken: string;
}) {
  try {
    const [friend] = await db
      .select({
        id: users.id,
        platform: users.platform,
        phoneNumber: users.phoneNumber,
      })
      .from(users)
      .where(
        and(
          eq(users.friendLinkToken, payload.referralFriendLinkToken),
          eq(users.isDeleted, false),
        ),
      )
      .limit(1);

    if (!friend) {
      throw new Error(
        `Friend not found in createFriendships() based on referral token: ${payload.referralFriendLinkToken}`,
      );
    }

    if (friend.id === payload.userId) {
      throw new Error(
        `Friend is the same as the user in createFriendships(): ${payload.userId}`,
      );
    }

    const now = new Date().toISOString();

    // Create or reactivate friendship relationship (bidirectional)
    await db
      .insert(friends)
      .values([
        {
          userId: payload.userId,
          friendId: friend.id,
          muted: false,
          active: true,
          updatedAt: now,
        },
        {
          userId: friend.id,
          friendId: payload.userId,
          muted: false,
          active: true,
          updatedAt: now,
        },
      ])
      .onConflictDoUpdate({
        target: [friends.userId, friends.friendId],
        set: {
          // Reactivate and reset muted state when re-establishing a friendship
          active: true,
          muted: false,
          updatedAt: now,
        },
      });

    // Update hasCrossPlatformFriends flag for both users if different platforms
    if (payload.userPlatform !== friend.platform) {
      await db
        .update(users)
        .set({
          hasCrossPlatformFriends: true,
        })
        .where(inArray(users.id, [payload.userId, friend.id]));
    }

    await sendMessagesTask.trigger({
      data: new Map([
        [
          friend.phoneNumber,
          [
            `you’re now friends with ${payload.userFirstName} ${payload.userLastName} :)`,
          ],
        ],
      ]),
    });

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
  console.log("Sending onboarding messages to... ", payload.phoneNumber);

  await sendMessagesTask.trigger({
    data: new Map([
      [
        payload.phoneNumber,
        [
          `
          welcome to echo - thanks for signing up :)
          here is how it works:

          1. we'll text you every 3 days to share a song
          2. submit your song
          3. at the end of the day, we'll text you the songs your friends shared`,
          "let's walk through a live example. click on the link below to share your first song",
          `https://text-echo.com/onboarding/${payload.onboardingToken}`,
        ],
      ],
    ]),
  });
  return {
    ok: true,
    message: `onboarding messages sent to ${payload.phoneNumber}`,
  };
}

export async function sendWelcomeMessage(payload: { phoneNumber: string }) {
  console.log("Sending welcome message to... ", payload.phoneNumber);
  await sendMessagesTask.trigger({
    data: new Map([
      [
        payload.phoneNumber,
        [
          "welcome back :) you'll get your first echo soon and can start discovering music with friends",
        ],
      ],
    ]),
  });

  return {
    ok: true,
    message: `welcome back message sent to ${payload.phoneNumber}`,
  };
}

export async function searchPlatformTracks(platform: Platform, query: string) {
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

    if (platform === Platform.SPOTIFY) {
      const { ok, data, error } = await SpotifyPlatform.searchTracks({
        query: query,
      });

      if (!ok) {
        return { ok: false, tracks: [], message: error };
      }

      return { ok: true, tracks: data?.tracks || [], message: error };
    } else if (platform === Platform.APPLE_MUSIC) {
      const { ok, data, error } = await AppleMusicPlatform.searchTracks({
        query,
      });

      if (!ok) {
        return { ok: false, tracks: [], message: error };
      }

      return { ok: true, tracks: data?.tracks || [], message: error };
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
        platform: userTrackPlays.platform,
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
        userTrackPlays.platform,
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

export async function submitSong(payload: {
  userId: number;
  token: string;
  platform: Platform;
  trackId: string;
  trackName: string;
  artists: string;
  albumImageUrl: string;
}) {
  try {
    await db
      .update(userEchoSessions)
      .set({
        trackId: payload.trackId,
        trackName: payload.trackName,
        trackArtists: payload.artists,
        trackAlbumImageUrl: payload.albumImageUrl,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userEchoSessions.token, payload.token));

    const { ok, message: submissionMessage } =
      await handleCrossPlatformSongSubmission({
        userId: payload.userId,
        platform: payload.platform,
        trackId: payload.trackId,
        trackName: payload.trackName,
        artists: payload.artists,
      });

    if (!ok) {
      throw new Error(
        submissionMessage || "An error occurred while submitting song",
      );
    }

    return { ok: true, message: "Song submitted successfully" };
  } catch (error: unknown) {
    console.error("Error in submitSong:", error);
    return { ok: false, message: "An error occurred while submitting song" };
  }
}

export async function handleCrossPlatformSongSubmission(payload: {
  userId: number;
  platform: Platform;
  trackId: string;
  trackName: string;
  artists: string;
}) {
  try {
    const [user] = await db
      .select({
        hasCrossPlatformFriends: users.hasCrossPlatformFriends,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.hasCrossPlatformFriends) {
      return {
        ok: true,
        message: `${payload.userId} has no cross platform friends`,
      };
    }

    const [songMapping] = await db
      .select()
      .from(songLinkCacheMappings)
      .where(
        and(
          eq(songLinkCacheMappings.platform, payload.platform),
          eq(songLinkCacheMappings.trackId, payload.trackId),
        ),
      )
      .limit(1);

    if (songMapping) {
      return { ok: true, message: `Song ${payload.trackId} already cached` };
    }

    const { ok, data, error } = await songLinkAdmin.getLinks(
      payload.platform,
      payload.trackId,
    );

    if (!ok) {
      return { ok: false, message: error };
    }

    if (!data) {
      return {
        ok: false,
        message: `No data returned from songLinkAdmin.getLinks(${payload.platform}, ${payload.trackId})`,
      };
    }

    const linksByPlatform = data.linksByPlatform;

    if (!linksByPlatform) {
      return {
        ok: false,
        message: `No linksByPlatform field in return from songLinkAdmin.getLinks(${payload.platform}, ${payload.trackId})`,
      };
    }

    const [songlinkCacheRecord] = await db
      .insert(songlinkCache)
      .values({
        title: payload.trackName,
        artists: payload.artists,
      })
      .onConflictDoUpdate({
        target: [songlinkCache.title, songlinkCache.artists],
        set: { lastCheckedAt: new Date().toISOString() },
      })
      .returning({ id: songlinkCache.id });

    for (const platformKey of Object.values(Platform)) {
      const songLinkPlatform = songLinkAdmin.songLinkPlatformMap[platformKey];
      const trackId = songLinkAdmin.extractTrackId(
        linksByPlatform[songLinkPlatform].url,
        platformKey,
      );

      await db.insert(songLinkCacheMappings).values({
        songlinkCacheId: songlinkCacheRecord.id,
        platform: platformKey,
        trackId: trackId,
      });
    }

    return { ok: true, message: "Song submitted successfully" };
  } catch (error: unknown) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "An error occurred while submitting song",
    };
  }
}

export async function completeOnboarding(payload: { onboardingToken: string }) {
  try {
    const [user] = await db
      .update(users)
      .set({
        isOnboardingComplete: true,
      })
      .where(
        and(
          eq(users.onboardingToken, payload.onboardingToken),
          eq(users.isDeleted, false),
        ),
      )
      .returning();

    if (!user) {
      throw new Error(
        `User not found with onboarding token ${payload.onboardingToken}`,
      );
    }

    const [auth] = await db
      .select({
        platformUserId: userAuth.platformUserId,
        accessToken: userAuth.accessToken,
        refreshToken: userAuth.refreshToken,
        tokenExpiresAt: userAuth.tokenExpiresAt,
      })
      .from(userAuth)
      .where(eq(userAuth.userId, user.id))
      .limit(1);

    if (!auth) {
      throw new Error("User auth not found");
    }

    // FIXME: this is a hack to get the user data to the onboarding completion task
    // implement codebase wide user type
    await onboardingCompletionTask.trigger({
      user: {
        userId: user.id,
        platform: user.platform,
        platformUserId: auth.platformUserId ?? "",
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken ?? "",
        tokenExpiresAt: auth.tokenExpiresAt ?? "",
        friendLinkToken: user.friendLinkToken,
        firstName: user.firstName,
        phoneNumber: user.phoneNumber,
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

export async function muteFriend(userId: number, friendId: number) {
  "use server";
  await db
    .update(friends)
    .set({ muted: true, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(friends.userId, userId),
        eq(friends.friendId, friendId),
        eq(friends.active, true),
      ),
    );
}

export async function unMuteFriend(userId: number, friendId: number) {
  "use server";
  await db
    .update(friends)
    .set({ muted: false, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(friends.userId, userId),
        eq(friends.friendId, friendId),
        eq(friends.active, true),
      ),
    );
}

export async function unfriendFriend(userId: number, friendId: number) {
  "use server";
  await db
    .update(friends)
    .set({ active: false, updatedAt: new Date().toISOString() })
    .where(
      and(
        or(
          and(eq(friends.userId, userId), eq(friends.friendId, friendId)),
          and(eq(friends.userId, friendId), eq(friends.friendId, userId)),
        ),

        eq(friends.active, true),
      ),
    );
}

export async function deleteUser(userId: number) {
  "use server";

  const now = new Date().toISOString();

  await db
    .update(users)
    .set({ isDeleted: true, updatedAt: now })
    .where(eq(users.id, userId));

  await db
    .update(friends)
    .set({ active: false, updatedAt: now })
    .where(
      and(
        eq(friends.active, true),
        or(eq(friends.userId, userId), eq(friends.friendId, userId)),
      ),
    );

  await db.delete(userAuth).where(eq(userAuth.userId, userId));
  await deleteAllSessionsForUser(userId);
}

export async function logInExistingUser(phoneNumber: string) {
  "use server";

  try {
    if (!isPhoneNumberValid(phoneNumber) || !phoneNumber.trim()) {
      return { ok: false, message: "invalid phone number" };
    }

    const [user] = await db
      .select({ id: users.id, isDeleted: users.isDeleted })
      .from(users)
      .where(
        and(eq(users.phoneNumber, phoneNumber), eq(users.isDeleted, false)),
      )
      .limit(1);

    if (!user) {
      return { ok: false, message: "user not found" };
    }

    await createSession(user.id);
    return { ok: true };
  } catch (error) {
    console.error("Error in logInExistingUser:", error);
    return { ok: false, message: "login failed" };
  }
}

export async function deleteUserSessionCookies(userId: number) {
  "use server";

  try {
    await deleteAllSessionsForUser(userId);
    return { ok: true };
  } catch (error) {
    console.error("Error in deleteUserSessionCookies:", error);
    return { ok: false };
  }
}

// handled directly in ourFileRouter (core.ts)
// export async function uploadUserProfilePicture(
//   userId: number,
//   profilePictureUrl: string,
// ) {}

export async function deleteUserProfilePicture(userId: number) {
  "use server";

  const previousUrl = await db.transaction(async (tx) => {
    const [prev] = await tx
      .select({ url: users.profilePictureUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    await tx
      .update(users)
      .set({ profilePictureUrl: null })
      .where(eq(users.id, userId));

    return prev?.url ?? null;
  });

  if (previousUrl) {
    try {
      const utapi = new UTApi();
      await utapi.deleteFiles(previousUrl);
    } catch (err) {
      // Non-fatal: DB already cleared
      console.error(
        `Failed to delete profile picture of ${userId}from UploadThing - ${previousUrl}:`,
        err,
      );
    }
  }
}
