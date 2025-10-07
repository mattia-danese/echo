// Get Tokens
export interface GetTokensRequest {
  code: string;
}

export interface GetTokensResponse {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

// Refresh Tokens
export interface RefreshTokensRequest {
  user_id: string;
  refresh_token: string;
}

export interface RefreshTokensResponse {
  access_token: string;
  refresh_token: string;
  expires_in: string;
}

// Create Playlist
export interface CreatePlaylistRequest {
  user_id: string;
  access_token: string;
  playlist_name: string;
  playlist_description: string;
  playlist_date: string;
}

export interface CreatePlaylistResponse {
  playlist_id: string;
}

// Populate Playlist
export interface PopulatePlaylistRequest {
  access_token: string;
  playlist_id: string;
  trackURIs: string[];
}

// export interface PopulatePlaylistResponse {}

// Get Tracks
export interface GetTracksRequest {
  user_id: string;
  access_token: string;
  platform: string;
}

export interface GetTracksResponse {
  tracks: RecentTrackPlay[];
}

export interface RecentTrackPlay {
  user_id: string;
  platform: string;
  track_id: string;
  track_name: string;
  artists: string;
  played_at: string;
  album_image_url: string;
}

// Search Tracks
export interface SearchTracksRequest {
  query: string;
}

export interface SearchTracksResponse {
  tracks: SearchResultTrack[];
}

export interface SearchResultTrack {
  track_id: string;
  track_name: string;
  artists: string;
  album_image_url: string;
}

// Get User ID
export interface GetUserIdRequest {
  access_token: string;
}

export interface GetUserIdResponse {
  spotify_user_id: string;
}

// Get Recent Plays
export interface User {
  id: string;
  platform: string;
  spotify_access_token: string | null;
  spotify_refresh_token: string | null;
  spotify_token_expires_at: string | null;
  apple_music_access_token: string | null;
  apple_music_refresh_token: string | null;
  apple_music_token_expires_at: string | null;
}
