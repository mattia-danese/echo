"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Platform } from "@/db/types";

export interface SettingsPanelProps {
  currentPlatform: Platform;
}

export default function SettingsPanel({ currentPlatform }: SettingsPanelProps) {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>(currentPlatform);

  const handlePhoneNumberChange = () => {
    // intentionally left blank for now
  };

  const handleChangePlatform = (next: string) => {
    setPlatform(next as Platform);
    // intentionally left blank for now
  };

  const handleDeleteUser = () => {
    // intentionally left blank for now
  };

  const platformOptions = [
    { label: "Spotify", value: Platform.SPOTIFY },
    { label: "Apple Music", value: Platform.APPLE_MUSIC },
  ];

  return (
    <div className="grid gap-4 w-fit mx-auto">
      <Button
        variant="outline"
        className="rounded-full text-white bg-black"
        disabled
        onClick={handlePhoneNumberChange}
      >
        change phone number
      </Button>

      <div className="w-full">
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
      </div>

      <Button
        variant="outline"
        className="rounded-full text-white bg-black hover:bg-gray-900"
        onClick={() => router.push("/contact-us")}
      >
        contact support
      </Button>

      <Button
        variant="outline"
        className="rounded-full text-white bg-black"
        disabled
      >
        send feedback
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button className="rounded-full bg-red-500 text-white">
            delete account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-black text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              are you sure you want to leave echo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              this action cannot be undone.
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
    </div>
  );
}
