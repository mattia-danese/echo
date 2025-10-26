"use server";

import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import LogInSignUp from "@/components/LogInSignUp";
import Profile from "@/components/Profile";
import { db } from "@/db";
import {
  friends,
  playlistSongs,
  playlists,
  userEchoSessions,
  users,
} from "@/db/schema";
import { Platform } from "@/db/types";
import { getCurrentUser } from "@/lib/cookieSession";
import { AppleMusicPlatform } from "@/platforms/apple_music_platform";
import { SpotifyPlatform } from "@/platforms/spotify_platform";

interface PageProps {
  searchParams: Promise<{
    accountStatus?: string;
  }>;
}

export default async function RootPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const accountStatus = resolvedSearchParams.accountStatus;

  const user = await getCurrentUser();
  if (!user) {
    return <LogInSignUp accountStatus={accountStatus} />;
  }

  /*
    BELOW ARE ALL METHODS FOR PROFILE PAGE
  */

  // Songs Shared: user_echo_sessions where track_id IS NOT NULL for this user
  const [{ count: songsShared }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userEchoSessions)
    .where(
      and(
        eq(userEchoSessions.userId, user.id),
        isNotNull(userEchoSessions.trackId),
      ),
    );

  // Songs Discovered: count of playlist_songs across all playlists belonging to the user
  const playlistIdsSubquery = db
    .select({ id: playlists.id })
    .from(playlists)
    .where(eq(playlists.userId, user.id));

  const [{ count: songsDiscovered }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(playlistSongs)
    .where(inArray(playlistSongs.playlistId, playlistIdsSubquery));

  // Friends list: include both directions and de-duplicate
  const friendsList = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      profilePic: users.profilePictureUrl,
      isMuted: friends.muted,
    })
    .from(friends)
    .innerJoin(users, eq(users.id, friends.friendId))
    .where(and(eq(friends.userId, user.id), eq(friends.active, true)))
    .orderBy(asc(users.firstName), asc(users.lastName));

  // Past echoes → "your songs": join mappings and cache in a single query
  const sharedSongs = await db
    .select({
      trackId: userEchoSessions.trackId,
      platform: userEchoSessions.platform,
      trackName: userEchoSessions.trackName,
      trackArtists: userEchoSessions.trackArtists,
      trackAlbumImageUrl: userEchoSessions.trackAlbumImageUrl,
    })
    .from(userEchoSessions)
    .where(
      and(
        eq(userEchoSessions.userId, user.id),
        isNotNull(userEchoSessions.trackId),
      ),
    )
    .orderBy(desc(userEchoSessions.createdAt));

  // Your playlists: simple select filtered by user and ordered by newest first
  const userPlaylists = await db
    .select({
      id: playlists.id,
      platform: playlists.platform,
      platformPlaylistId: playlists.platformPlaylistId,
      playlistName: playlists.playlistName,
      playlistImageUrl: playlists.playlistImageUrl,
      playlistUrl: sql<string>`''`,
    })
    .from(playlists)
    .where(eq(playlists.userId, user.id))
    .orderBy(desc(playlists.createdAt));

  const getPlaylistUrl = (platform: Platform, platformPlaylistId: string) => {
    if (platform === Platform.SPOTIFY) {
      return SpotifyPlatform.createPlaylistLink(platformPlaylistId);
    }

    if (platform === Platform.APPLE_MUSIC) {
      return AppleMusicPlatform.createPlaylistLink(platformPlaylistId);
    }

    return "#";
  };

  for (const playlist of userPlaylists) {
    playlist.playlistUrl = getPlaylistUrl(
      playlist.platform,
      playlist.platformPlaylistId,
    );
  }

  return (
    <Profile
      phoneNumber={user.phoneNumber}
      firstName={user.firstName}
      lastName={user.lastName}
      profilePictureUrl={user.profilePictureUrl}
      platform={user.platform}
      songsShared={songsShared}
      songsDiscovered={songsDiscovered}
      friendsList={friendsList}
      sharedSongs={
        sharedSongs as Array<{
          trackId: string;
          platform: Platform;
          trackName: string;
          trackArtists: string;
          trackAlbumImageUrl: string;
        }>
      }
      userPlaylists={userPlaylists}
      userId={user.id}
    />
  );
}
