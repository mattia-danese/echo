import * as Sentry from "@sentry/nextjs";
import { tasks } from "@trigger.dev/sdk/v3";

// Global error handler for all Trigger.dev tasks
// This will automatically capture any task failures and send them to Sentry
export const onFailure = tasks.onFailure(async ({ ctx, payload, error }) => {
  Sentry.captureException(error, {
    contexts: {
      task: {
        id: ctx.task.id,
        filePath: ctx.task.filePath,
        exportName: String(ctx.task.exportName),
      },
      run: {
        id: ctx.run.id,
        isTest: ctx.run.isTest,
      },
    },
    extra: {
      payload,
    },
    tags: {
      taskId: ctx.task.id,
      runId: ctx.run.id,
    },
  });
});
