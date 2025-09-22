"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createFriendships, createUser, sendOnboardingMessage } from "../../actions";
import { CircleArrowRight, Loader2, CircleCheck } from "lucide-react";

type AccountStatus =  "created" | "error" | null;

interface HomeProps {
  inviter: {
    firstName: string | null;
    link: string | null;
  };
}

export default function Home({ inviter }: HomeProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    spotifyCode: "",
    friendLinkToken: inviter.link || '',
  });
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(null);
  const [showPhoneError, setShowPhoneError] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [isCheckingPhoneNumber, setIsCheckingPhoneNumber] = useState(false);
  const [phoneNumberChecked, setPhoneNumberChecked] = useState(false);
  const [friendshipCreated, setFriendshipCreated] = useState(false);

  const formSteps = [
    {
      id: "firstName",
      label: "First Name",
      type: "text",
      placeholder: "Enter your first name",
    },
    {
      id: "lastName", 
      label: "Last Name",
      type: "text",
      placeholder: "Enter your last name",
    },
    {
      id: "phoneNumber",
      label: "Phone Number", 
      type: "tel",
      placeholder: "Enter your phone number",
    },
  ];

  const currentField = formSteps[currentStep];
  const currentValue = formData[currentField.id as keyof typeof formData];

  const checkAuth = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code) {
      // Restore form data from state parameter
      let userData = {
        firstName: '',
        lastName: '',
        phoneNumber: '',
        spotifyCode: code,
        friendLinkToken: '',
      };
      
      if (state) {
        try {
          const formParams = new URLSearchParams(decodeURIComponent(state));
          userData = {
            firstName: formParams.get('firstName') || '',
            lastName: formParams.get('lastName') || '',
            phoneNumber: decodeURIComponent(formParams.get('phoneNumber') || ''),
            spotifyCode: code,
            friendLinkToken: formParams.get('friendLinkToken') || '',
          };
        } catch (error) {
          console.error('Error parsing form data from URL:', error);
        }
      }
      
      setFormData(userData);
      
      // Make server action call to create/check user
      try {
        const result = await createUser({
          first_name: userData.firstName,
          last_name: userData.lastName,
          phone_number: userData.phoneNumber,
          spotify_code: code,
          referral_friend_link_token: userData.friendLinkToken,
        });

        if (result.ok) {
            // TODO: TEST THIS
        //   if (result.created) {
        //     sendOnboardingMessage({ phone_number: userData.phoneNumber });
        //   }

          setAccountStatus('created')
        } else {
          setAccountStatus('error')
        }
      } catch (error) {
        console.error('Error calling createUser server action:', error);
      }
      
      // Clean up the URL by removing the code and state parameters
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  };

  // Check for Spotify authorization code on page load
  useEffect(() => {
    checkAuth();
  }, []);

  const handlePhoneNumberChange = (value: string) => {
    const filteredValue = value.replace(/[^0-9+]/g, '');

    setShowPhoneError(value !== filteredValue);
    
    setFormData(prev => ({
      ...prev,
      phoneNumber: filteredValue,
    }));
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

      // if user exists and invite exists, create friendship
      if (data.exists && formData.friendLinkToken) {        
        const { ok, message } = await createFriendships({ 
            user_id: data.id, 
            referral_friend_link_token: formData.friendLinkToken 
        });
        
        if (ok) {
          setFriendshipCreated(true);
        } else {
          console.error('Error creating friendship:', message);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentValue.trim()) {
      const params = new URLSearchParams({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: encodeURIComponent(formData.phoneNumber),
        friendLinkToken: formData.friendLinkToken,
      });
      
    //   Redirect to Spotify authorization with form data
      const spotifyUrl = `https://accounts.spotify.com/authorize?client_id=${process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI}&scope=user-top-read%20user-read-recently-played%20user-read-private&show_dialog=true&state=${encodeURIComponent(params.toString())}`;
      window.location.href = spotifyUrl;
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 max-w-md w-full">
          {/* Logo */}
          <h1 className="text-9xl font-bold text-blue-400">echo</h1>

          {/* Tagline */}
          <div className="text-white text-3xl">Discover music through friends.</div>
          
          {/* Invitation message */}
          {inviter.firstName && (
            <div className="text-blue-400 text-4xl text-center">
              {inviter.firstName} wants to share music with you on echo.
            </div>
          )}

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
                {inviter.firstName && (
                  <div className="text-white text-center">
                    Complete your registration to be friends with {inviter.firstName}
                  </div>
                )}
                
                {/* First name input */}
                <div className="flex flex-col space-y-2">
                  <label className="text-white text-sm">first name</label>
                  <div className="flex items-center space-x-3">
                    <Input 
                      id='firstName'
                      type='text'
                      placeholder=''
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="border-0 border-b border-white bg-transparent text-white placeholder-gray-500 focus:border-white focus:ring-0 rounded-none"
                    />
                    <CircleCheck className={`h-5 w-5 ${formData.lastName.trim() ? 'text-green-600' : 'text-gray-500'}`} />
                  </div>
                </div>

                {/* Submit button */}
                <Button 
                  className="w-full bg-white text-black hover:bg-gray-100 rounded-lg py-3 font-medium" 
                  type="submit" 
                  disabled={!formData.firstName.trim() || !formData.lastName.trim() || !formData.phoneNumber.trim()} 
                >
                  {inviter.firstName ? 'accept' : 'register'}
                </Button>
              </div>
            )}

            {/* Existing user / friend acceptance message */}
            {phoneNumberChecked && !showRegistration && inviter.firstName && 
             (friendshipCreated ? <div className="space-y-6">
                <div className="text-white text-center">
                  you and {inviter.firstName} are now friends :)
                </div>
              </div> : <div className="space-y-6">
                <div className="text-white text-center">
                  an error occurred accepting the friend request, please contact support
                </div>
              </div>)
            }
              
            {/* Existing user message */}
            {phoneNumberChecked && !showRegistration && !inviter.firstName && 
            <div className="text-white text-center">
                  an account is already registered with that phone number :)
            </div>}
          </form>
      </main>
    </div>
  );
}
