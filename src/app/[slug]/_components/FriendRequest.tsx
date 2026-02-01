"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { createFriendships, sendOTP, verifyOTP } from "@/app/actions";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import OTPModal from "@/components/OTPModal";
import PhoneNumberChecker from "@/components/PhoneNumberChecker";
import RegistrationForm, { type FormData } from "@/components/RegistrationForm";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Platform } from "@/db/types";
import { isPhoneNumberValid } from "@/lib/validation";

type FriendshipStatus = "created" | "error" | "error-same-user" | null;

interface FriendRequestProps {
  inviter: {
    firstName: string;
    link: string;
  };
  accountStatus?: string;
  appleDeveloperToken: string;
  currentUser: {
    id: number;
    firstName: string;
    platform: string;
    phoneNumber: string;
  } | null;
}

export default function FriendRequest({
  inviter,
  accountStatus,
  appleDeveloperToken,
  currentUser,
}: FriendRequestProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberChecked, setPhoneNumberChecked] = useState(false);
  const [isRegistrationMode, setIsRegistrationMode] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
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

  // OTP state
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [pendingUserData, setPendingUserData] = useState<{
    id: number;
    platform: Platform;
    firstName: string;
  } | null>(null);

  useEffect(() => {
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }, []);

  const handleCreateFriendship = async (data: {
    id: number;
    platform: Platform;
    firstName: string;
  }) => {
    const { ok, message } = await createFriendships({
      userId: data.id,
      userPlatform: data.platform,
      userFirstName: data.firstName,
      referralFriendLinkToken: inviter.link,
    });

    if (ok) {
      setFriendshipStatus("created");
    } else {
      if (message.includes("Friend is the same as the user")) {
        setFriendshipStatus("error-same-user");
      } else {
        setFriendshipStatus("error");
      }
    }
  };

  const handlePhoneNumberChange = (value: string) => {
    setPhoneNumber(value);
    if (phoneNumberChecked) {
      setPhoneNumberChecked(false);
      setIsRegistrationMode(false);
      setFriendshipStatus(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumberChecked) {
      setIsCheckingUser(true);
      try {
        const response = await fetch("/api/get-user-by-phone-number", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber }),
        });

        const data = await response.json();

        if (data.exists) {
          setPhoneNumberChecked(true);
          setIsRegistrationMode(false);

          // Case 1: User is logged in AND phone matches their account
          if (currentUser && currentUser.phoneNumber === phoneNumber) {
            await handleCreateFriendship({
              id: currentUser.id,
              platform: currentUser.platform as Platform,
              firstName: currentUser.firstName,
            });
          } else {
            // Case 2: User exists but not logged in (or different account)
            setPendingUserData({
              id: data.id,
              platform: data.platform,
              firstName: data.firstName,
            });
            setOtpOpen(true);
            setOtpValue("");
            setOtpSending(true);
            setOtpError("");
            try {
              await sendOTP(phoneNumber);
            } catch {
              setOtpError("Failed to send code. Please try again.");
            } finally {
              setOtpSending(false);
            }
          }
        } else {
          // Case 3: User doesn't exist - show registration form
          setPhoneNumberChecked(true);
          setIsRegistrationMode(true);
        }
      } catch (error) {
        console.error("Error checking user:", error);
      } finally {
        setIsCheckingUser(false);
      }
    }
  };

  const handleVerifyOTP = async () => {
    setOtpError("");
    setOtpVerifying(true);

    try {
      const resp = await verifyOTP(phoneNumber, otpValue);
      if (!resp.ok || !resp.data?.verified) {
        setOtpError("Invalid code. Please try again.");
        return;
      }

      // OTP verified - create friendship
      if (pendingUserData) {
        setOtpOpen(false);
        await handleCreateFriendship(pendingUserData);
      }
    } catch {
      setOtpError("Verification failed. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleOtpModalChange = (open: boolean) => {
    setOtpOpen(open);
    if (!open) {
      setPhoneNumberChecked(false);
      setPendingUserData(null);
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
          <>
            <div className="text-white text-center">
              your account has been created and you should be getting a text
              from us shortly
            </div>
            <Button
              className="mt-4 bg-white text-black hover:bg-gray-200"
              onClick={() => {
                window.location.href = `sms:${process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER}`;
              }}
              type="button"
              variant="default"
            >
              open texts
            </Button>
          </>
        )}

        {accountStatus === "error" && (
          <div className="text-white text-center">
            there was an error creating your account, please contact support
          </div>
        )}

        {!accountStatus && !friendshipStatus && (
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
            <PhoneNumberChecker
              phoneNumber={phoneNumber}
              setPhoneNumber={handlePhoneNumberChange}
            />

            {/* Accept button */}
            {phoneNumber &&
              isPhoneNumberValid(phoneNumber) &&
              !isRegistrationMode && (
                <Button
                  type="submit"
                  disabled={isCheckingUser}
                  className="w-full bg-white text-black hover:bg-gray-100 rounded-lg py-3 font-medium"
                >
                  {isCheckingUser ? <Spinner className="size-5" /> : "accept"}
                </Button>
              )}
          </form>
        )}

        {/* Registration form */}
        {!accountStatus &&
          !friendshipStatus &&
          isRegistrationMode &&
          phoneNumberChecked && (
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

        <OTPModal
          open={otpOpen}
          onOpenChange={handleOtpModalChange}
          phoneNumber={phoneNumber}
          otpValue={otpValue}
          onOtpChange={setOtpValue}
          onVerify={handleVerifyOTP}
          otpError={otpError}
          otpSending={otpSending}
          otpVerifying={otpVerifying}
          verifyButtonText="verify & accept"
        />

        {/* Friendship status messages */}
        {phoneNumberChecked &&
          !isRegistrationMode &&
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

        <HowItWorks />
      </main>
    </div>
  );
}
