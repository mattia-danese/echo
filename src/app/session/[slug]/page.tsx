import { createClient } from "@supabase/supabase-js";
import SessionPageClient, { type SessionPageClientProps } from "./_components/SessionPageClient";
import { getUserTopSongs } from "@/app/actions";

interface UserEchoSession {
    user_id: string;
    spotify_track_id: string | null;
    echo_sessions: {
        end: string;
    };
}

interface PageProps {
    params: Promise<{
        slug: string;
    }>;
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function SessionPage({ params }: PageProps) {

    const resolvedParams = await params;
    const token = resolvedParams.slug;

    const props: SessionPageClientProps = {
        error: false,
        topSongs: [],
        sessionEndsAt: '',
        alreadySubmitted: false,
        token: token,
        isOnboarding: false,
    }

    // from token:
    //    - get user
    //    - get session end
    //    - check if they already submitted a song

    const { data, error }: { data: UserEchoSession | null; error: unknown } = await supabase
      .from("user_echo_sessions")
      .select(`
        user_id, 
        spotify_track_id, 
        echo_sessions!inner(end)
      `)
      .eq("token", token)
      .single();

      if (!data || error) {
        console.log("data", data)
        console.log("error", error)
        props.error = true;
        return <SessionPageClient {...props} />;
    }

    props.alreadySubmitted = data.spotify_track_id !== null;
    props.sessionEndsAt = data.echo_sessions.end;

    // get top songs of user

    const result = await getUserTopSongs({ user_id: data.user_id });

    if (!result.ok) {
        console.log("topSongsError:", result.message, data.user_id)
        props.error = true;
        return <SessionPageClient {...props} />;
    }

    props.topSongs = result.songs.map((song) => ({
        title: song.track_name,
        trackId: song.spotify_track_id,
        artists: song.artist_name,
        albumImageUrl: song.album_image_url,
    }));

    return <SessionPageClient error={props.error} topSongs={props.topSongs} sessionEndsAt={props.sessionEndsAt} alreadySubmitted={props.alreadySubmitted} token={props.token} isOnboarding={props.isOnboarding} />
}