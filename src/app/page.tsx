import LogInSignUp from "@/components/LogInSignUp";
import Profile from "@/components/Profile";

interface PageProps {
  searchParams: Promise<{
    accountStatus?: string;
    profile?: string;
  }>;
}

export default async function FriendRequestPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const accountStatus = resolvedSearchParams.accountStatus;
  const profilePhoneNumber = resolvedSearchParams.profile;

  if (profilePhoneNumber) {
    return <Profile phoneNumber={profilePhoneNumber} />;
  }

  return <LogInSignUp accountStatus={accountStatus} />;
}
