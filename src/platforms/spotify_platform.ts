import { Platform } from "@/platforms/platform";
import { 
    CreatePlaylistRequest, 
    CreatePlaylistResponse,
    PopulatePlaylistRequest,
    RefreshTokensRequest, 
    RefreshTokensResponse,
    GetTracksRequest,
    GetTracksResponse,
    RecentTrackPlay,
    SearchTracksResponse,
    SearchTracksRequest,
    SearchResultTrack,
    GetUserIdRequest,
    GetUserIdResponse,
    GetTokensRequest,
    GetTokensResponse
} from "@/types";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,    
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type SpotifyRecentTrackPlay = {
    track: {
        id: string;
        name: string;
        artists: {
            name: string;
        }[];
        album: {
            images: { url: string }[];
        };
    };
    played_at: string;
}

type SpotifySearchResultTrack = {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { images: { url: string }[] };
}

export class SpotifyPlatform extends Platform {
    
    static async getTokens(request: GetTokensRequest): Promise<{ ok: boolean, data: GetTokensResponse | null, error: unknown }> {
        try {
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
                  code: request.code,
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

            const data = {
                access_token: spotifyData.access_token,
                refresh_token: spotifyData.refresh_token,
                expires_at: expiresAt
            } as GetTokensResponse;

            return { ok: true, data: data, error: null }; 
        } catch (err) {
            return { ok: false, data: null, error: err };
        }
    }

    static async refreshTokens(request: RefreshTokensRequest): Promise<{ ok: boolean, data: RefreshTokensResponse | null, error: unknown }> {
        try {
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
                    refresh_token: request.refresh_token
                })
            });
            
            if (!response.ok) {
                const errorData = await response.text();
                return { ok: false, data: null, error: `HTTP ${response.status}: ${errorData}` };
            }
            
            const responseData = await response.json();
            const spotify_token_expires_at = new Date(Date.now() + responseData.expires_in * 1000).toISOString();
            
            await supabase
                .from('users')
                .update({ 
                    spotify_access_token: responseData.access_token, 
                    spotify_refresh_token: responseData.refresh_token ?? request.refresh_token,
                    spotify_token_expires_at: spotify_token_expires_at 
                })
                .eq('id', request.user_id);

            const data = {
                access_token: responseData.access_token,
                refresh_token: responseData.refresh_token ?? request.refresh_token,
                expires_in: spotify_token_expires_at
            } as RefreshTokensResponse;
            
            return { ok: true, data: data, error: null };
        } catch (err) {
            return { ok: false, data: null, error: err };
        }
    }

    static async createPlaylist(request: CreatePlaylistRequest): Promise<{ ok: boolean, data: CreatePlaylistResponse | null, error: unknown }> {
        try {
            const response = await fetch(`https://api.spotify.com/v1/users/${request.user_id}/playlists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${request.access_token}`,
                },
                body: JSON.stringify({
                    name: request.playlist_name,
                    description: request.playlist_description,
                    public: false,
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                return { ok: false, data: null, error: errorText };
            }

            const playlistData = await response.json();
            return { ok: true, data: { playlist_id: playlistData.id }, error: null };
        } catch (err) {
            return { ok: false, data: null, error: err };
        }
    }

    static async populatePlaylist(request: PopulatePlaylistRequest): Promise<{ ok: boolean, error: unknown }> {
        try {
            const response = await fetch(`https://api.spotify.com/v1/playlists/${request.playlist_id}/tracks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${request.access_token}`,
                },
                body: JSON.stringify({
                    uris: request.trackURIs,
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                return { ok: false, error: errorText };
            }

            return { ok: true, error: null };
        } catch (err) {
            return { ok: false, error: err };
        }
    }

    static async getRecentTracks(request: GetTracksRequest): Promise<{ ok: boolean, data: GetTracksResponse | null, error: unknown }> {
        try {
            // Get recent Spotify tracks
            const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${request.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                return { ok: false, data: null, error: `HTTP ${response.status}: ${errorText}` };
            }

            const data = await response.json();

            // Transform data to match GetTracksResponse
            const tracks: RecentTrackPlay[] = (data.items || []).map((play: SpotifyRecentTrackPlay) => ({
                user_id: request.user_id,
                platform: "spotify",
                track_id: play.track.id,
                track_name: play.track.name,
                artists: play.track.artists.map((artist) => artist.name).join(', '),
                played_at: play.played_at,
                album_image_url: play.track.album.images[0]?.url || "",
            }));

            return { ok: true, data: { tracks }, error: null };
        } catch (err) {
            return { ok: false, data: null, error: err };
        }
    }

    static async searchTracks(request: SearchTracksRequest): Promise<{ ok: boolean, data: SearchTracksResponse | null, error: unknown }> {
        try {
            // gets ECHO access token
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
                    data: null,
                    error: 'Failed to authenticate with Spotify'
                };
            }
        
            const authData = await authResponse.json();
            
            // Search using app token
            const searchResponse = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(request.query)}&type=track&limit=10`,
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
                    data: null,
                    error: 'Failed to search Spotify'
                };
            }
        
            const searchData = await searchResponse.json();
            
            // Format tracks to match SearchResultTrack interface
            const tracks: SearchResultTrack[] = searchData.tracks?.items?.map((track: SpotifySearchResultTrack) => ({
                track_id: track.id,
                track_name: track.name,
                artists: track.artists.map((artist) => artist.name).join(', '),
                album_image_url: track.album?.images?.[0]?.url || '',
            })) || [];
        
            return { ok: true, data: { tracks }, error: null };
        } catch (err) {
            return { ok: false, data: null, error: err };
        }
    }

    static async getUserId(request: GetUserIdRequest): Promise<{ ok: boolean, data: GetUserIdResponse | null, error: unknown }> {
        try {
            // Get Spotify user ID from /me endpoint
            const response = await fetch('https://api.spotify.com/v1/me', {
                headers: {
                'Authorization': `Bearer ${request.access_token}`
                }
            });
      
          if (!response.ok) {
            const errorData = await response.text();
            console.error('Spotify user profile error:', errorData);
            throw new Error(errorData);
          }
      
          const spotifyUserProfile = await response.json()
          const data = {
            spotify_user_id: spotifyUserProfile.id
          } as GetUserIdResponse;

          return { ok: true, data: data, error: null };
        } catch (err) {
            return { ok: false, data: null, error: err };
        }
    }
}
