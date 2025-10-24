import { logger, task } from "@trigger.dev/sdk/v3";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { friends, userEchoSessions, users } from "@/db/schema";
import { Platform } from "@/db/types";
import { spotifyAdmin } from "@/lib/spotifyAdmin";
import { twilioAdmin } from "@/lib/twilioAdmin";
import { SpotifyPlatform } from "@/platforms";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");

const accountSid = twilioAdmin.accountSid;
const authToken = twilioAdmin.authToken;
const fromNumber = twilioAdmin.phoneNumber;
const client = twilio(accountSid, authToken);

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

export const onboardingCompletionTask = task({
  id: "onboarding-completion",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: { user: UserData }, { ctx }) => {
    logger.log("onboarding task starting", { payload, ctx });

    // FIXME: send just one db request
    try {
      // FIXME: not sure if needed, adding just in case
      const [user] = await db
        .select({
          id: users.id,
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

      // get user friends' most recent shared songs (1 song per friend, max 15 friends)
      // First get the user's friends
      const userFriends = await db
        .select({ friendId: friends.friendId })
        .from(friends)
        .where(eq(friends.userId, payload.user.userId));

      if (userFriends.length === 0) {
        logger.log(
          `no friends found for user ${payload.user.userId}, sending generic playlist instead`,
        );

        await sendMessages({
          phoneNumber: payload.user.phoneNumber,
          playlistId: spotifyAdmin.genericPlaylistId,
          numFriends: 0,
          friendLinkToken: payload.user.friendLinkToken,
        });

        return {
          message: `sent generic playlist to ${payload.user.userId} at ${payload.user.phoneNumber}`,
        };
      }

      const numFriends = userFriends.length;

      // Then get echo sessions for those friends
      const friendsData = await db
        .select({
          trackId: userEchoSessions.trackId,
          createdAt: userEchoSessions.createdAt,
          userId: userEchoSessions.userId,
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
        .orderBy(desc(userEchoSessions.createdAt))
        .limit(15);
      if (friendsData.length === 0) {
        logger.log(
          `no echo sessions found for friends of user ${payload.user.userId}, sending generic playlist instead`,
        );

        await sendMessages({
          phoneNumber: payload.user.phoneNumber,
          playlistId: spotifyAdmin.genericPlaylistId,
          numFriends: numFriends,
          friendLinkToken: payload.user.friendLinkToken,
        });

        return {
          message: `sent generic playlist to ${payload.user.userId} at ${payload.user.phoneNumber}`,
        };
      }

      // FIXME: dont use type cast on friendsData
      const { ok, data, error } = await createOnboardingPlaylistForUser(
        payload.user,
        friendsData as {
          trackId: string;
          createdAt: string;
          userId: number;
        }[],
      );

      if (!ok) {
        throw new Error("error creating onboarding playlist", {
          cause: { user: payload.user, error },
        });
      }

      if (!data) {
        throw new Error(
          "no data returned from createOnboardingPlaylistForUser",
          {
            cause: { user: payload.user, data },
          },
        );
      }

      // send messages to user
      await sendMessages({
        phoneNumber: payload.user.phoneNumber,
        playlistId: data.playlistId,
        numFriends: numFriends,
        friendLinkToken: payload.user.friendLinkToken,
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
  playlistId: string;
  numFriends: number;
  friendLinkToken: string;
}) => {
  logger.log("sending messages", { payload });
  const message1 = await client.messages.create({
    body: `perfect :) at the end of the day you'll get a playlist with the songs your friends shared`,
    from: fromNumber,
    to: payload.phoneNumber,
  });

  logger.log("onboarding completion message #1 sent", { message1 });

  const message2 = await client.messages.create({
    body: `https://open.spotify.com/playlist/${payload.playlistId}`,
    from: fromNumber,
    to: payload.phoneNumber,
  });

  logger.log("onboarding completion message #2 sent", { message2 });

  const message3 = await client.messages.create({
    body: `and that's echo :)`,
    from: fromNumber,
    to: payload.phoneNumber,
  });

  logger.log("onboarding completion message #3 sent", { message3 });

  const message4 = await client.messages.create({
    body: `
      you only have ${payload.numFriends} friends
      here's your unique friend request link. send friends this link to add them and start discovering music together :)`,
    from: fromNumber,
    to: payload.phoneNumber,
  });

  logger.log("onboarding completion message #4 sent", { message4 });

  const message5 = await client.messages.create({
    body: `https://text-echo.com/${payload.friendLinkToken}`,
    from: fromNumber,
    to: payload.phoneNumber,
  });

  logger.log("onboarding completion message #5 sent", { message5 });
};

const createOnboardingPlaylistForUser = async (
  user: UserData,
  friendsData: { trackId: string; createdAt: string; userId: number }[],
) => {
  if (user.platform === Platform.SPOTIFY) {
    return await handleSpotifyUser(user, friendsData);
  } else if (user.platform === Platform.APPLE_MUSIC) {
    // return await handleAppleMusicUser(user, friendsData);
    return { ok: false, data: null, error: `apple music not implemented yet` };
  }

  return { ok: false, data: null, error: `invalid platform ${user.platform}` };
};

const handleSpotifyUser = async (
  user: UserData,
  friendsData: { trackId: string; createdAt: string; userId: number }[],
) => {
  // refresh spotify access token if it's expired
  if (new Date(user.tokenExpiresAt) < new Date()) {
    logger.log("spotify token expired, refreshing ...", { user: user });

    const {
      ok: refreshTokensOk,
      data: refreshTokensData,
      error: refreshTokensError,
    } = await SpotifyPlatform.refreshTokens({
      userId: user.userId,
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

  const playlistDate = new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
  });
  const playlistNameAbbreviation = user.firstName.endsWith("s") ? "'s" : "'s";

  // generate spotify playlist of last songs shared by friends

  const {
    ok: createPlaylistOk,
    data: createPlaylistData,
    error: createPlaylistError,
  } = await SpotifyPlatform.createPlaylist({
    userId: user.platformUserId,
    accessToken: user.accessToken,
    playlistName: `${user.firstName}${playlistNameAbbreviation} echo ${playlistDate}`,
    playlistDescription: `here are the songs your friends shared for the ${playlistDate} echo`,
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

  const songURIs = friendsData.map(
    (friend) => `spotify:track:${friend.trackId}`,
  );
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

  return { ok: true, data: createPlaylistData, error: null };
};

const handleAppleMusicUser = async (
  user: UserData,
  friendsData: { trackId: string; createdAt: string; userId: number }[],
) => {
  return { ok: false, data: null, error: `apple music not implemented yet` };
};
