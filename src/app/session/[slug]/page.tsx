import SessionPageClient from "./_components/SessionPageClient";

interface PageProps {
    params: Promise<{
        slug: string[];
    }>;
}

export default async function SessionPage({ params }: PageProps) {

    const resolvedParams = await params;
    // const token = resolvedParams.slug?.[0]; // TODO: implement token usage

    // TODO:from token (also check if they already submitted a song - cannot resubmit)
    // - get user
    // - check if they already submitted a song
    // - check if session is still active

    // TODO: get top songs of user (update db to store album image url from recently played songs endpoint)

    const topSongs = [
        {
            title: 'Song 1',
            trackId: '12345678901',
            artists: 'Artist 1',
            albumImageUrl: 'https://i.scdn.co/image/ab67616d00001e02ff9ca10b55ce82ae553c8228',
        },
        {
            title: 'Song 2',
            trackId: '12345678902',
            artists: 'Artist 2',
            albumImageUrl: 'https://i.scdn.co/image/ab67616d00001e02ff9ca10b55ce82ae553c8228',
        },
        {
            title: 'Song 3',
            trackId: '12345678903',
            artists: 'Artist 3',
            albumImageUrl: 'https://i.scdn.co/image/ab67616d00001e02ff9ca10b55ce82ae553c8228',
        },
        {
            title: 'Song 4',
            trackId: '12345678904',
            artists: 'Artist 4',
            albumImageUrl: 'https://i.scdn.co/image/ab67616d00001e02ff9ca10b55ce82ae553c8228',
        },
    ]

    return <SessionPageClient topSongs={topSongs} sessionActive={true} sessionEndsAt={new Date()} alreadySubmitted={false} />
}