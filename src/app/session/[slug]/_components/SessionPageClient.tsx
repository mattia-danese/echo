"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { useDebounce } from "@/components/Debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResultTrack } from "@/types";
import Hero from "../../../../components/Hero";
import {
  completeOnboarding,
  searchPlatformTracks,
  submitSong,
} from "../../../actions";

export interface SessionPageClientProps {
  error: boolean;
  topSongs: {
    title: string;
    trackId: string;
    albumImageUrl: string;
    artists: string;
  }[];
  platform: string;
  sessionEndsAt: string;
  alreadySubmitted: boolean;
  token: string;
  isOnboarding: boolean;
}

export default function SessionPageClient({
  error,
  topSongs,
  platform,
  sessionEndsAt,
  alreadySubmitted,
  token,
  isOnboarding,
}: SessionPageClientProps) {
  const [spotifySearch, setSpotifySearch] = useState("");
  const [selectedSong, setSelectedSong] = useState<SearchResultTrack | null>(
    null,
  );
  const spotifySearchId = useId();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  // Debounce the search input
  const debouncedSearch = useDebounce(spotifySearch, 500);

  const sessionActive = new Date() < new Date(sessionEndsAt);

  const handleSubmitSongSelection = async () => {
    if (!selectedSong) {
      console.error("Error submitting song: no song selected");
      setSubmitError(true);
      return;
    }

    if (isOnboarding) {
      const result = await completeOnboarding({
        onboarding_token: token,
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
      token: token,
      track_id: selectedSong.track_id,
    });

    if (result.ok) {
      setIsSubmitted(true);
    } else {
      console.error("Error submitting song:", result.message);
      setSubmitError(true);
    }
  };

  const handleSongSelect = (
    track_id: string,
    track_name: string,
    artists: string,
    album_image_url: string,
  ) => {
    setSelectedSong({ track_id, track_name, artists, album_image_url });
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
          const result = await searchPlatformTracks(platform, debouncedSearch);

          if (result.ok) {
            setSearchResults(result.tracks);
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
      <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
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
      <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
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
      <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
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
            })()} :(
          </div>
        </main>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
        <main className="flex flex-col items-center gap-8 max-w-md w-full">
          <Hero />
          <div className="text-white text-center">
            {isOnboarding
              ? "you already completed the onboarding :)"
              : "you already submitted a song for this echo session :)"}
          </div>
        </main>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
        <main className="flex flex-col items-center gap-8 max-w-md w-full">
          <Hero />
          <div className="text-white text-2xl text-center">
            {isOnboarding ? (
              <>
                thank you for sharing a song.
                <br />
                go back to your text messages to see the songs your friends
                shared :)
              </>
            ) : (
              "thank you for sharing a song :)"
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 max-w-md w-full">
        <Hero showText={false} />

        <div className="text-white text-2xl text-center">
          {isOnboarding
            ? "share your first song to complete your onboarding :)"
            : "share your song of the moment"}
        </div>

        {/* Selected song display or skeleton */}
        <div className="w-full flex items-center gap-4 px-4 py-3">
          {selectedSong ? (
            <>
              <Image
                src={selectedSong.album_image_url}
                alt={selectedSong.track_name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-medium text-white">
                  {selectedSong.track_name}
                </div>
                <div className="truncate text-sm text-gray-400">
                  {selectedSong.artists}
                </div>
              </div>
            </>
          ) : (
            <>
              <Skeleton className="h-16 w-16 rounded-lg bg-gray-800" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4 bg-gray-800" />
                <Skeleton className="h-4 w-1/2 bg-gray-800" />
              </div>
            </>
          )}
        </div>

        {/* Spotify search input */}
        <div className="w-full relative">
          <Popover
            open={isPopoverOpen && searchResults.length > 0}
            onOpenChange={setIsPopoverOpen}
          >
            <PopoverTrigger asChild>
              <Input
                id={spotifySearchId}
                type="text"
                placeholder={isSearching ? "searching..." : "search a song ..."}
                value={spotifySearch}
                onChange={(e) => setSpotifySearch(e.target.value)}
                className="border-0 border-b border-white bg-transparent text-white placeholder-gray-500 focus:border-white focus:ring-0 rounded-none w-full"
              />
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-black text-white border border-white/20">
              <div className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-track-black scrollbar-thumb-gray-600">
                {searchResults.map((result) => (
                  <button
                    key={result.track_id}
                    type="button"
                    className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 cursor-pointer transition-colors duration-150"
                    onClick={() =>
                      handleSongSelect(
                        result.track_id,
                        result.track_name,
                        result.artists,
                        result.album_image_url,
                      )
                    }
                    // onKeyDown={(e) => {
                    //   if (e.key === "Enter" || e.key === " ") {
                    //     e.preventDefault();
                    //     handleSongSelect(
                    //       result.track_id,
                    //       result.track_name,
                    //       result.artists,
                    //       result.album_image_url,
                    //     );
                    //   }
                    // }}
                  >
                    <Image
                      src={result.album_image_url}
                      alt={result.track_name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-sm object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {result.track_name}
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
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            </div>
          )}
          {searchError && (
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
              <div className="text-red-500 text-sm">error searching</div>
            </div>
          )}
        </div>

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
                )
              }
              className={`flex flex-col items-center gap-1.5 p-1.5 rounded-lg transition-all ${
                selectedSong?.track_id === song.trackId
                  ? "border-2 border-white"
                  : "border-2 border-transparent"
              }`}
            >
              <Image
                src={song.albumImageUrl}
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
          disabled={!selectedSong}
          className="w-full bg-white text-black hover:bg-gray-100 font-medium mb-8"
        >
          send
        </Button>
      </main>
    </div>
  );
}
