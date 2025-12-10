"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { logInExistingUser, sendOTP, verifyOTP } from "@/app/actions";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import PhoneNumberChecker from "@/components/PhoneNumberChecker";
import RegistrationForm, { type FormData } from "@/components/RegistrationForm";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";

// MusicKit is loaded via Next.js Script in the component render

interface LogInSignUpProps {
  accountStatus?: string;
  appleDeveloperToken: string;
}

export default function LogInSignUp({
  accountStatus,
  appleDeveloperToken,
}: LogInSignUpProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberChecked, setPhoneNumberChecked] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
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

  useEffect(() => {
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: phoneNumber is a valid dependency
  useEffect(() => {
    async function initiateLogin() {
      if (phoneNumberChecked && !showRegistration) {
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
    }
    void initiateLogin();
  }, [phoneNumberChecked, showRegistration]);

  const handleVerifyOTP = async () => {
    setOtpError("");
    setOtpVerifying(true);
    try {
      const resp = await verifyOTP(phoneNumber, otpValue);
      if (!resp.ok || !resp.data?.verified) {
        setOtpError("Invalid code. Please try again.");
        return;
      }

      // OTP verified, now log in the user
      const loginResult = await logInExistingUser(phoneNumber);
      if (loginResult.ok) {
        setOtpOpen(false);
        // Redirect will happen automatically via createSession
      } else {
        setOtpError("Login failed. Please try again.");
      }
    } catch {
      setOtpError("Verification failed. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleOtpModalChange = (open: boolean) => {
    setOtpOpen(open);
    // Reset phone number checked state if user cancels out of the modal
    if (!open) {
      setPhoneNumberChecked(false);
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
          <div className="w-full max-w-md">
            <PhoneNumberChecker
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              phoneNumberChecked={phoneNumberChecked}
              setPhoneNumberChecked={setPhoneNumberChecked}
              setShowRegistration={setShowRegistration}
            />
          </div>
        )}

        {/* Form */}
        {!accountStatus && phoneNumberChecked && showRegistration && (
          <RegistrationForm
            phoneNumber={phoneNumber}
            phoneNumberChecked={phoneNumberChecked}
            disableAppleMusic={!appleDeveloperToken}
            formData={formData}
            setFormData={setFormData}
            consentChecked={consentChecked}
            setConsentChecked={setConsentChecked}
          />
        )}

        {/* How It Works */}
        <HowItWorks />

        {/* Login OTP Dialog */}
        {phoneNumberChecked && !showRegistration && (
          <AlertDialog open={otpOpen} onOpenChange={handleOtpModalChange}>
            <AlertDialogContent className="bg-black text-white border-white">
              <AlertDialogHeader>
                <AlertDialogTitle>verify your phone number</AlertDialogTitle>
                <AlertDialogDescription>
                  we sent a 6-digit code to {phoneNumber}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="flex flex-col items-center gap-4 py-2">
                <InputOTP
                  maxLength={6}
                  value={otpValue}
                  onChange={(value: string) => setOtpValue(value)}
                  containerClassName="justify-center"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                {otpError && (
                  <div className="text-red-500 text-sm">{otpError}</div>
                )}
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={otpVerifying}>
                  cancel
                </AlertDialogCancel>
                <Button
                  onClick={handleVerifyOTP}
                  disabled={otpValue.length !== 6 || otpVerifying || otpSending}
                  className="bg-white text-black hover:bg-gray-100"
                >
                  {otpVerifying ? (
                    <Spinner className="size-5" />
                  ) : (
                    "verify & log in"
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </main>
    </div>
  );
}
