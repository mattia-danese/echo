"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import {
  checkRegistrationData,
  logInExistingUser,
  sendOTP,
  verifyOTP,
} from "@/app/actions";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import OTPModal from "@/components/OTPModal";
import PhoneNumberChecker from "@/components/PhoneNumberChecker";
import RegistrationForm, { type FormData } from "@/components/RegistrationForm";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Platform } from "@/db/types";
import { isPhoneNumberValid } from "@/lib/validation";

// MusicKit is loaded via Next.js Script in the component render

interface LogInSignUpProps {
  accountStatus?: string;
  appleDeveloperToken: string;
  initialPhoneNumber?: string;
}

export default function LogInSignUp({
  accountStatus,
  appleDeveloperToken,
  initialPhoneNumber,
}: LogInSignUpProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? "");
  const [phoneNumberChecked, setPhoneNumberChecked] = useState(
    !!initialPhoneNumber,
  );
  const [isRegistrationMode, setIsRegistrationMode] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    platform: "",
    gender: "",
    dateOfBirth: null,
  });
  const [consentChecked, setConsentChecked] = useState(false);
  const [formDataError, setFormDataError] = useState("");
  const [musicUserToken, setMusicUserToken] = useState("");

  useEffect(() => {
    // Clean up URL, preserving tab parameter if present
    const url = new URL(window.location.href);
    const tabParam = url.searchParams.get("tab");
    url.searchParams.delete("token");
    url.searchParams.delete("accountStatus");
    if (tabParam) {
      url.searchParams.set("tab", tabParam);
    }
    window.history.replaceState({}, document.title, url.toString());
  }, []);

  // Only trigger for deep links where phone is pre-filled and assumed to be existing user
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only run once on mount for deep link login
  useEffect(() => {
    async function initiateDeepLinkLogin() {
      if (!initialPhoneNumber) return;

      setOtpOpen(true);
      setOtpValue("");
      setOtpSending(true);
      setOtpError("");

      try {
        const resp = await sendOTP(phoneNumber);
        if (!resp.ok) {
          setOtpError("Failed to send code. Please try again.");
        }
      } catch {
        setOtpError("Failed to send code. Please try again.");
      } finally {
        setOtpSending(false);
      }
    }
    void initiateDeepLinkLogin();
  }, []); // Empty deps - only runs once on mount

  // Clear form errors when relevant fields change
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only clear error on form field changes
  useEffect(() => {
    if (formDataError && isRegistrationMode) {
      setFormDataError("");
    }
  }, [
    formData.firstName,
    formData.lastName,
    formData.dateOfBirth,
    formData.gender,
    formData.platform,
  ]);

  const handlePhoneNumberChange = (value: string) => {
    setPhoneNumber(value);
    // Reset state when phone number changes after initial check
    if (phoneNumberChecked) {
      setPhoneNumberChecked(false);
      setIsRegistrationMode(false);
      setFormDataError("");
    }
  };

  const isFormValid = () => {
    return (
      formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.phoneNumber.trim() &&
      phoneNumberChecked &&
      consentChecked &&
      formData.platform &&
      formData.gender &&
      formData.dateOfBirth
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If we haven't checked the user yet, do the check first
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
          // User exists - proceed to login with OTP
          setPhoneNumberChecked(true);
          setIsRegistrationMode(false);
          // Open OTP modal and send code
          setOtpOpen(true);
          await sendOTP(phoneNumber);
        } else {
          // User doesn't exist - show registration form
          setPhoneNumberChecked(true);
          setIsRegistrationMode(true);
        }
      } catch (error) {
        console.error("Error checking user:", error);
      } finally {
        setIsCheckingUser(false);
      }
      return;
    }

    // If we're in registration mode, handle registration submission
    if (isRegistrationMode) {
      await handleRegistrationSubmit();
    }
  };

  const handleRegistrationSubmit = async () => {
    setIsCheckingUser(true);

    // Apple Music authorization if needed
    if (formData.platform === Platform.APPLE_MUSIC) {
      const instance = MusicKit.getInstance?.();
      await instance?.authorize();
      setMusicUserToken(instance?.musicUserToken);
    }

    // Validate registration data
    const { ok, message } = await checkRegistrationData({
      firstName: formData.firstName,
      lastName: formData.lastName,
      phoneNumber: formData.phoneNumber,
      dateOfBirth: formData.dateOfBirth?.toISOString().split("T")[0] ?? "",
    });

    if (!ok) {
      setFormDataError(message);
      setIsCheckingUser(false);
      return;
    }

    // Send OTP for registration
    setOtpOpen(true);
    await sendOTP(formData.phoneNumber);
    setIsCheckingUser(false);
  };

  const continueRegistrationAfterOTP = async () => {
    // Apple Music path: authorize and then complete
    if (formData.platform === Platform.APPLE_MUSIC) {
      const resp = await fetch("/api/auth/apple/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phoneNumber: formData.phoneNumber,
          friendLinkToken: "", // No inviter in landing page flow
          platform: formData.platform,
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth?.toISOString().split("T")[0] ?? "",
          musicUserToken,
        }),
      });
      if (resp.ok) {
        const data: { redirect?: string } = await resp.json();
        if (data.redirect) window.location.href = data.redirect;
      }
      return;
    }

    // Spotify path: build auth URL and redirect
    const params = new URLSearchParams({
      firstName: formData.firstName,
      lastName: formData.lastName,
      phoneNumber: encodeURIComponent(formData.phoneNumber),
      friendLinkToken: "", // No inviter in landing page flow
      platform: formData.platform,
      gender: formData.gender,
      dateOfBirth: formData.dateOfBirth
        ? formData.dateOfBirth.toISOString().split("T")[0]
        : "",
    });

    window.location.href = `${process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI}?state=${encodeURIComponent(
      params.toString(),
    )}`;
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

      if (isRegistrationMode) {
        // Complete registration flow
        await continueRegistrationAfterOTP();
      } else {
        // Complete login flow
        const loginResult = await logInExistingUser(phoneNumber);
        if (loginResult.ok) {
          setOtpOpen(false);
          // Redirect happens automatically
        } else {
          setOtpError("Login failed. Please try again.");
        }
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
      // Reset state when user cancels OTP modal
      setPhoneNumberChecked(false);
      setIsRegistrationMode(false);
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
                if (appleDeveloperToken === "") {
                  return;
                }

                await MusicKit.configure({
                  developerToken: appleDeveloperToken,
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

        {!accountStatus && (
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
            <PhoneNumberChecker
              phoneNumber={phoneNumber}
              setPhoneNumber={handlePhoneNumberChange}
            />

            {/* Registration fields appear here when isRegistrationMode=true */}
            {isRegistrationMode && phoneNumberChecked && (
              <RegistrationForm
                renderAsFieldsOnly={true}
                phoneNumber={phoneNumber}
                phoneNumberChecked={phoneNumberChecked}
                formData={formData}
                setFormData={setFormData}
                consentChecked={consentChecked}
                setConsentChecked={setConsentChecked}
                disableAppleMusic={!appleDeveloperToken}
              />
            )}

            {/* Form data error display */}
            {formDataError && (
              <div className="text-red-500 text-sm text-center">
                {formDataError} is invalid
              </div>
            )}

            {/* Single submit button - changes text based on mode */}
            {phoneNumber && isPhoneNumberValid(phoneNumber) && (
              <Button
                type="submit"
                disabled={
                  isCheckingUser || (isRegistrationMode && !isFormValid())
                }
                className="w-full bg-white text-black hover:bg-gray-100 rounded-lg py-3 font-medium"
              >
                {isCheckingUser ? (
                  <Spinner className="size-5" />
                ) : isRegistrationMode ? (
                  "register"
                ) : (
                  "login"
                )}
              </Button>
            )}
          </form>
        )}

        {/* How It Works */}
        <HowItWorks />

        {/* OTP Dialog - handles both login and registration */}
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
          verifyButtonText="verify & log in"
        />
      </main>
    </div>
  );
}
