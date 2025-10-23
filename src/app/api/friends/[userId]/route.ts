import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { friends, users } from "@/db/schema";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      profilePic: users.profilePictureUrl,
      isMuted: friends.muted,
    })
    .from(friends)
    .innerJoin(users, eq(users.id, friends.friendId))
    .where(and(eq(friends.userId, Number(userId)), eq(friends.active, true)))
    .orderBy(asc(users.firstName), asc(users.lastName));

  return Response.json(rows);
}
