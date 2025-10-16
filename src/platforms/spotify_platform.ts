import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userAuth } from "@/db/schema";
import { spotifyAdmin } from "@/lib/spotifyAdmin";
import { Platform } from "@/platforms/platform";
import type {
  CreatePlaylistRequest,
  CreatePlaylistResponse,
  GetTokensRequest,
  GetTokensResponse,
  GetTracksRequest,
  GetTracksResponse,
  GetUserIdRequest,
  GetUserIdResponse,
  PopulatePlaylistRequest,
  RecentTrackPlay,
  RefreshTokensRequest,
  RefreshTokensResponse,
  SearchResultTrack,
  SearchTracksRequest,
  SearchTracksResponse,
} from "@/types";

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
};

type SpotifySearchResultTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
};

export class SpotifyPlatform extends Platform {
  static async getTokens(
    request: GetTokensRequest,
  ): Promise<{ ok: boolean; data: GetTokensResponse | null; error: unknown }> {
    try {
      const spotifyTokenResponse = await fetch(
        "https://accounts.spotify.com/api/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${spotifyAdmin.clientId}:${spotifyAdmin.clientSecret}`,
            ).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: request.code,
            redirect_uri: spotifyAdmin.redirectUri,
          }),
        },
      );

      if (!spotifyTokenResponse.ok) {
        const errorData = await spotifyTokenResponse.text();
        console.error("Spotify API error:", errorData);
        throw new Error(`Spotify API error: ${spotifyTokenResponse.status}`);
      }

      const spotifyData = await spotifyTokenResponse.json();

      // Calculate expiration timestamp
      const expiresAt = new Date(
        Date.now() + spotifyData.expires_in * 1000,
      ).toISOString();

      const data = {
        accessToken: spotifyData.access_token,
        refreshToken: spotifyData.refresh_token,
        expiresAt: expiresAt,
      } as GetTokensResponse;

      return { ok: true, data: data, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }

  static async refreshTokens(request: RefreshTokensRequest): Promise<{
    ok: boolean;
    data: RefreshTokensResponse | null;
    error: unknown;
  }> {
    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${spotifyAdmin.clientId}:${spotifyAdmin.clientSecret}`,
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: request.refreshToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        return {
          ok: false,
          data: null,
          error: `HTTP ${response.status}: ${errorData}`,
        };
      }

      const responseData = await response.json();
      const spotifyTokenExpiresAt = new Date(
        Date.now() + responseData.expiresIn * 1000,
      ).toISOString();

      await db
        .update(userAuth)
        .set({
          accessToken: responseData.accessToken,
          refreshToken: responseData.refreshToken ?? request.refreshToken,
          tokenExpiresAt: spotifyTokenExpiresAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userAuth.userId, request.userId));

      const data = {
        accessToken: responseData.accessToken,
        refreshToken: responseData.refreshToken ?? request.refreshToken,
        expiresIn: spotifyTokenExpiresAt,
      } as RefreshTokensResponse;

      return { ok: true, data: data, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }

  static async createPlaylist(request: CreatePlaylistRequest): Promise<{
    ok: boolean;
    data: CreatePlaylistResponse | null;
    error: unknown;
  }> {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/users/${request.userId}/playlists`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${request.accessToken}`,
          },
          body: JSON.stringify({
            name: request.playlistName,
            description: request.playlistDescription,
            public: false,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, data: null, error: errorText };
      }

      const playlistData = await response.json();
      return { ok: true, data: { playlistId: playlistData.id }, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }

  static async populatePlaylist(
    request: PopulatePlaylistRequest,
  ): Promise<{ ok: boolean; error: unknown }> {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${request.playlistId}/tracks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${request.accessToken}`,
          },
          body: JSON.stringify({
            uris: request.trackURIs,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText };
      }

      return { ok: true, error: null };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  static async getRecentTracks(
    request: GetTracksRequest,
  ): Promise<{ ok: boolean; data: GetTracksResponse | null; error: unknown }> {
    try {
      // Get recent Spotify tracks
      const response = await fetch(
        "https://api.spotify.com/v1/me/player/recently-played?limit=50",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${request.accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          data: null,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();

      // Transform data to match GetTracksResponse
      const tracks: RecentTrackPlay[] = (data.items || []).map(
        (play: SpotifyRecentTrackPlay) => ({
          userId: request.userId,
          platform: "spotify",
          trackId: play.track.id,
          trackName: play.track.name,
          artists: play.track.artists.map((artist) => artist.name).join(", "),
          playedAt: play.played_at,
          albumImageUrl: play.track.album.images[0]?.url || "",
        }),
      );

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
      // gets ECHO access token
      const authResponse = await fetch(
        "https://accounts.spotify.com/api/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${spotifyAdmin.clientId}:${spotifyAdmin.clientSecret}`,
            ).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
          }),
        },
      );

      if (!authResponse.ok) {
        console.error("Spotify auth error:", authResponse.status);
        return {
          ok: false,
          data: null,
          error: "Failed to authenticate with Spotify",
        };
      }

      const authData = await authResponse.json();

      // Search using app token
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(request.query)}&type=track&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${authData.accessToken}`,
          },
        },
      );

      if (!searchResponse.ok) {
        console.error("Spotify search error:", searchResponse.status);
        return {
          ok: false,
          data: null,
          error: "Failed to search Spotify",
        };
      }

      const searchData = await searchResponse.json();

      // Format tracks to match SearchResultTrack interface
      const tracks: SearchResultTrack[] =
        searchData.tracks?.items?.map((track: SpotifySearchResultTrack) => ({
          trackId: track.id,
          trackName: track.name,
          artists: track.artists.map((artist) => artist.name).join(", "),
          albumImageUrl: track.album?.images?.[0]?.url || "",
        })) || [];

      return { ok: true, data: { tracks }, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }

  static async getUserId(
    request: GetUserIdRequest,
  ): Promise<{ ok: boolean; data: GetUserIdResponse | null; error: unknown }> {
    try {
      // Get Spotify user ID from /me endpoint
      const response = await fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${request.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Spotify user profile error:", errorData);
        throw new Error(errorData);
      }

      const spotifyUserProfile = await response.json();
      const data = {
        spotifyUserId: spotifyUserProfile.id,
      } as GetUserIdResponse;

      return { ok: true, data: data, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }
}
