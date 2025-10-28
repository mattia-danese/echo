import { CircleCheck } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { checkRegistrationData } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gender, Platform } from "@/db/types";

interface RegistrationFormProps {
  phoneNumber: string;
  phoneNumberChecked: boolean;
  inviter?: {
    firstName: string;
    link: string;
  };
  disableAppleMusic: boolean;
}

type FormData = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  platform: string;
  gender: string;
  dateOfBirth: Date | null;
};

export default function RegistrationForm({
  phoneNumber,
  phoneNumberChecked,
  inviter,
  disableAppleMusic,
}: RegistrationFormProps) {
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    phoneNumber: phoneNumber,
    platform: "",
    gender: "",
    dateOfBirth: null,
  });
  const [consentChecked, setConsentChecked] = useState(false);
  const [formDataError, setFormDataError] = useState("");

  const consentCheckboxId = useId();
  const firstNameInputId = useId();
  const lastNameInputId = useId();
  const platformTabsId = useId();
  const genderSelectId = useId();
  const dateOfBirthInputId = useId();

  // biome-ignore lint/correctness/useExhaustiveDependencies: phoneNumberChecked is a prop and valid dependency
  useEffect(() => {
    setFormDataError(formDataError === "phone number" ? "" : formDataError);
  }, [phoneNumberChecked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // IMPORTANT: For Apple Music, call authorize immediately (no awaits before)
    if (formData.platform === Platform.APPLE_MUSIC) {
      const instance = MusicKit.getInstance?.();
      await instance?.authorize();
      const musicUserToken = instance?.musicUserToken;

      const { ok, message } = await checkRegistrationData({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth
          ? formData.dateOfBirth.toISOString().split("T")[0]
          : "",
      });

      if (!ok) {
        setFormDataError(message);
        return;
      }

      const resp = await fetch("/api/auth/apple/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phoneNumber: formData.phoneNumber,
          friendLinkToken: inviter?.link || "",
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

    // Default (e.g. Spotify): validate first, then build redirect
    const { ok, message } = await checkRegistrationData({
      firstName: formData.firstName,
      lastName: formData.lastName,
      phoneNumber: formData.phoneNumber,
      dateOfBirth: formData.dateOfBirth
        ? formData.dateOfBirth.toISOString().split("T")[0]
        : "",
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
      platform: formData.platform,
      gender: formData.gender,
      dateOfBirth: formData.dateOfBirth
        ? formData.dateOfBirth.toISOString().split("T")[0]
        : "",
    });

    let authUrl = "";
    if (formData.platform === Platform.SPOTIFY) {
      authUrl = `https://accounts.spotify.com/authorize?client_id=${process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI}&scope=user-top-read%20user-read-recently-played%20user-read-private%20playlist-modify-public%20playlist-modify-private&show_dialog=true&state=${encodeURIComponent(
        params.toString(),
      )}`;
    }

    if (authUrl) {
      window.location.href = authUrl;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      {/* Registration fields */}
      <div className="space-y-6">
        {/* First name input */}
        <div className="flex flex-col space-y-2">
          <label className="text-white text-sm" htmlFor={firstNameInputId}>
            first name
          </label>
          <div className="flex items-center space-x-3">
            <Input
              id={firstNameInputId}
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
              className={`h-5 w-5 ${formData.firstName.trim() ? "text-teal-400" : "text-gray-500"}`}
            />
          </div>
        </div>

        {/* Last name input */}
        <div className="flex flex-col space-y-2">
          <label className="text-white text-sm" htmlFor={lastNameInputId}>
            last name
          </label>
          <div className="flex items-center space-x-3">
            <Input
              id={lastNameInputId}
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
              className={`h-5 w-5 ${formData.lastName.trim() ? "text-teal-400" : "text-gray-500"}`}
            />
          </div>
        </div>

        {/* Platform selection */}
        <div className="flex w-full flex-col space-y-2">
          <label className="text-white text-sm" htmlFor={platformTabsId}>
            music platform
          </label>
          <div className="flex items-center w-full gap-3">
            <Tabs
              id={platformTabsId}
              value={formData.platform}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, platform: value }))
              }
              hasVerticalSeparators={true}
              className="w-full flex-1"
            >
              <TabsList className="w-full bg-transparent border border-white">
                <TabsTrigger
                  value={Platform.SPOTIFY}
                  className="flex-1 data-[state=active]:bg-white data-[state=active]:text-black text-white"
                >
                  Spotify
                </TabsTrigger>
                <TabsTrigger
                  value={Platform.APPLE_MUSIC}
                  className="flex-1 data-[state=active]:bg-white data-[state=active]:text-black text-white"
                  disabled={disableAppleMusic}
                >
                  <span className="flex items-center gap-1">
                    <svg
                      aria-label="Apple Music"
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4 inline-block"
                    >
                      <path d="M15.67 10.13c-.01-2.06 1.68-3.04 1.76-3.09-0.96-1.41-2.45-1.6-2.97-1.62-1.26-.13-2.46.74-3.1.74-.64 0-1.63-.72-2.68-.7-1.38.02-2.66.8-3.37 2.03-1.44 2.5-.37 6.2 1.03 8.23.68.98 1.49 2.08 2.56 2.04 1.03-.04 1.42-.66 2.67-.66 1.25 0 1.6.66 2.68.64 1.11-.02 1.81-.99 2.48-1.97.78-1.13 1.1-2.23 1.12-2.29-.02-.01-2.14-.82-2.16-3.25zm-2.54-5.93c.58-.7.97-1.68.86-2.66-.83.03-1.84.55-2.44 1.25-.54.62-1.01 1.62-.83 2.57.88.07 1.79-.45 2.41-1.16z" />
                    </svg>
                    Music
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <CircleCheck
              className={`h-5 w-5 ${formData.platform ? "text-teal-400" : "text-gray-500"}`}
            />
          </div>
        </div>

        {/* Gender selection */}
        <div className="flex flex-col space-y-2">
          <label className="text-white text-sm" htmlFor={genderSelectId}>
            gender
          </label>
          <div className="flex items-center space-x-3">
            <Select
              value={formData.gender}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, gender: value }))
              }
            >
              <SelectTrigger className="w-full text-white bg-black border-b border-white">
                <SelectValue placeholder="select gender" />
              </SelectTrigger>
              <SelectContent className="bg-black text-white border-white">
                <SelectGroup>
                  {Object.values(Gender).map((gender) => (
                    <SelectItem key={gender} value={gender.toLowerCase()}>
                      {gender}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <CircleCheck
              className={`h-5 w-5 ${formData.gender.trim() ? "text-teal-400" : "text-gray-500"}`}
            />
          </div>
        </div>

        {/* Date of birth selection */}
        <div className="flex flex-col space-y-2">
          <label className="text-white text-sm" htmlFor={dateOfBirthInputId}>
            date of birth
          </label>
          <div className="flex items-center space-x-3">
            <Input
              id={dateOfBirthInputId}
              type="date"
              value={
                formData.dateOfBirth
                  ? formData.dateOfBirth.toISOString().split("T")[0]
                  : ""
              }
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  dateOfBirth: new Date(e.target.value) ?? null,
                }));
                setFormDataError(
                  formDataError === "date of birth" ? "" : formDataError,
                );
              }}
              className="border-0 border-b border-white bg-transparent text-white placeholder-gray-500 focus:border-white focus:ring-0 rounded-none"
            />
            <CircleCheck
              className={`h-5 w-5 ${formData.dateOfBirth ? "text-teal-400" : "text-gray-500"}`}
            />
          </div>
        </div>

        {/* consent checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id={consentCheckboxId}
            className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white"
            checked={consentChecked}
            onCheckedChange={() => setConsentChecked(!consentChecked)}
          />
          <Label
            htmlFor={consentCheckboxId}
            className="text-white text-sm font-normal"
          >
            I agree to receive text messages from echo for song suggestions
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
            !formData.platform ||
            !formData.gender ||
            !formData.dateOfBirth
          }
        >
          {inviter ? "register & accept" : "register"}
        </Button>
      </div>
    </form>
  );
}
