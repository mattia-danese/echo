import { logger, task } from "@trigger.dev/sdk/v3";
import { twilioAdmin } from "@/lib/twilioAdmin";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");

const accountSid = twilioAdmin.accountSid;
const authToken = twilioAdmin.authToken;
const fromNumber = twilioAdmin.phoneNumber;
const client = twilio(accountSid, authToken);

export const onboardingTask = task({
  id: "onboarding",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (
    payload: { phone_number: string; onboarding_token: string },
    { ctx },
  ) => {
    logger.log("onboarding task starting", { payload, ctx });

    // const message = await client.messages.create({
    //     body: `
    //     welcome to echo - thanks for signing up :)
    //     here is how it works:

    //     1. we'll text you every 3 days to share a song
    //     2. submit your song
    //     3. at the end of the day, we'll text you the songs your friends shared`,
    //     from: fromNumber,
    //     to: payload.phone_number,
    //   });

    // logger.log("onboarding message #1 sent", { message });

    // const message2 = await client.messages.create({
    //   body: `
    //   let's walk through a live example. click on the link below to share your first song`,
    //   from: fromNumber,
    //   to: payload.phone_number,
    // });

    // logger.log("onboarding message #2 sent", { message2 });

    // const message3 = await client.messages.create({
    //   body: `
    //   https://text-echo.com/onboarding/${payload.onboarding_token}`,
    //   from: fromNumber,
    //   to: payload.phone_number,
    // });

    // logger.log("onboarding message #3 sent", { message3 });

    return {
      message: `onboarding message sent to ${payload.phone_number}`,
    };
  },
});
