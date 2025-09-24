import SignIn from "./_components/SignIn";

interface PageProps {
    searchParams: Promise<{
        accountStatus?: string;
    }>;
}

export default async function FriendRequestPage({ searchParams }: PageProps) {
    const resolvedSearchParams = await searchParams;
    const accountStatus = resolvedSearchParams.accountStatus;

  return <SignIn accountStatus={accountStatus} />;
}