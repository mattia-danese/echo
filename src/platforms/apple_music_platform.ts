import { Platform as PlatformEnum } from "@/db/types";
import type {
  CreatePlaylistResponse,
  createAndPopulatePlaylistRequest,
  GetTracksResponse,
  RecentTrackPlay,
  RefreshTokensRequest,
  RefreshTokensResponse,
  SearchResultTrack,
  SearchTracksRequest,
  SearchTracksResponse,
} from "@/types";
import { Platform } from "./platform";

export class AppleMusicPlatform extends Platform {
  // TODO: Implement refresh tokens (look at docs, access token expires yearly)
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

  static async createAndPopulatePlaylist(
    request: createAndPopulatePlaylistRequest,
  ): Promise<{
    ok: boolean;
    data: CreatePlaylistResponse | null;
    error: unknown;
  }> {
    try {
      const body = {
        attributes: {
          description: request.playlistDescription,
          name: request.playlistName,
          // isPublic: true,
        },
        relationships: {
          tracks: {
            data: request.songs.map((song) => ({
              id: song,
              type: "songs",
            })),
          },
        },
      };

      const response = await fetch(
        `https://api.music.apple.com/v1/me/library/playlists`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer `,
            "Music-User-Token": request.accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          data: null,
          error: `Failed to create AppleMusic playlist: ${errorText}`,
        };
      }

      const data = await response.json();
      const playlistId = data.data[0].id;

      return { ok: true, data: { playlistId }, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
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
    try {
      const params = new URLSearchParams({
        types: "songs",
        term: request.query,
        limit: "10",
      });

      const searchResponse = await fetch(
        `https://api.music.apple.com/v1/catalog/us/search?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer `,
            "Content-Type": "application/json",
          },
        },
      );

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        return {
          ok: false,
          data: null,
          error: `Failed to search Apple Music: ${errorText}`,
        };
      }

      const searchData = await searchResponse.json();

      // Format tracks to match SearchResultTrack interface
      const tracks: SearchResultTrack[] =
        searchData.results?.songs?.data?.map((track: any) => ({
          trackId: track.id,
          trackName: track.attributes.name,
          artists: track.attributes.artistName,
          albumImageUrl: track.attributes.artwork.url,
          trackPlatform: PlatformEnum.APPLE_MUSIC,
        })) || [];

      return { ok: true, data: { tracks }, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }

  static extractTrackId(url: string): string {
    const match = url.match(/i=(\w+)/);
    if (match) {
      return match[1];
    }
    throw new Error(`Could not extract Apple Music track ID from URL ${url}`);
  }

  static createPlaylistLink(platformPlaylistId: string) {
    return `https://music.apple.com/library/playlist/${platformPlaylistId}`;
  }

  static resolveAppleArtwork(urlTemplate: string, size: number) {
    return urlTemplate
      .replace("{w}", String(size))
      .replace("{h}", String(size));
  }
}
