import { logger, task } from "@trigger.dev/sdk/v3";
import * as jose from "jose";
import { db } from "@/db";
import { appleDevToken } from "@/db/schema";
import { env } from "@/lib/env";

export const refreshAppleDevTokenTask = task({
  id: "refresh-apple-dev-token",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: Record<string, never>, { ctx }) => {
    logger.log("send messages task starting", { payload, ctx });

    const applePrivateKey = await jose.importPKCS8(
      env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      "ES256",
    );

    const SIX_MONTHS_SECONDS = 15_777_000; // Apple max window (~6 months)
    const SAFETY_SECONDS = 86_400; // rotate 1 day early
    const IAT_SKEW_SECONDS = 300; // set iat slightly in the past for clock skew

    const iat = Math.floor(Date.now() / 1000) - IAT_SKEW_SECONDS;
    const exp = iat + SIX_MONTHS_SECONDS - SAFETY_SECONDS;
    const expiresAt = new Date(exp * 1000).toISOString();

    const developerToken = await new jose.SignJWT({
      iss: env.APPLE_TEAM_ID,
      iat,
      exp,
    })
      .setProtectedHeader({ alg: "ES256", kid: env.APPLE_KEY_ID })
      .sign(applePrivateKey);

    await db
      .insert(appleDevToken)
      .values({ id: 1, token: developerToken, expiresAt })
      .onConflictDoUpdate({
        target: appleDevToken.id,
        set: {
          token: developerToken,
          expiresAt: expiresAt,
          updatedAt: new Date().toISOString(),
        },
      });

    const FIVE_MONTHS_SECONDS = 12_960_000; // 5 months from now (approx, 5*30 days)

    // Set next invocation of this task to run in 5 months
    await refreshAppleDevTokenTask.trigger(
      {},
      { delay: `${FIVE_MONTHS_SECONDS}s` },
    );

    return {
      message: `send messages task completed`,
    };
  },
});
