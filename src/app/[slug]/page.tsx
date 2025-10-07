import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import FriendRequest from "./_components/FriendRequest";

const supabase = supabaseAdmin;

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    accountStatus?: string;
  }>;
}

export default async function FriendRequestPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const token = resolvedParams.slug;
  const accountStatus = resolvedSearchParams.accountStatus;

  const { data, error } = await supabase
    .from("users")
    .select("first_name")
    .eq("friend_link_token", token)
    .single();

  if (!data || error) {
    redirect("/");
  }

  const inviter = {
    firstName: data.first_name,
    link: token,
  };

  return <FriendRequest inviter={inviter} accountStatus={accountStatus} />;
}
