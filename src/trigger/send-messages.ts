import { logger, task } from "@trigger.dev/sdk/v3";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { CONTACT_CARD_PLACEHOLDER, MessageType } from "@/db/types";
import { twilioAdmin } from "@/lib/twilioAdmin";
import { embedLinksForInternational } from "./utils/message-helpers";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");

const accountSid = twilioAdmin.accountSid;
const authToken = twilioAdmin.authToken;
const fromNumber = twilioAdmin.phoneNumber;
const client = twilio(accountSid, authToken);

const INTER_MESSAGE_DELAY_MS = 1000;

export const sendMessagesTask = task({
  id: "send-messages",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: { data: Record<string, Array<string>> }, { ctx }) => {
    logger.log("send messages task starting", { payload, ctx });

    const userIds = await db
      .select({
        id: users.id,
        phoneNumber: users.phoneNumber,
      })
      .from(users)
      .where(inArray(users.phoneNumber, Object.keys(payload.data)));

    const phoneNumberToUserIdLookup = new Map<string, number>();
    for (const user of userIds) {
      phoneNumberToUserIdLookup.set(user.phoneNumber, user.id);
    }

    for (const [phoneNumber, textMessages] of Object.entries(payload.data)) {
      const testMessagesCleaned = embedLinksForInternational(
        phoneNumber,
        textMessages,
      );

      for (const textMessage of testMessagesCleaned) {
        const userId = phoneNumberToUserIdLookup.get(phoneNumber);
        if (!userId) {
          logger.error("user not found for phone number", { phoneNumber });
          continue;
        }

        try {
          let response: any;
          if (textMessage === CONTACT_CARD_PLACEHOLDER) {
            // Send MMS with contact card
            response = await client.messages.create({
              // body: "save our contact for easy access",
              from: fromNumber,
              to: phoneNumber,
              mediaUrl: [`https://text-echo.com/api/contact`],
            });
          } else {
            response = await client.messages.create({
              body: textMessage,
              from: fromNumber,
              to: phoneNumber,
            });
          }

          logger.log("message sent", { textMessage, response });

          // check response var
          await db.insert(messages).values({
            userId: userId,
            message: textMessage,
            messageType: MessageType.OUTBOUND,
          });
        } catch (error: any) {
          // Handle Twilio errors gracefully
          if (error.code === 21610) {
            // User has unsubscribed (sent STOP)
            logger.warn("skipping unsubscribed recipient", {
              phoneNumber,
              userId,
              error: error.message,
            });
          } else if (error.code === 21211) {
            // Invalid phone number
            logger.error("invalid phone number", {
              phoneNumber,
              userId,
              error: error.message,
            });
          } else {
            // Log other Twilio errors but continue processing
            logger.error("error sending message", {
              phoneNumber,
              userId,
              textMessage,
              error: error.message,
              errorCode: error.code,
            });
          }
          // Continue to next message instead of failing the entire task
        }

        // wait for 1 second between messages to help preserve ordering
        await new Promise((resolve) =>
          setTimeout(resolve, INTER_MESSAGE_DELAY_MS),
        );
      }
    }

    return {
      message: `send messages task completed`,
    };
  },
});
