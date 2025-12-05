import { logger, task } from "@trigger.dev/sdk/v3";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  friends,
  songLinkCacheMappings,
  userEchoSessions,
  users,
} from "@/db/schema";
import { Platform } from "@/db/types";
import { env } from "@/lib/env";
import { spotifyAdmin } from "@/lib/spotifyAdmin";
import { AppleMusicPlatform, SpotifyPlatform } from "@/platforms";
import { sendMessagesTask } from "./send-messages";
import { embedLinksForInternational } from "./utils/message-helpers";

type UserData = {
  userId: number;
  friendLinkToken: string;
  platformUserId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  firstName: string;
  phoneNumber: string;
  platform: Platform;
};

const NUM_SONGS_PER_PLAYLIST = 10;

export const onboardingCompletionTask = task({
  id: "onboarding-completion",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: { user: UserData }, { ctx }) => {
    logger.log("onboarding task starting", { payload, ctx });

    // FIXME: send just one db request to get friends + echo sessions of friends
    try {
      // FIXME: not sure if needed, adding just in case
      const [user] = await db
        .select({
          userId: users.id,
          isDeleted: users.isDeleted,
        })
        .from(users)
        .where(eq(users.id, payload.user.userId))
        .limit(1);

      if (user.isDeleted) {
        return {
          message: `user ${payload.user.userId} is deleted, skipping onboarding completion`,
        };
      }

      const genericPlaylistLink =
        payload.user.platform === Platform.SPOTIFY
          ? spotifyAdmin.genericPlaylistLink
          : env.ONBOARDING_COMPLETION_GENERIC_APPLE_MUSIC_PLAYLIST;

      // get user friends' most recent shared songs (1 song per friend, max 15 friends)

      // First get the user's friends
      const userFriends = await db
        .select({
          friendId: friends.friendId,
          isDeleted: users.isDeleted,
          firstName: users.firstName,
        })
        .from(friends)
        .innerJoin(users, eq(friends.friendId, users.id))
        .where(
          and(
            eq(friends.userId, payload.user.userId),
            eq(users.isDeleted, false),
          ),
        );

      logger.log("user friends", { userFriends });

      if (userFriends.length === 0) {
        logger.log(
          `no friends found for user ${payload.user.userId}, sending generic playlist instead`,
        );

        await sendMessages({
          phoneNumber: payload.user.phoneNumber,
          playlistLink: genericPlaylistLink,
          friendNames: [],
        });

        return {
          message: `sent generic playlist to ${payload.user.userId} at ${payload.user.phoneNumber}`,
        };
      }

      const friendNames = userFriends.map((f) => f.firstName);

      // Then get echo sessions for those friends (most recent song per friend)
      // Using DISTINCT ON to get the most recent track for each friend
      const friendSubmissions = await db
        .selectDistinctOn([userEchoSessions.userId], {
          userId: userEchoSessions.userId,
          platform: userEchoSessions.platform,
          trackId: userEchoSessions.trackId,
          createdAt: userEchoSessions.createdAt,
        })
        .from(userEchoSessions)
        .where(
          and(
            inArray(
              userEchoSessions.userId,
              userFriends.map((f) => f.friendId),
            ),
            isNotNull(userEchoSessions.trackId),
          ),
        )
        .orderBy(userEchoSessions.userId, desc(userEchoSessions.createdAt))
        .limit(NUM_SONGS_PER_PLAYLIST);

      if (friendSubmissions.length === 0) {
        logger.log(
          `no echo sessions found for friends of user ${payload.user.userId}, sending generic playlist instead`,
        );

        await sendMessages({
          phoneNumber: payload.user.phoneNumber,
          playlistLink: genericPlaylistLink,
          friendNames: friendNames,
        });

        return {
          message: `sent generic playlist to ${payload.user.userId} at ${payload.user.phoneNumber}`,
        };
      }

      // Create list of songs for playlist from friendsData
      const playlistSongs: string[] = [];
      const friendsThatSharedSongsNames = [];

      for (const friendSubmission of friendSubmissions) {
        friendsThatSharedSongsNames.push(
          userFriends.find((f) => f.friendId === friendSubmission.userId)
            ?.firstName,
        );

        if (payload.user.platform === friendSubmission.platform) {
          playlistSongs.push(friendSubmission.trackId as string);
        } else {
          const { ok: convertTrackOk, trackId: convertedTrackId } =
            await convertTrack(
              friendSubmission.trackId as string,
              payload.user.platform,
            );

          if (!convertTrackOk || !convertedTrackId) continue;

          playlistSongs.push(convertedTrackId);
        }
      }

      if (playlistSongs.length === 0) {
        logger.log(
          `no songs added to playlist for user ${payload.user.userId}, sending generic playlist instead`,
        );

        await sendMessages({
          phoneNumber: payload.user.phoneNumber,
          playlistLink: genericPlaylistLink,
          friendNames: friendNames,
        });

        return {
          message: `sent generic playlist to ${payload.user.userId} at ${payload.user.phoneNumber}`,
        };
      }

      const playlistDate = new Date().toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
      });
      const playlistNameAbbreviation = payload.user.firstName.endsWith("s")
        ? "'s"
        : "'s";

      let playlistDescription = "";

      // dont need to check for 0 songs here because we already checked that above
      if (playlistSongs.length >= 1 && playlistSongs.length <= 3) {
        let friendNamesString = "";

        if (friendsThatSharedSongsNames.length === 1) {
          friendNamesString = friendsThatSharedSongsNames[0] as string;
        } else if (friendsThatSharedSongsNames.length === 2) {
          friendNamesString = `${friendsThatSharedSongsNames[0]} and ${friendsThatSharedSongsNames[1]}`;
        } else {
          friendNamesString =
            friendsThatSharedSongsNames.slice(0, -1).join(", ") +
            `, and ${friendsThatSharedSongsNames[friendsThatSharedSongsNames.length - 1]}`;
        }
        playlistDescription = `this is what ${friendNamesString} recently shared on echo`;
      } else {
        playlistDescription = `here are the songs your friends recently shared on echo`;
      }

      // Create playlist on user's platform
      const { ok, data, error } = await createOnboardingPlaylistForUser(
        payload.user,
        playlistSongs,
        playlistDate,
        playlistNameAbbreviation,
        playlistDescription,
      );

      if (!ok || !data || error) {
        logger.error(
          "error creating onboarding playlist - sending generic playlist instead",
          {
            user: payload.user,
            error,
          },
        );

        await sendMessages({
          phoneNumber: payload.user.phoneNumber,
          playlistLink: genericPlaylistLink,
          friendNames: friendNames,
        });

        return {
          message: `sent generic playlist to ${payload.user.userId} at ${payload.user.phoneNumber}`,
        };
      }

      // send playlist link to user
      await sendMessages({
        phoneNumber: payload.user.phoneNumber,
        playlistLink: data,
        friendNames: friendNames,
      });

      return {
        message: `sent onboarding completion playlist to ${payload.user.userId} at ${payload.user.phoneNumber}`,
      };
    } catch (error) {
      logger.error("error onboarding completion", { error });
      throw error;
    }
  },
});

const sendMessages = async (payload: {
  phoneNumber: string;
  playlistLink: string;
  friendNames: string[];
}) => {
  const numFriends = payload.friendNames.length;

  const friendMessage =
    numFriends === 1
      ? `btw your only friend is ${payload.friendNames[0]} :(`
      : `you have ${numFriends} friends :(`;

  const messages = [
    `thanks for sharing your first song. at the end of the day you'll get a playlist like this with the songs your friends shared`,
    payload.playlistLink,
    `and that's echo :)`,
    `${friendMessage} text us "get link" to get your unique friend request link`,
  ];

  await sendMessagesTask.trigger({
    data: {
      [payload.phoneNumber]: embedLinksForInternational(
        payload.phoneNumber,
        messages
      ),
    },
  });

  return {
    message: `sent onboarding completion messages to ${payload.phoneNumber}`,
  };
};

const createOnboardingPlaylistForUser = async (
  user: UserData,
  playlistSongs: string[],
  playlistDate: string,
  playlistNameAbbreviation: string,
  playlistDescription: string,
) => {
  if (user.platform === Platform.SPOTIFY) {
    return handleSpotifyUser(
      user,
      playlistSongs,
      playlistDate,
      playlistNameAbbreviation,
      playlistDescription,
    );
  } else if (user.platform === Platform.APPLE_MUSIC) {
    return handleAppleMusicUser(
      user,
      playlistSongs,
      playlistDate,
      playlistNameAbbreviation,
      playlistDescription,
    );
  }

  return { ok: false, data: null, error: `invalid platform ${user.platform}` };
};

const handleSpotifyUser = async (
  user: UserData,
  playlistSongs: string[],
  playlistDate: string,
  playlistNameAbbreviation: string,
  playlistDescription: string,
) => {
  // refresh spotify access token if it's expired
  if (new Date(user.tokenExpiresAt) < new Date()) {
    logger.log("spotify token expired, refreshing ...", { user: user });

    const {
      ok: refreshTokensOk,
      data: refreshTokensData,
      error: refreshTokensError,
    } = await SpotifyPlatform.refreshTokens({
      userId: user.platformUserId,
      refreshToken: user.refreshToken,
    });

    if (!refreshTokensOk) {
      logger.error("error refreshing spotify token", {
        user,
        refreshTokensError,
      });
      return { ok: false, data: null, error: refreshTokensError };
    }

    if (!refreshTokensData) {
      logger.error("no data returned from refreshAccessToken", {
        user,
        refreshTokensData,
      });
      return {
        ok: false,
        data: null,
        error: `no data returned from refreshAccessToken`,
      };
    }

    user.accessToken = refreshTokensData.accessToken;
    user.refreshToken = refreshTokensData.refreshToken;
    user.tokenExpiresAt = refreshTokensData.expiresIn;

    logger.log("user update complete", { user: user });
  }

  logger.log("creating onboarding completion playlist for user", {
    user: user,
  });

  // create spotify playlist
  const {
    ok: createPlaylistOk,
    data: createPlaylistData,
    error: createPlaylistError,
  } = await SpotifyPlatform.createPlaylist({
    userId: user.platformUserId,
    accessToken: user.accessToken,
    playlistName: `${user.firstName}${playlistNameAbbreviation} echo ${playlistDate}`,
    // TODO: possibly change description?
    playlistDescription: playlistDescription,
    playlistDate: playlistDate,
  });

  if (!createPlaylistOk) {
    logger.error("error creating playlist", { user, createPlaylistError });
    return { ok: false, data: null, error: createPlaylistError };
  }

  if (!createPlaylistData) {
    logger.error("no data returned from createPlaylist", {
      user,
      createPlaylistData,
    });
    return {
      ok: false,
      data: null,
      error: `no data returned from createPlaylist`,
    };
  }

  logger.log("playlist created", { createPlaylistData });

  const songURIs = playlistSongs.map((song) => `spotify:track:${song}`);
  const { ok: addSongsToPlaylistOk, error: addSongsToPlaylistError } =
    await SpotifyPlatform.populatePlaylist({
      accessToken: user.accessToken,
      trackURIs: songURIs,
      playlistId: createPlaylistData.playlistId,
    });

  if (!addSongsToPlaylistOk) {
    logger.error("error adding songs to playlist", {
      user: user,
      addSongsToPlaylistError,
    });
    return { ok: false, data: null, error: addSongsToPlaylistError };
  }

  logger.log("adding songs to playlist done");

  return {
    ok: true,
    data: SpotifyPlatform.createPlaylistLink(createPlaylistData.playlistId),
    error: null,
  };
};

const handleAppleMusicUser = async (
  user: UserData,
  playlistSongs: string[],
  playlistDate: string,
  playlistNameAbbreviation: string,
  playlistDescription: string,
) => {
  const { ok, data, error } =
    await AppleMusicPlatform.createAndPopulatePlaylist({
      accessToken: user.accessToken,
      playlistName: `${user.firstName}${playlistNameAbbreviation} echo ${playlistDate}`,
      playlistDescription: playlistDescription,
      playlistDate: playlistDate,
      songs: playlistSongs,
    });

  if (!ok || !data || error) {
    logger.error("error creating apple music playlist", { user, error });
    return { ok: false, data: null, error: error };
  }

  return {
    ok: true,
    data: AppleMusicPlatform.createPlaylistLink(data.playlistId),
    error: null,
  };
};

const convertTrack = async (trackId: string, platform: Platform) => {
  try {
    const [submittedTrack] = await db
      .select({ songlinkCacheId: songLinkCacheMappings.songlinkCacheId })
      .from(songLinkCacheMappings)
      .where(eq(songLinkCacheMappings.trackId, trackId))
      .limit(1);

    if (!submittedTrack) {
      return {
        ok: false,
        trackId: null,
        error: `TrackId ${trackId} not found in songlink_cache_mappings when converting track to ${platform}`,
      };
    }

    const [convertedTrack] = await db
      .select({ trackId: songLinkCacheMappings.trackId })
      .from(songLinkCacheMappings)
      .where(
        and(
          eq(
            songLinkCacheMappings.songlinkCacheId,
            submittedTrack.songlinkCacheId,
          ),
          eq(songLinkCacheMappings.platform, platform),
        ),
      )
      .limit(1);

    if (!convertedTrack) {
      return {
        ok: false,
        trackId: null,
        error: `Track with songlinkCacheId ${submittedTrack.songlinkCacheId} not found in songlink_cache_mappings when converting track to ${platform}`,
      };
    }

    return { ok: true, trackId: convertedTrack.trackId, error: null };
  } catch (error) {
    return { ok: false, trackId: null, error: error };
  }
};
