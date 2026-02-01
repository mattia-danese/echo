"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";

interface OTPModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  otpValue: string;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  otpError: string;
  otpSending: boolean;
  otpVerifying: boolean;
  verifyButtonText?: string;
}

export default function OTPModal({
  open,
  onOpenChange,
  phoneNumber,
  otpValue,
  onOtpChange,
  onVerify,
  otpError,
  otpSending,
  otpVerifying,
  verifyButtonText = "verify",
}: OTPModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-black text-white border-white">
        <AlertDialogHeader>
          <AlertDialogTitle>verify your phone number</AlertDialogTitle>
          <AlertDialogDescription>
            we sent a 6-digit code to {phoneNumber}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <InputOTP
            maxLength={6}
            value={otpValue}
            onChange={onOtpChange}
            containerClassName="justify-center"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          {otpError && <div className="text-red-500 text-sm">{otpError}</div>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={otpVerifying}>cancel</AlertDialogCancel>
          <Button
            onClick={onVerify}
            disabled={otpValue.length !== 6 || otpVerifying || otpSending}
            className="bg-white text-black hover:bg-gray-100"
          >
            {otpVerifying ? <Spinner className="size-5" /> : verifyButtonText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
