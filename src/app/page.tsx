"use server";

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  sql,
} from "drizzle-orm";

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
    token?: string;
  }>;
}

export default async function RootPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const accountStatus = resolvedSearchParams.accountStatus;
  const token = resolvedSearchParams.token;

  // Fetch Apple developer token to pass to client when needed (MusicKit config)
  const [dev] = await db.select().from(appleDevToken).limit(1);
  const appleDeveloperToken = dev?.token ?? "";

  let initialPhoneNumber: string | undefined;
  if (token) {
    const [userWithToken] = await db
      .select({ phoneNumber: users.phoneNumber })
      .from(users)
      .where(and(eq(users.friendLinkToken, token), eq(users.isDeleted, false)))
      .limit(1);

    if (userWithToken) {
      initialPhoneNumber = userWithToken.phoneNumber;
    }
  }

  const user = await getCurrentUser();
  if (!user) {
    return (
      <LogInSignUp
        accountStatus={accountStatus}
        appleDeveloperToken={appleDeveloperToken}
        initialPhoneNumber={initialPhoneNumber}
      />
    );
  }

  /*
    BELOW ARE ALL METHODS FOR PROFILE PAGE
    Queries are parallelized where possible for performance
  */

  // Subquery for playlist IDs (used by multiple queries)
  const playlistIdsSubquery = db
    .select({ id: playlists.id })
    .from(playlists)
    .where(eq(playlists.userId, user.id));

  // Run all independent queries in parallel
  const [
    sharedSongs,
    [{ count: songsDiscovered }],
    friendsList,
    userPlaylists,
    playlistSongsRows,
    rankings,
    recentEchoSessions,
  ] = await Promise.all([
    // sharedSongs query (includes sessionId for streak calculation)
    db
      .select({
        trackId: userEchoSessions.trackId,
        platform: userEchoSessions.platform,
        trackName: userEchoSessions.trackName,
        trackArtists: userEchoSessions.trackArtists,
        trackAlbumImageUrl: userEchoSessions.trackAlbumImageUrl,
        sessionId: userEchoSessions.sessionId,
      })
      .from(userEchoSessions)
      .where(
        and(
          eq(userEchoSessions.userId, user.id),
          isNotNull(userEchoSessions.trackId),
        ),
      )
      .orderBy(desc(userEchoSessions.createdAt)),

    // songsDiscovered count
    db
      .select({ count: count() })
      .from(playlistSongs)
      .where(inArray(playlistSongs.playlistId, playlistIdsSubquery)),

    // friendsList
    db
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
      .orderBy(asc(users.firstName), asc(users.lastName)),

    // userPlaylists
    db
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
      .orderBy(desc(playlists.createdAt)),

    // playlistSongsRows
    db
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
        submittedByPhoneNumber: users.phoneNumber,
      })
      .from(playlistSongs)
      .innerJoin(
        userEchoSessions,
        eq(playlistSongs.trackId, userEchoSessions.trackId),
      )
      .innerJoin(users, eq(playlistSongs.submittedByUserId, users.id))
      .where(inArray(playlistSongs.playlistId, playlistIdsSubquery)),

    // rankings
    db
      .select({
        playlistId: userRankings.playlistId,
        rankedUserId: userRankings.rankedUserId,
      })
      .from(userRankings)
      .where(eq(userRankings.userId, user.id))
      .orderBy(desc(userRankings.createdAt)),

    // recentEchoSessions (limit 2 with end field for both needsToRank and countdown)
    db
      .select({ id: echoSessions.id, end: echoSessions.end })
      .from(echoSessions)
      .orderBy(desc(echoSessions.createdAt))
      .limit(2),
  ]);

  // Derive songsShared count from sharedSongs result
  const songsShared = sharedSongs.length;

  // Derive sharedSessionIds from sharedSongs for streak calculation
  const sharedSessionIds = new Set(sharedSongs.map((row) => row.sessionId));

  // Derive currentSessionEndTime from recentEchoSessions
  const currentSessionEndTime = recentEchoSessions[0]?.end ?? null;

  // Derive rankingsMap from rankings
  const rankingsMap = new Map(
    rankings.map((row) => [row.playlistId, row.rankedUserId]),
  );

  const playlistSongsByPlaylist: Record<
    number,
    Array<{
      trackId: string;
      platform: Platform | null;
      trackName: string | null;
      trackArtists: string | null;
      trackAlbumImageUrl: string | null;
      submittedByUserId: number;
      submittedByFirstName: string;
      submittedByLastName: string;
      submittedByPhoneNumber: string;
    }>
  > = {};

  for (const row of playlistSongsRows) {
    if (!playlistSongsByPlaylist[row.playlistId]) {
      playlistSongsByPlaylist[row.playlistId] = [];
    }
    playlistSongsByPlaylist[row.playlistId].push({
      trackId: row.trackId,
      platform: row.platform ?? null,
      trackName: row.trackName ?? null,
      trackArtists: row.trackArtists ?? null,
      trackAlbumImageUrl: row.trackAlbumImageUrl ?? null,
      submittedByUserId: row.submittedByUserId,
      submittedByFirstName: row.submittedByFirstName,
      submittedByLastName: row.submittedByLastName,
      submittedByPhoneNumber: row.submittedByPhoneNumber,
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

  // Streak calculation (uses sharedSessionIds derived from parallel query above)
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

  // Does user need to rank (uses rankingsMap and recentEchoSessions from parallel query above)
  let needsToRank = false;

  if (userPlaylists.length > 0) {
    const mostRecentPlaylist = userPlaylists[0];
    const mostRecentPlaylistId = mostRecentPlaylist.id;
    const mostRecentPlaylistEchoSessionId = mostRecentPlaylist.echoSessionId;

    // Check if user hasn't ranked their most recent playlist
    if (!rankingsMap.has(mostRecentPlaylistId)) {
      if (recentEchoSessions.length >= 2) {
        const secondMostRecentEchoSession = recentEchoSessions[1];

        // Check if the playlist's echo session is the second most recent
        if (
          secondMostRecentEchoSession.id === mostRecentPlaylistEchoSessionId
        ) {
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
      // platform={user.platform}
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
      rankings={rankingsMap}
      needsToRank={needsToRank}
      currentSessionEndTime={currentSessionEndTime}
    />
  );
}
