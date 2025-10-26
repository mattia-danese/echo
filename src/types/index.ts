import type { Platform } from "@/db/types";
// Get Tokens
export interface GetTokensRequest {
  code: string;
}

export interface GetTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// Refresh Tokens
export interface RefreshTokensRequest {
  userId: number;
  refreshToken: string;
}

export interface RefreshTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

// Create Playlist
export interface CreatePlaylistRequest {
  userId: string;
  accessToken: string;
  playlistName: string;
  playlistDescription: string;
  playlistDate: string;
}

export interface CreatePlaylistResponse {
  playlistId: string;
}

// Populate Playlist
export interface PopulatePlaylistRequest {
  accessToken: string;
  playlistId: string;
  trackURIs: string[];
}

export interface createAndPopulatePlaylistRequest {
  accessToken: string;
  playlistName: string;
  playlistDescription: string;
  playlistDate: string;
  songs: string[];
}

// Get Tracks
export interface GetTracksRequest {
  userId: number;
  accessToken: string;
  platform: Platform;
}

export interface GetTracksResponse {
  tracks: RecentTrackPlay[];
}

export interface RecentTrackPlay {
  userId: number;
  platform: Platform;
  trackId: string;
  trackName: string;
  artists: string;
  playedAt: string;
  albumImageUrl: string;
}

// Search Tracks
export interface SearchTracksRequest {
  query: string;
}

export interface SearchTracksResponse {
  tracks: SearchResultTrack[];
}

export interface SearchResultTrack {
  trackId: string;
  trackName: string;
  artists: string;
  albumImageUrl: string;
  trackPlatform: Platform;
}

// Get User ID
export interface GetUserIdRequest {
  accessToken: string;
}

export interface GetUserIdResponse {
  spotifyUserId: string;
}

// Get Recent Plays
export interface User {
  userId: number;
  platform: Platform;
  platformUserId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
}
