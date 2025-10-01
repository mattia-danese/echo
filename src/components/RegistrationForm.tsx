import { checkRegistrationData } from "@/app/actions";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { CircleCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface RegistrationFormProps {
    phoneNumber: string;
    phoneNumberChecked: boolean;
    inviter?: {
        firstName: string;
        link: string;
      };
}

export default function RegistrationForm({ phoneNumber, phoneNumberChecked, inviter }: RegistrationFormProps) {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        phoneNumber: phoneNumber,
        spotifyCode: "",
      });
    const [consentChecked, setConsentChecked] = useState(false);
    const [formDataError, setFormDataError] = useState("");

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
            return
        }

        const params = new URLSearchParams({
            firstName: formData.firstName,
            lastName: formData.lastName,
            phoneNumber: encodeURIComponent(formData.phoneNumber),
            friendLinkToken: inviter?.link || '',
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
                <label className="text-white text-sm">first name</label>
                <div className="flex items-center space-x-3">
                    <Input 
                    id='firstName'
                    type='text'
                    placeholder=''
                    value={formData.firstName}
                    onChange={(e) => {
                        setFormData(prev => ({ ...prev, firstName: e.target.value }));
                        setFormDataError(formDataError === "first name" ? "" : formDataError);
                    }}
                    className="border-0 border-b border-white bg-transparent text-white placeholder-gray-500 focus:border-white focus:ring-0 rounded-none"
                    />
                    <CircleCheck className={`h-5 w-5 ${formData.firstName.trim() ? 'text-green-600' : 'text-gray-500'}`} />
                </div>
                </div>

                {/* Last name input */}
                <div className="flex flex-col space-y-2">
                    <label className="text-white text-sm">first initial</label>
                    <div className="flex items-center space-x-3">
                        <Input 
                        id='lastName'
                        type='text'
                        placeholder=''
                        value={formData.lastName}
                        onChange={(e) => {
                            setFormData(prev => ({ ...prev, lastName: e.target.value }));
                            setFormDataError(formDataError === "last name" ? "" : formDataError);
                        }}
                        className="border-0 border-b border-white bg-transparent text-white placeholder-gray-500 focus:border-white focus:ring-0 rounded-none"
                        />
                        <CircleCheck className={`h-5 w-5 ${formData.lastName.trim() ? 'text-green-600' : 'text-gray-500'}`} />
                    </div>
                </div>

                {/* consent checkbox */}    
                <div className="flex items-center space-x-2">
                    <Checkbox 
                        id="terms2" 
                        className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white"
                        checked={consentChecked}
                        onCheckedChange={() => setConsentChecked(consentChecked === true ? false : true)}
                    />
                    <Label 
                        htmlFor="terms2" 
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
                disabled={!formData.firstName.trim() || !formData.lastName.trim() || !formData.phoneNumber.trim() || !phoneNumberChecked || !consentChecked} 
                >
                {inviter ? "register & accept" : "register"}
                </Button>
            </div>
        </form>
    )
}