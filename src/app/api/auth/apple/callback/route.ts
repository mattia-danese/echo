// app/auth/callback/route.ts  (App Router API route)

import { NextResponse } from "next/server";
import {
  createUser,
  sendOnboardingMessage,
  sendWelcomeMessage,
} from "@/app/actions";

type AccountStatus = "created" | "error";

export async function POST(req: Request) {
  let accountStatus: AccountStatus;

  const body = await req.json();

  try {
    const firstName = body.firstName;
    const lastName = body.lastName;
    const phoneNumber = body.phoneNumber;
    const platform = body.platform;
    const gender = body.gender;
    const dateOfBirth = body.dateOfBirth;
    const musicUserToken = body.musicUserToken;

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

    if (!gender) {
      throw new Error("Gender is required");
    }

    if (!dateOfBirth) {
      throw new Error("Date of birth is required");
    }

    if (!musicUserToken) {
      throw new Error("AppleMusic user token is required");
    }

    const result = await createUser({
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber,
      auth: musicUserToken,
      platform: platform,
      referralFriendLinkToken: body.friendLinkToken || "",
      gender: gender,
      dateOfBirth: dateOfBirth,
    });

    // const user = result.user;

    // if (!user) {
    //   throw new Error(
    //     `User not returned to auth callback route: ${result.message}`,
    //   );
    // }

    if (result.ok) {
      const user = result.user;

      if (!user) {
        throw new Error(
          `User not returned to auth callback route: ${result.message}`,
        );
      }

      if (result.isNewUser) {
        await sendOnboardingMessage({
          phoneNumber: phoneNumber,
          friendFirstName: user.friendFirstName,
          userPlatform: platform,
        });
      } else {
        await sendWelcomeMessage({
          phoneNumber: phoneNumber,
        });
      }

      accountStatus = "created";
    } else {
      console.error("Error creating user:", result.message);
      accountStatus = "error";
    }
  } catch (error) {
    console.error("Error calling createUser server action:", error);
    accountStatus = "error";
  }

  const friendLinkToken = body.friendLinkToken;
  const redirectUrl = friendLinkToken
    ? new URL(`/${friendLinkToken}`, req.url)
    : new URL("/", req.url);
  redirectUrl.searchParams.set("accountStatus", accountStatus);

  return NextResponse.json({ redirect: redirectUrl.toString() });
}
