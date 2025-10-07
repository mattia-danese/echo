import { CircleCheck } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { checkRegistrationData } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RegistrationFormProps {
  phoneNumber: string;
  phoneNumberChecked: boolean;
  inviter?: {
    firstName: string;
    link: string;
  };
}

export default function RegistrationForm({
  phoneNumber,
  phoneNumberChecked,
  inviter,
}: RegistrationFormProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: phoneNumber,
    spotifyCode: "",
    platform: "",
  });
  const [consentChecked, setConsentChecked] = useState(false);
  const [formDataError, setFormDataError] = useState("");

  const consentCheckboxId = useId();
  const firstNameInputId = useId();
  const lastNameInputId = useId();
  const platformTabsId = useId();

  // biome-ignore lint/correctness/useExhaustiveDependencies: phoneNumberChecked is a prop and valid dependency
  useEffect(() => {
    setFormDataError(formDataError === "phone number" ? "" : formDataError);
  }, [phoneNumberChecked]);

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
      platform: formData.platform,
    });

    let authUrl = "";

    switch (formData.platform) {
      case "spotify":
        authUrl = `https://accounts.spotify.com/authorize?client_id=${process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI}&scope=user-top-read%20user-read-recently-played%20user-read-private%20playlist-modify-public%20playlist-modify-private&show_dialog=true&state=${encodeURIComponent(params.toString())}`;
        break;
      case "apple-music":
        break;
      default:
        break;
    }

    window.location.href = authUrl;
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
              className={`h-5 w-5 ${formData.firstName.trim() ? "text-green-600" : "text-gray-500"}`}
            />
          </div>
        </div>

        {/* Last name input */}
        <div className="flex flex-col space-y-2">
          <label className="text-white text-sm" htmlFor={lastNameInputId}>
            first initial
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
              className={`h-5 w-5 ${formData.lastName.trim() ? "text-green-600" : "text-gray-500"}`}
            />
          </div>
        </div>

        {/* Platform selection */}
        <div className="flex w-full flex-col space-y-2">
          <label className="text-white text-sm" htmlFor={platformTabsId}>
            music platform
          </label>
          <Tabs
            id={platformTabsId}
            value={formData.platform}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, platform: value }))
            }
          >
            <TabsList className="w-full bg-transparent border border-white">
              <TabsTrigger
                value="spotify"
                className="flex-1 data-[state=active]:bg-white data-[state=active]:text-black text-white"
              >
                Spotify
              </TabsTrigger>
              <TabsTrigger
                value="apple-music"
                className="flex-1 data-[state=active]:bg-white data-[state=active]:text-black text-white"
                disabled
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
                  Music (coming soon)
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
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
            !formData.platform
          }
        >
          {inviter ? "register & accept" : "register"}
        </Button>
      </div>
    </form>
  );
}
