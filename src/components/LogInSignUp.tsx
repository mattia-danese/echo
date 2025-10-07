"use client";

import { useEffect, useState } from "react";
import Hero from "@/components/Hero";
import PhoneNumberChecker from "@/components/PhoneNumberChecker";
import RegistrationForm from "@/components/RegistrationForm";

interface LogInSignUpProps {
  accountStatus?: string;
}

export default function LogInSignUp({ accountStatus }: LogInSignUpProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberChecked, setPhoneNumberChecked] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

  useEffect(() => {
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }, []);

  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 max-w-md w-full">
        <Hero />

        {/* Account status messages */}
        {accountStatus === "created" && (
          <div className="text-white text-center">
            your account has been created and you should be getting a text from
            us shortly!
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
            />
          </div>
        )}

        {/* Form */}
        {!accountStatus && phoneNumberChecked && showRegistration && (
          <RegistrationForm
            phoneNumber={phoneNumber}
            phoneNumberChecked={phoneNumberChecked}
          />
        )}

        {/* once we hit this condtion, perform OTP --> authenticate user --> show profile page */}
        {phoneNumberChecked && !showRegistration && (
          <div className="text-white text-center">
            an account is already registered with that phone number :)
          </div>
        )}
      </main>
    </div>
  );
}
