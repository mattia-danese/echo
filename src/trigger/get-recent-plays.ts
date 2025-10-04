import { logger, task} from "@trigger.dev/sdk/v3";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,    
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type User = {   
    id: string,
    platform: string,
    spotify_access_token: string | null, 
    spotify_refresh_token: string | null, 
    spotify_token_expires_at: string | null,
    apple_music_access_token: string | null,
    apple_music_refresh_token: string | null,
    apple_music_token_expires_at: string | null,
}

type TrackPlay = {
    user_id: string,
    platform: string,
    track_id: string,
    track_name: string,
    artists: string,
    played_at: string,
    album_image_url: string,
}

export const getRecentPlaysTask = task({
  id: "get-recent-plays",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute

  run: async (payload: {user?: User}, { ctx }) => {
    logger.log("get recent plays task starting ...");

    let data = payload.user ? [payload.user] : [] as User[];

    if (!payload.user) {
        const { data: users, error } = await supabase
        .from('users')
        .select(`
            id,
            platform,
            spotify_access_token, 
            spotify_refresh_token, 
            spotify_token_expires_at,
            apple_music_access_token,
            apple_music_refresh_token,
            apple_music_token_expires_at,
        `)

        if (error) {
            logger.error("error getting recent plays", { error });
            throw error;
        }

        data = (users as unknown as User[]) || [];
    }

    for (const user of data) {
        
        if (user.platform === "spotify") {
            await handleSpotifyUser(user.id, user.spotify_access_token!, user.spotify_refresh_token!, user.spotify_token_expires_at!);
        } else if (user.platform === "apple-music") {
            await handleAppleMusicUser(user.id, user.apple_music_access_token!, user.apple_music_refresh_token!, user.apple_music_token_expires_at!);
        } else {
            logger.error("invalid platform", { user });
        }
    }

    return {
      message: `get recent plays task completed`,
    }
  },
});

const handleSpotifyUser = async (user_id: string, access_token: string, refresh_token: string, token_expires_at: string) => {
    if (new Date(token_expires_at) < new Date()) {
        logger.log("spotify token expired, refreshing ...", { user_id, access_token, refresh_token, token_expires_at });

        const {data: refreshAccessTokenData, error: refreshAccessTokenError} = await refreshSpotifyAccessToken(refresh_token);

        if (refreshAccessTokenError) {
            logger.error("error refreshing spotify token", {user_id, refreshAccessTokenError });
            return;
        }

        if (!refreshAccessTokenData) {
            logger.error("no data returned from refreshAccessToken", {user_id, refreshAccessTokenData });
            return;
        }
        
        const new_access_token = refreshAccessTokenData.access_token;
        const new_refresh_token = refreshAccessTokenData.refresh_token;
        const new_token_expires_at = new Date(Date.now() + refreshAccessTokenData.expires_in * 1000).toISOString();

        logger.log("spotify token refreshed", { user_id, new_access_token, new_token_expires_at });
        
        logger.log("updating user with refreshed token", { user_id, new_access_token, new_token_expires_at });  
        await supabase
            .from('users')
            .update({ 
                spotify_access_token: new_access_token, 
                spotify_refresh_token: new_refresh_token ?? refresh_token,
                spotify_token_expires_at: new_token_expires_at
            })
            .eq('id', user_id);

        logger.log("user update complete", { user_id, new_access_token, new_token_expires_at });
    }

    logger.log("getting recent plays", { user_id });
    const {data: recentPlaysData, error: recentPlaysError} = await getRecentSpotifyPlays(access_token);
    logger.log("recent plays fetched", { recentPlaysData });

    if (recentPlaysError) {
        logger.error("error getting recent plays", {user_id, recentPlaysError });
        return;
    }

    if (!recentPlaysData) {
        logger.error("no data returned from getRecentPlays", {user_id, recentPlaysData });
        return;
    }

    // insert recent plays into supabase
    const userTrackPlays: TrackPlay[] = [];
    for (const play of recentPlaysData.items) {
        userTrackPlays.push({
            user_id: user_id,
            platform: 'spotify',
            track_id: play.track.id,
            track_name: play.track.name,
            artists: play.track.artists.map((artist: SpotifyApi.ArtistObjectSimplified) => artist.name).join(', '),
            played_at: play.played_at,
            album_image_url: play.track.album.images[0].url,
        });
    }

    await storeTracks(userTrackPlays, user_id);
}

const getRecentSpotifyPlays = async (spotify_access_token: string) => {
    const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${spotify_access_token}`
        }
    });

    if (!response.ok) {
        const errorData = await response.text();
        return { data: null, error: `HTTP ${response.status}: ${errorData}` };
    }
    
    const data = await response.json();
    
    return { data, error: null };
}

const refreshSpotifyAccessToken = async (spotify_refresh_token: string) => {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString('base64')}`
          },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: spotify_refresh_token
        })
    });
    
    if (!response.ok) {
        const errorData = await response.text();
        return { data: null, error: `HTTP ${response.status}: ${errorData}` };
    }
    
    const data = await response.json();
    
    return { data, error: null };
}

const handleAppleMusicUser = async (user_id: string, user_access_token: string, refresh_token: string, token_expires_at: string) => {
    throw new Error("apple music auth not implemented yet");
}

const refreshAppleMusicAccessToken = async (apple_music_refresh_token: string) => {
    return { data: null, error: null };
}

const getRecentAppleMusicPlays = async (apple_music_access_token: string) => {
    return { data: null, error: null };
}

const storeTracks = async (trackPlays: TrackPlay[], user_id: string) => {
    const {error: writeRecentPlaysError} = await supabase
        .from('user_track_plays')
        .upsert(trackPlays, { 
            onConflict: 'user_id, track_id, played_at',
            ignoreDuplicates: true 
        });

    if (writeRecentPlaysError) {
        logger.error("error writing recent plays", {user_id, writeRecentPlaysError });
        throw writeRecentPlaysError;
    }

    logger.log("writing recent plays done", { user_id });
}