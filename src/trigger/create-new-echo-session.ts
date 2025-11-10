import crypto from "node:crypto";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import { fromZonedTime } from "date-fns-tz";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { echoSessions, userEchoSessions, users } from "@/db/schema";
import { sendMessagesTask } from "./send-messages";

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
      const sendMessagesData: Record<string, Array<string>> = {};

      // Inside the run function:
      const timezone = "America/New_York";
      const today = new Date();

      // Create 11 AM EST/EDT
      const startEST = new Date(today).setHours(11, 0, 0, 0);
      const startUTC = fromZonedTime(startEST, timezone);

      // Create 6 PM EST/EDT
      const endEST = new Date(today).setHours(18, 0, 0, 0);
      const endUTC = fromZonedTime(endEST, timezone);

      // create new echo session in the database
      const [echoSession] = await db
        .insert(echoSessions)
        .values({
          start: startUTC.toISOString(),
          end: endUTC.toISOString(),
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
      const userIdToPhoneNumberLookup = new Map<number, string>();

      for (const user of fetchedUsers) {
        const token = crypto.randomBytes(16).toString("base64url");

        userEchoSessionData.push({
          userId: user.id,
          sessionId: echoSession.id,
          token: token,
          platform: user.platform,
        });

        userIdToPhoneNumberLookup.set(user.id, user.phoneNumber);
      }

      logger.log("compiling user echo session data done", {
        numUserEchoSessions: userEchoSessionData.length,
      });

      // create new record in user_session table for each user (with token) -- batch write
      await db.insert(userEchoSessions).values(userEchoSessionData);

      logger.log("user echo sessions written to database");

      for (const userEchoSession of userEchoSessionData) {
        const phoneNumber = userIdToPhoneNumberLookup.get(
          userEchoSession.userId,
        );

        if (!phoneNumber) {
          logger.error("phone number not found for user", {
            userId: userEchoSession.userId,
          });
          continue;
        }

        sendMessagesData[phoneNumber] = [
          "start the echo :) click here to share what you've been listening to by 9pm tonight",
          `https://text-echo.com/session/${userEchoSession.token}`,
        ];
      }

      await sendMessagesTask.trigger({
        data: sendMessagesData,
      });

      return {
        message: `sent echo session links to ${userEchoSessionData.length} users`,
      };
    } catch (error: unknown) {
      logger.error("error creating new echo session", { error });
      throw error;
    }
  },
});
