"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import {
  completeOnboarding,
  searchPlatformTracks,
  submitSong,
} from "@/app/actions";
import { useDebounce } from "@/components/Debounce";
import Hero from "@/components/Hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Platform } from "@/db/types";
import type { SearchResultTrack } from "@/types";

export interface SessionPageClientProps {
  error: boolean;
  topSongs: {
    title: string;
    trackId: string;
    albumImageUrl: string;
    artists: string;
    trackPlatform: Platform;
  }[];
  platform: Platform;
  sessionEndsAt: string;
  alreadySubmitted: boolean;
  token: string;
  isOnboarding: boolean;
  userId: number;
  sessionId?: number; // Optional - only needed for non-onboarding sessions
  platformAccessToken?: string;
}

function resolveAppleArtwork(urlTemplate: string, size: number) {
  return urlTemplate.replace("{w}", String(size)).replace("{h}", String(size));
}

export default function SessionPageClient({
  error,
  topSongs,
  platform,
  sessionEndsAt,
  alreadySubmitted,
  token,
  isOnboarding,
  userId,
  sessionId,
  platformAccessToken,
}: SessionPageClientProps) {
  const [search, setSearch] = useState("");
  const [selectedSong, setSelectedSong] = useState<SearchResultTrack | null>(
    null,
  );
  const searchId = useId();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce the search input
  const debouncedSearch = useDebounce(search, 500);

  const sessionActive = new Date() < new Date(sessionEndsAt);

  const handleSubmitSongSelection = async () => {
    if (!selectedSong) {
      console.error("Error submitting song: no song selected");
      setSubmitError(true);
      return;
    }

    setIsSubmitting(true);

    try {
      if (isOnboarding) {
        const result = await completeOnboarding({
          userId: userId,
          onboardingToken: token,
          platform: selectedSong.trackPlatform,
          trackName: selectedSong.trackName,
          artists: selectedSong.artists,
          spotifyAccessToken:
            selectedSong.trackPlatform === Platform.SPOTIFY
              ? platformAccessToken
              : undefined,
        });

        if (result.ok) {
          setIsSubmitted(true);
        } else {
          console.error("Error completing onboarding:", result.message);
          setSubmitError(true);
        }

        return;
      }

      const result = await submitSong({
        userId: userId,
        token: token,
        platform: selectedSong.trackPlatform,
        trackId: selectedSong.trackId,
        trackName: selectedSong.trackName,
        artists: selectedSong.artists,
        albumImageUrl: selectedSong.albumImageUrl,
        sessionId: sessionId!, // Safe to use ! here because submitSong is only called when not onboarding
        platformAccessToken: platformAccessToken || undefined,
      });

      if (result.ok) {
        setIsSubmitted(true);
      } else {
        console.error("Error submitting song:", result.message);
        setSubmitError(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSongSelect = (
    trackId: string,
    trackName: string,
    artists: string,
    albumImageUrl: string,
    trackPlatform: Platform,
  ) => {
    setSelectedSong({
      trackId,
      trackName,
      artists,
      albumImageUrl,
      trackPlatform,
    });
    setIsPopoverOpen(false); // Close popover when song is selected
  };

  // Effect to handle debounced search
  // biome-ignore lint/correctness/useExhaustiveDependencies: platform does not change
  useEffect(() => {
    const performSearch = async () => {
      if (debouncedSearch.trim().length >= 2) {
        setIsSearching(true);
        setSearchError(false);

        try {
          const result = await searchPlatformTracks(
            platform,
            debouncedSearch,
            platformAccessToken || undefined,
          );

          if (result.ok) {
            setSearchResults(result.tracks);
            setIsPopoverOpen(true);
          } else {
            console.error("Search failed:", result.message);
            setSearchResults([]);
          }
        } catch (error) {
          console.error("Error searching:", error);
          setSearchResults([]);
          setSearchError(true);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    };

    performSearch();
  }, [debouncedSearch]);

  if (error) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center p-8 min-h-screen">
        <main className="flex flex-col items-center gap-8 max-w-md w-full">
          <Hero />
          <div className="text-white text-center">
            there was an error loading this page :( please try again later or
            contact support
          </div>
        </main>
      </div>
    );
  }

  if (submitError) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center p-8 min-h-screen">
        <main className="flex flex-col items-center gap-8 max-w-md w-full">
          <Hero />
          <div className="text-white text-center">
            there was an error submitting your song :( please try again later or
            contact support
          </div>
        </main>
      </div>
    );
  }

  if (!sessionActive && !isOnboarding) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center p-8 min-h-screen">
        <main className="flex flex-col items-center gap-8 max-w-md w-full">
          <Hero />
          <div className="text-white text-center">
            this echo session ended at {(() => {
              const date = new Date(sessionEndsAt);
              return `${date.toLocaleDateString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
              })} at ${date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}`;
            })()}
          </div>
        </main>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center p-8 min-h-screen">
        <main className="flex flex-col items-center gap-8 max-w-md w-full">
          <Hero />
          <div className="text-white text-center">
            {isOnboarding
              ? "you already completed onboarding :)"
              : "you already submitted a song for this echo session :)"}
          </div>
        </main>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center p-8 min-h-screen">
        <main className="flex flex-col items-center gap-8 max-w-md w-full">
          <Hero />
          {isOnboarding ? (
            <>
              <div className="text-white text-center">
                thank you for sharing a song.
                <br />
                go back to your text messages to see the songs your friends
                shared
              </div>
              <Button
                className="mt-4 bg-white text-black hover:bg-gray-200"
                onClick={() => {
                  window.location.href = `sms:${process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER}`;
                }}
                type="button"
                variant="default"
              >
                open texts
              </Button>
            </>
          ) : (
            "thank you for sharing a song :)"
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-center p-8 min-h-screen">
      <main className="flex flex-col items-center gap-8 max-w-md w-full">
        <Hero showText={false} />

        {/* Selected song display or skeleton */}
        <div className="w-full flex items-center gap-4 px-4 py-3 h-16">
          {selectedSong ? (
            <>
              <Image
                src={
                  selectedSong.trackPlatform === Platform.APPLE_MUSIC
                    ? resolveAppleArtwork(selectedSong.albumImageUrl, 64)
                    : selectedSong.albumImageUrl
                }
                alt={selectedSong.trackName}
                width={64}
                height={64}
                className="h-16 w-16 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-medium text-white">
                  {selectedSong.trackName}
                </div>
                <div className="truncate text-sm text-gray-400">
                  {selectedSong.artists}
                </div>
              </div>
            </>
          ) : (
            <div className="text-white text-2xl text-center">
              {isOnboarding
                ? "share your first song to complete your onboarding :)"
                : "share your song of the moment"}
            </div>
          )}
        </div>

        {/* Search input */}
        <div className="w-full relative">
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Input
                id={searchId}
                type="text"
                placeholder={isSearching ? "searching..." : "search a song ..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 border-b border-white bg-transparent text-white placeholder-gray-500 focus:border-white focus:ring-0 rounded-none w-full"
              />
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-black text-white border border-white/20">
              <div className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-track-black scrollbar-thumb-gray-600">
                {searchResults.map((result) => (
                  <button
                    key={result.trackId}
                    type="button"
                    className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 cursor-pointer transition-colors duration-150 text-left w-full"
                    onClick={() =>
                      handleSongSelect(
                        result.trackId,
                        result.trackName,
                        result.artists,
                        result.albumImageUrl,
                        platform,
                      )
                    }
                    // onKeyDown={(e) => {
                    //   if (e.key === "Enter" || e.key === " ") {
                    //     e.preventDefault();
                    //     handleSongSelect(
                    //       result.trackId,
                    //       result.trackName,
                    //       result.artists,
                    //       result.albumImageUrl,
                    //     );
                    //   }
                    // }}
                  >
                    <Image
                      src={
                        result.trackPlatform === Platform.APPLE_MUSIC
                          ? resolveAppleArtwork(result.albumImageUrl, 40)
                          : result.albumImageUrl
                      }
                      alt={result.trackName}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-sm object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {result.trackName}
                      </div>
                      <div className="truncate text-xs text-gray-400">
                        {result.artists}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {isSearching && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <Spinner className="size-4 text-teal-400" />
            </div>
          )}
          {searchError && (
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
              <div className="text-red-500 text-sm">error searching</div>
            </div>
          )}
        </div>

        {topSongs.length > 0 && (
          <div className="text-white text-sm text-center">
            {platform === Platform.SPOTIFY
              ? "suggested from your previously shared songs"
              : "here are the songs you played recently"}
          </div>
        )}

        {/* Album covers grid */}
        <div className="grid grid-cols-2 gap-3 w-full">
          {topSongs.map((song) => (
            <button
              key={song.trackId}
              type="button"
              onClick={() =>
                handleSongSelect(
                  song.trackId,
                  song.title,
                  song.artists,
                  song.albumImageUrl,
                  song.trackPlatform,
                )
              }
              className={`flex flex-col items-center gap-1.5 p-1.5 rounded-lg transition-all ${
                selectedSong?.trackId === song.trackId
                  ? "border-2 border-white"
                  : "border-2 border-transparent"
              }`}
            >
              <Image
                src={
                  song.trackPlatform === Platform.APPLE_MUSIC
                    ? resolveAppleArtwork(song.albumImageUrl, 200)
                    : song.albumImageUrl
                }
                alt={`${song.title} album cover`}
                width={200}
                height={200}
                className="w-full aspect-square object-cover rounded-lg"
              />
              <span className="text-white text-sm text-center">
                {song.title}
              </span>
            </button>
          ))}
        </div>

        {/* Send button */}
        <Button
          onClick={handleSubmitSongSelection}
          disabled={!selectedSong || isSubmitting}
          className="w-full bg-white text-black hover:bg-gray-100 font-medium mb-8"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <Spinner className="size-4" />
            </div>
          ) : (
            "send"
          )}
        </Button>
      </main>
    </div>
  );
}
