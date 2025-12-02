import { logger, schedules } from "@trigger.dev/sdk/v3";
import { isSameDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { echoSessions, userEchoSessions, users } from "@/db/schema";
import { sendMessagesTask } from "./send-messages";

export const morningReminderTask = schedules.task({
  id: "morning-reminder",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute

  cron: {
    pattern: "0 11 * * *", // run daily at 11:00 AM EST, with conditional logic inside
    timezone: "America/New_York",
    environments: ["DEVELOPMENT"],
  },
  run: async () => {
    logger.log("morning reminder task starting ...");

    // Check if we should run today by checking if a session ends today
    const [echoSession] = await db
      .select({ id: echoSessions.id, end: echoSessions.end })
      .from(echoSessions)
      .orderBy(desc(echoSessions.createdAt))
      .limit(1);

    if (!echoSession) {
      logger.log("Skipping execution - no sessions found in database");
      return { message: "Skipped - no sessions found" };
    }

    const sessionEndDate = new Date(echoSession.end);
    const now = new Date();

    // Convert both dates to EST for comparison
    const timezone = "America/New_York";
    const sessionEndDateEST = toZonedTime(sessionEndDate, timezone);
    const nowEST = toZonedTime(now, timezone);

    if (!isSameDay(sessionEndDateEST, nowEST)) {
      // Check if the most recent session ends today (same calendar day in EST)
      logger.log("Skipping execution - no session ends today", {
        sessionEndDate: sessionEndDate.toISOString(),
        sessionEndDateEST: sessionEndDateEST.toISOString(),
        nowEST: nowEST.toISOString(),
      });
      return {
        message: "Skipped - no session ends today",
      };
    }

    logger.log("Executing - session ends today", {
      sessionEndDate: sessionEndDate.toISOString(),
    });

    const userData = await db
      .select({
        userId: users.id,
        trackId: userEchoSessions.trackId,
        phoneNumber: users.phoneNumber,
        userEchoSessionToken: userEchoSessions.token,
        threeConsecutiveNoShare: sql<boolean>`(
            SELECT 
              COUNT(*) >= 3 AND 
              COUNT(track_id) = 0
            FROM (
              SELECT ${userEchoSessions.trackId}
              FROM ${userEchoSessions}
              WHERE ${userEchoSessions.userId} = ${users.id}
              ORDER BY ${userEchoSessions.sessionId} DESC
              LIMIT 3
            ) recent_sessions
          )`.as("three_consecutive_no_share"),
      })
      .from(userEchoSessions)
      .innerJoin(users, eq(userEchoSessions.userId, users.id))
      .where(eq(userEchoSessions.sessionId, echoSession.id));

    if (userData.length === 0) {
      logger.error("Skipping execution - no users found for session", {
        sessionId: echoSession.id,
      });
      return {
        message: "Skipped - no users found for session",
      };
    }

    const sendMessagesData: Record<string, Array<string>> = {};

    for (const user of userData) {
      if (user.trackId) {
        sendMessagesData[user.phoneNumber] = [
          "get ready - echo playlists come out tonight",
        ];
      } else if (user.threeConsecutiveNoShare) {
        sendMessagesData[user.phoneNumber] = [
          "hey we noticed you haven’t shared a song recently. your friends are missing out on all your great songs :) start the echo and share your song of the moment",
          `https://text-echo.com/session/${user.userEchoSessionToken}`,
        ];
      } else {
        sendMessagesData[user.phoneNumber] = [
          "start the echo :) you’ve got 10 hours left to share what you’ve been listening to",
          `https://text-echo.com/session/${user.userEchoSessionToken}`,
        ];
      }
    }

    await sendMessagesTask.trigger({
      data: sendMessagesData,
    });
  },
});
