import { logger, task, wait } from "@trigger.dev/sdk/v3";
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
        body: "perfect - you're all set. reply back with 3 friends' contacts or phone numbers to add them\n\n ps: they don’t have to be on echo yet :)",
        from: fromNumber,
        to: payload.phone_number,
      });

    logger.log("onboarding message sent", { message });

    return {
      message: `onboarding message sent to ${payload.phone_number}`,
    }
  },
});