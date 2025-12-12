"use client";

import { UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import NavBar from "@/components/NavBar";
import SettingsPanel from "@/components/SettingsPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Platform } from "@/db/types";
import { Platform as PlatformEnum } from "@/db/types";
import { useFriendMutations, useFriends } from "@/hooks/useFriends";
import { UploadButton } from "@/src/utils/uploadthing";

interface ProfilePageProps {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
  platform: Platform;
  songsShared: number;
  songsDiscovered: number;
  friendsList: {
    id: number;
    firstName: string;
    lastName: string;
    profilePic: string | null;
    isMuted: boolean;
  }[];
  sharedSongs: {
    trackId: string;
    platform: Platform;
    trackName: string;
    trackArtists: string;
    trackAlbumImageUrl: string;
  }[];
  userPlaylists: {
    id: number;
    platform: Platform;
    platformPlaylistId: string;
    playlistName: string;
    playlistImageUrl: string;
    playlistUrl: string;
  }[];
  playlistSongsByPlaylist: Record<
    number,
    Array<{
      trackId: string;
      platform: Platform | null;
      trackName: string | null;
      trackArtists: string | null;
      trackAlbumImageUrl: string | null;
    }>
  >;
  userId: number;
  streak: number;
}

export default function ProfilePage({
  firstName,
  lastName,
  profilePictureUrl,
  platform,
  songsShared,
  songsDiscovered,
  friendsList,
  sharedSongs,
  userPlaylists,
  playlistSongsByPlaylist,
  userId,
  streak,
}: ProfilePageProps) {
  const getTabsFromLocation = () => {
    if (typeof window === "undefined") {
      return { main: "friends", past: "songs" };
    }

    const hash = window.location.hash.replace("#", "");
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    const target = (hash || tabParam || "").toLowerCase();
    if (target === "playlists" || target === "your-playlists") {
      return { main: "past", past: "playlists" };
    }
    return { main: "friends", past: "songs" };
  };

  const [uploadedProfilePictureUrl, setUploadedProfilePictureUrl] = useState<
    string | null
  >(profilePictureUrl);
  const previewUrlRef = useRef<string | null>(null);
  const initialTabsRef = useRef(getTabsFromLocation());
  const [mainTab, setMainTab] = useState(initialTabsRef.current.main);
  const [pastTab, setPastTab] = useState(initialTabsRef.current.past);
  const [expandedPlaylists, setExpandedPlaylists] = useState<Set<number>>(
    new Set(),
  );
  const { data: friendsData } = useFriends(userId, friendsList); // initialData = SSR list
  const { toggleMute, unfriend } = useFriendMutations(userId);

  // Ensure the page loads scrolled to the very top. iOS sometimes restores an offset.
  useEffect(() => {
    // Use both scrollTop and window to cover all browsers
    try {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant" as ScrollBehavior,
      });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {}
  }, []);

  // After hydration, re-read the URL to apply tab deep-linking (SSR can't see hash/query)
  useEffect(() => {
    const readTabsFromLocation = () => {
      if (typeof window === "undefined") {
        return { main: "friends", past: "songs" };
      }

      const hash = window.location.hash.replace("#", "");
      const tabParam = new URLSearchParams(window.location.search).get("tab");
      const target = (hash || tabParam || "").toLowerCase();
      if (target === "playlists" || target === "your-playlists") {
        return { main: "past", past: "playlists" };
      }
      return { main: "friends", past: "songs" };
    };

    const tabs = readTabsFromLocation();
    setMainTab(tabs.main);
    setPastTab(tabs.past);
  }, []);

  const getPlaylistImage = (playlistImageUrl: string) => {
    const images = playlistImageUrl.split("|");

    if (images.length === 4) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-0 w-10 h-10 overflow-hidden rounded-md">
          {images.map((img) => (
            <Image
              key={img}
              src={img.replace("{w}", String(20)).replace("{h}", String(20))}
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
        src={images[0].replace("{w}", String(40)).replace("{h}", String(40))}
        alt="playlist cover"
        width={40}
        height={40}
        className="rounded-md"
      />
    );
  };

  const formatStreak = (streak: number) => {
    if (streak < 3) return "";

    const mod10 = streak % 10;
    const mod100 = streak % 100;
    const ending =
      mod10 === 1 && mod100 !== 11
        ? "st"
        : mod10 === 2 && mod100 !== 12
          ? "nd"
          : mod10 === 3 && mod100 !== 13
            ? "rd"
            : "th";

    return `🔥 ${streak}${ending} echo in a row 🔥\nkeep up your streak`;
  };

  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-start p-8 min-h-screen overflow-x-hidden">
      <NavBar userId={userId} />

      <main className="flex flex-col items-center gap-8 w-full max-w-6xl h-full transform-gpu origin-top md:scale-100 scale-[1.06]">
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
            {uploadedProfilePictureUrl ? (
              <div className="relative size-20 md:size-[120px] shrink-0 rounded-full overflow-hidden">
                <Image
                  src={uploadedProfilePictureUrl}
                  alt="profile picture"
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="relative size-20 md:size-[120px] cursor-pointer">
                <UploadButton
                  endpoint="imageUploader"
                  input={{ userId }}
                  appearance={{
                    container: "absolute inset-0 cursor-pointer",
                    button:
                      "absolute inset-0 w-full h-full opacity-0 cursor-pointer",
                    allowedContent: "hidden",
                    clearBtn: "hidden",
                  }}
                  content={{
                    button: () => null,
                    allowedContent: () => null,
                    clearBtn: () => null,
                  }}
                  onBeforeUploadBegin={(files) => {
                    // Set a local preview immediately
                    const file = files?.[0];
                    if (file) {
                      if (previewUrlRef.current) {
                        URL.revokeObjectURL(previewUrlRef.current);
                      }
                      const objectUrl = URL.createObjectURL(file);
                      previewUrlRef.current = objectUrl;
                      setUploadedProfilePictureUrl(objectUrl);
                    }
                    return files;
                  }}
                  onClientUploadComplete={(res) => {
                    const uploadedUrl = res?.[0]?.serverData?.profilePictureUrl;
                    // Replace preview with final URL
                    if (previewUrlRef.current) {
                      URL.revokeObjectURL(previewUrlRef.current);
                      previewUrlRef.current = null;
                    }
                    setUploadedProfilePictureUrl(uploadedUrl);
                  }}
                  onUploadError={(error: Error) => {
                    if (previewUrlRef.current) {
                      URL.revokeObjectURL(previewUrlRef.current);
                      previewUrlRef.current = null;
                    }
                    alert(error.message);
                  }}
                />
                <div className="absolute inset-0 rounded-full bg-gray-800 flex items-center justify-center pointer-events-none">
                  <UserPlus className="text-gray-400" size={40} />
                </div>
              </div>
            )}
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

        {/* Name under the avatar */}
        <div className="text-white text-2xl text-center">
          {`${firstName} ${lastName}`.trim().toLowerCase()}
        </div>

        {/* Streak */}
        {streak >= 3 && (
          <div className="text-white text-2xl text-center whitespace-pre-line">
            {formatStreak(streak)}
          </div>
        )}

        {/* Tabs */}
        <Tabs
          value={mainTab}
          onValueChange={(val) => setMainTab(val)}
          className="w-full"
        >
          <TabsList className="w-full max-w-2xl mx-auto">
            <TabsTrigger
              className=" data-[state=active]:border data-[state=active]:border-white"
              value="friends"
            >
              friends
            </TabsTrigger>
            <TabsTrigger
              className=" data-[state=active]:border data-[state=active]:border-white"
              value="past"
            >
              past echoes
            </TabsTrigger>
            <TabsTrigger
              className=" data-[state=active]:border data-[state=active]:border-white"
              value="settings"
            >
              settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-4">
            <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
              {friendsData?.length === 0 && (
                <div className="text-white/80 text-center">no friends yet</div>
              )}
              {friendsData?.map((friend) => {
                const fullName = `${friend.firstName} ${friend.lastName}`
                  .trim()
                  .toLowerCase();
                return (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between gap-4 w-full"
                  >
                    <div className="flex items-center gap-4">
                      {friend.profilePic ? (
                        <Image
                          src={friend.profilePic}
                          alt={`${fullName} avatar`}
                          width={32}
                          height={32}
                          className="object-cover shrink-0 rounded-full overflow-hidden size-10 md:size-12"
                        />
                      ) : (
                        <div className="shrink-0 rounded-full bg-gray-800 flex items-center justify-center size-10 md:size-12">
                          <UserPlus className="text-gray-400" size={20} />
                        </div>
                      )}
                      <div className="text-white text-lg">{fullName}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {friend.isMuted ? (
                        <Button
                          variant="outline"
                          onClick={() =>
                            toggleMute.mutate({
                              friendId: friend.id,
                              nextMuted: false,
                            })
                          }
                        >
                          unmute
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() =>
                            toggleMute.mutate({
                              friendId: friend.id,
                              nextMuted: true,
                            })
                          }
                        >
                          mute
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => unfriend.mutate({ friendId: friend.id })}
                      >
                        unfriend
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            <Tabs
              value={pastTab}
              onValueChange={(val) => setPastTab(val)}
              className="w-full"
            >
              <TabsList className="w-full max-w-2xl mx-auto">
                <TabsTrigger
                  className=" data-[state=active]:border data-[state=active]:border-white"
                  value="songs"
                >
                  songs you've shared
                </TabsTrigger>
                <TabsTrigger
                  className=" data-[state=active]:border data-[state=active]:border-white"
                  value="playlists"
                >
                  your playlists
                </TabsTrigger>
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
                        src={row.trackAlbumImageUrl
                          .replace("{w}", String(40))
                          .replace("{h}", String(40))}
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
                  {userPlaylists.map((pl, idx) => {
                    const songsForPlaylist =
                      playlistSongsByPlaylist[pl.id] ?? [];
                    const isFlipped = expandedPlaylists.has(pl.id);
                    const isFirstCard = idx === 0;

                    return (
                      <button
                        key={pl.id}
                        type="button"
                        className="relative w-full group [perspective:1600px] border-0 p-0 text-left bg-transparent"
                        onClick={() => {
                          setExpandedPlaylists((prev) => {
                            const next = new Set(prev);
                            if (next.has(pl.id)) {
                              next.delete(pl.id);
                            } else {
                              next.add(pl.id);
                            }
                            return next;
                          });
                        }}
                      >
                        {/* Outer container for overflow clipping */}
                        <div className="relative w-full overflow-hidden">
                          {/* Inner container for 3D flip */}
                          <div
                            className={`relative w-full transition-transform duration-500 ease-in-out [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"}`}
                          >
                            {/* Front */}
                            <div
                              className={`rounded-xl border border-white/20 bg-black p-4 flex flex-col [backface-visibility:hidden] ${isFlipped ? "absolute inset-0 invisible" : "relative visible"}`}
                            >
                              {isFirstCard && (
                                <div className="text-xs text-blue-500 bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 mb-3">
                                  💡 submit your favorite song of the echo to
                                  see who shared what song
                                </div>
                              )}
                              <div className="flex items-center gap-4">
                                <div className="shrink-0">
                                  {getPlaylistImage(pl.playlistImageUrl)}
                                </div>
                                <div className="flex flex-col text-white">
                                  <div className="text-lg font-semibold">
                                    {pl.playlistName}
                                  </div>
                                  <div className="text-sm text-white/70">
                                    {songsForPlaylist.length}{" "}
                                    {songsForPlaylist.length === 1
                                      ? "song"
                                      : "songs"}
                                  </div>
                                  <div className="text-xs text-white/50 mt-1">
                                    tap to flip
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Back */}
                            <div
                              className={`rounded-xl border border-white/20 bg-black p-4 [transform:rotateY(180deg)] [backface-visibility:hidden] flex flex-col ${isFlipped ? "relative visible" : "absolute inset-0 invisible"}`}
                            >
                              {isFirstCard && (
                                <div className="text-xs text-blue-500 bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 mb-3">
                                  💡 submit your favorite song of the echo to
                                  see who shared what song
                                </div>
                              )}
                              <div className="text-white font-semibold text-base mb-3">
                                songs
                              </div>

                              <div className="flex flex-col gap-3 mb-3">
                                {songsForPlaylist.length === 0 && (
                                  <div className="text-white/70 text-sm">
                                    no songs yet
                                  </div>
                                )}
                                {songsForPlaylist.map((song) => {
                                  const albumImg = song.trackAlbumImageUrl
                                    ? song.trackAlbumImageUrl
                                        .replace("{w}", String(40))
                                        .replace("{h}", String(40))
                                    : null;
                                  return (
                                    <div
                                      key={`${pl.id}:${song.trackId}`}
                                      className="flex items-center gap-3 shrink-0"
                                    >
                                      {albumImg ? (
                                        <Image
                                          src={albumImg}
                                          alt={song.trackName ?? song.trackId}
                                          width={40}
                                          height={40}
                                          className="rounded-md object-cover"
                                        />
                                      ) : (
                                        <div className="size-10 rounded-md bg-gray-800" />
                                      )}
                                      <div className="text-white">
                                        <div className="text-sm">
                                          {song.trackName ?? "Unknown title"}
                                        </div>
                                        <div className="text-xs text-white/70">
                                          {song.trackArtists ??
                                            "Unknown artist"}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                                <div className="text-xs text-white/50">
                                  tap to flip back
                                </div>
                                <Link
                                  href={pl.playlistUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-white/50 hover:text-white/70"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  go to{" "}
                                  {pl.platform === PlatformEnum.SPOTIFY
                                    ? "spotify"
                                    : "apple music"}
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <SettingsPanel
              currentPlatform={platform}
              userId={userId}
              setUploadedProfilePictureUrl={setUploadedProfilePictureUrl}
              profilePictureUrl={uploadedProfilePictureUrl}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
