import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import Hero from "@/components/Hero";
import NavBar from "@/components/NavBar";
import SettingsPanel from "@/components/SettingsPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import {
  friends,
  playlistSongs,
  playlists,
  userEchoSessions,
  users,
} from "@/db/schema";
import { Platform } from "@/db/types";
import { AppleMusicPlatform } from "@/platforms/apple_music_platform";
import { SpotifyPlatform } from "@/platforms/spotify_platform";

interface ProfilePageProps {
  phoneNumber: string;
}

type Friend = {
  id: number;
  firstName: string;
  lastName: string;
};

export default async function ProfilePage({ phoneNumber }: ProfilePageProps) {
  // Resolve user by phone number first; this drives all subsequent queries
  const [userRecord] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      platform: users.platform,
    })
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1);

  if (!userRecord) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
        <main className="flex flex-col items-center gap-8 max-w-md w-full">
          <Hero />
          <div className="text-white text-center">
            No user found for this phone number.
          </div>
        </main>
      </div>
    );
  }

  const userId = userRecord.id;

  // Songs Shared: user_echo_sessions where track_id IS NOT NULL for this user
  const [{ count: songsShared }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userEchoSessions)
    .where(
      and(
        eq(userEchoSessions.userId, userId),
        isNotNull(userEchoSessions.trackId),
      ),
    );

  // Songs Discovered: count of playlist_songs across all playlists belonging to the user
  const playlistIdsSubquery = db
    .select({ id: playlists.id })
    .from(playlists)
    .where(eq(playlists.userId, userId));

  const [{ count: songsDiscovered }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(playlistSongs)
    .where(inArray(playlistSongs.playlistId, playlistIdsSubquery));

  // Friends list: include both directions and de-duplicate
  const outgoingFriends = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(friends)
    .innerJoin(users, eq(users.id, friends.friendId))
    .where(eq(friends.userId, userId));

  const incomingFriends = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(friends)
    .innerJoin(users, eq(users.id, friends.userId))
    .where(eq(friends.friendId, userId));

  const friendIdToFriend = new Map<number, Friend>();
  [...outgoingFriends, ...incomingFriends].forEach((f) => {
    friendIdToFriend.set(f.id, f);
  });
  const friendsList = Array.from(friendIdToFriend.values()).sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(
      `${b.firstName} ${b.lastName}`,
    ),
  );

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
        eq(userEchoSessions.userId, userId),
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
    })
    .from(playlists)
    .where(eq(playlists.userId, userId))
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

  const getPlaylistImage = (playlistImageUrl: string) => {
    const images = playlistImageUrl.split("|");

    if (images.length === 4) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-0 w-10 h-10 overflow-hidden rounded-md">
          {images.map((img) => (
            <Image
              key={img}
              src={img}
              alt="playlist cover tile"
              width={20}
              height={20}
              className="object-cover w-full h-full"
            />
          ))}
        </div>
      );
    }

    return (
      <Image
        src={images[0]}
        alt="playlist cover"
        width={40}
        height={40}
        className="rounded-md"
      />
    );
  };

  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-start p-8 min-h-screen">
      <NavBar />

      <main className="flex flex-col items-center gap-8 w-full max-w-6xl h-full">
        {/* Stats and profile area */}
        <div className="flex items-center w-full">
          <div className="flex flex-col items-center flex-1">
            <div className="text-white text-4xl font-semibold">
              {songsShared}
            </div>
            <div className="text-white/90 text-xl text-center">
              {Number(songsShared) === 1 ? "song shared" : "songs shared"}
            </div>
          </div>

          <div className="flex flex-col items-center flex-1">
            <Skeleton className="size-20 rounded-full bg-gray-800" />
          </div>

          <div className="flex flex-col items-center flex-1">
            <div className="text-white text-4xl font-semibold">
              {songsDiscovered}
            </div>
            <div className="text-white/90 text-xl text-center">
              {Number(songsDiscovered) === 1
                ? "song discovered"
                : "songs discovered"}
            </div>
          </div>
        </div>

        {/* Name under the avatar if available */}
        <div className="text-white text-2xl text-center">
          {`${userRecord.firstName} ${userRecord.lastName}`
            .trim()
            .toLowerCase()}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="w-full max-w-2xl mx-auto">
            <TabsTrigger value="friends">friends</TabsTrigger>
            <TabsTrigger value="past">past echoes</TabsTrigger>
            <TabsTrigger value="settings">settings</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-4">
            <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
              {friendsList.length === 0 && (
                <div className="text-white/80 text-center">no friends yet</div>
              )}
              {friendsList.map((friend) => {
                const fullName = `${friend.firstName} ${friend.lastName}`
                  .trim()
                  .toLowerCase();
                return (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between gap-4 w-full"
                  >
                    <div className="flex items-center gap-4">
                      <Skeleton className="size-8 rounded-full bg-gray-800" />
                      <div className="text-white text-lg">{fullName}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="outline">mute</Button>
                      <Button variant="outline">unfriend</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            <Tabs defaultValue="songs" className="w-full">
              <TabsList className="w-full max-w-2xl mx-auto">
                <TabsTrigger value="songs">songs you shared</TabsTrigger>
                <TabsTrigger value="playlists">your playlists</TabsTrigger>
              </TabsList>

              <TabsContent value="songs" className="mt-4">
                <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
                  {sharedSongs.length === 0 && (
                    <div className="text-white/80 text-center">
                      no songs yet
                    </div>
                  )}
                  {sharedSongs.map((row) => (
                    <div
                      key={`${row.platform}:${row.trackId}`}
                      className="flex items-center gap-4"
                    >
                      {/* <Skeleton className="size-10 rounded-md bg-gray-800" /> */}
                      <Image
                        src={row.trackAlbumImageUrl as string}
                        alt={row.trackName as string}
                        width={40}
                        height={40}
                        className="rounded-md"
                      />
                      <div className="text-white">
                        <div className="text-base">
                          {row.trackName} - {row.trackArtists}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="playlists" className="mt-4">
                <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
                  {userPlaylists.length === 0 && (
                    <div className="text-white/80 text-center">
                      no playlists yet
                    </div>
                  )}
                  {userPlaylists.map((pl) => {
                    const href = getPlaylistUrl(
                      pl.platform,
                      pl.platformPlaylistId,
                    );

                    return (
                      <div key={pl.id} className="flex items-center gap-4">
                        {getPlaylistImage(pl.playlistImageUrl)}

                        <div className="text-white">
                          <Link
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base underline underline-offset-2 hover:opacity-90"
                          >
                            {pl.playlistName}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <SettingsPanel currentPlatform={userRecord.platform} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
