"use server";

import crypto from "node:crypto";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  or,
} from "drizzle-orm";
import { UTApi } from "uploadthing/server";
import { db } from "@/db";
import {
  friends,
  songLinkCacheMappings,
  songlinkCache,
  spotifyAuth,
  userAuth,
  userEchoSessions,
  userRecommendedSongs,
  users,
  userTrackPlays,
} from "@/db/schema";
import { type Gender, Platform } from "@/db/types";
import { createSession, deleteAllSessionsForUser } from "@/lib/cookieSession";
import { lastFmAdmin } from "@/lib/lastFmAdmin";
import { songLinkAdmin } from "@/lib/songLinkAdmin";
import { twilioAdmin } from "@/lib/twilioAdmin";
import { isNameValid, isPhoneNumberValid, isValidDate } from "@/lib/validation";
import { AppleMusicPlatform, SpotifyPlatform } from "@/platforms";
import {
  getRecentPlaysTask,
  onboardingCompletionTask,
  sendMessagesTask,
} from "@/trigger";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");

const accountSid = twilioAdmin.accountSid;
const authToken = twilioAdmin.authToken;
const client = twilio(accountSid, authToken);

type UserAuthInsert = typeof userAuth.$inferInsert;

export async function checkRegistrationData(payload: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: string;
}) {
  if (!payload.phoneNumber.trim() || !isPhoneNumberValid(payload.phoneNumber)) {
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
      // const {
      //   ok: platformAuthOk,
      //   data: platformAuthData,
      //   error: platformAuthError,
      // } = await getPlatformAuth({
      //   platform: payload.platform,
      //   code: payload.auth,
      // });
      // if (!platformAuthOk) {
      //   return {
      //     ok: false,
      //     userId: null,
      //     onboardingToken: null,
      //     created: false,
      //     message: platformAuthError,
      //   };
      // }
      // if (!platformAuthData) {
      //   return {
      //     ok: false,
      //     userId: null,
      //     onboardingToken: null,
      //     created: false,
      //     message: "No data returned from platform auth",
      //   };
      // }
      // userAuthData.accessToken = platformAuthData.accessToken;
      // userAuthData.refreshToken = platformAuthData.refreshToken;
      // userAuthData.tokenExpiresAt = platformAuthData.expiresAt;
      // userAuthData.platformUserId = platformAuthData.platformUserId;
    } else if (payload.platform === Platform.APPLE_MUSIC) {
      userAuthData.accessToken = payload.auth;
    } else {
      return {
        ok: false,
        userId: null,
        created: false,
        message: "Invalid platform",
      };
    }

    // Generate friend link
    const friendLinkToken = crypto.randomBytes(16).toString("base64url");

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
        whenOnboardingComplete: null,
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
          platform: payload.platform,
          isDeleted: false,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning({
        id: users.id,
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
    if (payload.platform !== Platform.SPOTIFY) {
      await db.insert(userAuth).values(userAuthData);
    }

    let friendFirstName = "";

    if (payload.referralFriendLinkToken) {
      const { ok, data, message } = await createFriendships({
        userId: newUser.id,
        referralFriendLinkToken: payload.referralFriendLinkToken,
        userPlatform: payload.platform,
        userFirstName: payload.firstName,
      });

      if (!ok || !data) {
        console.error("Error creating friendship:", message);
      }

      friendFirstName = data?.friendFirstName || "";
    }

    // async task to get recent plays of new user
    if (payload.platform !== Platform.SPOTIFY) {
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
    }

    return {
      ok: true,
      user: { ...newUser, friendFirstName: friendFirstName },
      created: true,
      message: "User created successfully with Spotify tokens.",
    };
  } catch (error: unknown) {
    console.error("Error in createUser:", error);
    return {
      ok: false,
      userId: null,
      created: false,
      message: `An error occurred while creating the user: ${error}`,
    };
  }
}

// async function getPlatformAuth(payload: { platform: Platform; code: string }) {
//   try {
//     if (payload.platform === Platform.SPOTIFY) {
//       const {
//         ok: getTokensOk,
//         data: getTokensData,
//         error: getTokensError,
//       } = await SpotifyPlatform.getTokens({ code: payload.code });

//       if (!getTokensOk) {
//         return { ok: false, data: null, error: getTokensError };
//       }

//       if (!getTokensData) {
//         return {
//           ok: false,
//           data: null,
//           error: "No data returned from Spotify getTokens",
//         };
//       }

//       const { accessToken, refreshToken, expiresAt } = getTokensData;

//       const {
//         ok: getUserIdOk,
//         data: getUserIdData,
//         error: getUserIdError,
//       } = await SpotifyPlatform.getUserId({
//         accessToken: accessToken,
//       });

//       if (!getUserIdOk) {
//         return { ok: false, data: null, error: getUserIdError };
//       }

//       if (!getUserIdData) {
//         return {
//           ok: false,
//           data: null,
//           error: "No data returned from Spotify getUserId",
//         };
//       }

//       const data = {
//         accessToken: accessToken,
//         refreshToken: refreshToken,
//         expiresAt: expiresAt,
//         platformUserId: getUserIdData.spotifyUserId,
//       };

//       return { ok: true, data: data, error: null };
//     }

//     return { ok: false, data: null, error: "Invalid platform" };
//   } catch (error: unknown) {
//     console.error("Error in getPlatformAuth:", error);
//     return {
//       ok: false,
//       data: null,
//       error: "An error occurred while getting platform auth",
//     };
//   }
// }

export async function createFriendships(payload: {
  userId: number;
  userPlatform: Platform;
  userFirstName: string;
  referralFriendLinkToken: string;
}) {
  try {
    const [friend] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
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
      data: {
        [friend.phoneNumber]: [
          `you're now friends with ${payload.userFirstName} :)`,
        ],
      },
    });

    return {
      ok: true,
      data: { friendFirstName: friend.firstName },
      message: "Friendship created successfully",
    };
  } catch (error: unknown) {
    console.error(
      `Error in createFriendships (${payload.userId}, ${payload.referralFriendLinkToken}):`,
      error,
    );
    return {
      ok: false,
      data: null,
      message:
        error instanceof Error
          ? error.message
          : "An error occurred while creating friendships",
    };
  }
}

export async function sendOnboardingMessage(payload: {
  phoneNumber: string;
  friendFirstName: string;
  userPlatform: Platform;
}) {
  console.log("Sending onboarding messages to... ", payload.phoneNumber);

  const lastSentence = payload.friendFirstName
    ? `we'll add your song to ${payload.friendFirstName}'s playlist`
    : "we'll add your song to your friends' playlist";

  const platformLink =
    payload.userPlatform === Platform.SPOTIFY
      ? "https://open.spotify.com/collection/tracks"
      : "https://music.apple.com/library";

  await sendMessagesTask.trigger({
    data: {
      [payload.phoneNumber]: [
        [
          "welcome to echo - your music sharing squad :)",
          "",
          "here's how it works:",
          "",
          "1. next time you're listening to a good song, just text us the link",
          "2. every 2 days, we'll send you a playlist with songs your friends shared",
          // "3. we'll text you before playlists drop so you remember to send groovy tunes",
        ].join("\n"),
        `let's try it together. tap the link below to share your first song. pick a track, tap "share", then "copy link", & text it here. ${lastSentence}`,
        platformLink,
      ],
    },
  });
  return {
    ok: true,
    message: `onboarding messages sent to ${payload.phoneNumber}`,
  };
}

export async function sendWelcomeMessage(payload: { phoneNumber: string }) {
  console.log("Sending welcome message to... ", payload.phoneNumber);
  await sendMessagesTask.trigger({
    data: {
      [payload.phoneNumber]: [
        "welcome back :) you'll get your first echo soon and can start discovering music with friends",
      ],
    },
  });

  return {
    ok: true,
    message: `welcome back message sent to ${payload.phoneNumber}`,
  };
}

export async function searchPlatformTracks(
  platform: Platform,
  query: string,
  platformAccessToken?: string,
) {
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
      const { ok, data, error } = await SpotifyPlatform.searchTracks(
        {
          query: query,
        },
        platformAccessToken,
      );

      if (!ok) {
        return { ok: false, tracks: [], message: error };
      }

      return { ok: true, tracks: data?.tracks || [], message: error };
    } else if (platform === Platform.APPLE_MUSIC) {
      const { ok, data, error } = await AppleMusicPlatform.searchTracks(
        {
          query,
        },
        platformAccessToken,
      );

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
  platform: Platform;
  numSongs: number;
}) {
  try {
    if (payload.platform === Platform.SPOTIFY) {
      const topSongs = await db
        .select({
          trackId: userRecommendedSongs.trackId,
          trackName: userRecommendedSongs.trackName,
          artists: userRecommendedSongs.trackArtists,
          albumImageUrl: userRecommendedSongs.trackAlbumImageUrl,
          platform: userRecommendedSongs.platform,
        })
        .from(userRecommendedSongs)
        .where(eq(userRecommendedSongs.userId, payload.userId))
        .limit(payload.numSongs);

      return {
        ok: true,
        songs: topSongs,
        message: "User top songs fetched successfully",
      };
    }

    if (payload.platform === Platform.APPLE_MUSIC) {
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
    }

    throw new Error(`Unsupported platform: ${payload.platform}`);
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
  userEchoSessionToken: string;
  sessionId: number;
  platform: Platform;
  trackId: string;
  trackName: string;
  artists: string;
  albumImageUrl: string;
  platformAccessToken?: string;
}) {
  try {
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

    if (payload.platform === Platform.SPOTIFY) {
      const { data: similarTracksData, error: similarTracksError } =
        await lastFmAdmin.getSimilarTracks(
          payload.trackName,
          payload.artists.split(",")[0].trim(),
        );

      if (similarTracksError) {
        console.error(
          "Last.fm API error in submitSong (non-blocking):",
          similarTracksError,
        );
      }

      const spotifySimilarTracks: {
        userId: number;
        trackId: string;
        trackName: string;
        trackArtists: string;
        trackAlbumImageUrl: string;
        platform: Platform;
      }[] = [];

      if (!payload.platformAccessToken) {
        console.log("getting spotify token in submitSong");
        const [spotifyAuthRecord] = await db
          .select({
            userId: spotifyAuth.userId,
            accessToken: spotifyAuth.accessToken,
            refreshToken: spotifyAuth.refreshToken,
            tokenExpiresAt: spotifyAuth.tokenExpiresAt,
          })
          .from(spotifyAuth)
          .limit(1);

        if (new Date(spotifyAuthRecord.tokenExpiresAt) < new Date()) {
          const { ok, data, error } = await SpotifyPlatform.refreshTokens({
            userId: spotifyAuthRecord.userId,
            refreshToken: spotifyAuthRecord.refreshToken,
          });

          if (!ok) {
            throw new Error(`Error in SpotifyPlatform.refreshTokens: ${error}`);
          }

          if (!data) {
            throw new Error(
              "No data returned from SpotifyPlatform.refreshTokens",
            );
          }

          payload.platformAccessToken = data.accessToken;
        }
      }

      for (const track of similarTracksData) {
        try {
          const { ok, data, error } =
            await SpotifyPlatform.searchTrackByNameAndArtist(
              track.trackName,
              track.artists,
              payload.platformAccessToken,
            );

          if (!ok || !data || error) continue;

          spotifySimilarTracks.push({
            userId: payload.userId,
            trackId: data.tracks[0].trackId,
            trackName: data.tracks[0].trackName,
            trackArtists: data.tracks[0].artists,
            trackAlbumImageUrl: data.tracks[0].albumImageUrl,
            platform: Platform.SPOTIFY,
          });
        } catch (error: unknown) {
          console.error(
            "Error adding similar track to userRecommendedSongs (non-blocking):",
            error,
          );
        }
      }

      await db.transaction(async (tx) => {
        await tx
          .delete(userRecommendedSongs)
          .where(eq(userRecommendedSongs.userId, payload.userId));

        if (spotifySimilarTracks.length !== 0) {
          await tx.insert(userRecommendedSongs).values(spotifySimilarTracks);
        }
      });
    }

    // if userEchoSession already exists, update it, otherwise insert a new one (onboarding)
    await db
      .insert(userEchoSessions)
      .values({
        userId: payload.userId,
        sessionId: payload.sessionId,
        token: payload.userEchoSessionToken,
        platform: payload.platform,
        trackId: payload.trackId,
        trackName: payload.trackName,
        trackArtists: payload.artists,
        trackAlbumImageUrl: payload.albumImageUrl,
      })
      .onConflictDoUpdate({
        target: userEchoSessions.token,
        set: {
          trackId: payload.trackId,
          trackName: payload.trackName,
          trackArtists: payload.artists,
          trackAlbumImageUrl: payload.albumImageUrl,
          updatedAt: new Date().toISOString(),
        },
      });

    await db
      .update(users)
      .set({
        firstSharedSessionId: payload.sessionId,
      })
      .where(
        and(eq(users.id, payload.userId), isNull(users.firstSharedSessionId)),
      );

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
      let trackId = "";

      // always use the trackId directly from Apple Music when available
      // (i.e. when song is submitted from Apple Music platform)
      if (
        payload.platform === Platform.APPLE_MUSIC &&
        platformKey === Platform.APPLE_MUSIC
      ) {
        console.log("Using trackId directly from Apple Music");
        trackId = payload.trackId;
      } else {
        const songLinkPlatform = songLinkAdmin.songLinkPlatformMap[platformKey];

        trackId = songLinkAdmin.extractTrackId(
          linksByPlatform[songLinkPlatform].url,
          platformKey,
        );
      }

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

export async function getRecommendedSongs(payload: {
  userId: number;
  platform: Platform;
}) {
  if (payload.platform !== Platform.SPOTIFY) return;

  const lastFiveSharedTracks = await db
    .select({ trackId: userEchoSessions.trackId })
    .from(userEchoSessions)
    .where(
      and(
        eq(userEchoSessions.userId, payload.userId),
        isNotNull(userEchoSessions.trackId),
      ),
    )
    .orderBy(desc(userEchoSessions.createdAt))
    .limit(5);

  if (!lastFiveSharedTracks) return;

  return SpotifyPlatform.getRecommendedSongs(
    lastFiveSharedTracks.map((track) => track.trackId as string),
  );
}

// export async function completeOnboarding(payload: {
//   userId: number;
//   onboardingToken: string;
//   platform: Platform;
//   trackName: string;
//   artists: string;
// }) {
//   try {
//     const [user] = await db
//       .select({
//         id: users.id,
//         platform: users.platform,
//         firstName: users.firstName,
//         phoneNumber: users.phoneNumber,
//         friendLinkToken: users.friendLinkToken,
//       })
//       .from(users)
//       .where(
//         and(
//           eq(users.id, payload.userId),
//           eq(users.onboardingToken, payload.onboardingToken),
//           eq(users.isDeleted, false),
//         ),
//       )
//       .limit(1);

//     if (!user) {
//       throw new Error(
//         `User not found with onboarding token ${payload.onboardingToken}`,
//       );
//     }

//     let auth = null;

//     if (user.platform === Platform.SPOTIFY) {
//       const { data: similarTracksData, error: similarTracksError } =
//         await lastFmAdmin.getSimilarTracks(
//           payload.trackName,
//           payload.artists.split(",")[0].trim(),
//         );

//       if (similarTracksError) {
//         console.error(
//           "Last.fm API error in completeOnboarding (non-blocking):",
//           similarTracksError,
//         );
//       }

//       const spotifySimilarTracks: {
//         userId: number;
//         trackId: string;
//         trackName: string;
//         trackArtists: string;
//         trackAlbumImageUrl: string;
//         platform: Platform;
//       }[] = [];

//       console.log("getting spotify token in completeOnboarding");
//       const [spotifyAuthRecord] = await db
//         .select({
//           platformUserId: spotifyAuth.userId,
//           accessToken: spotifyAuth.accessToken,
//           refreshToken: spotifyAuth.refreshToken,
//           tokenExpiresAt: spotifyAuth.tokenExpiresAt,
//         })
//         .from(spotifyAuth)
//         .limit(1);

//       if (new Date(spotifyAuthRecord.tokenExpiresAt) < new Date()) {
//         const { ok, data, error } = await SpotifyPlatform.refreshTokens({
//           userId: spotifyAuthRecord.platformUserId,
//           refreshToken: spotifyAuthRecord.refreshToken,
//         });

//         if (!ok) {
//           throw new Error(`Error in SpotifyPlatform.refreshTokens: ${error}`);
//         }

//         if (!data) {
//           throw new Error(
//             "No data returned from SpotifyPlatform.refreshTokens",
//           );
//         }

//         spotifyAuthRecord.accessToken = data.accessToken;
//         spotifyAuthRecord.refreshToken = data.refreshToken;
//         spotifyAuthRecord.tokenExpiresAt = data.expiresIn;
//       }

//       auth = {
//         platformUserId: spotifyAuthRecord.platformUserId,
//         accessToken: spotifyAuthRecord.accessToken,
//         refreshToken: spotifyAuthRecord.refreshToken,
//         tokenExpiresAt: spotifyAuthRecord.tokenExpiresAt,
//       };

//       for (const track of similarTracksData) {
//         const { ok, data, error } =
//           await SpotifyPlatform.searchTrackByNameAndArtist(
//             track.trackName,
//             track.artists,
//             auth.accessToken,
//           );

//         if (!ok || !data || error) continue;

//         spotifySimilarTracks.push({
//           userId: payload.userId,
//           trackId: data.tracks[0].trackId,
//           trackName: data.tracks[0].trackName,
//           trackArtists: data.tracks[0].artists,
//           trackAlbumImageUrl: data.tracks[0].albumImageUrl,
//           platform: Platform.SPOTIFY,
//         });
//       }

//       if (spotifySimilarTracks.length > 0) {
//         await db.insert(userRecommendedSongs).values(spotifySimilarTracks);
//       }
//     } else {
//       const [authRecord] = await db
//         .select({
//           platformUserId: userAuth.platformUserId,
//           accessToken: userAuth.accessToken,
//           refreshToken: userAuth.refreshToken,
//           tokenExpiresAt: userAuth.tokenExpiresAt,
//         })
//         .from(userAuth)
//         .where(eq(userAuth.userId, user.id))
//         .limit(1);

//       auth = authRecord;
//     }

//     if (!auth) {
//       throw new Error("User auth not found");
//     }

//     await db
//       .update(users)
//       .set({
//         isOnboardingComplete: true,
//       })
//       .where(eq(users.id, user.id));

//     // FIXME: this is a hack to get the user data to the onboarding completion task
//     // implement codebase wide user type
//     await onboardingCompletionTask.trigger({
//       user: {
//         userId: user.id,
//         platform: user.platform,
//         platformUserId: auth.platformUserId ?? "",
//         accessToken: auth.accessToken,
//         refreshToken: auth.refreshToken ?? "",
//         tokenExpiresAt: auth.tokenExpiresAt ?? "",
//         friendLinkToken: user.friendLinkToken,
//         firstName: user.firstName,
//         phoneNumber: user.phoneNumber,
//       },
//     });

//     return { ok: true, message: "Onboarding completed successfully" };
//   } catch (error: unknown) {
//     console.error("Error in completeOnboarding:", error);
//     return {
//       ok: false,
//       message: "An error occurred while completing onboarding",
//     };
//   }
// }

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

export async function deleteUser(userId: number, clearCookie = true) {
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
  await deleteAllSessionsForUser(userId, clearCookie);
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

export async function sendOTP(phoneNumber: string) {
  "use server";
  try {
    const verification = await client.verify.v2
      .services(twilioAdmin.verifyServiceSid)
      .verifications.create({
        to: phoneNumber,
        channel: "sms",
      });

    if (!verification.status || !verification.sid) {
      throw new Error("Failed to send OTP");
    }

    return {
      ok: true,
      data: {
        status: verification.status,
        sid: verification.sid,
      },
      message: "OTP sent successfully",
    };
  } catch (error) {
    console.error(
      `Error in sendOTPToPhoneNumber for phone number ${phoneNumber}:`,
      error,
    );
    return { ok: false, message: "Failed to send OTP" };
  }
}

export async function verifyOTP(phoneNumber: string, code: string) {
  "use server";
  try {
    const verification = await client.verify.v2
      .services(twilioAdmin.verifyServiceSid)
      .verificationChecks.create({
        to: phoneNumber,
        code: code,
      });

    // if (!verification.ok || !verification.status || !verification.sid) {
    //   throw new Error(`Failed to verify OTP - ${verification.error?.message}`);
    // }

    if (verification.status === "approved") {
      return {
        ok: true,
        data: { verified: true },
        message: "OTP verified successfully",
      };
    }

    return { ok: true, data: { verified: false }, message: "Invalid OTP" };
  } catch (error) {
    console.error(`Error in verifyOTP for phone number ${phoneNumber}:`, error);
    return {
      ok: false,
      data: { verified: false },
      message: "Failed to verify OTP",
    };
  }
}
