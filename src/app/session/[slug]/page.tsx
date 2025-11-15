import { and, eq } from "drizzle-orm";
import { getUserTopSongs } from "@/app/actions";
import { db } from "@/db";
import { echoSessions, userEchoSessions, users } from "@/db/schema";
import { Platform } from "@/db/types";
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
    platform: Platform.SPOTIFY,
    sessionEndsAt: "",
    alreadySubmitted: false,
    token: token,
    isOnboarding: false,
    userId: 0,
    sessionId: 0,
  };

  try {
    const [userEchoSession] = await db
      .select({
        userId: userEchoSessions.userId,
        platform: userEchoSessions.platform,
        trackId: userEchoSessions.trackId,
        sessionId: userEchoSessions.sessionId,
        echoSessionsEnd: echoSessions.end,
      })
      .from(userEchoSessions)
      .innerJoin(echoSessions, eq(userEchoSessions.sessionId, echoSessions.id))
      .innerJoin(users, eq(userEchoSessions.userId, users.id))
      .where(and(eq(userEchoSessions.token, token), eq(users.isDeleted, false)))
      .limit(1);

    if (!userEchoSession) {
      throw new Error(`User echo session not found for token ${token}`);
    }

    props.userId = userEchoSession.userId;
    props.platform = userEchoSession.platform;
    props.alreadySubmitted = !!userEchoSession.trackId;
    props.sessionId = userEchoSession.sessionId;
    props.sessionEndsAt = userEchoSession.echoSessionsEnd;

    // get top songs of user
    const result = await getUserTopSongs({
      userId: userEchoSession.userId,
      platform: userEchoSession.platform,
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
      trackPlatform: song.platform,
    }));

    return <SessionPageClient {...props} />;
  } catch (error: unknown) {
    console.error(error);

    props.error = true;
    return <SessionPageClient {...props} />;
  }
}
