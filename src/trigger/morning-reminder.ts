import { logger, schedules } from "@trigger.dev/sdk/v3";
import { isSameDay, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { echoSessions, playlists, userEchoSessions, users } from "@/db/schema";
import { sendMessagesTask } from "./send-messages";

const morningReminderText = async (echoSessionId: number) => {
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
    .where(
      and(
        eq(userEchoSessions.sessionId, echoSessionId),
        eq(users.isDeleted, false),
      ),
    );

  if (userData.length === 0) {
    logger.error("Skipping execution - no users found for session", {
      sessionId: echoSessionId,
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
        "hey we noticed you haven't shared a song recently. your friends are missing out on all your great songs :) start the echo and share your song of the moment",
        `https://text-echo.com/session/${user.userEchoSessionToken}`,
      ];
    } else {
      sendMessagesData[user.phoneNumber] = [
        "start the echo :) you've got 10 hours left to share what you've been listening to",
        `https://text-echo.com/session/${user.userEchoSessionToken}`,
      ];
    }
  }

  await sendMessagesTask.trigger({
    data: sendMessagesData,
  });
};

const rankingText = async () => {
  const [secondMostRecentSession] = await db
    .select({ id: echoSessions.id })
    .from(echoSessions)
    .orderBy(desc(echoSessions.createdAt))
    .limit(1)
    .offset(1);

  if (!secondMostRecentSession) {
    logger.error("Skipping execution - no second most recent session found");
    return {
      message: "Skipped - no second most recent session found",
    };
  }

  const userData = await db
    .select({
      userId: users.id,
      phoneNumber: users.phoneNumber,
      friendLinkToken: users.friendLinkToken,
    })
    .from(users)
    .innerJoin(playlists, eq(users.id, playlists.userId))
    .where(
      and(
        eq(users.isDeleted, false),
        eq(playlists.sessionId, secondMostRecentSession.id),
      ),
    );

  if (userData.length === 0) {
    logger.error("Skipping execution - no users found for previous session");
    return {
      message: "Skipped - no users found for previous session",
    };
  }

  const sendMessagesData: Record<string, Array<string>> = {};

  for (const user of userData) {
    sendMessagesData[user.phoneNumber] = [
      "curious to see who shared what song? check it out here",
      `https://text-echo.com/?tab=playlists&token=${user.friendLinkToken}`,
    ];
  }

  await sendMessagesTask.trigger({
    data: sendMessagesData,
  });
};

export const morningReminderTask = schedules.task({
  id: "morning-reminder",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute

  // Cron paused — uncomment to resume scheduled runs.
  // cron: {
  //   pattern: "0 11 * * *", // run daily at 11:00 AM EST, with conditional logic inside
  //   timezone: "America/New_York",
  //   environments: ["DEVELOPMENT"],
  // },

  run: async () => {
    logger.log("morning reminder task starting ...");

    // Check if we should run today by checking if a session ends today
    const [echoSession] = await db
      .select({
        id: echoSessions.id,
        end: echoSessions.end,
        start: echoSessions.start,
      })
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

    if (isSameDay(sessionEndDateEST, nowEST)) {
      logger.log("running morning reminder text");
      return morningReminderText(echoSession.id);
    }

    const sessionStartDateEST = toZonedTime(echoSession.start, timezone);
    const yesterdayEST = subDays(nowEST, 1);

    if (isSameDay(sessionStartDateEST, yesterdayEST)) {
      logger.log("running ranking text");
      return rankingText();
    }

    return {
      message: "Skipped - no session ends today or yesterday",
    };
  },
});
