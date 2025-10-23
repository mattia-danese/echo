import crypto from "node:crypto";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import { and, eq } from "drizzle-orm";
// import { twilioAdmin } from "@/lib/twilioAdmin";
import { db } from "@/db";
import { echoSessions, userEchoSessions, users } from "@/db/schema";

// eslint-disable-next-line @typescript-eslint/no-require-imports
// const twilio = require("twilio");

// const accountSid = twilioAdmin.accountSid;
// const authToken = twilioAdmin.authToken;
// const fromNumber = twilioAdmin.phoneNumber;
// const client = twilio(accountSid, authToken);

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

    try {
      // create new echo session in the database
      const [echoSession] = await db
        .insert(echoSessions)
        .values({
          start: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
          end: new Date(new Date().setHours(18, 0, 0, 0)).toISOString(),
        })
        .returning({ id: echoSessions.id });

      logger.log("new echo session created", { echoSession });

      // get all the users in the database that have completed onboarding
      const fetchedUsers = await db
        .select({
          id: users.id,
          phoneNumber: users.phoneNumber,
          platform: users.platform,
        })
        .from(users)
        .where(
          and(eq(users.isOnboardingComplete, true), eq(users.isDeleted, false)),
        );

      if (fetchedUsers.length === 0) {
        throw new Error("no users found");
      }

      logger.log("users fetched", { numUsers: fetchedUsers.length });

      // for each user, create echo session token
      const userEchoSessionData = [];

      for (const user of fetchedUsers) {
        const token = crypto.randomBytes(16).toString("base64url");

        userEchoSessionData.push({
          userId: user.id,
          sessionId: echoSession.id,
          token: token,
          platform: user.platform,
        });
      }

      logger.log("compiling user echo session data done", {
        numUserEchoSessions: userEchoSessionData.length,
      });

      // create new record in user_session table for each user (with token) -- batch write
      await db.insert(userEchoSessions).values(userEchoSessionData);

      logger.log("user echo sessions written to database");

      // send text to each user with their echo session link
      // for (const userEchoSession of userEchoSessionData) {
      //   const startEchoMessage = await client.messages.create({
      //     body: `
      //     start the echo :)

      //     click here to share what you've been listening to by 9pm tonight`,
      //     from: fromNumber,
      //     to: userEchoSession.phoneNumber,
      //   });

      //   const userEchoSessionLinkMessage = await client.messages.create({
      //     body: `
      //     https://text-echo.com/session/${userEchoSession.token}`,
      //     from: fromNumber,
      //     to: userEchoSession.phoneNumber,
      //   });

      //   logger.log("started echo to", { userEchoSession, startEchoMessage, userEchoSessionLinkMessage });
      // }

      return {
        message: `create new echo session task completed`,
      };
    } catch (error: unknown) {
      logger.error("error creating new echo session", { error });
      throw error;
    }
  },
});
