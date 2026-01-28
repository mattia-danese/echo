"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  deleteUser,
  deleteUserProfilePicture,
  deleteUserSessionCookies,
} from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import type { Platform } from "@/db/types";

export interface SettingsPanelProps {
  // currentPlatform: Platform;
  userId: number;
  profilePictureUrl: string | null;
  setUploadedProfilePictureUrl: (url: string | null) => void;
}

export default function SettingsPanel({
  // currentPlatform,
  userId,
  profilePictureUrl,
  setUploadedProfilePictureUrl,
}: SettingsPanelProps) {
  const router = useRouter();

  // const [platform, setPlatform] = useState<Platform>(currentPlatform);

  // const platformOptions = [
  //   { label: "Spotify", value: Platform.SPOTIFY },
  //   { label: "Apple Music", value: Platform.APPLE_MUSIC },
  // ];

  // const handlePhoneNumberChange = () => {
  //   // intentionally left blank for now
  // };

  // const handleChangePlatform = (next: string) => {
  //   setPlatform(next as Platform);
  //   // intentionally left blank for now
  // };

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteUser = async () => {
    setIsDeleting(true);
    try {
      await deleteUser(userId);
      router.replace("/"); // or sign-out flow
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="grid gap-4 w-fit mx-auto">
      {/* <Button
        variant="outline"
        className="rounded-full text-white bg-black"
        disabled
        onClick={handlePhoneNumberChange}
      >
        change phone number
      </Button> */}

      {/* <div className="w-full">
        <Select value={platform} onValueChange={handleChangePlatform}>
          <SelectTrigger className="w-full rounded-full text-white bg-black justify-center">
            <SelectValue placeholder="select platform" />
          </SelectTrigger>
          <SelectContent className="bg-black text-white">
            {platformOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div> */}

      <Button
        variant="outline"
        className="rounded-full text-white bg-black hover:bg-gray-900"
        onClick={async () => {
          await deleteUserProfilePicture(userId);
          setUploadedProfilePictureUrl(null);
        }}
        disabled={!profilePictureUrl}
      >
        delete profile picture
      </Button>

      <Button
        variant="outline"
        className="rounded-full text-white bg-black hover:bg-gray-900"
        asChild
      >
        <a href="mailto:support@text-echo.com">contact support</a>
      </Button>

      <Button
        variant="outline"
        className="rounded-full text-white bg-black hover:bg-gray-900"
        asChild
      >
        <a href="mailto:support@text-echo.com">send feedback</a>
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            className="rounded-full bg-red-500 text-white"
            disabled={isDeleting}
          >
            delete account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-black text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>are you sure you want to leave?</AlertDialogTitle>
            <AlertDialogDescription>
              this action cannot be undone
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white"
              onClick={handleDeleteUser}
            >
              continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        variant="outline"
        className="rounded-full text-white bg-black hover:bg-gray-900"
        onClick={async () => {
          await deleteUserSessionCookies(userId);
          router.replace("/");
        }}
      >
        log out
      </Button>
    </div>
  );
}
