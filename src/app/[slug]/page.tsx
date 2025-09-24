import { createClient } from "@supabase/supabase-js";
import FriendRequest from "./_components/FriendRequest";
import { redirect } from "next/navigation";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PageProps {
    params: Promise<{
        slug?: string;
    }>;
    searchParams: Promise<{
        accountStatus?: string;
    }>;
}

export default async function FriendRequestPage({ params, searchParams }: PageProps) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
   
    const token = resolvedParams.slug;
    const accountStatus = resolvedSearchParams.accountStatus;

    console.log("token", token)

    const { data, error } = await supabase
      .from("users")
      .select("first_name")
      .eq("friend_link_token", token)
      .single();

    if (!data || error) {
        console.log("data", data)
        console.log("error", error)
        redirect("/");
    }

    const inviter = {
        'firstName': data!.first_name,
        'link': token!,
    }

  return <FriendRequest inviter={inviter} accountStatus={accountStatus} />;
}