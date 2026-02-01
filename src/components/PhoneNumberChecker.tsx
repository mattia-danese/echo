"use client";

import { getCountryCallingCode } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js/core";
import { CircleCheck } from "lucide-react";
import { useId, useState } from "react";
import PhoneInput from "react-phone-number-input";
import { isPhoneNumberValid } from "@/lib/validation";
import "react-phone-number-input/style.css";

interface PhoneNumberCheckerProps {
  phoneNumber: string;
  setPhoneNumber: (value: string) => void;
}

export default function PhoneNumberChecker({
  phoneNumber,
  setPhoneNumber,
}: PhoneNumberCheckerProps) {
  const [selectedCountry, setSelectedCountry] = useState<
    CountryCode | undefined
  >("US");

  const phoneNumberInputId = useId();

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
          country={selectedCountry}
          value={phoneNumber}
          onCountryChange={(country) => {
            setSelectedCountry(country ?? "US");
          }}
          onChange={(value) => {
            if (!value) {
              setPhoneNumber("");
              return;
            }

            const countryCode = selectedCountry
              ? getCountryCallingCode(selectedCountry)
              : "1";
            const expectedPrefix = `+${countryCode}`;

            // If value doesn't start with the expected country code, add it
            if (!value.startsWith(expectedPrefix)) {
              const digits = value.replace(/\D/g, "");
              setPhoneNumber(`${expectedPrefix}${digits}`);
            } else {
              setPhoneNumber(value);
            }
          }}
          className="flex-1 phone-input-custom"
        />
        <CircleCheck
          className={`h-5 w-5 ${
            phoneNumber && isPhoneNumberValid(phoneNumber)
              ? "text-teal-400"
              : "text-gray-500"
          }`}
        />
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
