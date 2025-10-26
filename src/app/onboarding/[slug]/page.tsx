import { and, eq } from "drizzle-orm";
import { getUserTopSongs } from "@/app/actions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Platform } from "@/db/types";
import SessionPageClient from "../../session/[slug]/_components/SessionPageClient";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function OnboardingPage({ params }: PageProps) {
  // FIXME: can these be moved inside the try block?
  const resolvedParams = await params;
  const token = resolvedParams.slug;

  let alreadySubmitted = false;
  let platform = Platform.SPOTIFY;

  try {
    const [user] = await db
      .select({
        id: users.id,
        isOnboardingComplete: users.isOnboardingComplete,
        platform: users.platform,
      })
      .from(users)
      .where(and(eq(users.onboardingToken, token), eq(users.isDeleted, false)))
      .limit(1);

    if (!user) {
      throw new Error(`User with onboarding token ${token} not found`);
    }

    alreadySubmitted = user.isOnboardingComplete;
    platform = user.platform;

    // get top songs of user
    const result = await getUserTopSongs({ userId: user.id, numSongs: 2 });

    if (!result.ok) {
      throw new Error(result.message);
    }

    const topSongs = result.songs.map((song) => ({
      title: song.trackName,
      trackId: song.trackId,
      artists: song.artists,
      albumImageUrl: song.albumImageUrl,
      trackPlatform: song.platform,
    }));

    return (
      <SessionPageClient
        error={false}
        topSongs={topSongs}
        sessionEndsAt={""}
        alreadySubmitted={alreadySubmitted}
        token={token}
        isOnboarding={true}
        platform={platform}
        userId={user.id}
      />
    );
  } catch (error: unknown) {
    console.error("Error in OnboardingPage:", error);
    return (
      <SessionPageClient
        error={true}
        topSongs={[]}
        sessionEndsAt={""}
        alreadySubmitted={alreadySubmitted}
        token={token}
        isOnboarding={true}
        platform={platform}
        userId={0}
      />
    );
  }
}
