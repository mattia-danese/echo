"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { checkRegistrationData } from "@/app/actions";
import Hero from "@/components/Hero";
import PhoneNumberChecker from "@/components/PhoneNumberChecker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function HomePage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberChecked, setPhoneNumberChecked] = useState(false);
  const [_showRegistration, setShowRegistration] = useState(false);

  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 max-w-md w-full">
        <Hero />

        <div className="text-white text-center text-xl">
          start sharing & discovering music on echo.
        </div>
        <div className="text-teal-400 text-center text-4xl">join now</div>

        <div className="w-full max-w-md">
          <PhoneNumberChecker
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            phoneNumberChecked={phoneNumberChecked}
            setPhoneNumberChecked={setPhoneNumberChecked}
            setShowRegistration={setShowRegistration}
          />
        </div>

        <RegistrationForm2
          phoneNumber={phoneNumber}
          phoneNumberChecked={phoneNumberChecked}
        />
      </main>
    </div>
  );
}

interface RegistrationFormProps {
  phoneNumber: string;
  phoneNumberChecked: boolean;
  inviter?: {
    firstName: string;
    link: string;
  };
}

function RegistrationForm2({
  phoneNumber,
  phoneNumberChecked,
  inviter,
}: RegistrationFormProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: phoneNumber,
    spotifyCode: "",
  });
  const [consentChecked, setConsentChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [formDataError, setFormDataError] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: phoneNumberChecked is a prop and valid dependency
  useEffect(() => {
    setFormDataError((prev) => (prev === "phone number" ? "" : prev));
  }, [phoneNumberChecked]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, phoneNumber: phoneNumber }));
  }, [phoneNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { ok, message } = await checkRegistrationData({
      first_name: formData.firstName,
      last_name: formData.lastName,
      phone_number: formData.phoneNumber,
    });

    if (!ok) {
      setFormDataError(message);
      return;
    }

    const params = new URLSearchParams({
      firstName: formData.firstName,
      lastName: formData.lastName,
      phoneNumber: encodeURIComponent(formData.phoneNumber),
      friendLinkToken: inviter?.link || "",
    });

    //   Redirect to Spotify authorization with form data
    const spotifyUrl = `https://accounts.spotify.com/authorize?client_id=${process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI}&scope=user-top-read%20user-read-recently-played%20user-read-private%20playlist-modify-public%20playlist-modify-private&show_dialog=true&state=${encodeURIComponent(params.toString())}`;

    window.location.href = spotifyUrl;
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      {/* Registration fields */}
      <div className="space-y-6">
        {/* First name input */}
        <div className="flex flex-col space-y-2">
          <label htmlFor="firstName" className="text-white text-sm">
            first name
          </label>
          <div className="flex items-center space-x-3">
            <Input
              id={useId()}
              type="text"
              placeholder=""
              value={formData.firstName}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, firstName: e.target.value }));
                setFormDataError(
                  formDataError === "first name" ? "" : formDataError,
                );
              }}
              className="border-0 border-b border-white bg-transparent text-white placeholder-gray-500 focus:border-white focus:ring-0 rounded-none"
            />
            <CircleCheck
              className={`h-5 w-5 ${formData.firstName.trim() ? "text-green-600" : "text-gray-500"}`}
            />
          </div>
        </div>

        {/* Last name input */}
        <div className="flex flex-col space-y-2">
          <label htmlFor="lastName" className="text-white text-sm">
            first initial
          </label>
          <div className="flex items-center space-x-3">
            <Input
              id={useId()}
              type="text"
              placeholder=""
              value={formData.lastName}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, lastName: e.target.value }));
                setFormDataError(
                  formDataError === "last name" ? "" : formDataError,
                );
              }}
              className="border-0 border-b border-white bg-transparent text-white placeholder-gray-500 focus:border-white focus:ring-0 rounded-none"
            />
            <CircleCheck
              className={`h-5 w-5 ${formData.lastName.trim() ? "text-green-600" : "text-gray-500"}`}
            />
          </div>
        </div>

        {/* consent checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id={useId()}
            className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white"
            checked={consentChecked}
            onCheckedChange={() => setConsentChecked(!consentChecked)}
          />
          <Label
            htmlFor="sms-consent"
            className="text-white text-sm font-normal block"
          >
            <div className="block">
              I agree to receive SMS from Echo about song suggestions and app
              updates. Message frequency may vary. Message & data rates may
              apply. Reply STOP to opt out, HELP for help. Consent is not
              required to use the service.
            </div>
            <div className="block mt-2">
              Privacy Policy:{" "}
              <Link
                href="/privacy-policy"
                className="underline hover:text-gray-300"
              >
                Privacy Policy
              </Link>{" "}
              Support:{" "}
              <Link
                href="mailto:support@text-echo.com"
                className="underline hover:text-gray-300"
              >
                support@text-echo.com
              </Link>
            </div>
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id={useId()}
            className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white"
            checked={termsChecked}
            onCheckedChange={() => setTermsChecked(!termsChecked)}
          />
          <Label
            htmlFor="terms-privacy"
            className="text-white text-sm font-normal"
          >
            I accept the{" "}
            <Link
              href="/terms-of-service"
              className="underline hover:text-gray-300"
            >
              Terms of Service
            </Link>{" "}
            &{" "}
            <Link
              href="/privacy-policy"
              className="underline hover:text-gray-300"
            >
              Privacy Policy
            </Link>
          </Label>
        </div>

        {/* form data error */}
        {formDataError && (
          <div className="text-red-500 text-sm text-center">
            {formDataError} is invalid
          </div>
        )}

        {/* Submit button */}
        <Button
          className="w-full bg-white text-black hover:bg-gray-100 rounded-lg py-3 font-medium"
          type="submit"
          disabled={
            !formData.firstName.trim() ||
            !formData.lastName.trim() ||
            !formData.phoneNumber.trim() ||
            !phoneNumberChecked ||
            !consentChecked ||
            !termsChecked
          }
        >
          {inviter ? "register & accept" : "register"}
        </Button>
      </div>
    </form>
  );
}
