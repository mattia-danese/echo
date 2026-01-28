import { eq } from "drizzle-orm";
import { db } from "@/db";
import { spotifyAuth } from "@/db/schema";
import { Platform as PlatformEnum } from "@/db/types";
import { spotifyAdmin } from "@/lib/spotifyAdmin";
import { Platform } from "@/platforms/platform";
import type {
  CreatePlaylistRequest,
  GetTokensRequest,
  GetTokensResponse,
  GetTracksRequest,
  GetTracksResponse,
  GetUserIdRequest,
  GetUserIdResponse,
  PopulatePlaylistRequest,
  RefreshTokensRequest,
  RefreshTokensResponse,
  SearchResultTrack,
  SearchTracksRequest,
  SearchTracksResponse,
  UserTrackPlay,
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
  // Static cache for the Echo app's Spotify token (singleton pattern)
  private static cachedToken: string | null = null;
  private static tokenExpiry: Date | null = null;

  /**
   * Get a valid Spotify access token for the Echo app account.
   * Handles in-memory caching and automatic refresh.
   * Use this instead of manually fetching and checking token expiry.
   */
  static async getValidToken(): Promise<{
    ok: boolean;
    data: { accessToken: string; userId: string } | null;
    error: unknown;
  }> {
    try {
      // Check in-memory cache first (fast!)
      if (
        SpotifyPlatform.cachedToken &&
        SpotifyPlatform.tokenExpiry &&
        new Date() < SpotifyPlatform.tokenExpiry
      ) {
        // Need userId for API calls, fetch it (lightweight query)
        const [auth] = await db
          .select({ userId: spotifyAuth.userId })
          .from(spotifyAuth)
          .limit(1);

        if (!auth) {
          return {
            ok: false,
            data: null,
            error: "No Spotify auth found",
          };
        }

        return {
          ok: true,
          data: {
            accessToken: SpotifyPlatform.cachedToken,
            userId: auth.userId,
          },
          error: null,
        };
      }

      // Fetch from DB
      const [auth] = await db
        .select({
          userId: spotifyAuth.userId,
          accessToken: spotifyAuth.accessToken,
          refreshToken: spotifyAuth.refreshToken,
          tokenExpiresAt: spotifyAuth.tokenExpiresAt,
        })
        .from(spotifyAuth)
        .limit(1);

      if (!auth) {
        return {
          ok: false,
          data: null,
          error: "No Spotify auth found",
        };
      }

      // Check if token is still valid
      if (new Date(auth.tokenExpiresAt) > new Date()) {
        // Token is still good, cache it
        SpotifyPlatform.cachedToken = auth.accessToken;
        SpotifyPlatform.tokenExpiry = new Date(auth.tokenExpiresAt);

        return {
          ok: true,
          data: { accessToken: auth.accessToken, userId: auth.userId },
          error: null,
        };
      }

      // Token expired, refresh it
      const { ok, data, error } = await SpotifyPlatform.refreshTokens({
        userId: auth.userId,
        refreshToken: auth.refreshToken,
      });

      if (!ok || !data) {
        return { ok: false, data: null, error };
      }

      // Cache the new token
      SpotifyPlatform.cachedToken = data.accessToken;
      SpotifyPlatform.tokenExpiry = new Date(data.expiresIn);

      return {
        ok: true,
        data: { accessToken: data.accessToken, userId: auth.userId },
        error: null,
      };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }

  /**
   * Invalidate the token cache.
   * Useful for testing or forcing a fresh token fetch.
   */
  static invalidateCache(): void {
    SpotifyPlatform.cachedToken = null;
    SpotifyPlatform.tokenExpiry = null;
  }

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
        Date.now() + responseData.expires_in * 1000,
      ).toISOString();

      // await db
      //   .update(userAuth)
      //   .set({
      //     accessToken: responseData.access_token,
      //     refreshToken: responseData.refresh_token ?? request.refreshToken,
      //     tokenExpiresAt: spotifyTokenExpiresAt,
      //     updatedAt: new Date().toISOString(),
      //   })
      //   .where(eq(userAuth.userId, request.userId));

      await db
        .update(spotifyAuth)
        .set({
          accessToken: responseData.access_token,
          refreshToken: responseData.refresh_token ?? request.refreshToken,
          tokenExpiresAt: spotifyTokenExpiresAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(spotifyAuth.userId, request.userId));

      const data = {
        accessToken: responseData.access_token,
        refreshToken: responseData.refresh_token ?? request.refreshToken,
        expiresIn: spotifyTokenExpiresAt,
      } as RefreshTokensResponse;

      return { ok: true, data: data, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }

  static async createPlaylist(request: CreatePlaylistRequest): Promise<{
    ok: boolean;
    data: { playlistId: string; allData: unknown } | null;
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
      return {
        ok: true,
        data: { playlistId: playlistData.id, allData: playlistData },
        error: null,
      };
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
      const tracks: UserTrackPlay[] = (data.items || []).map(
        (play: SpotifyRecentTrackPlay) => ({
          userId: request.userId,
          platform: PlatformEnum.SPOTIFY,
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

  /**
   * Helper method to get client credentials access token
   * Can be used to get a token once and reuse it for multiple API calls
   */
  static async getClientCredentialsToken(): Promise<{
    ok: boolean;
    data: { accessToken: string } | null;
    error: unknown;
  }> {
    try {
      console.log("getting spotify token in getClientCredentialsToken");
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
      return {
        ok: true,
        data: { accessToken: authData.access_token },
        error: null,
      };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }

  static async searchTracks(
    request: SearchTracksRequest,
    accessToken?: string,
    limit = 10,
  ): Promise<{
    ok: boolean;
    data: SearchTracksResponse | null;
    error: unknown;
  }> {
    try {
      let token = accessToken;

      // Only fetch token if not provided
      if (!token) {
        const tokenResponse = await SpotifyPlatform.getClientCredentialsToken();
        if (!tokenResponse.ok || !tokenResponse.data) {
          return {
            ok: false,
            data: null,
            error: tokenResponse.error || "Failed to get access token",
          };
        }
        token = tokenResponse.data.accessToken;
      }

      // Search using app token
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(request.query)}&type=track&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
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
          trackPlatform: PlatformEnum.SPOTIFY,
        })) || [];

      return { ok: true, data: { tracks }, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }

  /**
   * Wrapper method to search for a track by name and artist using precise field filters
   * @param trackName - The name of the track
   * @param artistName - The name of the artist
   * @param accessToken - Optional access token to reuse (useful for bulk searches)
   * @param limit - Number of results to return (default: 10)
   */
  static async searchTrackByNameAndArtist(
    trackName: string,
    artistName: string,
    accessToken?: string,
  ): Promise<{
    ok: boolean;
    data: SearchTracksResponse | null;
    error: unknown;
  }> {
    const query = `track:"${trackName}" artist:"${artistName}"`;
    return SpotifyPlatform.searchTracks({ query }, accessToken, 1);
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

  static async getRecommendedSongs(sharedTracks: string[]): Promise<{
    ok: boolean;
    data: Array<{
      trackId: string;
      trackName: string;
      artists: string;
      albumImageUrl: string;
    }> | null;
    error: unknown;
  }> {
    try {
      const [auth] = await db
        .select({
          userId: spotifyAuth.userId,
          accessToken: spotifyAuth.accessToken,
          refreshToken: spotifyAuth.refreshToken,
          tokenExpiresAt: spotifyAuth.tokenExpiresAt,
        })
        .from(spotifyAuth)
        .limit(1);

      if (!auth) {
        return {
          ok: false,
          data: null,
          error: "Error in getRecommendedSongs: No Spotify auth found",
        };
      }

      let {
        userId: platformUserId,
        accessToken,
        refreshToken,
        tokenExpiresAt,
      } = auth;

      if (new Date(tokenExpiresAt) < new Date()) {
        const {
          ok: refreshTokensOk,
          data: refreshTokensData,
          error: refreshTokensError,
        } = await SpotifyPlatform.refreshTokens({
          userId: platformUserId,
          refreshToken: refreshToken,
        });

        if (!refreshTokensOk) {
          return { ok: false, data: null, error: refreshTokensError };
        }

        if (!refreshTokensData) {
          return {
            ok: false,
            data: null,
            error: `no data returned from refreshAccessToken`,
          };
        }

        accessToken = refreshTokensData.accessToken;
        refreshToken = refreshTokensData.refreshToken;
        tokenExpiresAt = refreshTokensData.expiresIn;
      }

      const seedTracks = sharedTracks.join(",");

      const response = await fetch(
        `https://api.spotify.com/v1/recommendations?seed_tracks=${seedTracks}&limit=4`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      console.log("response status", response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.log("error response", errorData);
        throw new Error(errorData);
      }

      const data = await response.json();
      console.log("recommendations response", data);

      const recommendedSongs = data.tracks.map((track: any) => ({
        trackId: track.id,
        trackName: track.name,
        artists: track.artists.map((artist: any) => artist.name).join(", "),
        albumImageUrl: track.album.images[0]?.url || "",
      }));

      return { ok: true, data: recommendedSongs, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }

  static extractTrackId(url: string): string {
    const match = url.match(/track\/(\w+)/);
    if (match) {
      return match[1];
    }
    throw new Error(`Could not extract Spotify track ID from URL ${url}`);
  }

  static createPlaylistLink(platformPlaylistId: string) {
    return `https://open.spotify.com/playlist/${platformPlaylistId}`;
  }

  static async getTrack(
    trackId: string,
    accessToken: string,
  ): Promise<{
    ok: boolean;
    data: {
      trackId: string;
      trackName: string;
      artists: string;
      albumImageUrl: string;
    } | null;
    error: unknown;
  }> {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/tracks/${trackId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (!response.ok) {
        const errorData = await response.text();
        return { ok: false, data: null, error: errorData };
      }

      const data = await response.json();
      return {
        ok: true,
        data: {
          trackId,
          trackName: data.name,
          artists: data.artists.map((artist: any) => artist.name).join(", "),
          albumImageUrl: data.album.images[0]?.url || "",
        },
        error: null,
      };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }

  static isTrackLink(link: string): boolean {
    // https://open.spotify.com/track/0jkAr7eZsvWDLYiQCfaxak?si=-P5tF8qcQ0ezx9ZALcQpYw&context=spotify%3Aplaylist%3A37i9dQZF1EId8sNiDAP5xq
    if (!link) return false;

    if (!link.startsWith("https://")) return false;

    if (!link.includes("spotify.com/track/")) return false;

    return true;
  }

  static async getTrackFromLink(
    link: string,
    accessToken: string,
  ): Promise<{
    ok: boolean;
    data: {
      trackId: string;
      trackName: string;
      artists: string;
      albumImageUrl: string;
    } | null;
    error: unknown;
  }> {
    try {
      const trackId = SpotifyPlatform.extractTrackId(link);
      const { ok, data, error } = await SpotifyPlatform.getTrack(
        trackId,
        accessToken,
      );

      if (!ok || !data || error) {
        return { ok: false, data: null, error: error };
      }

      return { ok: true, data: data, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err };
    }
  }
}
