import { logger, task, wait } from "@trigger.dev/sdk/v3";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const client = twilio(accountSid, authToken);

export const onboardingTask = task({
  id: "onboarding",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: {phone_number: string}, { ctx }) => {
    logger.log("onboarding task starting", { payload, ctx });

    const message = await client.messages.create({
        body: `
        welcome to echo - thanks for signing up :)
        here is how it works:

        1. we'll text you every 3 days to share a song
        2. submit your song
        3. at the end of the day, we'll text you the songs your friends shared`,
        from: fromNumber,
        to: payload.phone_number,
      });

    logger.log("onboarding message sent", { message });

    return {
      message: `onboarding message sent to ${payload.phone_number}`,
    }
  },
});