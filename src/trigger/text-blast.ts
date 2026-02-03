import { logger, task } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { twilioAdmin } from "@/lib/twilioAdmin";
import { type MessageInsert, MessageType } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");

const accountSid = twilioAdmin.accountSid;
const authToken = twilioAdmin.authToken;
const fromNumber = twilioAdmin.phoneNumber;
const client = twilio(accountSid, authToken);

export const textBlastTask = task({
  id: "text-blast",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: { messages: string[] }, { ctx }) => {
    logger.log("text blast task starting", { payload, ctx });

    const userData = await db
      .select({
        id: users.id,
        phoneNumber: users.phoneNumber,
      })
      .from(users)
      .where(eq(users.isDeleted, false));

    const messageInserts: MessageInsert[] = [];

    for (const user of userData) {
      for (const message of payload.messages) {
        const response = await client.messages.create({
          body: message,
          from: fromNumber,
          to: user.phoneNumber,
        });

        logger.log("message sent", { response });

        messageInserts.push({
          userId: user.id,
          message: message,
          messageType: MessageType.OUTBOUND,
        });
      }
    }

    if (messageInserts.length > 0) {
      await db.insert(messages).values(messageInserts);
    }

    return {
      message: `text blast task completed`,
    };
  },
});
