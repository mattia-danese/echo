import { Platform as PlatformEnum } from "@/db/types";
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
    userId: number,
    accessToken: string,
  ): Promise<{ ok: boolean; data: GetTracksResponse | null; error: unknown }> {
    try {
      // Get recent Apple Music tracks

      const params = new URLSearchParams({
        types: "songs",
      });
      const response = await fetch(
        `https://api.music.apple.com/v1/me/recent/played/tracks?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer `,
            "Music-User-Token": `${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, data: null, error: errorText };
      }

      const data = await response.json();
      const now = new Date();

      const tracks: RecentTrackPlay[] = data.data.map((track: any) => ({
        userId: userId,
        platform: PlatformEnum.APPLE_MUSIC,
        trackId: track.id,
        trackName: track.attributes.name,
        // artists: track.artists.map((artist: any) => artist.name).join(", "),
        artists: track.attributes.artistName,
        albumImageUrl: track.attributes.artwork.url,
        playedAt: now.toISOString(),
      }));
      return { ok: true, data: { tracks }, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
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

  static getSongLink(trackId: string): string {
    return `https://api.apple.com/v1/tracks/${trackId}`;
  }

  static extractTrackId(url: string): string {
    const match = url.match(/i=(\w+)/);
    if (match) {
      return match[1];
    }
    throw new Error(`Could not extract Apple Music track ID from URL ${url}`);
  }

  static createPlaylistLink(platformPlaylistId: string) {
    return `https://music.apple.com/playlist/${platformPlaylistId}`;
  }
}
