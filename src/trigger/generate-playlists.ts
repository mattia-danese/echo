import { logger, schedules } from "@trigger.dev/sdk/v3";
import { createClient } from '@supabase/supabase-js';

import { refreshAccessToken } from "./index";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const client = twilio(accountSid, authToken);

type PlaylistRecords = {
  user_id: string;
  session_id: string;
  playlist_spotify_id: string;
}[];

type PlaylistSongRecords = {
  playlist_id: string;
  spotify_track_id: string;
  submitted_by_user_id: string;
  playlist_spotify_id: string;
}[];

type UserSongData = {
  user_id: string;
  spotify_track_id: string;
  users: {
    first_name: string;
    phone_number: string;
    spotify_user_id: string;
    spotify_access_token: string;
    spotify_refresh_token: string;
    spotify_token_expires_at: string;
  };
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,    
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NUM_SONGS_PER_PLAYLIST = 10;

export const generatePlaylistsTask = schedules.task({
  id: "generate-playlists",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute

  cron : {
    // echo sessions are every Tues and Fri at 6:00 PM
    pattern: "0 12 * * 3,6", // run every Wed and Sat at 12:00 PM
    timezone: "America/New_York",
    environments: ["DEVELOPMENT"],
  },

  run: async () => {
    logger.log("generate playlists task starting ...");

    // get most recent echo session
    const { data: echoSessionData, error: echoSessionError } = await supabase
      .from('echo_sessions')
      .select('id, start')
      .order('start', { ascending: false })
      .limit(1)
      .single();
      
    if (echoSessionError) {
      logger.error("error getting most recent echo session", { echoSessionError });
      throw echoSessionError;
    }

    const echoSessionId = echoSessionData.id;
    const playlistDate = new Date(echoSessionData.start).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
    logger.log("most recent echo session fetched", { echoSessionData });
    
    // get all users that submitted a song in the last session (user_id, phone_number, song_id)
    const { data: userSongData, error: userSongError } = await supabase
      .from('user_echo_sessions')
      .select(`
        user_id, 
        spotify_track_id,
        users!inner(first_name, phone_number, spotify_user_id, spotify_access_token, spotify_refresh_token, spotify_token_expires_at)
      `)
      .eq('session_id', echoSessionId) as { data: UserSongData[] | null; error: unknown };
      
    if (userSongError) {
      logger.error("error getting users that submitted a song in the last session", { userSongError });
      throw userSongError;
    }

    if (!userSongData || userSongData.length === 0) {
      logger.log("no users that submitted a song in the last session found", { echoSessionId });
      return {
        message: `no users that submitted a song in the last session found`,
      }
    }

    logger.log("users that submitted a song in the last session fetched", { numUsers: userSongData.length });

    // create lookup table mapping user_id to song_id
    const userSongLookup: Record<string, string> = {};
    for (const user of userSongData) {
      userSongLookup[user.user_id] = user.spotify_track_id;
    }

    logger.log("user song lookup created");

    // iterate over users and get each user's friends
    // iterate over friends and get each friend's song from lookup table
    // aggregate friends' songs (ignore duplicates) + create playlist_song record data


    // user_id -> [friend_id, song_id]
    const playlists: Record<string, string[][]> = {};

    const playlistRecords: PlaylistRecords = [];
    const playlistSongRecords: PlaylistSongRecords = [];

    for (const user of userSongData) {

      logger.log("processing user", { user });

      playlists[user.user_id] = [];

      const { data: userFriendData, error: userFriendError } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', user.user_id)
        .limit(NUM_SONGS_PER_PLAYLIST);

      if (userFriendError) {
        logger.error("error getting user's friends", { user, userFriendError });
        // throw userFriendError;
        continue;
      }

      if (userFriendData.length === 0) {
        continue
      }

      for (const friend of userFriendData) {
        const friendSong = userSongLookup[friend.friend_id];

        if (playlists[user.user_id].map(playlist => playlist[1]).includes(friendSong)) { continue }

        playlists[user.user_id].push([friend.friend_id, friendSong]);
      }

      // create a playlist with Spotify API
      // TODO: add spotify_user_id to users table

      if (new Date(user.users.spotify_token_expires_at) < new Date()) {
        logger.log("spotify token expired, refreshing ...", { user });
        
        const {data: refreshAccessTokenData, error: refreshAccessTokenError} = await refreshAccessToken(user.users.spotify_refresh_token);

        if (refreshAccessTokenError) {
            logger.error("error refreshing spotify token", {user, refreshAccessTokenError });
            continue;
        }

        if (!refreshAccessTokenData) {
            logger.error("no data returned from refreshAccessToken", {user, refreshAccessTokenData });
            continue;
        }

        user.users.spotify_access_token = refreshAccessTokenData.access_token;
        user.users.spotify_token_expires_at = new Date(Date.now() + refreshAccessTokenData.expires_in * 1000).toISOString();

        logger.log("spotify token refreshed", { user });
        
        logger.log("updating user with refreshed token", { user });
        await supabase
            .from('users')
            .update({ 
                spotify_access_token: user.users.spotify_access_token, 
                spotify_refresh_token: refreshAccessTokenData.refresh_token ?? user.users.spotify_refresh_token,
                spotify_token_expires_at: user.users.spotify_token_expires_at 
            })
            .eq('id', user.user_id);

        logger.log("user update complete", { user });
      }

      logger.log("creating playlist for user", { user });
      const playlistNameAbbreviation = user.users.first_name.endsWith('s') ? "'s" : "'s";

      const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${user.users.spotify_user_id}/playlists`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.users.spotify_access_token}`,
          },
        body: JSON.stringify({
           name: `${user.users.first_name}${playlistNameAbbreviation} echo ${playlistDate}`,
           description: `here are the songs your friends shared for the ${playlistDate} echo`,
           public: false,
        })
      });

      if (!createPlaylistResponse.ok) {
        logger.error("error creating playlist", { user, createPlaylistResponse });
        continue;
      }

      const playlistData = await createPlaylistResponse.json();
      logger.log("playlist created", { playlistData });

      logger.log("adding songs to playlist");

      const addSongsToPlaylistResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistData.id}/tracks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.users.spotify_access_token}`,
        },
        body: JSON.stringify({
            uris: playlists[user.user_id].map(song => `spotify:track:${song[1]}`),
        })
      });

      if (!addSongsToPlaylistResponse.ok) {
        logger.error("error adding songs to playlist", { user, addSongsToPlaylistResponse });
        continue;
      }
      logger.log("adding songs to playlist done", { addSongsToPlaylistResponse });

      playlistRecords.push({
        user_id: user.user_id,
        session_id: echoSessionId,
        playlist_spotify_id: playlistData.id,
      });

      playlistSongRecords.push(...playlists[user.user_id].map(song => ({
        playlist_id: "",
        spotify_track_id: song[1],
        submitted_by_user_id: song[0],
        playlist_spotify_id: playlistData.id,
      })));
    }

    // save each playlist to database
    logger.log("saving playlists to database");
    const { data: playlistInsertData, error: playlistInsertError } = await supabase
      .from('playlists')
      .insert(playlistRecords)
      .select('id, playlist_spotify_id');

    if (playlistInsertError) {
      logger.error("error writing playlists to database", { playlistInsertError });
      throw playlistInsertError;
    }

    const playlistIdBySpotifyId = new Map(
      playlistInsertData.map(r => [r.playlist_spotify_id, r.id])
    );

    logger.log("saving playlists to database done", { numPlaylists: playlistIdBySpotifyId.size });

    // save each playlist_song to database
    for (const playlistSong of playlistSongRecords) {
      playlistSong.playlist_id = playlistIdBySpotifyId.get(playlistSong.playlist_spotify_id);
    }

    logger.log("saving playlist songs to database");
    const { error: playlistSongInsertError } = await supabase
      .from('playlist_songs')
      .insert(playlistSongRecords.map(r => ({
        playlist_id: r.playlist_id,
        spotify_track_id: r.spotify_track_id,
        submitted_by_user_id: r.submitted_by_user_id,
      })));

    if (playlistSongInsertError) {
      logger.error("error writing playlist songs to database", { playlistSongInsertError });
      throw playlistSongInsertError;
    }
    logger.log("saving playlist songs to database done");

    // text each user their playlist
    for (const playlist of playlistRecords) {
      const userPhoneNumber = userSongData.find(user => user.user_id === playlist.user_id)?.users.phone_number;

      if (!userPhoneNumber) {
        logger.error("phone number not found for user", { playlist, userSongData });
        continue;
      }

      const message = await client.messages.create({
        body: `
        https://open.spotify.com/playlist/${playlist.playlist_spotify_id}
        `,
        from: fromNumber,
        to: userPhoneNumber,
      });

      logger.log("texted user their playlist", { playlist, message });

    }
    return {
      message: `generate playlists task completed`,
    }
  },
});

// const getEchoSessionAndUsers = async () => {}

// const getUserFriends = async (userId: string) => {}

// const compilePlaylistPerUser = async (userId: string, friends: string[]) => {}

// const createSpotifyPlaylistForUser = async (userId: string) => {}

// const persistPlaylistsToDatabase = async (playlists: PlaylistRecords, playlistSongs: PlaylistSongRecords) => {}

// const textUsersTheirPlaylists = async (playlists: PlaylistRecords) => {}

