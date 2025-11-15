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

    let topSongs: {
      title: string;
      trackId: string;
      artists: string;
      albumImageUrl: string;
      trackPlatform: Platform;
    }[] = [];

    if (platform === Platform.SPOTIFY) {
      topSongs = [
        {
          title: "Sex on Fire",
          trackId: "0ntQJM78wzOLVeCUAW7Y45",
          artists: "Kings of Leon",
          albumImageUrl:
            "https://i.scdn.co/image/ab67616d0000b2732519d01c0cca06f134eeadd8",
          trackPlatform: Platform.SPOTIFY,
        },
        {
          title: "NUEVAYoL",
          trackId: "5TFD2bmFKGhoCRbX61nXY5",
          artists: "Bad Bunny",
          albumImageUrl:
            "https://i.scdn.co/image/ab67616d0000b273bbd45c8d36e0e045ef640411",
          trackPlatform: Platform.SPOTIFY,
        },
        {
          title: "Juicy",
          trackId: "2AP7m2dBb8ULTx4Gc1rdMc",
          artists: "The Notorious B.I.G.",
          albumImageUrl:
            "https://i.scdn.co/image/ab67616d0000b273f7a29d6fe5d39ec9313a19cb",
          trackPlatform: Platform.SPOTIFY,
        },
        {
          title: "Lay All Your Love On Me",
          trackId: "2245x0g1ft0HC7sf79zbYN",
          artists: "ABBA",
          albumImageUrl:
            "https://i.scdn.co/image/ab67616d0000b273f7ecaf9daf2c1d5ca89f7312",
          trackPlatform: Platform.SPOTIFY,
        },
      ];
    } else {
      // get top songs of user
      const result = await getUserTopSongs({
        userId: user.id,
        platform: user.platform,
        numSongs: 4,
      });

      if (!result.ok) {
        throw new Error(result.message);
      }

      topSongs = result.songs.map((song) => ({
        title: song.trackName,
        trackId: song.trackId,
        artists: song.artists,
        albumImageUrl: song.albumImageUrl,
        trackPlatform: song.platform,
      }));
    }

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
