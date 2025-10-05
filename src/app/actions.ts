"use server";

import { getRecentPlaysTask, onboardingCompletionTask, onboardingTask } from '@/trigger';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { isNameValid, isPhoneNumberValid } from "@/lib/validation";
import { SpotifyPlatform } from '@/platforms';

// Initialize the Supabase client with the service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function checkRegistrationData(payload: {
    first_name: string, 
    last_name: string, 
    phone_number: string
}) {
    if (!isPhoneNumberValid(payload.phone_number) || !payload.phone_number.trim()) {
        return { ok: false, message: "phone number" };
    }

    if (!isNameValid(payload.first_name) || !payload.first_name.trim()) {
        return { ok: false, message: "first name" };
    }

    if (!isNameValid(payload.last_name) || !payload.last_name.trim()) {
        return { ok: false, message: "last name" };
    }

    return { ok: true, message: "User is valid" };
} 

export async function createUser(payload: { 
  first_name: string; 
  last_name: string; 
  phone_number: string;
  spotify_code: string;
  platform: string;
  referral_friend_link_token: string | null;
}) {
  try {    
    // First, check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', payload.phone_number)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // Handle unexpected errors (PGRST116 is "no rows returned" which is expected for new users)
      throw fetchError;
    }

    if (existingUser) {
      // User already exists, return early
      return {
        ok: true,
        user_id: existingUser.id,
        onboarding_token: null,
        created: false,
        message: 'User with this phone number already exists.'
      };
    }

    // User doesn't exist, make Spotify API call to get tokens
    const { ok: platformAuthOk, data: platformAuthData, error: platformAuthError } = await getPlatformAuth({ platform: payload.platform, code: payload.spotify_code });

    if (!platformAuthOk) {
      return {
        ok: false,
        user_id: null,
        onboarding_token: null,
        created: false,
        message: platformAuthError
      };
    }

    if (!platformAuthData) {
      return {
        ok: false,
        user_id: null,
        onboarding_token: null,
        created: false,
        message: 'No data returned from platform auth'
      };
    }

    const { access_token, refresh_token, expires_at, platform_user_id } = platformAuthData;

    const userAuth = {
        spotify_user_id: payload.platform === "spotify" ? platform_user_id : null,
        spotify_access_token: payload.platform === "spotify" ? access_token : null,
        spotify_refresh_token: payload.platform === "spotify" ? refresh_token : null,
        spotify_token_expires_at: payload.platform === "spotify" ? expires_at : null,
        
        apple_music_user_id: payload.platform === "apple-music" ? platform_user_id : null,
        apple_music_access_token: payload.platform === "apple-music" ? access_token : null,
        apple_music_refresh_token: payload.platform === "apple-music" ? refresh_token : null,
        apple_music_token_expires_at: payload.platform === "apple-music" ? expires_at : null,
    }

    // Generate friend link
    const friend_link_token = crypto.randomBytes(16).toString("base64url");

    // Generate onboarding token
    const onboarding_token = crypto.randomBytes(16).toString("base64url");

    // Create new user with Spotify tokens
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone_number: payload.phone_number,
        friend_link_token: friend_link_token,
        onboarding_token: onboarding_token,
        is_onboarding_complete: false,
        platform: payload.platform,

        ...userAuth,
      })
      .select('id,onboarding_token')
      .single();

    if (insertError) {
      throw insertError;
    }

    if (payload.referral_friend_link_token) {
      const { ok, message } = await createFriendships({ 
        user_id: newUser.id, 
        referral_friend_link_token: payload.referral_friend_link_token 
      });

      if (!ok) {
        console.error('Error creating friendship:', message);
      }
    }

    // async task to get recent plays of new user
    await getRecentPlaysTask.trigger({
        user: {
            id: newUser.id,
            platform: payload.platform,
            ...(({ spotify_user_id, apple_music_user_id, ...rest }) => rest)(userAuth),
        }
    });

    return {
      ok: true,
      user_id: newUser.id,
      onboarding_token: newUser.onboarding_token,
      created: true,
      message: 'User created successfully with Spotify tokens.'
    };

  } catch (error: unknown) {
    console.error('Error in createUser:', error);
    return {
      ok: false,
      user_id: null,
      onboarding_token: null,
      created: false,
      message: 'An error occurred while creating the user.'
    };
  }
}

async function getPlatformAuth(payload: {
  platform: string;
  code: string;
}){
  try {
    if (payload.platform === "spotify") {
      const { ok: getTokensOk, data: getTokensData, error: getTokensError } = await SpotifyPlatform.getTokens({ code: payload.code });
      
      if (!getTokensOk) {
        return { ok: false, data: null, error: getTokensError };
      }

      if (!getTokensData) {
        return { ok: false, data: null, error: 'No data returned from Spotify getTokens' };
      }
      
      const { access_token, refresh_token, expires_at } = getTokensData;

      const { ok: getUserIdOk, data: getUserIdData, error: getUserIdError } = await SpotifyPlatform.getUserId({ 
        access_token: access_token 
      });

      if (!getUserIdOk) {
        return { ok: false, data: null, error: getUserIdError };
      }

      if (!getUserIdData) {
        return { ok: false, data: null, error: 'No data returned from Spotify getUserId' };
      }

      const data = {
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: expires_at,
        platform_user_id: getUserIdData.spotify_user_id
      }
    
        return { ok: true, data: data, error: null };
    }
    
    // TODO: implement apple music auth
    if (payload.platform === "apple-music") {
      return { ok: false, data: null, error: 'Apple Music auth not implemented yet' };
    }
    
    return { ok: false, data: null, error: 'Invalid platform' };
  } catch(error: unknown){
    console.error('Error in getPlatformAuth:', error);
    return { ok: false, data: null, error: 'An error occurred while getting platform auth' };
  }
}

export async function createFriendships(payload: { 
  user_id: string;
  referral_friend_link_token: string;
}) {
    const { data: friend, error: friendError } = await supabase
    .from('users')
    .select('id')
    .eq('friend_link_token', payload.referral_friend_link_token)
    .single();

  if (friendError) {
    console.error('Error finding friend based on referral token:', friendError);
    return { ok: false, message: 'Error finding friend based on referral token' };
  }

  if (!friend) {
    console.error('Friend not found based on referral token:', payload);
    return { ok: false, message: 'Friend not found based on referral token' };
  }

  if (friend.id === payload.user_id) {
    console.error('Friend is the same as the user:', payload);
    return { ok: false, message: 'Friend is the same as the user' };
  }

  // Create friendship relationship (bidirectional)
  const now = new Date().toISOString();

   const { error: friendshipError } = await supabase
   .from('friends')
   .upsert([
     {
       user_id: payload.user_id,
       friend_id: friend.id,
       updated_at: now
     },
     {
       user_id: friend.id,
       friend_id: payload.user_id,
       updated_at: now
     }
   ]);

  if (friendshipError) {
    console.error('Error creating friendship:', friendshipError);
    return { ok: false, message: 'Error creating friendship' };
  }

  return { ok: true, message: 'Friendship created successfully' };
}

export async function sendOnboardingMessage(payload: { 
    phone_number: string;
    onboarding_token: string;
  }) {
    console.log('Triggering onboarding task... ', payload.phone_number);
    await onboardingTask.trigger({ phone_number: payload.phone_number, onboarding_token: payload.onboarding_token });
    return {
      ok: true,
      message: `onboarding message sent to ${payload.phone_number}`,
    };
  }

export async function searchPlatformTracks(platform: string, query: string) {
  "use server";
  
  try {
    // Validate input
    if (!query || query.trim().length < 2) {
      return {
        ok: false,
        tracks: [],
        message: 'Query must be at least 2 characters long'
      };
    }

    if (platform === "spotify") {
      const { ok, data, error } = await SpotifyPlatform.searchTracks({ query: query });
      if (!ok) {
        return { ok: false, tracks: [], message: error };
      }
      return { ok: true, tracks: data?.tracks || [], message: error };
    }
    else if (platform === "apple-music") {
      const { ok, data, error } = await handleAppleMusicSearch(query);
      if (!ok) {
        return { ok: false, tracks: [], message: error };
      }
      
      return { ok: true, tracks: [], message: error };
    }
    
    return {
        ok: false,
        tracks: [],
        message: 'Invalid platform'
    };
    

  } catch (error: unknown) {
    console.error('Error in searchPlatformTracks:', error);
    return {
      ok: false,
      tracks: [],
      message: 'An error occurred while searching'
    };
  }
}

async function handleAppleMusicSearch(query: string) {
    return { ok: false, data: null, error: 'Apple Music search not implemented yet' };
}

export async function getUserTopSongs(payload: {
    user_id: string;
    num_songs: number;
}){
    const FOUR_DAYS_IN_MS = 4 * 24 * 60 * 60 * 1000;
    
    const { data: topSongs, error: topSongsError } = await supabase
    .from('user_track_plays')
    .select('track_id.count(), track_id,track_name, artists, album_image_url')
    .eq('user_id', payload.user_id)
    .gte('played_at', new Date(Date.now() - FOUR_DAYS_IN_MS).toISOString())
    .order('count', { ascending: false })
    .limit(payload.num_songs);

  if (topSongsError) {
    console.error('Error getting user top songs:', topSongsError, payload);
    return { ok: false, songs: [], message: 'Error getting user top songs' };
  }

  return { ok: true, songs: topSongs, message: 'User top songs fetched successfully' };
}

export async function submitSong(payload: {
    token: string;
    track_id: string;
}){
    const { error: userEchoSessionError } = await supabase
    .from('user_echo_sessions')
    .update({
        track_id: payload.track_id,
        updated_at: new Date().toISOString()
    })
    .eq('token', payload.token)

  if (userEchoSessionError) {
    console.error('Error submitting song:', userEchoSessionError, payload);
    return { ok: false, message: 'Error submitting song' };
  }

  return { ok: true, message: 'Song submitted successfully' };
}

export async function completeOnboarding(payload: {
    onboarding_token: string;
}) {
    const { data: user, error } = await supabase
    .from('users')
    .update({
        is_onboarding_complete: true
    })
    .eq('onboarding_token', payload.onboarding_token)
    .select('*')
    .single();

  if (error) {
    console.error('Error completing onboarding:', error, payload);
    return { ok: false, message: 'Error completing onboarding' };
  }

  if (!user) {
    console.error('User not found:', payload);
    return { ok: false, message: 'User not found' };
  }

  await onboardingCompletionTask.trigger({ user });

  return { ok: true, message: 'Onboarding completed successfully' };
}