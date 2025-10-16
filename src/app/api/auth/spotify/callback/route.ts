// app/auth/callback/route.ts  (App Router API route)

import { NextResponse } from "next/server";
import { createUser, sendOnboardingMessage } from "@/app/actions";
import type { Platform } from "@/db/types";

type AccountStatus = "created" | "error";

export async function GET(req: Request) {
  let accountStatus: AccountStatus;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const formParams = new URLSearchParams(decodeURIComponent(state));

  try {
    const firstName = decodeURIComponent(formParams.get("firstName") || "");
    const lastName = decodeURIComponent(formParams.get("lastName") || "");
    const phoneNumber = decodeURIComponent(formParams.get("phoneNumber") || "");
    const platform = decodeURIComponent(
      formParams.get("platform") || "",
    ) as Platform;

    if (!phoneNumber) {
      throw new Error("Phone number is required");
    }

    if (!firstName) {
      throw new Error("First name is required");
    }

    if (!lastName) {
      throw new Error("Last name is required");
    }

    if (!platform) {
      throw new Error("Platform is required");
    }

    const result = await createUser({
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber,
      spotifyCode: code,
      platform: platform,
      referralFriendLinkToken: formParams.get("friendLinkToken") || "",
    });

    if (result.ok) {
      if (result.created) {
        sendOnboardingMessage({
          phoneNumber: phoneNumber,
          onboardingToken: result.onboardingToken || "",
        });
        // FIXME: should not need to include || "" as onboardingToken is not nullable

        accountStatus = "created";
      } else {
        accountStatus = "error";
      }
    } else {
      console.error("Error creating user:", result.message);
      accountStatus = "error";
    }
  } catch (error) {
    console.error("Error calling createUser server action:", error);
    accountStatus = "error";
  }

  const friendLinkToken = formParams.get("friendLinkToken");
  const redirectUrl = friendLinkToken
    ? new URL(`/${friendLinkToken}`, req.url)
    : new URL("/", req.url);
  redirectUrl.searchParams.set("accountStatus", accountStatus);

  return NextResponse.redirect(redirectUrl);
}
