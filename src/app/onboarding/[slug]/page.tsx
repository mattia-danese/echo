import { getUserTopSongs } from "@/app/actions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import SessionPageClient from "../../session/[slug]/_components/SessionPageClient";

const supabase = supabaseAdmin;

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function OnboardingPage({ params }: PageProps) {
  const resolvedParams = await params;
  const token = resolvedParams.slug;

  let alreadySubmitted = false;
  let err = false;
  let platform = "";

  const { data, error } = await supabase
    .from("users")
    .select("id, is_onboarding_complete, platform")
    .eq("onboarding_token", token)
    .single();

  if (!data || error) {
    err = true;

    return (
      <SessionPageClient
        error={true}
        topSongs={[]}
        sessionEndsAt={""}
        alreadySubmitted={alreadySubmitted}
        token={token}
        isOnboarding={true}
        platform={platform}
      />
    );
  } else {
    alreadySubmitted = data.is_onboarding_complete;
    platform = data.platform;
  }

  // get top songs of user
  const result = await getUserTopSongs({ user_id: data.id, num_songs: 2 });

  if (!result.ok) {
    err = true;
    console.log("topSongsError:", result.message, data.id);

    return (
      <SessionPageClient
        error={true}
        topSongs={[]}
        sessionEndsAt={""}
        alreadySubmitted={alreadySubmitted}
        token={token}
        isOnboarding={true}
        platform={platform}
      />
    );
  }

  const topSongs = result.songs.map((song) => ({
    title: song.track_name,
    trackId: song.track_id,
    artists: song.artists,
    albumImageUrl: song.album_image_url,
  }));

  return (
    <SessionPageClient
      error={err}
      topSongs={topSongs}
      sessionEndsAt={""}
      alreadySubmitted={alreadySubmitted}
      token={token}
      isOnboarding={true}
      platform={platform}
    />
  );
}
