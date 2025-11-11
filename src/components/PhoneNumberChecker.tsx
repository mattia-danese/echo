"use client";

import { CircleArrowRight, CircleCheck, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import PhoneInput from "react-phone-number-input";
// import { Input } from "@/components/ui/input";
import type { Platform } from "@/db/types";
import "react-phone-number-input/style.css";

interface PhoneNumberCheckerProps {
  phoneNumber: string;
  setPhoneNumber: (value: string) => void;
  phoneNumberChecked: boolean;
  setPhoneNumberChecked: (checked: boolean) => void;
  setShowRegistration: (show: boolean) => void;

  handleCreateFriendship?: (data: {
    id: number;
    platform: Platform;
    firstName: string;
  }) => void;
}

export default function PhoneNumberChecker({
  phoneNumber,
  setPhoneNumber,
  phoneNumberChecked,
  setPhoneNumberChecked,
  setShowRegistration,
  handleCreateFriendship,
}: PhoneNumberCheckerProps) {
  const [isCheckingPhoneNumber, setIsCheckingPhoneNumber] = useState(false);

  const phoneNumberInputId = useId();

  // const handlePhoneNumberChange = (value: string) => {
  //   const filteredValue = value.replace(/[^0-9+]/g, "");

  //   setPhoneNumber(filteredValue);

  //   // either set to false on change to recheck number after change OR disbale Input after first check
  //   setPhoneNumberChecked(false);
  // };

  const handlePhoneNumberSubmit = async () => {
    if (!phoneNumber.trim()) return;

    setIsCheckingPhoneNumber(true);

    try {
      const response = await fetch("/api/get-user-by-phone-number", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber: phoneNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Error checking user:", data.error);
        return;
      }

      if (handleCreateFriendship && data.exists) {
        handleCreateFriendship(data);
      }

      setPhoneNumberChecked(true);
      setShowRegistration(!data.exists);
    } catch (error) {
      console.error("Error calling check-user API:", error);
      setPhoneNumberChecked(false);
    } finally {
      setIsCheckingPhoneNumber(false);
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <label className="text-white text-sm" htmlFor={phoneNumberInputId}>
        phone number
      </label>
      <div className="flex items-center space-x-3">
        <PhoneInput
          id={phoneNumberInputId}
          international
          defaultCountry="US"
          value={phoneNumber}
          onChange={(value) => {
            setPhoneNumber(value || "");
            setPhoneNumberChecked(false);
          }}
          className="flex-1 phone-input-custom"
        />
        {/* <Input
          id={phoneNumberInputId}
          type="tel"
          placeholder=""
          value={phoneNumber}
          onChange={(e) => handlePhoneNumberChange(e.target.value)}
          className="flex-1 border-0 border-b border-white bg-transparent text-white placeholder-gray-500 focus:border-white focus:ring-0 rounded-none"
        /> */}
        {isCheckingPhoneNumber ? (
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        ) : phoneNumberChecked ? (
          <CircleCheck className="h-5 w-5 text-teal-400" />
        ) : (
          <CircleArrowRight
            className={`h-5 w-5 transition-all ${
              phoneNumber?.trim()
                ? "cursor-pointer text-white hover:opacity-70"
                : "cursor-not-allowed text-gray-500"
            }`}
            onClick={phoneNumber.trim() ? handlePhoneNumberSubmit : undefined}
          />
        )}
      </div>
      <style jsx>{`
        :global(.phone-input-custom) {
          display: flex;
          align-items: center;
        }
        :global(.phone-input-custom .PhoneInputCountry) {
          margin-right: 0.5rem;
          background: transparent;
          border: 0;
          border-bottom: 1px solid white;
          padding: 0.5rem 0;
        }
        :global(.phone-input-custom .PhoneInputCountrySelect) {
          background: transparent;
          border: none;
          color: white;
          font-size: 1rem;
          cursor: pointer;
        }
        :global(.phone-input-custom .PhoneInputCountrySelect:focus) {
          outline: none;
        }
        :global(.phone-input-custom .PhoneInputCountryIcon) {
          width: 1.5rem;
          height: 1.5rem;
          margin-right: 0.25rem;
        }
        :global(.phone-input-custom .PhoneInputInput) {
          flex: 1;
          border: 0;
          border-bottom: 1px solid white;
          background: transparent;
          color: white;
          padding: 0.5rem 0;
          font-size: 1rem;
          border-radius: 0;
        }
        :global(.phone-input-custom .PhoneInputInput::placeholder) {
          color: rgb(107 114 128);
        }
        :global(.phone-input-custom .PhoneInputInput:focus) {
          outline: none;
          border-bottom-color: white;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}
