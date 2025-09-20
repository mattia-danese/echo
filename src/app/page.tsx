"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createUser } from "./actions";

type AccountStatus =  "created" | "existing" | "error" | null;

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    spotifyCode: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(null);
  const [showPhoneError, setShowPhoneError] = useState(false);

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
  const isLastStep = currentStep === formSteps.length - 1;

  const checkAuth = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code) {
      console.log('Spotify authorization code:', code);
      
      // Restore form data from state parameter
      let userData = {
        firstName: '',
        lastName: '',
        phoneNumber: '',
        spotifyCode: code,
      };
      
      if (state) {
        try {
          const formParams = new URLSearchParams(decodeURIComponent(state));
          userData = {
            firstName: formParams.get('firstName') || '',
            lastName: formParams.get('lastName') || '',
            phoneNumber: formParams.get('phoneNumber') || '',
            spotifyCode: code,
          };
        } catch (error) {
          console.error('Error parsing form data from URL:', error);
        }
      }
      
      setFormData(userData);
      
      // Make server action call to create/check user
      try {
        console.log('Creating user...', userData);
        const result = await createUser({
          first_name: userData.firstName,
          last_name: userData.lastName,
          phone_number: userData.phoneNumber,
          spotify_code: code
        });

        if (result.ok) {
          setAccountStatus(result.created ? 'created' : 'existing')
        } else {
          setAccountStatus('error')
        }

        console.log('Server action response:', result);
      } catch (error) {
        console.error('Error calling createUser server action:', error);
      }
      
      // Clean up the URL by removing the code and state parameters
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
    
    setIsLoading(false);
  };

  // Check for Spotify authorization code on page load
  useEffect(() => {
    checkAuth();
  }, []);

  const handleInputChange = (value: string) => {
    // For phone number field, only allow numbers and '+'
    if (currentField.id === 'phoneNumber') {
      const filteredValue = value.replace(/[^0-9+]/g, '');
      
      // Show error if user tried to type invalid characters
      setShowPhoneError(value !== filteredValue);
      
      setFormData(prev => ({
        ...prev,
        [currentField.id]: filteredValue,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [currentField.id]: value,
      }));
    }
  };

  const handleNext = () => {
    if (currentValue.trim() && currentStep < formSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentValue.trim()) {
      console.log("Form submitted:", formData);

        //   check if user already exists by phone number
      
      // Store form data in URL parameters
      const params = new URLSearchParams({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
      });
      
      // Redirect to Spotify authorization with form data
      const spotifyUrl = `https://accounts.spotify.com/authorize?client_id=${process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI}&scope=user-top-read%20user-read-recently-played%20user-read-private&show_dialog=true&state=${encodeURIComponent(params.toString())}`;
      window.location.href = spotifyUrl;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && currentValue.trim()) {
      e.preventDefault();
      if (!isLastStep) {
        handleNext();
      } else {
        handleSubmit(e);
      }
    }
  };

  // Show loading state while checking for auth code
  if (isLoading) {
    return (
      <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
          <div>Welcome to Echo</div>
          <div>Loading...</div>
        </main>
      </div>
    );
  }

  if (accountStatus == 'error') {
    return (
        <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
          <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
            <div>Welcome to Echo</div>
            <div>There was an error creating your account</div>
          </main>
        </div>
      );
  }

  if (accountStatus == 'created') {
    return (
        <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
          <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
            <div>Welcome to Echo</div>
            <div>Your account has been successfully created and you should be getting a text from us shortly!</div>
          </main>
        </div>
      );
  }

  if (accountStatus == 'existing'){
    return (
        <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
          <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
            <div>Welcome to Echo</div>
            <div>An account already exists with this phone nunber</div>
          </main>
        </div>
      );
  }

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
          <div className="w-full max-w-md min-w-0 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4 min-w-0 w-full">
            <div className="flex items-center justify-center space-x-2">
                {formSteps.map((_, index) => (
                <div
                    key={index}
                    className={`h-2 w-12 rounded-full transition-colors duration-300 ${
                    index <= currentStep 
                        ? 'bg-black dark:bg-white' 
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                />
                ))}
            </div>
            
            <div className="mx-auto w-[360px]">
              <Input 
                id={currentField.id}
                type={currentField.type}
                placeholder={currentField.placeholder}
                value={currentValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="block"
              />
            </div>
            
            <div className="text-center min-w-0 w-full">
              <p 
                className={`text-sm text-red-500 truncate ${
                  currentField.id === 'phoneNumber' && showPhoneError ? 'block' : 'hidden'
                }`}
              >
                Only numbers and + are allowed for phone numbers
              </p>
            </div>
            
            {!isLastStep ? (
              <Button 
                type="button"
                onClick={handleNext}
                disabled={!currentValue.trim()}
                className="w-full border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Next
              </Button>
            ) : (
              <Button 
                type="submit"
                disabled={!currentValue.trim()}
                className="w-full border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Submit
              </Button>
            )}
          </form>
          </div>
      </main>
    </div>
  );
}