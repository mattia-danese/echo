import { refreshAccessToken } from "./index";
import { logger, task } from "@trigger.dev/sdk/v3";
import { createClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const client = twilio(accountSid, authToken);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,    
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type EchoSessionData = {
  spotify_track_id: string;
  created_at: string;
  user_id: string;
};

type UserData = {
  id: string;
  friend_link_token: string;
  spotify_user_id: string;
  spotify_access_token: string;
  spotify_refresh_token: string;
  spotify_token_expires_at: string;
  first_name: string;
  phone_number: string;
};

export const onboardingCompletionTask = task({
  id: "onboarding-completion",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: {user: UserData}, { ctx }) => {
    logger.log("onboarding task starting", { payload, ctx });   

    // get user friends' most recent shared songs (1 song per friend, max 15 friends)
    // First get the user's friends
    const { data: userFriends, error: userFriendsError } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', payload.user.id);

    if (userFriendsError) {
        logger.error("error getting friends", { friendsError: userFriendsError });
        throw userFriendsError;
    }

    if (!userFriends || userFriends.length === 0) {
        logger.log(`no friends found for user ${payload.user.id}, sending generic playlist instead`);
        
        await sendMessages({
            phone_number: payload.user.phone_number, 
            playlist_id: process.env.ONBOARDING_COMPLETION_GENERIC_SPOTIFY_PLAYLIST_ID!, numFriends: 0, 
            friend_link_token: payload.user.friend_link_token
        });

        return {
            message: `sent generic playlist to ${payload.user.id} at ${payload.user.phone_number}`,
        };
    }

    const numFriends = userFriends.length;

    // Then get echo sessions for those friends
    const { data: friendsData, error: friendsDataError } = await supabase
        .from('user_echo_sessions')
        .select(`
            spotify_track_id,
            created_at,
            user_id
        `)
        .in('user_id', userFriends.map(f => f.friend_id))
        .not('spotify_track_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(15);
        
    if (friendsDataError) {
        logger.error("error getting echo sessions", { sessionsError: friendsDataError });
        throw friendsDataError;
    }

    if (!friendsData || friendsData.length === 0) {
        logger.log(`no echo sessions found for friends of user ${payload.user.id}, sending generic playlist instead`);
        
        await sendMessages({
            phone_number: payload.user.phone_number, 
            playlist_id: process.env.ONBOARDING_COMPLETION_GENERIC_SPOTIFY_PLAYLIST_ID!, 
            numFriends: numFriends, 
            friend_link_token: payload.user.friend_link_token
        });

        return {
            message: `sent generic playlist to ${payload.user.id} at ${payload.user.phone_number}`,
        };
    }

    // refresh spotify access token if it's expired
    if (new Date(payload.user.spotify_token_expires_at) < new Date()) {
        logger.log("spotify token expired, refreshing ...", { user: payload.user });

        const { data: refreshAccessTokenData, error: refreshAccessTokenError } = await refreshAccessToken(payload.user.spotify_refresh_token);

        if (refreshAccessTokenError) {
            logger.error("error refreshing spotify token", {user: payload.user, refreshAccessTokenError });
            throw refreshAccessTokenError;
        }

        if (!refreshAccessTokenData) {
            logger.error("no data returned from refreshAccessToken", {user: payload.user, refreshAccessTokenData });
            throw refreshAccessTokenError;
        }

        payload.user.spotify_access_token = refreshAccessTokenData.access_token;
        payload.user.spotify_token_expires_at = new Date(Date.now() + refreshAccessTokenData.expires_in * 1000).toISOString();

        logger.log("spotify token refreshed", { user: payload.user });
        
        logger.log("updating user with refreshed token", { user: payload.user });
        await supabase
            .from('users')
            .update({ 
                spotify_access_token: payload.user.spotify_access_token, 
                spotify_refresh_token: refreshAccessTokenData.refresh_token ?? payload.user.spotify_refresh_token,
                spotify_token_expires_at: payload.user.spotify_token_expires_at 
            })
            .eq('id', payload.user.id);

        logger.log("user update complete", { user: payload.user });
    }

    logger.log("creating onboarding completion playlist for user", { user: payload.user });

    const playlistDate = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
    const playlistNameAbbreviation = payload.user.first_name.endsWith('s') ? "'s" : "'s";

    // generate spotify playlist of last songs shared by friends
    const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${payload.user.spotify_user_id}/playlists`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${payload.user.spotify_access_token}`,
          },
        body: JSON.stringify({
           name: `${payload.user.first_name}${playlistNameAbbreviation} echo ${playlistDate}`,
           description: `here are the songs your friends shared for the ${playlistDate} echo`,
           public: false,
        })
      });

    if (!createPlaylistResponse.ok) {
        logger.error("error creating playlist", { user: payload.user, createPlaylistResponse });
        throw createPlaylistResponse;
    }

    const playlistData = await createPlaylistResponse.json();
    logger.log("playlist created", { playlistData });

    logger.log("adding songs to playlist");

    const addSongsToPlaylistResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistData.id}/tracks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${payload.user.spotify_access_token}`,
        },
        body: JSON.stringify({
            uris: friendsData.map(friend => `spotify:track:${friend.spotify_track_id}`),
        })
    });

    if (!addSongsToPlaylistResponse.ok) {
        logger.error("error adding songs to playlist", { user: payload.user, addSongsToPlaylistResponse });
        throw addSongsToPlaylistResponse;
    }
    
    logger.log("adding songs to playlist done", { addSongsToPlaylistResponse });

    // send messages to user
    await sendMessages({phone_number: payload.user.phone_number, playlist_id: playlistData.id, numFriends: numFriends, friend_link_token: payload.user.friend_link_token});

    return {
        message: `sent onboarding completion playlist to ${payload.user.id} at ${payload.user.phone_number}`,
    };
  },
});

const sendMessages = async (payload: {phone_number: string, playlist_id: string, numFriends: number, friend_link_token: string}) => {
    // const message1 = await client.messages.create({
    //     body: `perfect :) at the end of the day you'll get a playlist with the songs your friends shared`,
    //     from: fromNumber,
    //     to: payload.phone_number,
    // });

    // logger.log("onboarding completion message #1 sent", { message1 });

    // const message2 = await client.messages.create({
    //     body: `https://open.spotify.com/playlist/${payload.playlist_id}`,
    //     from: fromNumber,
    //     to: payload.phone_number,
    // });

    // logger.log("onboarding completion message #2 sent", { message2 });

    // const message3 = await client.messages.create({
    //     body: `and that's echo :)`,
    //     from: fromNumber,
    //     to: payload.phone_number,
    // });

    // logger.log("onboarding completion message #3 sent", { message3 });

    // const message4 = await client.messages.create({
    //     body: `
    //     you only have ${payload.numFriends} friends
    //     here's your unique friend request link. send friends this link to add them and start discovering music together :)`,
    //     from: fromNumber,
    //     to: payload.phone_number,
    // });

    // logger.log("onboarding completion message #4 sent", { message4 });

    // const message5 = await client.messages.create({
    //     body: `https://text-echo.com/${payload.friend_link_token}`,    
    //     from: fromNumber,
    //     to: payload.phone_number,
    // });

    // logger.log("onboarding completion message #5 sent", { message5 });
}