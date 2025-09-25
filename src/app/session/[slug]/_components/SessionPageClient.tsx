"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Hero from "../../../../components/Hero";
import { useDebounce } from "@/components/Debounce";
import { useState, useEffect } from "react";
import { searchSpotifyTracks, submitSong } from "../../../actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Image from "next/image";

export interface SessionPageClientProps {
    error: boolean;
    topSongs: {
        title: string;
        trackId: string;
        albumImageUrl: string;
        artists: string;
    }[];
    sessionEndsAt: string;
    alreadySubmitted: boolean;
    token: string;
}

export default function SessionPageClient({ 
    error, 
    topSongs, 
    sessionEndsAt, 
    alreadySubmitted,
    token
}: SessionPageClientProps) 
{
    const [spotifySearch, setSpotifySearch] = useState('');
    const [selectedSong, setSelectedSong] = useState<{
        trackId: string;
        title: string;
        artists: string;
        albumImageUrl: string;
    } | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [searchResults, setSearchResults] = useState<{
        trackId: string;
        title: string;
        artists: string;
        albumImageUrl: string;
    }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [submitError, setSubmitError] = useState(false);
    
    // Debounce the search input
    const debouncedSearch = useDebounce(spotifySearch, 500);

    const sessionActive = new Date() < new Date(sessionEndsAt);

    const handleSubmitSongSelection = async () => {
        if (selectedSong) {
            
            const result = await submitSong({
                token: token,
                spotify_track_id: selectedSong.trackId
            });
            
            if (result.ok) {
                setIsSubmitted(true);
            } else {
                console.error('Error submitting song:', result.message);
                setSubmitError(true);
            }
        }
    }

    const handleSongSelect = (trackId: string, title: string, artists: string, albumImageUrl: string) => {
        setSelectedSong({ trackId, title, artists, albumImageUrl });
        setIsPopoverOpen(false); // Close popover when song is selected
    }

    // Effect to handle debounced search
    useEffect(() => {
        const performSearch = async () => {
            if (debouncedSearch.trim().length >= 2) {
                setIsSearching(true);
                setSearchError(false);
                
                try {
                    const result = await searchSpotifyTracks(debouncedSearch);
                    
                    if (result.ok) {
                        setSearchResults(result.tracks);
                    } else {
                        console.error('Search failed:', result.message);
                        setSearchResults([]);
                    }
                } catch (error) {
                    console.error('Error searching:', error);
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
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
                <main className="flex flex-col items-center gap-8 max-w-md w-full">
                    <Hero />
                    <div className="text-white text-center">
                        there was an error loading this page :( please try again later or contact support
                    </div>
                </main>
            </div>
        );
    }

    if (submitError) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
                <main className="flex flex-col items-center gap-8 max-w-md w-full">
                    <Hero />
                    <div className="text-white text-center">
                        there was an error submitting your song :( please try again later or contact support
                    </div>
                </main>
            </div>
        );
    }

    if (!sessionActive) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
                <main className="flex flex-col items-center gap-8 max-w-md w-full">
                    <Hero />
                    <div className="text-white text-center">
                        this echo session ended at {sessionEndsAt.toLocaleString()} :(
                    </div>
                </main>
            </div>
        );
    }

    if (alreadySubmitted) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
                <main className="flex flex-col items-center gap-8 max-w-md w-full">
                    <Hero />
                    <div className="text-white text-center">
                        you already submitted a song for this echo session :)
                    </div>
                </main>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
                <main className="flex flex-col items-center gap-8 max-w-md w-full">
                    <Hero />
                    <div className="text-white text-2xl text-center">
                        thank you for sharing a song :)
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
            <main className="flex flex-col items-center gap-8 max-w-md w-full">
                <Hero showText={false} />

                <div className="text-white text-2xl text-center">
                    share your song of the moment
                </div>

                {/* Selected song display or skeleton */}
                <div className="w-full flex items-center gap-4 px-4 py-3">
                    {selectedSong ? (
                        <>
                            <Image
                                src={selectedSong.albumImageUrl}
                                alt={selectedSong.title}
                                width={64}
                                height={64}
                                className="h-16 w-16 rounded-lg object-cover"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-lg font-medium text-white">{selectedSong.title}</div>
                                <div className="truncate text-sm text-gray-400">{selectedSong.artists}</div>
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
                            id='spotifySearch'
                            type='text'
                            placeholder={isSearching ? 'searching...' : 'search a song ...'}
                            value={spotifySearch}
                            onChange={(e) => setSpotifySearch(e.target.value)}
                            className="border-0 border-b border-white bg-transparent text-white placeholder-gray-500 focus:border-white focus:ring-0 rounded-none w-full"
                        />
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-black text-white border border-white/20">
                        <div className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-track-black scrollbar-thumb-gray-600">
                            {searchResults.map((result) => (
                                <div
                                    key={result.trackId}
                                    className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 cursor-pointer transition-colors duration-150"
                                    onClick={() => handleSongSelect(result.trackId, result.title, result.artists, result.albumImageUrl)}
                                >
                                    <Image
                                        src={result.albumImageUrl}
                                        alt={result.title}
                                        width={40}
                                        height={40}
                                        className="h-10 w-10 rounded-sm object-cover"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">{result.title}</div>
                                        <div className="truncate text-xs text-gray-400">{result.artists}</div>
                                    </div>
                                </div>
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
                            onClick={() => handleSongSelect(song.trackId, song.title, song.artists, song.albumImageUrl)}
                            className={`flex flex-col items-center gap-1.5 p-1.5 rounded-lg transition-all ${
                                selectedSong?.trackId === song.trackId 
                                    ? 'border-2 border-white' 
                                    : 'border-2 border-transparent'
                            }`}
                        >
                            <Image
                                src={song.albumImageUrl}
                                alt={`${song.title} album cover`}
                                width={200}
                                height={200}
                                className="w-full aspect-square object-cover rounded-lg"
                            />
                            <span className="text-white text-sm text-center">{song.title}</span>
                        </button>
                    ))}
                </div>

                {/* Send button */}
                <Button
                    onClick={handleSubmitSongSelection}
                    disabled={!selectedSong}
                    className="w-full bg-white text-black hover:bg-gray-100 font-medium"
                >
                    send
                </Button>
            </main>
        </div>
    )
}