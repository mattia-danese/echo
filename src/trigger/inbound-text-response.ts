import crypto from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { logger, task } from "@trigger.dev/sdk/v3";
import { and, desc, eq } from "drizzle-orm";
import { createUser, deleteUser, submitSong } from "@/app/actions";
import { db } from "@/db";
import {
  echoSessions,
  friends,
  messages,
  spotifyAuth,
  userEchoSessions,
  users,
} from "@/db/schema";
import { MessageType, Platform } from "@/db/types";
import { env } from "@/lib/env";
import { SpotifyPlatform } from "@/platforms";
import { sendMessagesTask } from "./send-messages";
import { embedLinksForInternational } from "./utils/message-helpers";

export const inboundTextResponseTask = task({
  id: "inbound-text-response",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: { inboundMessage: string; phoneNumber: string }) => {
    logger.log("inbound text response task starting", { data: payload });

    logger.log("THIS IS INBOUND MESSAGE:", {
      inboundMessage: payload.inboundMessage,
    });
    logger.log("THIS IS PHONE NUMBER:", { phoneNumber: payload.phoneNumber });

    // Use a plain object instead of Map for serialization
    const data: Record<string, Array<string>> = {
      [payload.phoneNumber]: [],
    };

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.phoneNumber, payload.phoneNumber))
        .limit(1);

      if (!user) {
        throw new Error(`received text from user not found for phone number:`, {
          cause: {
            phoneNumber: payload.phoneNumber,
            inboundMessage: payload.inboundMessage,
          },
        });
      }

      await db.insert(messages).values({
        userId: user.id,
        message: payload.inboundMessage,
        messageType: MessageType.INBOUND,
      });

      const message = payload.inboundMessage.trim();
      const messageLower = message.toLowerCase();

      if (user.isDeleted) {
        if (messageLower === "unstop" || messageLower === "start") {
          data[payload.phoneNumber] = [
            "login at https://text-echo.com to reactivate your account",
          ];

          await sendMessagesTask.trigger({
            data: data,
          });

          return {
            message: `sent login link to ${user.id}`,
          };

          /* 
            NOTE: ideally we would call createUser() directly but need to pass 'auth' token for Apple Music users which we dont have
            
            // not sending a message since Twilio sends automatic START response
            await createUser({
              firstName: user.firstName,
              lastName: user.lastName,
              phoneNumber: payload.phoneNumber,
              gender: user.gender,
              dateOfBirth: user.dateOfBirth,
              auth: "",
              platform: user.platform,
              referralFriendLinkToken: null,
            });

            return {
              message: `recreated user ${user.id} because they sent "start/unstop"`,
            };
          */
        }

        data[payload.phoneNumber] = [
          `your account has been deleted. Click here to reactivate: https://text-echo.com`,
        ];

        await sendMessagesTask.trigger({
          data: data,
        });

        return {
          message: `responded to deleted user message from ${payload.phoneNumber}:'${payload.inboundMessage}'`,
        };
      }

      if (SpotifyPlatform.isTrackLink(message)) {
        try {
          const [spotifyAuthData] = await db
            .select({
              accessToken: spotifyAuth.accessToken,
              refreshToken: spotifyAuth.refreshToken,
              tokenExpiresAt: spotifyAuth.tokenExpiresAt,
              platformUserId: spotifyAuth.userId,
            })
            .from(spotifyAuth)
            .limit(1);

          if (new Date(spotifyAuthData.tokenExpiresAt) < new Date()) {
            const {
              ok: refreshTokensOk,
              data: refreshTokensData,
              error: refreshTokensError,
            } = await SpotifyPlatform.refreshTokens({
              userId: spotifyAuthData.platformUserId,
              refreshToken: spotifyAuthData.refreshToken,
            });

            if (!refreshTokensOk || !refreshTokensData || refreshTokensError) {
              throw new Error(
                `error refreshing spotify token: ${refreshTokensError}`,
                {
                  cause: {
                    refreshTokensError: refreshTokensError,
                  },
                },
              );
            }

            spotifyAuthData.accessToken = refreshTokensData.accessToken;
            spotifyAuthData.refreshToken = refreshTokensData.refreshToken;
            spotifyAuthData.tokenExpiresAt = refreshTokensData.expiresIn;
          }

          const {
            ok,
            data: trackData,
            error,
          } = await SpotifyPlatform.getTrackFromLink(
            message,
            spotifyAuthData.accessToken,
          );

          if (!ok || !trackData || error) {
            throw new Error(`error getting spotify track from link: ${error}`, {
              cause: {
                link: message,
                error: error,
              },
            });
          }

          const [recentSession] = await db
            .select({
              sessionId: echoSessions.id,
              sessionEndsAt: echoSessions.end,
              userEchoSessionToken: userEchoSessions.token,
            })
            .from(echoSessions)
            .leftJoin(
              userEchoSessions,
              and(
                eq(userEchoSessions.sessionId, echoSessions.id),
                eq(userEchoSessions.userId, user.id),
              ),
            )
            .orderBy(desc(echoSessions.createdAt))
            .limit(1);

          if (!recentSession) {
            throw new Error(`no recent echo session found`, {
              cause: {
                userId: user.id,
                message: message,
              },
            });
          }

          // Generate token if null (onboarding case where userEchoSession doesn't exist yet)
          const userEchoSessionToken =
            recentSession.userEchoSessionToken ||
            crypto.randomBytes(16).toString("base64url");

          const { ok: submitSongOk, message: submitSongMessage } =
            await submitSong({
              userId: user.id,
              userEchoSessionToken: userEchoSessionToken,
              sessionId: recentSession.sessionId,
              platform: Platform.SPOTIFY,
              trackId: trackData.trackId,
              trackName: trackData.trackName,
              artists: trackData.artists,
              albumImageUrl: trackData.albumImageUrl,
              platformAccessToken: spotifyAuthData.accessToken,
            });

          if (!submitSongOk) {
            throw new Error(`error submitting song: ${submitSongMessage}`, {
              cause: {
                message: submitSongMessage,
                error: error,
              },
            });
          }

          const timeUntilNextPlaylist =
            new Date(recentSession.sessionEndsAt).getTime() - Date.now();

          // Convert to total minutes and round
          const totalMinutes =
            Math.round(timeUntilNextPlaylist / (1000 * 60)) + 30;
          // Round to nearest hour
          const totalHours = Math.round(totalMinutes / 60);

          const timeFormatted = `${totalHours} hour${totalHours !== 1 ? "s" : ""}`;

          if (user.whenOnboardingComplete) {
            data[payload.phoneNumber] = ["thanks for sharing :)"];
          } else {
            const numFriends = await db
              .select({ firstName: users.firstName })
              .from(friends)
              .innerJoin(users, eq(friends.friendId, users.id))
              .where(eq(friends.userId, user.id));

            const friendMessage =
              numFriends.length === 1
                ? `btw your only friend is ${numFriends[0].firstName} :(`
                : `you have ${numFriends.length} friends :(`;

            data[payload.phoneNumber] = [
              "nice pick - that's echo :) from now on, share a song with us every few days & you'll get a playlist with the songs your friends send. if you don't send a song, you don't get the playlist",
              `the next playlist comes out in ${timeFormatted}. stay tuned, we'll text you then`,
              `${friendMessage} text us "get link" to get your unique friend request link`,
            ];

            await db
              .update(users)
              .set({ whenOnboardingComplete: new Date().toISOString() })
              .where(eq(users.id, user.id));
          }

          await sendMessagesTask.trigger({
            data: data,
          });

          return {
            message: `responded to spotify song submission from ${payload.phoneNumber}: '${payload.inboundMessage}'`,
          };
        } catch (error) {
          logger.error("error submitting song", { error });

          // Manually capture in Sentry
          Sentry.captureException(error, {
            extra: {
              phoneNumber: payload.phoneNumber,
              inboundMessage: payload.inboundMessage,
              context: "spotify_link_submission_failed",
            },
            tags: {
              taskId: "inbound-text-response",
              errorType: "spotify_link_error",
            },
          });

          data[payload.phoneNumber] = ["we cannot regonize this link"];

          await sendMessagesTask.trigger({
            data: data,
          });

          return {
            message: `could not recognize spotify link from ${payload.phoneNumber}: '${payload.inboundMessage}'`,
          };
        }
      }

      // if (AppleMusicPlatform.isSongLink(message)) {
      // }

      if (messageLower === "stop") {
        // not sending a message since Twilio sends automatic STOP response

        // Pass false to skip cookie clearing since we're in a Trigger.dev task (no request context)
        await deleteUser(user.id, false);

        return {
          message: `deleted user ${user.id} because they sent "stop"`,
        };
      }

      if (messageLower === "get help") {
        data[payload.phoneNumber] = [
          "we notified our team about your issue. they'll personally reach out shortly",
        ];

        data[env.LUCAS_PHONE_NUMBER] = [
          `${user.firstName} ${user.lastName} (${payload.phoneNumber}) needs help`,
        ];

        await sendMessagesTask.trigger({
          data: data,
        });

        return {
          message: `responded to help message from ${payload.phoneNumber}: '${payload.inboundMessage}'`,
        };
      }

      if (messageLower === "get link") {
        if (!user.sentGetLink) {
          await db
            .update(users)
            .set({ sentGetLink: true })
            .where(eq(users.id, user.id));
        }

        const messages = [
          [
            "share this link with friends to add them & start discovering music together - the same link works whether or not your friends are already on echo",
            "",
            `if you ever forget your link, just text us "get link" and we'll send it to you`,
          ].join("\n"),
          `https://text-echo.com/${user.friendLinkToken}`,
        ];

        data[payload.phoneNumber] = embedLinksForInternational(
          payload.phoneNumber,
          messages
        );

        await sendMessagesTask.trigger({
          data: data,
        });

        return {
          message: `responded to get link message from ${payload.phoneNumber}: '${payload.inboundMessage}'`,
        };
      }

      // check if we already sent no text alert to user
      if (user.receivedNoTextAlert) {
        return {
          message: `already sent no text alert to ${payload.phoneNumber} - skipping`,
        };
      }

      await db
        .update(users)
        .set({ receivedNoTextAlert: true })
        .where(eq(users.id, user.id));

      data[payload.phoneNumber] = [
        `thanks for the message - we don't respond to texts, but text "get help" if you need support`,
      ];

      await sendMessagesTask.trigger({
        data: data,
      });

      return {
        message: `sent no text alert to ${payload.phoneNumber}: '${payload.inboundMessage}'`,
      };
    } catch (error) {
      logger.error("error sending no text alert", { error });
      throw error;
    }
  },
});
