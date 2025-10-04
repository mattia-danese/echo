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
  platform: string;
  session_id: string;
  platform_playlist_id: string;
}[];

type PlaylistSongRecords = {
  playlist_id: string;
  track_id: string;
  submitted_by_user_id: string;
  platform_playlist_id: string;
}[];

type UserSongData = {
  user_id: string;
  track_id: string;
  platform: string;
  users: {
    first_name: string;
    platform: string;
    phone_number: string;
    spotify_user_id: string;
    spotify_access_token: string;
    spotify_refresh_token: string;
    spotify_token_expires_at: string;
    apple_music_user_id: string;
    apple_music_access_token: string;
    apple_music_refresh_token: string;
    apple_music_token_expires_at: string;
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
    pattern: "30 18 * * 3,7", // run every Wed and Sun at 6:30 PM EST
    timezone: "America/New_York",
    environments: ["DEVELOPMENT"],
  },

  run: async () => {
    logger.log("generate playlists task starting ...");

    const { ok, data, error } = await getEchoSessionAndUsers();
    
    if (!ok) {
      logger.error("error getting echo session and users", { error });
      throw error;
    }

    const { userSongData, echoSessionId, playlistDate } = data!;

    logger.log("echo session and users fetched", { numUsers: userSongData.length, echoSessionId, playlistDate });

    // create lookup table mapping user_id to song_id
    const userSongLookup: Record<string, string> = {};
    for (const user of userSongData) {
      userSongLookup[user.user_id] = user.track_id;
    }

    logger.log("user to song lookup created");

    // create lookup table mapping user_id to platform (used to determine which platform to create playlist on)
    const userToSongSubmittedPlatformLookup: Record<string, string> = {};
    for (const user of userSongData) {
      userToSongSubmittedPlatformLookup[user.user_id] = user.platform;
    }

    logger.log("user to song platform lookup created");

    // user_id -> [friend_id, song_id]
    const playlists: Record<string, string[][]> = {};

    const playlistRecords: PlaylistRecords = [];
    const playlistSongRecords: PlaylistSongRecords = [];

    const usersThatEncounteredErrors: Set<string> = new Set();

    for (const user of userSongData) {
      logger.log("processing user", { user });

      const { ok, data: userFriendData, error } = await getUserFriends(user.user_id);
      if (!ok) {
        logger.error("error getting user's friends", { user, error });
        usersThatEncounteredErrors.add(user.user_id);
        continue;
      }

      logger.log("user's friends fetched", { userFriendData });

      playlists[user.user_id] = await compilePlaylistSongs(
        user.users.platform, 
        userFriendData, 
        userSongLookup, 
        userToSongSubmittedPlatformLookup,
        NUM_SONGS_PER_PLAYLIST
      );

      const { ok: createPlaylistOk, data: playlistData, error: createPlaylistError } = await createPlaylistOnPlatformForUser(user, playlistDate);
      
      if (!createPlaylistOk) {
        logger.error("error creating playlist", { user, createPlaylistError });
        usersThatEncounteredErrors.add(user.user_id);
        continue;
      }

      logger.log("playlist created", { playlistData });
      logger.log("adding songs to playlist");

      const { ok: populatePlaylistOk, error: populatePlaylistError } = await populatePlatformPlaylist(
        user, 
        playlists[user.user_id].map(song => song[1]), 
        playlistData.id
      );

      if (!populatePlaylistOk) {
        logger.error("error populating playlist", { user, populatePlaylistError });
        usersThatEncounteredErrors.add(user.user_id);
        continue;
      }

      playlistRecords.push({
        user_id: user.user_id,
        platform: user.users.platform,
        session_id: echoSessionId,
        platform_playlist_id: playlistData.id,
      });

      playlistSongRecords.push(...playlists[user.user_id].map(song => ({
        playlist_id: "",
        track_id: song[1],
        submitted_by_user_id: song[0],
        platform_playlist_id: playlistData.id, // will not be persisted to database, just used to get Playlist.id in persistPlaylistsToDatabase
      })));
    }

    logger.log("playlist records and playlist song records", { playlistRecords, playlistSongRecords });
    
    const { ok: persistPlaylistsOk, error: persistPlaylistsError } = await persistPlaylistsToDatabase(playlistRecords, playlistSongRecords);
    if (!persistPlaylistsOk) {
      logger.error("error persisting playlists to database", { persistPlaylistsError });
      throw persistPlaylistsError;
    }

    // text each user their playlist
    await textUsersPlaylists(playlistRecords, userSongData, usersThatEncounteredErrors);
    
    return {
      message: `generate playlists task completed`,
    }
  },
});

const getEchoSessionAndUsers = async () => {
    // get most recent echo session
    const { data: echoSessionData, error: echoSessionError } = await supabase
      .from('echo_sessions')
      .select('id, start')
      .order('start', { ascending: false })
      .limit(1)
      .single();
      
    if (echoSessionError) {
      return { ok: false, data: null, error: echoSessionError };
    }

    const echoSessionId = echoSessionData.id;
    const playlistDate = new Date(echoSessionData.start).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
    
    // get all users that submitted a song in the last session (user_id, phone_number, song_id)
    const { data: userSongData, error: userSongError } = await supabase
      .from('user_echo_sessions')
      .select(`
        user_id, 
        track_id,
        platform,
        users!inner(platform, first_name, phone_number, spotify_user_id, spotify_access_token, spotify_refresh_token, spotify_token_expires_at, apple_music_user_id, apple_music_access_token, apple_music_refresh_token, apple_music_token_expires_at)
      `)
      .eq('session_id', echoSessionId)
      .neq('track_id', null) as { data: UserSongData[] | null; error: unknown };
      
    if (userSongError) {
      return { ok: false, data: null, error: userSongError };
    }

    if (!userSongData || userSongData.length === 0) {
      return {
        ok: false,
        data: null,
        error: `no users that submitted a song in the last session found`,
      }
    }

    return { ok: true, data: { userSongData, echoSessionId, playlistDate }, error: null };
}

const getUserFriends = async (userId: string) => {
    const { data: userFriendData, error: userFriendError } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId)
            
    if (userFriendError) {
        return { ok: false, data: [], error: userFriendError };
    }

    if (userFriendData.length === 0) {
        return { ok: false, data: [], error: `no friends found for user ${userId}` };
    }

    return { ok: true, data: userFriendData.map(friend => friend.friend_id), error: null };
}

const compilePlaylistSongs = async (
    user_platform: string,
    userFriendData: string[], 
    userSongLookup: Record<string, string>, 
    userToSongSubmittedPlatformLookup: Record<string, string>,
    numSongsPerPlaylist: number
) => {
    const playlist: string[][] = []; // [friend_id, song_id]
    
    for (const friend_id of userFriendData) {
        const friendSong = userSongLookup[friend_id];
        const friendSongSubmittedPlatform = userToSongSubmittedPlatformLookup[friend_id];

        if (!friendSong) continue;

        if (playlist.map(p => p[1]).includes(friendSong)) continue;

        if (playlist.length === numSongsPerPlaylist) break

        playlist.push([
            friend_id, 
            await matchFriendSongToUserPlatform(user_platform, friendSongSubmittedPlatform, friendSong)
        ]);
    }

    return playlist;
}

const createPlaylistOnPlatformForUser = async (user: UserSongData, playlistDate: string) => {
    const playlistNameAbbreviation = user.users.first_name.endsWith('s') ? "'s" : "'s";

  if (user.users.platform === "spotify") {
    return await createSpotifyPlaylistForUser(user, playlistNameAbbreviation, playlistDate);
  }
  else if (user.users.platform === "apple-music") {
    return await createAppleMusicPlaylistForUser(user, playlistNameAbbreviation);
  }

  return { ok: false, data: null, error: `invalid platform ${user.users.platform}` };
}

const createSpotifyPlaylistForUser = async (user: UserSongData, playlistNameAbbreviation: string, playlistDate: string) => {
    if (new Date(user.users.spotify_token_expires_at) < new Date()) {
        logger.log("spotify token expired, refreshing ...", { user });
        
        const {data: refreshAccessTokenData, error: refreshAccessTokenError} = await refreshAccessToken(user.users.spotify_refresh_token);
    
        if (refreshAccessTokenError) {
            logger.error("error refreshing spotify token", {user, refreshAccessTokenError });
            return { ok: false, data: null, error: refreshAccessTokenError };
        }
    
        if (!refreshAccessTokenData) {
            logger.error("no data returned from refreshAccessToken", {user, refreshAccessTokenData });
            return { ok: false, data: null, error: `no data returned from refreshAccessToken` };
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
    
      logger.log("creating spotify playlist for user", { user });
    
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
        return { ok: false, data: null, error: createPlaylistResponse.text };
      }
    
      const playlistData = await createPlaylistResponse.json();

      return { ok: true, data: playlistData, error: null };
}

const createAppleMusicPlaylistForUser = async (user: UserSongData, playlistNameAbbreviation: string) => {
  return { ok: true, data: null, error: null };
}

const populatePlatformPlaylist = async (user: UserSongData, songs: string[], playlist_id: string) => {
  if (user.users.platform === "spotify") {
    return await populateSpotifyPlaylist(user.users.spotify_access_token, songs, playlist_id);
  }
  else if (user.users.platform === "apple-music") {
    return await populateAppleMusicPlaylist(user.users.apple_music_access_token, songs);
  }

  return { ok: false, data: null, error: `invalid platform ${user.users.platform}` };
}

const populateSpotifyPlaylist = async (spotify_access_token: string, songs: string[], playlist_id: string) => {
    const addSongsToPlaylistResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${spotify_access_token}`,
        },
        body: JSON.stringify({
            uris: songs.map(song => `spotify:track:${song}`),
        })
      });

      if (!addSongsToPlaylistResponse.ok) {
        logger.error("error adding songs to spotify playlist", { songs, addSongsToPlaylistResponse });
        return { ok: false, error: addSongsToPlaylistResponse.text };
      }

      return { ok: true, error: null };
}

const populateAppleMusicPlaylist = async (apple_music_access_token: string, songs: string[]) => {
    return { ok: false, error: 'not implemented' };
}

const persistPlaylistsToDatabase = async (playlists: PlaylistRecords, playlistSongs: PlaylistSongRecords) => {
    if (playlists.length === 0 || playlistSongs.length === 0) {
        logger.log("no playlists or playlist songs to save to database, skipping");
        return { ok: true, error: null };
    }

    logger.log("saving playlists to database");
    const { data: playlistInsertData, error: playlistInsertError } = await supabase
      .from('playlists')
      .insert(playlists)
      .select('id, platform_playlist_id');

    if (playlistInsertError) {
      return { ok: false, error: playlistInsertError };
    }

    const playlistIdByPlatfomPlaylistId = new Map(
      playlistInsertData.map(r => [r.platform_playlist_id, r.id])
    );

    logger.log("saving playlists to database done", { numPlaylists: playlistIdByPlatfomPlaylistId.size });

    // save each playlist_song to database
    for (const playlistSong of playlistSongs) {
      playlistSong.playlist_id = playlistIdByPlatfomPlaylistId.get(playlistSong.platform_playlist_id);
    }

    logger.log("saving playlist songs to database");
    const { error: playlistSongInsertError } = await supabase
      .from('playlist_songs')
      .insert(playlistSongs.map(r => ({
        playlist_id: r.playlist_id,
        track_id: r.track_id,
        submitted_by_user_id: r.submitted_by_user_id,
      })));

    if (playlistSongInsertError) {
      return { ok: false, error: playlistSongInsertError };
    }
    logger.log("saving playlist songs to database done");
    
    return { ok: true, error: null };
}

const textUsersPlaylists = async (playlists: PlaylistRecords, userSongData: UserSongData[], usersThatEncounteredErrors: Set<string>) => {
    for (const playlist of playlists) {
        if (usersThatEncounteredErrors.has(playlist.user_id)) {
            logger.error("user encountered errors, skipping text", { playlist });
            continue;
        }
        
        const userPhoneNumber = userSongData.find(user => user.user_id === playlist.user_id)?.users.phone_number;
  
        if (!userPhoneNumber) {
          logger.error("phone number not found for user", { playlist, userSongData });
          continue;
        }

        let playlistLink = "";

        switch (playlist.platform) {
          case "spotify":
            playlistLink = `https://open.spotify.com/playlist/${playlist.platform_playlist_id}`;
            break;
          case "apple-music":
            playlistLink = `https://music.apple.com/playlist/${playlist.platform_playlist_id}`;
            break;
        }

        // const message = await client.messages.create({
        //   body: `
        //   ${playlistLink}
        //   `,
        //   from: fromNumber,
        //   to: userPhoneNumber,
        // });

        const message = ""
  
        logger.log("texted user their playlist", { playlist, message });
      }
}

const matchFriendSongToUserPlatform = async (userPlatform: string, songSubmittedPlatform: string, submittedSong: string) => {
  if (userPlatform === songSubmittedPlatform) {
    return submittedSong;
  }
  
  return convertSong(submittedSong, userPlatform);
}

// TODO: use SongLink API to convert song to target user platform
const convertSong = async (song: string, platform: string) => {
    throw new Error(`Not implemented: convertSong for ${platform}`);
}