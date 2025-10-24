import { logger, task } from "@trigger.dev/sdk/v3";
import { twilioAdmin } from "@/lib/twilioAdmin";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");

const accountSid = twilioAdmin.accountSid;
const authToken = twilioAdmin.authToken;
const fromNumber = twilioAdmin.phoneNumber;
const client = twilio(accountSid, authToken);

export const notifyNewFriendTask = task({
  id: "notify-new-friend",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (
    payload: {
      userPhoneNumber: string;
      friendFirstName: string;
      friendLastName: string;
    },
    { ctx },
  ) => {
    logger.log("notify new friend task starting", { payload, ctx });

    // const message = await client.messages.create({
    //   body: `
    //   you’re now friends with ${payload.friendFirstName} ${payload.friendLastName} :)
    //   `,
    //   from: fromNumber,
    //   to: payload.userPhoneNumber,
    // });

    // logger.log("notify new friend message sent", { message });

    return {
      message: `notify new friend message sent to ${payload.userPhoneNumber}`,
    };
  },
});
