import { logger, task } from "@trigger.dev/sdk/v3";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { MessageType } from "@/db/types";
import { twilioAdmin } from "@/lib/twilioAdmin";

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
  run: async (payload: { data: Map<string, Array<string>> }, { ctx }) => {
    logger.log("send messages task starting", { payload, ctx });

    const userIds = await db
      .select({
        id: users.id,
        phoneNumber: users.phoneNumber,
      })
      .from(users)
      .where(inArray(users.phoneNumber, Array.from(payload.data.keys())));

    const phoneNumberToUserIdLookup = new Map<string, number>();
    for (const user of userIds) {
      phoneNumberToUserIdLookup.set(user.phoneNumber, user.id);
    }

    for (const [phoneNumber, textMessages] of payload.data.entries()) {
      for (const textMessage of textMessages) {
        const userId = phoneNumberToUserIdLookup.get(phoneNumber);
        if (!userId) {
          logger.error("user not found for phone number", { phoneNumber });
          continue;
        }

        const response = await client.messages.create({
          body: textMessage,
          from: fromNumber,
          to: phoneNumber,
        });

        logger.log("message sent", { response });

        // check response var
        await db.insert(messages).values({
          userId: userId,
          message: textMessage,
          messageType: MessageType.OUTBOUND,
        });
      }
    }

    // wait for 1 second between messages to help preserve ordering
    await new Promise((resolve) => setTimeout(resolve, INTER_MESSAGE_DELAY_MS));

    return {
      message: `send messages task completed`,
    };
  },
});
