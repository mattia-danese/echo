import { env } from "./env";

// TOOD: see if multiple arrists can be supplied
export const getSimilarTracks = async (
  trackName: string,
  artistName: string,
) => {
  const response = await fetch(
    `http://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${artistName}&track=${trackName}&api_key=${lastFmAdmin.apiKey}&limit=4&format=json`,
  );

  if (!response.ok) {
    const errorData = await response.text();
    return { ok: false, data: null, error: errorData };
  }

  const data = await response.json();

  if (data.error) {
    const errorMessage = `Received error from Last.fm: code ${data.error} & message ${data.message}`;
    return { ok: false, data: null, error: errorMessage };
  }

  const similarTracks = data.similartracks.track.map((track: any) => ({
    trackName: track.name,
    artists: track.artist.name,
  }));

  return { ok: true, data: similarTracks, error: null };
};

export const lastFmAdmin = {
  apiKey: env.LAST_FM_API_KEY,
  apiSecret: env.LAST_FM_SECRET_KEY,
  getSimilarTracks: getSimilarTracks,
};
