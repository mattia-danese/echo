import { logger, schedules } from "@trigger.dev/sdk";
import { getRecentPlaysTask } from "@/trigger";

export const getRecentPlaysScheduledTask = schedules.task({
  id: "get-recent-plays-scheduled",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute

  cron: {
    pattern: "0 0 * * *", // run every day at 12:00 AM
    timezone: "America/New_York",
    environments: ["DEVELOPMENT"],
  },

  run: async () => {
    logger.log("get recent plays scheduled task starting ...");

    return getRecentPlaysTask.trigger({});
  },
});
