"use client";

import { useState, useEffect } from "react";

import Hero from "@/components/Hero";
import { createFriendships } from "@/app/actions";
import PhoneNumberChecker from "@/components/PhoneNumberChecker";
import RegistrationForm from "@/components/RegistrationForm";

type FriendshipStatus = "created" | "error" | "error-same-user" | null;

interface FriendRequestProps {
    inviter: {
      firstName: string;
      link: string;
    };
    accountStatus?: string;
  }

export default function FriendRequest({ inviter, accountStatus }: FriendRequestProps) {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [phoneNumberChecked, setPhoneNumberChecked] = useState(false);
    const [showRegistration, setShowRegistration] = useState(false);
    const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>(null);

  useEffect(() => {
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }, []);

  const handleCreateFriendship = async (data: { id: string }) => {
    const { ok, message } = await createFriendships({ 
        user_id: data.id, 
        referral_friend_link_token: inviter.link 
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

    return (
        <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
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

                {!accountStatus && 
                <div className="w-full max-w-md">
                    <PhoneNumberChecker 
                        phoneNumber={phoneNumber}
                        setPhoneNumber={setPhoneNumber}
                        phoneNumberChecked={phoneNumberChecked}
                        setPhoneNumberChecked={setPhoneNumberChecked}
                        setShowRegistration={setShowRegistration}
                        handleCreateFriendship={handleCreateFriendship}
                    />
                </div>}

                {!accountStatus && phoneNumberChecked && showRegistration && 
                <RegistrationForm
                    phoneNumber={phoneNumber}
                    phoneNumberChecked={phoneNumberChecked}
                    inviter={inviter}
                />}

          {phoneNumberChecked && !showRegistration && friendshipStatus !== null && (
                <div className="text-white text-center">
                  {friendshipStatus === 'created' ? 
                  "you and " + inviter.firstName + " are now friends :)" : 
                  friendshipStatus === 'error' ?
                  "an error occurred accepting the friend request, please contact support" :
                  friendshipStatus === 'error-same-user' ?
                  "you cannot accept yourself as a friend :)": ""}
                </div>
            )}
            </main>
        </div>
    )
}