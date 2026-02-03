import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { appleDevToken, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/cookieSession";
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

    const accountStatus = resolvedSearchParams.accountStatus;

    const [[user], [dev], currentUser] = await Promise.all([
      db
        .select({ firstName: users.firstName, platform: users.platform })
        .from(users)
        .where(
          and(eq(users.friendLinkToken, token), eq(users.isDeleted, false)),
        )
        .limit(1),
      db.select().from(appleDevToken).limit(1),
      getCurrentUser(),
    ]);

    if (!user) {
      throw new Error(`User with friend link ${token} not found`);
    }

    const inviter = {
      firstName: user.firstName,
      link: token,
    };

    const appleDeveloperToken = dev?.token ?? "";

    return (
      <FriendRequest
        inviter={inviter}
        accountStatus={accountStatus}
        appleDeveloperToken={appleDeveloperToken}
        currentUser={currentUser}
      />
    );
  } catch (error: unknown) {
    console.error("Error in FriendRequestPage:", error);
    redirect("/");
  }
}
