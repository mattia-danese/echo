"use client";

import { CircleArrowRight, Loader2, CircleCheck } from "lucide-react";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import Hero from "@/components/Hero";
import { createFriendships } from "@/app/actions";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { checkRegistrationData } from "@/app/actions";

type FriendshipStatus = "created" | "error" | "error-same-user" | null;

interface FriendRequestProps {
    inviter: {
      firstName: string;
      link: string;
    };
    accountStatus?: string;
  }

export default function FriendRequest({ inviter, accountStatus }: FriendRequestProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    spotifyCode: "",
    friendLinkToken: inviter.link || '',
  });
  const [showRegistration, setShowRegistration] = useState(false);
  const [isCheckingPhoneNumber, setIsCheckingPhoneNumber] = useState(false);
  const [phoneNumberChecked, setPhoneNumberChecked] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [formDataError, setFormDataError] = useState("");

  useEffect(() => {
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }, []);

  const handlePhoneNumberChange = (value: string) => {
    const filteredValue = value.replace(/[^0-9+]/g, '');
    
    setFormData(prev => ({
      ...prev,
      phoneNumber: filteredValue,
    }));

    // either set to false on change to recheck number after change OR disbale Input after first check
    setPhoneNumberChecked(false);
    setFormDataError(formDataError === "phone number" ? "" : formDataError);
  };

  const handlePhoneNumberSubmit = async () => {
    if (!formData.phoneNumber.trim()) return;

    setIsCheckingPhoneNumber(true);
    
    try {
      const response = await fetch('/api/get-user-by-phone-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: formData.phoneNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error checking user:', data.error);
        return;
      }

      // if user exists, create friendship
      if (data.exists) {        
        const { ok, message } = await createFriendships({ 
            user_id: data.id, 
            referral_friend_link_token: formData.friendLinkToken 
        });
        
        if (ok) {
          setFriendshipStatus('created');
        } else {
          if (message === 'Friend is the same as the user') {
            setFriendshipStatus('error-same-user');
          } else {
            setFriendshipStatus('error');
          }
          console.log('Error creating friendship:', message);
        }
      }

      setShowRegistration(!data.exists);
      setPhoneNumberChecked(true);

    } catch (error) {
      console.error('Error calling check-user API:', error);
      setPhoneNumberChecked(false);
    } finally {
      setIsCheckingPhoneNumber(false);
    }
  };

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
        friendLinkToken: formData.friendLinkToken,
    });
      
    //   Redirect to Spotify authorization with form data
      const spotifyUrl = `https://accounts.spotify.com/authorize?client_id=${process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI}&scope=user-top-read%20user-read-recently-played%20user-read-private%20playlist-modify-public%20playlist-modify-private&show_dialog=true&state=${encodeURIComponent(params.toString())}`;
      window.location.href = spotifyUrl;
  };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
            <main className="flex flex-col items-center gap-8 max-w-md w-full">
                <Hero />

                {/* Invitation message */}
                
                <div className="text-blue-400 text-4xl text-center">
                {inviter.firstName} wants to share music with you on echo.
                </div>

                {/* Account status messages */}
                {accountStatus === 'created' && (
                    <div className="text-white text-center">
                    your account has been created and you should be getting a text from us shortly!
                    </div>
                )}
                
                {accountStatus === 'error' && (
                    <div className="text-white text-center">
                    there was an error creating your account, please contact support
                    </div>
                )}

                {/* Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-6">
                {/* Phone input */}
                {!accountStatus && <div className="flex flex-col space-y-2">
                <label className="text-white text-sm">phone (include +1)</label>
                <div className="flex items-center space-x-3">
                    <Input 
                    id='phoneNumber'
                    type='tel'
                    placeholder=''
                    value={formData.phoneNumber}
                    onChange={(e) => handlePhoneNumberChange(e.target.value)}
                    className="border-0 border-b border-white bg-transparent text-white placeholder-gray-500 focus:border-white focus:ring-0 rounded-none"
                    />
                    {isCheckingPhoneNumber ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                    ) : phoneNumberChecked ? (
                    <CircleCheck className="h-5 w-5 text-green-600" />
                    ) : (
                    <CircleArrowRight 
                        className={`h-5 w-5 transition-all ${
                        formData.phoneNumber && formData.phoneNumber.trim()
                            ? 'cursor-pointer text-white hover:opacity-70' 
                            : 'cursor-not-allowed text-gray-500'
                        }`}
                        onClick={formData.phoneNumber.trim() ? handlePhoneNumberSubmit : undefined}
                    />
                    )}
                </div>
                </div>}

                {/* Registration fields */}
                {phoneNumberChecked && showRegistration && (
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
                    disabled={!formData.firstName.trim() || !formData.lastName.trim() || !formData.phoneNumber.trim() || !consentChecked} 
                    >
                    register & accept
                    </Button>
                </div>
                )}
          </form>

          {phoneNumberChecked && !showRegistration && friendshipStatus === 'created' && (
                <div className="text-white text-center">
                  you and {inviter.firstName} are now friends :)
                </div>
            )}

          {phoneNumberChecked && !showRegistration && friendshipStatus === 'error' && (
            <div className="text-white text-center">
                an error occurred accepting the friend request, please contact support
            </div>
          )}

          {phoneNumberChecked && !showRegistration && friendshipStatus === 'error-same-user' && (
            <div className="text-white text-center">
                you cannot accept yourself as a friend :)
            </div>
          )}
            </main>
        </div>
    )
}