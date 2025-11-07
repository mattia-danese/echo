import { logger, task } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { MessageType } from "@/db/types";
import { env } from "@/lib/env";
import { sendMessagesTask } from "./send-messages";

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
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          receivedNoTextAlert: users.receivedNoTextAlert,
          isDeleted: users.isDeleted,
          friendLinkToken: users.friendLinkToken,
          sentGetLink: users.sentGetLink,
        })
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

      if (user.isDeleted) {
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

      if (payload.inboundMessage.trim().toLowerCase() === "help") {
        data[payload.phoneNumber] = [
          "we notified our team about your issue. they will personally reach out shortly",
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

      if (payload.inboundMessage.trim().toLowerCase() === "get link") {
        if (!user.sentGetLink) {
          await db
            .update(users)
            .set({ sentGetLink: true })
            .where(eq(users.id, user.id));
        }

        data[payload.phoneNumber] = [
          [
            "send this link now to add friends and start discovering music together",
            "",
            `if you ever forget your link, just text us "get link" and we'll send it to you`,
          ].join("\n"),
          `https://text-echo.com/${user.friendLinkToken}`,
        ];

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
        `thanks for the message - we don't respond to texts, but text "help" if you need support`,
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
