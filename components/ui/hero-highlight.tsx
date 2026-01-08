"use client";
import { cn } from "@/lib/utils";
import { useMotionValue, motion, useMotionTemplate } from "framer-motion";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ThreeDMarquee } from "./3d-marquee";
import { PlaceholdersAndVanishInput } from "./placeholders-and-vanish-input";
import { search } from "@/services/pulsechainService";
import type { SearchResultItem } from "@/types";

export const HeroHighlight = ({
  children,
  className,
  containerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) => {
  const appPicsImages = Array(25).fill("/LogoVector.svg");
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
    "Bookmark Morbius.io",
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

  return (
    <div
      className={cn(
        "group relative flex w-full items-center justify-center bg-white dark:bg-slate-950",
        containerClassName,
      )}
      style={{
        background: 'transparent',
      }}
    >
      <div className="absolute inset-0 z-0">
        <ThreeDMarquee images={appPicsImages} className="h-full w-full" />
      </div>

      {/* Search Bar at top */}
      {/* <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-30">
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
                    <div className="relative">
                      {item.icon_url ?
                        <img src={item.icon_url} alt={`${item.name} logo`} className="w-8 h-8 rounded-full bg-slate-700" /> :
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">{item.name?.[0] || '?'}</div>
                      }
                      {item.is_smart_contract_verified && (
                        <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-600 text-white text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
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
      </div> */}

      <div className={cn("relative z-20", className)}>{children}</div>
    </div>
  );
};

export const Highlight = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <motion.span
      initial={{
        backgroundSize: "0% 100%",
      }}
      animate={{
        backgroundSize: "100% 100%",
      }}
      transition={{
        duration: 2,
        ease: "linear",
        delay: 0.5,
      }}
      style={{
        backgroundRepeat: "no-repeat",
        backgroundPosition: "left center",
        display: "inline",
      }}
      className={cn(
        `relative inline-block rounded-lg bg-gradient-to-r from-indigo-300 to-blue-300 from-cyan-300 to-cyan-800 px-1 pb-1 dark:from-indigo-500 dark:to-blue-500`,
        className,
      )}
    >
      {children}
    </motion.span>
  );
};
