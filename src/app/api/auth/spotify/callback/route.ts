// app/auth/callback/route.ts  (App Router API route)

import { NextResponse } from "next/server";
import { createUser, sendOnboardingMessage } from "@/app/actions";

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
    const platform = decodeURIComponent(formParams.get("platform") || "");

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
      first_name: firstName,
      last_name: lastName,
      phone_number: phoneNumber,
      spotify_code: code,
      platform: platform,
      referral_friend_link_token: formParams.get("friendLinkToken") || "",
    });

    if (result.ok) {
      if (result.created) {
        sendOnboardingMessage({
          phone_number: phoneNumber,
          onboarding_token: result.onboarding_token,
        });

        accountStatus = "created";
      } else {
        accountStatus = "error";
      }
    } else {
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
