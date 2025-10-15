import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import FriendRequest from "./_components/FriendRequest";

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
  try {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    const token = resolvedParams.slug;

    // Allow static files to be served by Next.js default handling
    if (token === "sms-optin.png") {
      redirect("/sms-optin.png");
    }
    const accountStatus = resolvedSearchParams.accountStatus;

    const [user] = await db
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.friendLinkToken, token))
      .limit(1);

    if (!user) {
      throw new Error(`User with friend link ${token} not found`);
    }

    const inviter = {
      firstName: user.firstName,
      link: token,
    };

    return <FriendRequest inviter={inviter} accountStatus={accountStatus} />;
  } catch (error: unknown) {
    console.error("Error in FriendRequestPage:", error);
    redirect("/");
  }
}
