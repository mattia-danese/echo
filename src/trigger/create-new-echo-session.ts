import crypto from "node:crypto";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { twilioAdmin } from "@/lib/twilioAdmin";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");

const accountSid = twilioAdmin.accountSid;
const authToken = twilioAdmin.authToken;
const fromNumber = twilioAdmin.phoneNumber;
const client = twilio(accountSid, authToken);

const supabase = supabaseAdmin;

export const createNewEchoSessionTask = schedules.task({
  id: "create-new-echo-session",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute

  cron: {
    pattern: "0 11 * * 3,7", // run every Wed and Sun at 11:00 AM EST
    timezone: "America/New_York",
    environments: ["DEVELOPMENT"],
  },

  run: async () => {
    logger.log("create new echo session task starting ...");

    // create new echo session in the database
    const { data: echoSessionData, error: echoSessionError } = await supabase
      .from("echo_sessions")
      .insert({
        start: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
        end: new Date(new Date().setHours(18, 0, 0, 0)).toISOString(),
      })
      .select("id")
      .single();

    if (echoSessionError) {
      logger.error("error creating new echo session", { echoSessionError });
      throw echoSessionError;
    }

    const echoSessionId = echoSessionData.id;
    logger.log("new echo session created", { echoSessionId });

    // get all the users in the database that have completed onboarding
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("id, phone_number, platform")
      .eq("is_onboarding_complete", true);
    if (usersError) {
      logger.error("error getting users", { usersError });
      throw usersError;
    }

    logger.log("users fetched", { numUsers: usersData.length });

    // for each user, create echo session token
    const userEchoSessionData = [];

    for (const user of usersData) {
      const token = crypto.randomBytes(16).toString("base64url");

      userEchoSessionData.push({
        user_id: user.id,
        session_id: echoSessionId,
        token: token,
        platform: user.platform,
      });
    }

    logger.log("compiling user echo session data done", {
      numUserEchoSessions: userEchoSessionData.length,
    });

    // create new record in user_session table for each user (with token) -- batch write
    const { error: userSessionError } = await supabase
      .from("user_echo_sessions")
      .insert(userEchoSessionData);

    if (userSessionError) {
      logger.error("error writing to user_echo_sessions", { userSessionError });
      throw userSessionError;
    }

    logger.log("user echo sessions written to database");

    // send text to each user with their echo session link
    // for (const userEchoSession of userEchoSessionData) {
    //   const startEchoMessage = await client.messages.create({
    //     body: `
    //     start the echo :)

    //     click here to share what you've been listening to by 9pm tonight`,
    //     from: fromNumber,
    //     to: userEchoSession.phone_number,
    //   });

    //   const userEchoSessionLinkMessage = await client.messages.create({
    //     body: `
    //     https://text-echo.com/session/${userEchoSession.token}`,
    //     from: fromNumber,
    //     to: userEchoSession.phone_number,
    //   });

    //   logger.log("started echo to", { userEchoSession, startEchoMessage, userEchoSessionLinkMessage });
    // }

    return {
      message: `create new echo session task completed`,
    };
  },
});
