"use server";

import { onboardingTask } from '@/trigger';
import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client with the service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createUser(payload: { 
  first_name: string; 
  last_name: string; 
  phone_number: string;
  spotify_code: string;
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
        created: false,
        message: 'User with this phone number already exists.'
      };
    }

    // User doesn't exist, make Spotify API call to get tokens
    const spotifyResponse = await fetch('https://accounts.spotify.com/api/token', {
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

    if (!spotifyResponse.ok) {
      const errorData = await spotifyResponse.text();
      console.error('Spotify API error:', errorData);
      throw new Error(`Spotify API error: ${spotifyResponse.status}`);
    }

    const spotifyData = await spotifyResponse.json();
    
    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + spotifyData.expires_in * 1000);

    // Create new user with Spotify tokens
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone_number: payload.phone_number,
        spotify_access_token: spotifyData.access_token,
        spotify_refresh_token: spotifyData.refresh_token,
        spotify_token_expires_at: expiresAt
      })
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    return {
      ok: true,
      user_id: newUser.id,
      created: true,
      message: 'User created successfully with Spotify tokens.'
    };

  } catch (error: unknown) {
    console.error('Error in createUser:', error);
    return {
      ok: false,
      user_id: null,
      created: false,
      message: 'An error occurred while creating the user.'
    };
  }
}

export async function sendOnboardingMessage(payload: { 
    phone_number: string;
  }) {
    await onboardingTask.trigger({ phone_number: payload.phone_number });
    return {
      ok: true,
      message: `onboarding message sent to ${payload.phone_number}`,
    };
  }