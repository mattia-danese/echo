import { logger, task } from "@trigger.dev/sdk/v3";
import { createClient } from '@supabase/supabase-js';

import { SpotifyPlatform } from "@/platforms";

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

    const { ok, data, error } = await createOnboardingPlaylistForUser(payload.user, friendsData);

    if (!ok) {
        throw new Error("error creating onboarding playlist", { cause: { user: payload.user, error } });
    }

    if (!data) {
        throw new Error("no data returned from createOnboardingPlaylistForUser", { cause: { user: payload.user, data } });
    }

    // send messages to user
    await sendMessages({
        phone_number: 
        payload.user.phone_number, 
        playlist_id: data.playlist_id, 
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

const createOnboardingPlaylistForUser = async (user: UserData, friendsData: { track_id: string; created_at: string; user_id: string; }[]) => {
  if (user.platform === "spotify") {
    return await handleSpotifyUser(user, friendsData);
  }
  else if (user.platform === "apple-music") {
    return await handleAppleMusicUser(user, friendsData);
  }

  return { ok: false, data: null, error: `invalid platform ${user.platform}` };
}

const handleSpotifyUser = async (user: UserData, friendsData: { track_id: string; created_at: string; user_id: string; }[]) => {
    // refresh spotify access token if it's expired
    if (new Date(user.spotify_token_expires_at) < new Date()) {
        logger.log("spotify token expired, refreshing ...", { user: user });

        const { ok: refreshTokensOk, data: refreshTokensData, error: refreshTokensError } = await SpotifyPlatform.refreshTokens({ user_id: user.id, refresh_token: user.spotify_refresh_token });

        if (!refreshTokensOk) {
            logger.error("error refreshing spotify token", {user, refreshTokensError });
            return { ok: false, data: null, error: refreshTokensError };
        }

        if (!refreshTokensData) {
            logger.error("no data returned from refreshAccessToken", {user, refreshTokensData });
            return { ok: false, data: null, error: `no data returned from refreshAccessToken` };
        }

        user.spotify_access_token = refreshTokensData.access_token;
        user.spotify_refresh_token = refreshTokensData.refresh_token;
        user.spotify_token_expires_at = refreshTokensData.expires_in;

        logger.log("user update complete", { user: user });
    }

    logger.log("creating onboarding completion playlist for user", { user: user });

    const playlistDate = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
    const playlistNameAbbreviation = user.first_name.endsWith('s') ? "'s" : "'s";

    // generate spotify playlist of last songs shared by friends
    
    const { ok: createPlaylistOk, data: createPlaylistData, error: createPlaylistError } = await SpotifyPlatform.createPlaylist({
        user_id: user.spotify_user_id, 
        access_token: user.spotify_access_token, 
        playlist_name: `${user.first_name}${playlistNameAbbreviation} echo ${playlistDate}`, playlist_description: `here are the songs your friends shared for the ${playlistDate} echo`,
        playlist_date: playlistDate 
    });

    if (!createPlaylistOk) {
        logger.error("error creating playlist", { user, createPlaylistError });
        return { ok: false, data: null, error: createPlaylistError };
    }

    if (!createPlaylistData) {
        logger.error("no data returned from createPlaylist", { user, createPlaylistData });
        return { ok: false, data: null, error: `no data returned from createPlaylist` };
    }

    logger.log("playlist created", { createPlaylistData });

    const songURIs = friendsData.map(friend => `spotify:track:${friend.track_id}`);
    const { ok: addSongsToPlaylistOk, error: addSongsToPlaylistError } = await SpotifyPlatform.populatePlaylist({
        access_token: user.spotify_access_token,
        trackURIs: songURIs,
        playlist_id: createPlaylistData.playlist_id
    });

    if (!addSongsToPlaylistOk) {
        logger.error("error adding songs to playlist", { user: user, addSongsToPlaylistError });
        return { ok: false, data: null, error: addSongsToPlaylistError };
    }
    
    logger.log("adding songs to playlist done");

    return { ok: true, data: createPlaylistData, error: null };
}

const handleAppleMusicUser = async (user: UserData, friendsData: { track_id: string; created_at: string; user_id: string; }[]) => {
    return { ok: false, data: null, error: `apple music not implemented yet` };
}