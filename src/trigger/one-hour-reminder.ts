import { logger, schedules } from "@trigger.dev/sdk/v3";
import { isSameDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { echoSessions, friends, userEchoSessions, users } from "@/db/schema";
import { sendMessagesTask } from "./send-messages";

export const oneHourReminderTask = schedules.task({
  id: "one-hour-reminder",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute

  // Cron paused — uncomment to resume scheduled runs.
  // cron: {
  //   pattern: "0 20 * * *", // run daily at 8:00 PM EST, with conditional logic inside
  //   timezone: "America/New_York",
  //   environments: ["DEVELOPMENT"],
  // },

  run: async () => {
    logger.log("one hour reminder task starting ...");

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

    try {
      const sessionId = echoSession.id;

      // Create aliases for friend data
      const friendUsers = alias(users, "friendUsers");
      const friendSessions = alias(userEchoSessions, "friendSessions");

      // Single query to get all users who haven't shared and their friends' data
      const results = await db
        .select({
          userId: userEchoSessions.userId,
          userPhoneNumber: users.phoneNumber,
          friendId: friends.friendId,
          friendFirstName: friendUsers.firstName,
          friendTrackId: friendSessions.trackId,
        })
        .from(userEchoSessions)
        .innerJoin(users, eq(userEchoSessions.userId, users.id))
        .leftJoin(
          friends,
          and(
            eq(userEchoSessions.userId, friends.userId),
            eq(friends.active, true),
          ),
        )
        .leftJoin(
          friendSessions,
          and(
            eq(friends.friendId, friendSessions.userId),
            eq(friendSessions.sessionId, sessionId),
          ),
        )
        .leftJoin(friendUsers, eq(friends.friendId, friendUsers.id))
        .where(
          and(
            eq(userEchoSessions.sessionId, sessionId),
            isNull(userEchoSessions.trackId), // User hasn't shared
            eq(users.isDeleted, false),
            isNotNull(users.whenOnboardingComplete),
          ),
        );

      logger.log(`Found ${results.length} rows for users who haven't shared`);

      // Process results to group by user
      const userMap = new Map<
        number,
        {
          phoneNumber: string;
          friendsWhoShared: string[];
        }
      >();

      for (const row of results) {
        if (!userMap.has(row.userId)) {
          userMap.set(row.userId, {
            phoneNumber: row.userPhoneNumber,
            friendsWhoShared: [],
          });
        }

        const userData = userMap.get(row.userId);
        if (!userData) continue;

        // Add friend's name if they shared (trackId is not null)
        if (row.friendTrackId && row.friendFirstName) {
          userData.friendsWhoShared.push(row.friendFirstName);
        }
      }

      logger.log(`Processing messages for ${userMap.size} users`);

      // Generate messages in the format expected by sendMessagesTask
      const messagesToSend: Record<string, Array<string>> = {};

      for (const [userId, data] of userMap.entries()) {
        let message: string;

        if (data.friendsWhoShared.length === 0) {
          message =
            "1 hour left to share your song to see what your friends shared";
        } else if (data.friendsWhoShared.length === 1) {
          message = `1 hour left to share your song to see what ${data.friendsWhoShared[0]} has shared`;
        } else if (data.friendsWhoShared.length === 2) {
          message = `1 hour left to share your song to see what ${data.friendsWhoShared[0]} and ${data.friendsWhoShared[1]} have shared`;
        } else if (data.friendsWhoShared.length === 3) {
          const [first, second, third] = data.friendsWhoShared;
          message = `1 hour left to share your song to see what ${first}, ${second}, and ${third} have shared`;
        } else {
          const firstThree = data.friendsWhoShared.slice(0, 3).join(", ");
          message = `1 hour left to share your song to see what ${firstThree}, and more have shared`;
        }

        messagesToSend[data.phoneNumber] = [message];

        logger.log(`User ${userId}: ${message}`);
      }

      // Send the messages via Twilio
      const messageCount = Object.keys(messagesToSend).length;
      if (messageCount > 0) {
        logger.log(`Sending ${messageCount} reminder messages`);
        await sendMessagesTask.triggerAndWait({
          data: messagesToSend,
        });
      }

      return {
        message: `Sent ${messageCount} reminder messages`,
      };
    } catch (error: unknown) {
      logger.error("error sending one hour reminder", { error });
      throw error;
    }
  },
});
