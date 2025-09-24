import { createClient } from "@supabase/supabase-js";
import FriendRequest from "./_components/FriendRequest";
import SignIn from "./_components/SignIn";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PageProps {
    params: Promise<{
        slug?: string[];
    }>;
    searchParams: Promise<{
        accountStatus?: string;
    }>;
}

export default async function HomePage({ params, searchParams }: PageProps) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
   
    const token = resolvedParams.slug?.[0];
    const accountStatus = resolvedSearchParams.accountStatus;

    const inviter = {
        'firstName': null as string | null,
        'link': null as string | null,
    }

  if (token) {
    const { data } = await supabase
      .from("users")
      .select("first_name")
      .eq("friend_link_token", token)
      .single();

    inviter.firstName = data?.first_name ?? null;
    inviter.link = token ?? null;

    return <FriendRequest inviter={inviter} accountStatus={accountStatus} />;
  }

  return <SignIn accountStatus={accountStatus} />;

}