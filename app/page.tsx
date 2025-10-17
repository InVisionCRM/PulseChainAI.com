'use client';

import { Highlight } from "@/components/ui/hero-highlight";
import AIAgentsSection from "@/components/AIAgentsSection";
import LoaderThreeSection from "@/components/LoaderThreeSection";
import ColourfulText from "@/components/ui/colourful-text";
import { TopTokensList } from "@/components/TopTokensList";
import { ThreeDMarquee } from "@/components/ui/3d-marquee";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { search } from "@/services/pulsechainService";
import type { SearchResultItem } from "@/types";

export default function Home() {
  const router = useRouter();

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[] | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  // Search placeholders
  const searchPlaceholders = [
    "Search Any PulseChain Ticker",
    "Search By Name, Ticker, or Address",
    "Search for HEX...or HEX!",
    "Search for PulseChain or PLS!",
    "Try SuperStake or PSSH",
    "Bringing AI To PulseChain",
    "Bookmark PulseChainAI.com",
  ];

  // Token search with debouncing
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(searchQuery);
    if (isAddress) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await search(searchQuery);
        setSearchResults(results.slice(0, 10));
        setSearchError(null);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : 'Search failed');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle search result selection
  const handleSelectSearchResult = (item: SearchResultItem) => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    router.push(`/ai-agent?address=${item.address}`);
  };
  const appPicsImages = Array(25).fill("/LogoVector.svg");

  return (
    <div className="w-full">
      <div
        className="min-h-screen relative w-full flex flex-col items-center justify-center"
      >
        <div className="absolute inset-0 w-full h-full z-20 [mask-image:radial-gradient(transparent,white)] pointer-events-none" style={{ backgroundColor: '#0C2340' }} />

        <video
          className="absolute inset-0 w-full h-full object-cover z-0"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/hexx.mp4" type="video/mp4" />
        </video>

        {/* Search Bar at top */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-40">
          <div className="relative">
            <PlaceholdersAndVanishInput
              placeholders={searchPlaceholders}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                if (value.trim()) {
                  setShowSearchResults(true);
                } else {
                  setShowSearchResults(false);
                }
              }}
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim() && /^0x[a-fA-F0-9]{40}$/.test(searchQuery)) {
                  router.push(`/ai-agent?address=${searchQuery}`);
                }
              }}
            />
            {showSearchResults && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl z-[9999] max-h-80 overflow-y-auto">
                <div
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-lg opacity-20"
                  style={{ backgroundImage: 'url(/Mirage.jpg)' }}
                />
                <div className="relative z-10">
                  {isSearching && (
                    <div className="flex items-center justify-center p-4">
                      <div className="text-slate-400 text-sm">Searching...</div>
                    </div>
                  )}
                  {!isSearching && searchError && (
                    <div className="p-4 text-red-400 text-sm">{searchError}</div>
                  )}
                  {!isSearching && searchQuery.length >= 2 && searchResults?.length === 0 && !searchError && (
                    <div className="p-4 text-slate-400 text-sm">No tokens found for &quot;{searchQuery}&quot;</div>
                  )}
                  {!isSearching && searchResults?.map(item => (
                    <div
                      key={item.address}
                      onClick={() => handleSelectSearchResult(item)}
                      className="flex items-center gap-3 p-3 hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      {item.icon_url ?
                        <img src={item.icon_url} alt={`${item.name} logo`} className="w-8 h-8 rounded-full bg-slate-700" /> :
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-purple-400 font-bold text-sm flex-shrink-0">{item.name?.[0] || '?'}</div>
                      }
                      <div className="overflow-hidden flex-1">
                        <div className="font-semibold text-white truncate">{item.name} {item.symbol && `(${item.symbol})`}</div>
                        <div className="text-xs text-slate-400 capitalize">{item.type}</div>
                        <div className="text-xs text-slate-500 font-mono truncate">{item.address}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="relative z-30 text-center">
          <div className="flex flex-col items-center mb-6">
            <div className="relative inline-block px-6 py-3 rounded-lg" style={{ backgroundColor: '#0C2340' }}>
              <span className="text-5xl md:text-7xl lg:text-8xl font-bold" style={{ color: '#FA4616' }}>
                PULSECHAIN
              </span>
              <div className="absolute inset-0 bg-white opacity-10 rounded-lg"></div>
            </div>
            <div className="bg-white z-10 rounded inline-block -mt-[15px] overflow-hidden relative" style={{ boxShadow: "0 -4px 8px 2px rgba(0, 0, 0, 0.8)" }}>
              <div className="text-4xl md:text-6xl lg:text-7xl font-bold text-black">
                AI
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            Made by <Link href="https://superstake.win" target="_blank" className="text-blue-400 hover:text-blue-300 transition-colors">SuperStake.Win</Link>
          </p>
        </div>
      </div>
      <TopTokensList />
      <AIAgentsSection />
      <LoaderThreeSection />
      
      {/* ElevenLabs Convai AI Help Agent */}
      {/* <elevenlabs-convai agent-id="C25KqdgQbXZXGwa1OJcC"></elevenlabs-convai>
      <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="javascript"></script> */}
    </div>
  );
}
