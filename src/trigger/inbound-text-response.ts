import { logger, task } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { MessageType } from "@/db/types";
import { sendMessagesTask } from "./send-messages";

export const inboundTextResponseTask = task({
  id: "inbound-text-response",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (
    payload: { inboundMessage: string; phoneNumber: string },
    { ctx },
  ) => {
    logger.log("inbound text response task starting", { payload, ctx });

    const data = new Map<string, Array<string>>([[payload.phoneNumber, []]]);

    try {
      const [user] = await db
        .select({
          id: users.id,
          receivedNoTextAlert: users.receivedNoTextAlert,
          isDeleted: users.isDeleted,
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
        data.set(payload.phoneNumber, [
          `your account has been deleted. Click here to reactivate: https://text-echo.com`,
        ]);

        await sendMessagesTask.trigger({
          data: data,
        });

        return {
          message: `responded to deleted user message from ${payload.phoneNumber}:'${payload.inboundMessage}'`,
        };
      }

      if (payload.inboundMessage.trim().toLowerCase() === "help") {
        data.set(payload.phoneNumber, ["RESPONDING TO HELP MESSAGE"]);

        await sendMessagesTask.trigger({
          data: data,
        });

        return {
          message: `responded to help message from ${payload.phoneNumber}: '${payload.inboundMessage}'`,
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

      data.set(payload.phoneNumber, [
        'thanks for the message - we don\'t respond to texts, but text "help" if you need support',
      ]);

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
