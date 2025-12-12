"use server";

import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import LogInSignUp from "@/components/LogInSignUp";
import Profile from "@/components/Profile";
import { db } from "@/db";
import {
  appleDevToken,
  echoSessions,
  friends,
  playlistSongs,
  playlists,
  userEchoSessions,
  userRankings,
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

  // Fetch Apple developer token to pass to client when needed (MusicKit config)
  const [dev] = await db.select().from(appleDevToken).limit(1);
  const appleDeveloperToken = dev?.token ?? "";

  const user = await getCurrentUser();
  if (!user) {
    return (
      <LogInSignUp
        accountStatus={accountStatus}
        appleDeveloperToken={appleDeveloperToken}
      />
    );
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
      echoSessionId: playlists.sessionId,
    })
    .from(playlists)
    .where(eq(playlists.userId, user.id))
    .orderBy(desc(playlists.createdAt));

  // Playlist songs joined with user echo sessions to get track metadata and submitter info
  // Use distinctOn to get only one row per playlist song (in case multiple users submitted the same track)
  const playlistSongsRows = await db
    .selectDistinctOn([playlistSongs.id], {
      playlistId: playlistSongs.playlistId,
      trackId: playlistSongs.trackId,
      trackName: userEchoSessions.trackName,
      trackArtists: userEchoSessions.trackArtists,
      trackAlbumImageUrl: userEchoSessions.trackAlbumImageUrl,
      platform: userEchoSessions.platform,
      submittedByUserId: playlistSongs.submittedByUserId,
      submittedByFirstName: users.firstName,
      submittedByLastName: users.lastName,
    })
    .from(playlistSongs)
    .innerJoin(
      userEchoSessions,
      eq(playlistSongs.trackId, userEchoSessions.trackId),
    )
    .innerJoin(users, eq(playlistSongs.submittedByUserId, users.id))
    .where(inArray(playlistSongs.playlistId, playlistIdsSubquery));

  const playlistSongsByPlaylist: Record<
    number,
    Array<{
      trackId: string;
      platform: Platform;
      trackName: string | null;
      trackArtists: string | null;
      trackAlbumImageUrl: string | null;
      submittedByUserId: number;
      submittedByFirstName: string;
      submittedByLastName: string;
    }>
  > = {};

  for (const row of playlistSongsRows) {
    if (!playlistSongsByPlaylist[row.playlistId]) {
      playlistSongsByPlaylist[row.playlistId] = [];
    }
    playlistSongsByPlaylist[row.playlistId].push({
      trackId: row.trackId,
      platform: row.platform,
      trackName: row.trackName ?? null,
      trackArtists: row.trackArtists ?? null,
      trackAlbumImageUrl: row.trackAlbumImageUrl ?? null,
      submittedByUserId: row.submittedByUserId,
      submittedByFirstName: row.submittedByFirstName,
      submittedByLastName: row.submittedByLastName,
    });
  }

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

  // Streak
  const userSharedSessions = await db
    .select({ sessionId: userEchoSessions.sessionId })
    .from(userEchoSessions)
    .where(
      and(
        eq(userEchoSessions.userId, user.id),
        isNotNull(userEchoSessions.trackId),
      ),
    )
    .orderBy(desc(userEchoSessions.createdAt));

  const sharedSessionIds = new Set(
    userSharedSessions.map((row) => row.sessionId),
  );

  let streak = 0;
  if (sharedSessionIds.size > 0) {
    const maxSessionsToCheck = sharedSessionIds.size + 1; // +1 to detect the first miss

    const sessionsToCheck =
      maxSessionsToCheck > 0
        ? await db
            .select({ id: echoSessions.id })
            .from(echoSessions)
            .orderBy(desc(echoSessions.createdAt))
            .offset(1) // skip the most recent session
            .limit(maxSessionsToCheck)
        : [];

    for (const session of sessionsToCheck) {
      if (sharedSessionIds.has(session.id)) {
        streak += 1;
      } else {
        break;
      }
    }
  }

  // User rankings
  const rankings = await db
    .select({
      playlistId: userRankings.playlistId,
    })
    .from(userRankings)
    .where(eq(userRankings.userId, user.id))
    .orderBy(desc(userRankings.createdAt));

  const rankingsSet = new Set(rankings.map((row) => row.playlistId));

  // Does user need to rank
  let needsToRank = false;

  if (userPlaylists.length > 0) {
    const lastPlaylist = userPlaylists[0];
    const lastPlaylistId = lastPlaylist.id;
    const lastPlaylistEchoSessionId = lastPlaylist.echoSessionId;

    const [endOfLastEchoSessionThatGeneratedPlaylist] = await db
      .select({ end: echoSessions.end })
      .from(echoSessions)
      .where(eq(echoSessions.id, lastPlaylistEchoSessionId))
      .offset(1)
      .limit(1);

    if (!rankingsSet.has(lastPlaylistId)) {
      if (endOfLastEchoSessionThatGeneratedPlaylist) {
        const endOfLastEchoSessionThatGeneratedPlaylistDate = new Date(
          endOfLastEchoSessionThatGeneratedPlaylist.end,
        );

        const now = new Date();

        // 1 day after the end of the last echo session that generated a playlist
        const endOfRankingPeriod = new Date(
          endOfLastEchoSessionThatGeneratedPlaylistDate,
        );
        endOfRankingPeriod.setDate(endOfRankingPeriod.getDate() + 1);

        if (now < endOfRankingPeriod) {
          needsToRank = true;
        }
      }
    }
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
      playlistSongsByPlaylist={playlistSongsByPlaylist}
      userId={user.id}
      streak={streak}
      rankings={rankingsSet}
      needsToRank={true}
    />
  );
}
