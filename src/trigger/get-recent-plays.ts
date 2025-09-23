import { logger, task, wait } from "@trigger.dev/sdk/v3";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,    
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const getRecentPlaysTask = task({
  id: "get-recent-plays",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: {}, { ctx }) => {
    logger.log("get recent plays task starting", { payload, ctx });

    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        spotify_access_token, 
        spotify_refresh_token, 
        spotify_token_expires_at
    `)

    if (error) {
      logger.error("error getting recent plays", { error });
      throw error;
    }

    for (const user of data) {
        // check if spotify_token_expires_at is in the past
        if (new Date(user.spotify_token_expires_at) < new Date()) {
            logger.log("spotify token expired, refreshing ...", { user });

            const {data: refreshAccessTokenData, error: refreshAccessTokenError} = await refreshAccessToken(user.spotify_refresh_token);

            if (refreshAccessTokenError) {
                logger.error("error refreshing spotify token", {user, refreshAccessTokenError });
                continue;
            }

            if (!refreshAccessTokenData) {
                logger.error("no data returned from refreshAccessToken", {user, refreshAccessTokenData });
                continue;
            }
            
            user.spotify_access_token = refreshAccessTokenData.access_token;
            user.spotify_token_expires_at = new Date(Date.now() + refreshAccessTokenData.expires_in * 1000).toISOString();

            logger.log("spotify token refreshed", { user });
            
            logger.log("updating user with refreshed token", { user });
            await supabase
                .from('users')
                .update({ 
                    spotify_access_token: user.spotify_access_token, 
                    spotify_refresh_token: refreshAccessTokenData.refresh_token ?? user.spotify_refresh_token,
                    spotify_token_expires_at: user.spotify_token_expires_at 
                })
                .eq('id', user.id);

            logger.log("user update complete", { user });
        }

        logger.log("getting recent plays", { user });
        const {data: recentPlaysData, error: recentPlaysError} = await getRecentPlays(user.spotify_access_token);
        logger.log("recent plays fetched", { recentPlaysData });

        if (recentPlaysError) {
            logger.error("error getting recent plays", {user, recentPlaysError });
            continue;
        }

        if (!recentPlaysData) {
            logger.error("no data returned from getRecentPlays", {user, recentPlaysData });
            continue;
        }

        // insert recent plays into supabase
        const userTrackPlays = [];
        for (const play of recentPlaysData.items) {
            userTrackPlays.push({
                user_id: user.id,
                spotify_track_id: play.track.id,
                track_name: play.track.name,
                artist_name: play.track.artists.map((artist: SpotifyApi.ArtistObjectSimplified) => artist.name).join(', '),
                played_at: play.played_at,
            });
        }

        logger.log("writing recent plays into 'user_track_plays' table ...", { userTrackPlays });
        const {error: writeRecentPlaysError} = await supabase
            .from('user_track_plays')
            .insert(userTrackPlays);

        if (writeRecentPlaysError) {
            logger.error("error writing recent plays", {user, writeRecentPlaysError });
            continue;
        }

        logger.log("writing recent plays done");
    }

    return {
      message: `get recent plays task completed`,
    }
  },
});


const getRecentPlays = async (spotify_access_token: string) => {
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

const refreshAccessToken = async (spotify_refresh_token: string) => {
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