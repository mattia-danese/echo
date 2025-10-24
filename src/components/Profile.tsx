"use client";

import { User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import NavBar from "@/components/NavBar";
import SettingsPanel from "@/components/SettingsPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Platform } from "@/db/types";
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
  userId: number;
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
  userId,
}: ProfilePageProps) {
  const [uploadedProfilePictureUrl, setUploadedProfilePictureUrl] = useState<
    string | null
  >(profilePictureUrl);
  const previewUrlRef = useRef<string | null>(null);
  const { data: friendsData } = useFriends(userId, friendsList); // initialData = SSR list
  const { toggleMute, unfriend } = useFriendMutations(userId);

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
      <NavBar userId={userId} />

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
                  <User className="text-gray-400" size={40} />
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

        {/* Name under the avatar if available */}
        <div className="text-white text-2xl text-center">
          {`${firstName} ${lastName}`.trim().toLowerCase()}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="friends" className="w-full">
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
                          <User className="text-gray-400" size={20} />
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
            <Tabs defaultValue="songs" className="w-full">
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
                    return (
                      <div key={pl.id} className="flex items-center gap-4">
                        {getPlaylistImage(pl.playlistImageUrl)}

                        <div className="text-white">
                          <Link
                            href={pl.playlistUrl}
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
