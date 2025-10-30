"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { logInExistingUser } from "@/app/actions";
import Hero from "@/components/Hero";
import PhoneNumberChecker from "@/components/PhoneNumberChecker";
import RegistrationForm from "@/components/RegistrationForm";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: phoneNumber is a valid dependency
  useEffect(() => {
    async function tryLogin() {
      if (phoneNumberChecked && !showRegistration) {
        void logInExistingUser(phoneNumber);
      }
    }
    void tryLogin();
  }, [phoneNumberChecked, showRegistration]);

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
                window.location.href = "sms:";
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
          />
        )}

        {/* once we hit this condtion, perform OTP --> authenticate user --> show profile page */}
        {/* {phoneNumberChecked && !showRegistration && (
          <div className="text-white text-center">
            an account is already registered with that phone number :)
            redirecting to your profile...
          </div>
        )} */}
      </main>
    </div>
  );
}
