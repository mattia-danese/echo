import {
  type CreatePlaylistRequest,
  type CreatePlaylistResponse,
  type GetTokensRequest,
  type GetTokensResponse,
  type GetTracksRequest,
  type GetTracksResponse,
  type GetUserIdRequest,
  type GetUserIdResponse,
  type PopulatePlaylistRequest,
  RecentTrackPlay,
  type RefreshTokensRequest,
  type RefreshTokensResponse,
  SearchResultTrack,
  type SearchTracksRequest,
  type SearchTracksResponse,
} from "@/types";
import { Platform } from "./platform";
export class AppleMusicPlatform extends Platform {
  static async getTokens(
    request: GetTokensRequest,
  ): Promise<{ ok: boolean; data: GetTokensResponse | null; error: unknown }> {
    return {
      ok: false,
      data: null,
      error: "apple music auth not implemented yet",
    };
  }

  static async refreshTokens(request: RefreshTokensRequest): Promise<{
    ok: boolean;
    data: RefreshTokensResponse | null;
    error: unknown;
  }> {
    return {
      ok: false,
      data: null,
      error: "apple music auth not implemented yet",
    };
  }

  static async createPlaylist(request: CreatePlaylistRequest): Promise<{
    ok: boolean;
    data: CreatePlaylistResponse | null;
    error: unknown;
  }> {
    return {
      ok: false,
      data: null,
      error: "apple music auth not implemented yet",
    };
  }

  static async populatePlaylist(
    request: PopulatePlaylistRequest,
  ): Promise<{ ok: boolean; error: unknown }> {
    return { ok: false, error: "apple music auth not implemented yet" };
  }

  static async getRecentTracks(
    request: GetTracksRequest,
  ): Promise<{ ok: boolean; data: GetTracksResponse | null; error: unknown }> {
    return {
      ok: false,
      data: null,
      error: "apple music auth not implemented yet",
    };
  }

  static async searchTracks(request: SearchTracksRequest): Promise<{
    ok: boolean;
    data: SearchTracksResponse | null;
    error: unknown;
  }> {
    return {
      ok: false,
      data: null,
      error: "apple music auth not implemented yet",
    };
  }

  static async getUserId(
    request: GetUserIdRequest,
  ): Promise<{ ok: boolean; data: GetUserIdResponse | null; error: unknown }> {
    return {
      ok: false,
      data: null,
      error: "apple music auth not implemented yet",
    };
  }
}
