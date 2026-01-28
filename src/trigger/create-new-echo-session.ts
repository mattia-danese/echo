import crypto from "node:crypto";
import { logger, task } from "@trigger.dev/sdk/v3";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { echoSessions, userEchoSessions, users } from "@/db/schema";
import type { EchoSessionInsert, UserEchoSessionInsert } from "@/types";

export const createNewEchoSessionTask = task({
  id: "create-new-echo-session",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute

  run: async () => {
    logger.log("create new echo session task starting ...");

    try {
      const timezone = "America/New_York";
      const now = new Date();

      const nowInEST = toZonedTime(now, timezone);

      // Create 9:30 PM EST/EDT today
      const startInEST = new Date(nowInEST);
      startInEST.setHours(21, 30, 0, 0);
      const startUTC = fromZonedTime(startInEST, timezone);

      // Create 9:00 PM EST/EDT in two days
      const twoDaysFromNowInEST = new Date(nowInEST);
      twoDaysFromNowInEST.setDate(twoDaysFromNowInEST.getDate() + 2);
      twoDaysFromNowInEST.setHours(21, 0, 0, 0);
      const endUTC = fromZonedTime(twoDaysFromNowInEST, timezone);

      // create new echo session in the database
      const echoSessionInsert: EchoSessionInsert = {
        start: startUTC.toISOString(),
        end: endUTC.toISOString(),
      };

      const [echoSession] = await db
        .insert(echoSessions)
        .values(echoSessionInsert)
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
          and(
            isNotNull(users.whenOnboardingComplete),
            eq(users.isDeleted, false),
          ),
        );

      if (fetchedUsers.length === 0) {
        throw new Error("no users found");
      }

      logger.log("users fetched", { numUsers: fetchedUsers.length });

      // for each user, create echo session token
      const userEchoSessionData: UserEchoSessionInsert[] = [];

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

      return {
        message: `new echo session ${echoSession.id} created with ${userEchoSessionData.length} users`,
      };
    } catch (error: unknown) {
      logger.error("error creating new echo session", { error });
      throw error;
    }
  },
});
