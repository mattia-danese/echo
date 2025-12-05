import * as Sentry from "@sentry/node";
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_wrnspfsaufpodrxlgzfg",
  runtime: "node",
  logLevel: "log",
  enableConsoleLogging: true,
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],

  // Initialize Sentry when the worker starts
  init: async () => {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment:
        process.env.NODE_ENV === "production" ? "production" : "development",
      tracesSampleRate: 1.0,
    });
  },

  // Capture errors to Sentry when a task fails
  onFailure: async ({ payload, error, ctx }) => {
    Sentry.captureException(error, {
      extra: {
        taskId: ctx.task.id,
        runId: ctx.run.id,
        attemptNumber: ctx.attempt.number,
        payload,
      },
      tags: {
        taskId: ctx.task.id,
        source: "trigger.dev",
      },
    });

    // Flush to ensure the error is sent before the process exits
    await Sentry.flush(2000);
  },
});
