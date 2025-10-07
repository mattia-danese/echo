"use client";

import { CircleArrowRight, CircleCheck, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";

interface PhoneNumberCheckerProps {
  phoneNumber: string;
  setPhoneNumber: (value: string) => void;
  phoneNumberChecked: boolean;
  setPhoneNumberChecked: (checked: boolean) => void;
  setShowRegistration: (show: boolean) => void;

  handleCreateFriendship?: (data: { id: string }) => void;
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

  const handlePhoneNumberChange = (value: string) => {
    const filteredValue = value.replace(/[^0-9+]/g, "");

    setPhoneNumber(filteredValue);

    // either set to false on change to recheck number after change OR disbale Input after first check
    setPhoneNumberChecked(false);
  };

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
        phone (include +1)
      </label>
      <div className="flex items-center space-x-3">
        <Input
          id={phoneNumberInputId}
          type="tel"
          placeholder=""
          value={phoneNumber}
          onChange={(e) => handlePhoneNumberChange(e.target.value)}
          className="flex-1 border-0 border-b border-white bg-transparent text-white placeholder-gray-500 focus:border-white focus:ring-0 rounded-none"
        />
        {isCheckingPhoneNumber ? (
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        ) : phoneNumberChecked ? (
          <CircleCheck className="h-5 w-5 text-green-600" />
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
    </div>
  );
}
