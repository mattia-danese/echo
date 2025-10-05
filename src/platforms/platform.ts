import { 
    GetTokensRequest,
    GetTokensResponse,

    RefreshTokensRequest,
    RefreshTokensResponse,

    CreatePlaylistRequest,
    CreatePlaylistResponse,

    PopulatePlaylistRequest,

    GetTracksResponse,
    GetTracksRequest,

    SearchTracksRequest,
    SearchTracksResponse,

    GetUserIdRequest,
    GetUserIdResponse
} from "@/types";

// Define the static interface that all platform classes must implement
export interface PlatformStatic {
  getTokens(request: GetTokensRequest): Promise<{ ok: boolean, data: GetTokensResponse | null, error: unknown }>;
  refreshTokens(request: RefreshTokensRequest): Promise<{ ok: boolean, data: RefreshTokensResponse | null, error: unknown }>;
  createPlaylist(request: CreatePlaylistRequest): Promise<{ ok: boolean, data: CreatePlaylistResponse | null, error: unknown }>;
  populatePlaylist(request: PopulatePlaylistRequest): Promise<{ ok: boolean, error: unknown }>;
  getRecentTracks(request: GetTracksRequest): Promise<{ ok: boolean, data: GetTracksResponse | null, error: unknown }>;
  searchTracks(request: SearchTracksRequest): Promise<{ ok: boolean, data: SearchTracksResponse | null, error: unknown }>;
  getUserId(request: GetUserIdRequest): Promise<{ ok: boolean, data: GetUserIdResponse | null, error: unknown }>;
}

// Abstract class that enforces static method implementation through type constraints
export abstract class Platform<T extends PlatformStatic = PlatformStatic> {
  // This class exists purely to enforce the contract through TypeScript's type system
  // All actual implementations should be static methods in concrete classes
}

// Type guard function to ensure a class implements the PlatformStatic interface
export function isPlatformClass<T extends PlatformStatic>(cls: T): cls is T {
  return typeof cls.refreshTokens === 'function' &&
         typeof cls.createPlaylist === 'function' &&
         typeof cls.populatePlaylist === 'function' &&
         typeof cls.getRecentTracks === 'function' &&
         typeof cls.searchTracks === 'function' &&
         typeof cls.getUserId === 'function';
}

// Utility type for platform classes that implement the static interface
export type PlatformClass<T extends PlatformStatic = PlatformStatic> = new (...args: unknown[]) => Platform<T> & T;
