import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  appleDevToken,
  authSessions,
  echoSessions,
  friends,
  messages,
  playlistSongs,
  playlists,
  songLinkCacheMappings,
  songlinkCache,
  spotifyAuth,
  userAuth,
  userEchoSessions,
  userRankings,
  userRecommendedSongs,
  users,
  userTrackPlays,
} from "@/db/schema";
import {
  CONTACT_CARD_PLACEHOLDER,
  Gender,
  MessageType,
  Platform,
} from "@/db/types";

// ============================================================================
// RE-EXPORTS
// ============================================================================
export { CONTACT_CARD_PLACEHOLDER, Gender, MessageType, Platform };

// ============================================================================
// DATABASE TYPES (Inferred from Drizzle Schema)
// ============================================================================
export type User = InferSelectModel<typeof users>;
export type UserInsert = InferInsertModel<typeof users>;

export type UserAuth = InferSelectModel<typeof userAuth>;
export type UserAuthInsert = InferInsertModel<typeof userAuth>;

export type Friend = InferSelectModel<typeof friends>;
export type FriendInsert = InferInsertModel<typeof friends>;

export type UserTrackPlay = InferSelectModel<typeof userTrackPlays>;
export type UserTrackPlayInsert = InferInsertModel<typeof userTrackPlays>;

export type EchoSession = InferSelectModel<typeof echoSessions>;
export type EchoSessionInsert = InferInsertModel<typeof echoSessions>;

export type UserEchoSession = InferSelectModel<typeof userEchoSessions>;
export type UserEchoSessionInsert = InferInsertModel<typeof userEchoSessions>;

export type Playlist = InferSelectModel<typeof playlists>;
export type PlaylistInsert = InferInsertModel<typeof playlists>;

export type PlaylistSong = InferSelectModel<typeof playlistSongs>;
export type PlaylistSongInsert = InferInsertModel<typeof playlistSongs>;

export type Message = InferSelectModel<typeof messages>;
export type MessageInsert = InferInsertModel<typeof messages>;

export type AuthSession = InferSelectModel<typeof authSessions>;
export type AuthSessionInsert = InferInsertModel<typeof authSessions>;

export type AppleDevToken = InferSelectModel<typeof appleDevToken>;
export type AppleDevTokenInsert = InferInsertModel<typeof appleDevToken>;

export type SpotifyAuth = InferSelectModel<typeof spotifyAuth>;
export type SpotifyAuthInsert = InferInsertModel<typeof spotifyAuth>;

export type UserRecommendedSong = InferSelectModel<typeof userRecommendedSongs>;
export type UserRecommendedSongInsert = InferInsertModel<
  typeof userRecommendedSongs
>;

export type UserRanking = InferSelectModel<typeof userRankings>;
export type UserRankingInsert = InferInsertModel<typeof userRankings>;

export type SonglinkCache = InferSelectModel<typeof songlinkCache>;
export type SonglinkCacheInsert = InferInsertModel<typeof songlinkCache>;

export type SongLinkCacheMapping = InferSelectModel<
  typeof songLinkCacheMappings
>;
export type SongLinkCacheMappingInsert = InferInsertModel<
  typeof songLinkCacheMappings
>;

// ============================================================================
// PLATFORM API TYPES
// ============================================================================

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
  userId: string;
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
  tracks: UserTrackPlay[];
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
