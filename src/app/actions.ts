"use server";

import { onboardingTask } from '@/trigger';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { isNameValid, isPhoneNumberValid } from "@/lib/validation";

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
    const spotifyTokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: payload.spotify_code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!
      })
    });

    if (!spotifyTokenResponse.ok) {
      const errorData = await spotifyTokenResponse.text();
      console.error('Spotify API error:', errorData);
      throw new Error(`Spotify API error: ${spotifyTokenResponse.status}`);
    }

    const spotifyData = await spotifyTokenResponse.json();
    
    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + spotifyData.expires_in * 1000).toISOString();

    // Generate friend link
    const friend_link_token = crypto.randomBytes(16).toString("base64url");

    // Generate onboarding token
    const onboarding_token = crypto.randomBytes(16).toString("base64url");

    // Get Spotify user ID from /me endpoint
    const spotifyUserProfileResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${spotifyData.access_token}`
        }
      });
  
      if (!spotifyUserProfileResponse.ok) {
        const errorData = await spotifyUserProfileResponse.text();
        console.error('Spotify user profile error:', errorData);
        throw new Error(`Spotify user profile error: ${spotifyUserProfileResponse.status}`);
      }
  
      const spotifyUserProfile = await spotifyUserProfileResponse.json()

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
        spotify_user_id: spotifyUserProfile.id,
        spotify_access_token: spotifyData.access_token,
        spotify_refresh_token: spotifyData.refresh_token,
        spotify_token_expires_at: expiresAt,
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

export async function searchSpotifyTracks(query: string) {
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

    // Get app-level access token using client credentials

    // TODO: store access token somewhere and auto refresh it
    const authResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials'
      })
    });

    if (!authResponse.ok) {
      console.error('Spotify auth error:', authResponse.status);
      return {
        ok: false,
        tracks: [],
        message: 'Failed to authenticate with Spotify'
      };
    }

    const authData = await authResponse.json();
    
    // Search using app token
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${authData.access_token}`
        }
      }
    );

    if (!searchResponse.ok) {
      console.error('Spotify search error:', searchResponse.status);
      return {
        ok: false,
        tracks: [],
        message: 'Failed to search Spotify'
      };
    }

    const searchData = await searchResponse.json();
    
    // Format tracks for frontend
    const tracks = searchData.tracks?.items?.map((track: SpotifyApi.TrackObjectFull) => ({
      trackId: track.id,
      title: track.name,
      artists: track.artists.map((artist: SpotifyApi.ArtistObjectSimplified) => artist.name).join(', '),
      albumImageUrl: track.album?.images?.[0]?.url || '',
    })) || [];

    return {
      ok: true,
      tracks,
      message: 'Search completed successfully'
    };

  } catch (error: unknown) {
    console.error('Error in searchSpotifyTracks:', error);
    return {
      ok: false,
      tracks: [],
      message: 'An error occurred while searching'
    };
  }
}

export async function getUserTopSongs(payload: {
    user_id: string;
}){
    const FOUR_DAYS_IN_MS = 4 * 24 * 60 * 60 * 1000;
    
    const { data: topSongs, error: topSongsError } = await supabase
    .from('user_track_plays')
    .select('spotify_track_id.count(), spotify_track_id,track_name, artist_name, album_image_url')
    .eq('user_id', payload.user_id)
    .gte('played_at', new Date(Date.now() - FOUR_DAYS_IN_MS).toISOString())
    .order('count', { ascending: false })
    .limit(4);

  if (topSongsError) {
    console.error('Error getting user top songs:', topSongsError, payload);
    return { ok: false, songs: [], message: 'Error getting user top songs' };
  }

  return { ok: true, songs: topSongs, message: 'User top songs fetched successfully' };
}

export async function submitSong(payload: {
    token: string;
    spotify_track_id: string;
}){
    const { error: userEchoSessionError } = await supabase
    .from('user_echo_sessions')
    .update({
        spotify_track_id: payload.spotify_track_id,
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
    const { error } = await supabase
    .from('users')
    .update({
        is_onboarding_complete: true
    })
    .eq('onboarding_token', payload.onboarding_token)

  if (error) {
    console.error('Error completing onboarding:', error, payload);
    return { ok: false, message: 'Error completing onboarding' };
  }

  return { ok: true, message: 'Onboarding completed successfully' };
}