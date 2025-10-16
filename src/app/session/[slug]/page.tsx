import { eq } from "drizzle-orm";
import { getUserTopSongs } from "@/app/actions";
import { db } from "@/db";
import { echoSessions, userEchoSessions } from "@/db/schema";
import SessionPageClient, {
  type SessionPageClientProps,
} from "./_components/SessionPageClient";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function SessionPage({ params }: PageProps) {
  const resolvedParams = await params;
  const token = resolvedParams.slug;

  const props: SessionPageClientProps = {
    error: false,
    topSongs: [],
    platform: "",
    sessionEndsAt: "",
    alreadySubmitted: false,
    token: token,
    isOnboarding: false,
  };

  try {
    const [userEchoSession] = await db
      .select({
        userId: userEchoSessions.userId,
        platform: userEchoSessions.platform,
        trackId: userEchoSessions.trackId,
        echoSessionsEnd: echoSessions.end,
      })
      .from(userEchoSessions)
      .innerJoin(echoSessions, eq(userEchoSessions.sessionId, echoSessions.id))
      .where(eq(userEchoSessions.token, token))
      .limit(1);

    if (!userEchoSession) {
      throw new Error(`User echo session not found for token ${token}`);
    }

    props.platform = userEchoSession.platform;
    props.alreadySubmitted = !!userEchoSession.trackId;
    props.sessionEndsAt = userEchoSession.echoSessionsEnd;

    // get top songs of user
    const result = await getUserTopSongs({
      userId: userEchoSession.userId,
      numSongs: 4,
    });

    if (!result.ok) {
      throw new Error(result.message);
    }

    props.topSongs = result.songs.map((song) => ({
      title: song.trackName,
      trackId: song.trackId,
      artists: song.artists,
      albumImageUrl: song.albumImageUrl,
    }));

    return <SessionPageClient {...props} />;
  } catch (error: unknown) {
    console.error(error);

    props.error = true;
    return <SessionPageClient {...props} />;
  }
}
