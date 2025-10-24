import { logger, task } from "@trigger.dev/sdk/v3";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { twilioAdmin } from "@/lib/twilioAdmin";

const accountSid = twilioAdmin.accountSid;
const authToken = twilioAdmin.authToken;
const fromNumber = twilioAdmin.phoneNumber;
const client = twilio(accountSid, authToken);

export const inboundTextResponseTask = task({
  id: "inbound-text-response",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (
    payload: { inboundMessage: string; phoneNumber: string },
    { ctx },
  ) => {
    logger.log("inbound text response task starting", { payload, ctx });

    if (payload.inboundMessage.trim().toLowerCase() === "help") {
      const message = await client.messages.create({
        body: `
            HELP
            `,
        from: fromNumber,
        to: payload.phoneNumber,
      });

      return {
        message: `responded to help message from ${payload.phoneNumber}: ${message}`,
      };
    }

    try {
      // check if we already sent no text alert to user
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

      if (user.isDeleted) {
        const message = await client.messages.create({
          body: `your account has been deleted. Click here to reactivate: https://text-echo.com`,
          from: fromNumber,
          to: payload.phoneNumber,
        });

        return {
          message: `responded to deleted user message from ${payload.phoneNumber}: ${message}`,
        };
      }

      if (user.receivedNoTextAlert) {
        return {
          message: `already sent no text alert to ${payload.phoneNumber} - skipping`,
        };
      }

      const message = await client.messages.create({
        body: `
        thanks for the message - we don’t respond to texts, but text "help" if you need support
        `,
        from: fromNumber,
        to: payload.phoneNumber,
      });

      await db
        .update(users)
        .set({ receivedNoTextAlert: true })
        .where(eq(users.id, user.id));

      return {
        message: `no text alert sent to ${payload.phoneNumber}: ${message}`,
      };
    } catch (error) {
      logger.error("error sending no text alert", { error });
      throw error;
    }
  },
});
