import SessionPageClient from "../../session/[slug]/_components/SessionPageClient";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PageProps {
    params: Promise<{
        slug: string;
    }>;
}

export default async function OnboardingPage({ params }: PageProps) {
    const resolvedParams = await params;
    const token = resolvedParams.slug;

    const topSongs: {
        title: string;
        trackId: string;
        albumImageUrl: string;
        artists: string;
    }[] = [
        {
            title: "The Fox (What Does the Fox Say?)",
            trackId: "5HOpkTTVcmZHnthgyxrIL8",
            albumImageUrl: "https://i.scdn.co/image/ab67616d0000b273078f1176c3c725de8e95f490",
            artists: "Ylvis",
        },
    ];

    let alreadySubmitted = false;
    let err = false;

    const { data, error } = await supabase
      .from("users")
      .select("is_onboarding_complete")
      .eq("onboarding_token", token)
      .single();

    if (!data || error) {
        err = true;
    } else {
        alreadySubmitted = data.is_onboarding_complete;
    }

    return <SessionPageClient error={err} topSongs={topSongs} sessionEndsAt={""} alreadySubmitted={alreadySubmitted} token={token} isOnboarding={true} />
}
