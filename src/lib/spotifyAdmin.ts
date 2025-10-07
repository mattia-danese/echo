import { env } from "./env";

export const spotifyAdmin = {
  clientId: env.SPOTIFY_CLIENT_ID,
  clientSecret: env.SPOTIFY_CLIENT_SECRET,
  redirectUri: env.SPOTIFY_REDIRECT_URI,
  publicClientId: env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
  publicRedirectUri: env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI,
  genericPlaylistId: env.ONBOARDING_COMPLETION_GENERIC_SPOTIFY_PLAYLIST,
};
