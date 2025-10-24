import { logger, task } from "@trigger.dev/sdk/v3";
import { twilioAdmin } from "@/lib/twilioAdmin";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");

const accountSid = twilioAdmin.accountSid;
const authToken = twilioAdmin.authToken;
const fromNumber = twilioAdmin.phoneNumber;
const client = twilio(accountSid, authToken);

export const welcomeBackTask = task({
  id: "welcome-back",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: { phoneNumber: string }, { ctx }) => {
    logger.log("welcome back task starting", { payload, ctx });

    // const message = await client.messages.create({
    //   body: `
    //     welcome back :) you’ll get your first echo soon and can start discovering music with friends`,
    //   from: fromNumber,
    //   to: payload.phoneNumber,
    // });

    // logger.log("welcome back message sent", { message });

    return {
      message: `welcome back message sent to ${payload.phoneNumber}`,
    };
  },
});
