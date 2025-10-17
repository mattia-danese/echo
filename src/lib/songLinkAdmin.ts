// curl -X GET "<https://api.song.link/v1-alpha.1/links?.>.."
// curl -X GET "<https://api.song.link/v1-alpha.1/links?url=spotify%3Atrack%3A0Jcij1eWd5bDMU5iPbxe2i&userCountry=US&key=9ed95450-2b6f-4aae-a3ab-34b6bca4f786>"
// curl -X GET "<https://api.song.link/v1-alpha.1/links?url=spotify%3Atrack%3A0Jcij1eWd5bDMU5iPbxe2i&userCountry=US&songIfSingle=true&key=><key>"

import { Platform } from "@/db/types";
import { AppleMusicPlatform, SpotifyPlatform } from "@/platforms";

const songLinkPlatformMap = {
  [Platform.SPOTIFY]: "spotify",
  [Platform.APPLE_MUSIC]: "appleMusic",
};

const getLinks = async (platform: Platform, trackId: string) => {
  // TODO: might be easier to just use (platform, type, id)
  // const songLinkPlatform = songLinkPlatformMap[platform];

  let songLink = "";

  switch (platform) {
    case Platform.SPOTIFY:
      songLink = SpotifyPlatform.getSongLink(trackId);
      break;
    case Platform.APPLE_MUSIC:
      songLink = AppleMusicPlatform.getSongLink(trackId);
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  const response = await fetch(
    `https://api.song.link/v1-alpha.1/links?url=${songLink}&userCountry=US&songIfSingle=true`,
  );

  if (!response.ok) {
    const errorData = await response.text();
    return { ok: false, data: null, error: errorData };
  }

  const data = await response.json();
  return { ok: true, data: data, error: null };
};

const extractTrackId = (url: string, platform: Platform) => {
  switch (platform) {
    case Platform.SPOTIFY:
      return SpotifyPlatform.extractTrackId(url);
    case Platform.APPLE_MUSIC:
      return AppleMusicPlatform.extractTrackId(url);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};

export const songLinkAdmin = {
  getLinks: getLinks,
  songLinkPlatformMap: songLinkPlatformMap,
  extractTrackId: extractTrackId,
};
