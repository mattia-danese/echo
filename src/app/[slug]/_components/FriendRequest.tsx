"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { createFriendships } from "@/app/actions";
import Hero from "@/components/Hero";
import PhoneNumberChecker from "@/components/PhoneNumberChecker";
import RegistrationForm, { type FormData } from "@/components/RegistrationForm";
import type { Platform } from "@/db/types";

type FriendshipStatus = "created" | "error" | "error-same-user" | null;

interface FriendRequestProps {
  inviter: {
    firstName: string;
    link: string;
  };
  accountStatus?: string;
  appleDeveloperToken: string;
}

export default function FriendRequest({
  inviter,
  accountStatus,
  appleDeveloperToken,
}: FriendRequestProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberChecked, setPhoneNumberChecked] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [friendshipStatus, setFriendshipStatus] =
    useState<FriendshipStatus>(null);
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    platform: "",
    gender: "",
    dateOfBirth: null,
  });
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }, []);

  const handleCreateFriendship = async (data: {
    id: number;
    platform: Platform;
    firstName: string;
    lastName: string;
  }) => {
    const { ok, message } = await createFriendships({
      userId: data.id,
      userPlatform: data.platform,
      userFirstName: data.firstName,
      userLastName: data.lastName,
      referralFriendLinkToken: inviter.link,
    });

    if (ok) {
      setFriendshipStatus("created");
    } else {
      if (message === "Friend is the same as the user") {
        setFriendshipStatus("error-same-user");
      } else {
        setFriendshipStatus("error");
      }
    }
  };

  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-center p-8 min-h-screen">
      <main className="flex flex-col items-center gap-8 max-w-md w-full">
        <Script
          src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"
          strategy="afterInteractive"
          onLoad={() => {
            const configure = async () => {
              try {
                const token = appleDeveloperToken;
                if (!token) return;

                await MusicKit.configure({
                  developerToken: token,
                  app: {
                    name: "echo",
                    build: "1.0.0",
                  },
                });
              } catch {
                // ignore config errors for now
                console.log("here");
              }
            };

            if (typeof window !== "undefined" && "MusicKit" in window) {
              void configure();
            } else if (typeof document !== "undefined") {
              document.addEventListener(
                "musickitloaded",
                () => {
                  void configure();
                },
                { once: true },
              );
            }
          }}
        />
        <Hero />

        {/* Invitation message */}
        <div className="text-4xl text-center bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">
          <span className="font-bold">{inviter.firstName}</span> wants to share
          music with you on echo.
        </div>

        {/* Account status messages */}
        {accountStatus === "created" && (
          <div className="text-white text-center">
            your account has been created and you should be getting a text from
            us shortly
          </div>
        )}

        {accountStatus === "error" && (
          <div className="text-white text-center">
            there was an error creating your account, please contact support
          </div>
        )}

        {!accountStatus && (
          <div className="w-full max-w-md">
            <PhoneNumberChecker
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              phoneNumberChecked={phoneNumberChecked}
              setPhoneNumberChecked={setPhoneNumberChecked}
              setShowRegistration={setShowRegistration}
              handleCreateFriendship={handleCreateFriendship}
            />
          </div>
        )}

        {!accountStatus && phoneNumberChecked && showRegistration && (
          <RegistrationForm
            phoneNumber={phoneNumber}
            phoneNumberChecked={phoneNumberChecked}
            inviter={inviter}
            disableAppleMusic={!appleDeveloperToken}
            formData={formData}
            setFormData={setFormData}
            consentChecked={consentChecked}
            setConsentChecked={setConsentChecked}
          />
        )}

        {phoneNumberChecked &&
          !showRegistration &&
          friendshipStatus !== null && (
            <div className="text-white text-center">
              {friendshipStatus === "created"
                ? `you and ${inviter.firstName} are now friends :)`
                : friendshipStatus === "error"
                  ? "an error occurred accepting the friend request, please contact support"
                  : friendshipStatus === "error-same-user"
                    ? "you cannot accept yourself as a friend :)"
                    : ""}
            </div>
          )}
      </main>
    </div>
  );
}
