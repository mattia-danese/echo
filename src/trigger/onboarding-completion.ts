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

type UserData = {
  id: string;
  friend_link_token: string;
  spotify_user_id: string;
  spotify_access_token: string;
  spotify_refresh_token: string;
  spotify_token_expires_at: string;
  apple_music_user_id: string;
  apple_music_access_token: string;
  apple_music_refresh_token: string;
  apple_music_token_expires_at: string;
  first_name: string;
  phone_number: string;
  platform: string;
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
            track_id,
            created_at,
            user_id
        `)
        .in('user_id', userFriends.map(f => f.friend_id))
        .not('track_id', 'is', null)
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

    let playlistData: { id: string } | { id: null };
    
    if (payload.user.platform === "spotify") {
        playlistData = await handleSpotifyUser(payload.user, friendsData);
    } else if (payload.user.platform === "apple-music") {
        playlistData = await handleAppleMusicUser(payload.user, friendsData);
    }
    else {
        logger.error("invalid platform", { user: payload.user });
        throw new Error("invalid platform");
    }

    // send messages to user
    await sendMessages({
        phone_number: 
        payload.user.phone_number, 
        playlist_id: playlistData.id!, 
        numFriends: numFriends, 
        friend_link_token: 
        payload.user.friend_link_token
    });

    return {
        message: `sent onboarding completion playlist to ${payload.user.id} at ${payload.user.phone_number}`,
    };
  },
});

const sendMessages = async (payload: {phone_number: string, playlist_id: string, numFriends: number, friend_link_token: string}) => {
    logger.log("sending messages", { payload });
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

const handleSpotifyUser = async (user: UserData, friendsData: { track_id: string; created_at: string; user_id: string; }[]) => {
    // refresh spotify access token if it's expired
    if (new Date(user.spotify_token_expires_at) < new Date()) {
        logger.log("spotify token expired, refreshing ...", { user: user });

        const { data: refreshAccessTokenData, error: refreshAccessTokenError } = await refreshAccessToken(user.spotify_refresh_token);

        if (refreshAccessTokenError) {
            logger.error("error refreshing spotify token", {user: user, refreshAccessTokenError });
            throw refreshAccessTokenError;
        }

        if (!refreshAccessTokenData) {
            logger.error("no data returned from refreshAccessToken", {user: user, refreshAccessTokenData });
            throw refreshAccessTokenError;
        }

        user.spotify_access_token = refreshAccessTokenData.access_token;
        user.spotify_token_expires_at = new Date(Date.now() + refreshAccessTokenData.expires_in * 1000).toISOString();

        logger.log("spotify token refreshed", { user: user });
        
        logger.log("updating user with refreshed token", { user: user });
        await supabase
            .from('users')
            .update({ 
                spotify_access_token: user.spotify_access_token, 
                spotify_refresh_token: refreshAccessTokenData.refresh_token ?? user.spotify_refresh_token,
                spotify_token_expires_at: user.spotify_token_expires_at 
            })
            .eq('id', user.id);

        logger.log("user update complete", { user: user });
    }

    logger.log("creating onboarding completion playlist for user", { user: user });

    const playlistDate = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
    const playlistNameAbbreviation = user.first_name.endsWith('s') ? "'s" : "'s";

    // generate spotify playlist of last songs shared by friends
    const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${user.spotify_user_id}/playlists`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.spotify_access_token}`,
          },
        body: JSON.stringify({
           name: `${user.first_name}${playlistNameAbbreviation} echo ${playlistDate}`,
           description: `here are the songs your friends shared for the ${playlistDate} echo`,
           public: false,
        })
      });

    if (!createPlaylistResponse.ok) {
        logger.error("error creating playlist", { user: user, createPlaylistResponse });
        throw createPlaylistResponse;
    }

    const playlistData = await createPlaylistResponse.json();
    logger.log("playlist created", { playlistData });

    logger.log("adding songs to playlist");

    const addSongsToPlaylistResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistData.id}/tracks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.spotify_access_token}`,
        },
        body: JSON.stringify({
            uris: friendsData.map(friend => `spotify:track:${friend.track_id}`),
        })
    });

    if (!addSongsToPlaylistResponse.ok) {
        logger.error("error adding songs to playlist", { user: user, addSongsToPlaylistResponse });
        throw addSongsToPlaylistResponse;
    }
    
    logger.log("adding songs to playlist done", { addSongsToPlaylistResponse });

    return { id: playlistData.id };
}

const handleAppleMusicUser = async (user: UserData, friendsData: { track_id: string; created_at: string; user_id: string; }[]) => {
    return { id: null };
}