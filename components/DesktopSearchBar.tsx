"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";
import { search } from "@/services/pulsechainService";
import { searchCache } from "@/lib/searchCache";
import type { SearchResultItem } from "@/types";
import { Check } from "lucide-react";

// List of contract addresses that should show as verified even if API doesn't return it
const VERIFIED_CONTRACT_ADDRESSES = new Set<string>([
  // Add verified contract addresses here (lowercase for comparison)
  // Example: '0x1234567890123456789012345678901234567890',
]);

export const DesktopSearchBar = () => {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isCachedResult, setIsCachedResult] = useState(false);

  // Optimized search effect with multi-layer caching
  useEffect(() => {
    if (searchValue.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setShowResults(false);
      setIsCachedResult(false);
      return;
    }

    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(searchValue);
    if (isAddress) {
      setSearchResults([]);
      setIsSearching(false);
      setShowResults(false);
      setIsCachedResult(false);
      return;
    }

    // Show dropdown immediately
    setShowResults(true);

    // Check in-memory cache first - INSTANT results if cached
    const memoryCachedResults = searchCache.get(searchValue);
    if (memoryCachedResults) {
      setSearchResults(memoryCachedResults.slice(0, 10));
      setIsSearching(false);
      setSearchError(null);
      setIsCachedResult(true);
      return;
    }

    // Not in memory cache - show searching state
    setIsSearching(true);
    setIsCachedResult(false);

    // Check IndexedDB cache (persists across sessions)
    let isCancelled = false;

    (async () => {
      try {
        const indexedDBResults = await searchCache.getAsync(searchValue);

        if (isCancelled) return;

        if (indexedDBResults) {
          // Found in IndexedDB - return quickly
          setSearchResults(indexedDBResults.slice(0, 10));
          setIsSearching(false);
          setSearchError(null);
          setIsCachedResult(true);
          return;
        }

        // Not in any cache - fetch from API with debounce
        const timer = setTimeout(async () => {
          if (isCancelled) return;

          try {
            const results = await search(searchValue);

            if (isCancelled) return;

            const limitedResults = results.slice(0, 10);

            // Store in both caches for next time
            searchCache.set(searchValue, results);

            setSearchResults(limitedResults);
            setSearchError(null);
          } catch (error) {
            if (isCancelled) return;

            console.error('Search error:', error);
            setSearchResults([]);
            setSearchError(error instanceof Error ? error.message : 'Search failed');
          } finally {
            if (!isCancelled) {
              setIsSearching(false);
            }
          }
        }, 300);

        return () => {
          isCancelled = true;
          clearTimeout(timer);
        };
      } catch (error) {
        console.error('Cache check error:', error);
        // Fall back to API search even if cache check fails
        if (isCancelled) return;

        const timer = setTimeout(async () => {
          if (isCancelled) return;

          try {
            const results = await search(searchValue);

            if (isCancelled) return;

            setSearchResults(results.slice(0, 10));
            setSearchError(null);
            searchCache.set(searchValue, results);
          } catch (error) {
            if (isCancelled) return;
            console.error('Search error:', error);
            setSearchResults([]);
            setSearchError(error instanceof Error ? error.message : 'Search failed');
          } finally {
            if (!isCancelled) {
              setIsSearching(false);
            }
          }
        }, 300);

        return () => {
          isCancelled = true;
          clearTimeout(timer);
        };
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [searchValue]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowResults(false);
      }
    };

    if (showResults) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showResults]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/geicko?address=${searchValue.trim()}`);
      setSearchValue("");
      setShowResults(false);
    }
  };

  const handleSelectResult = (item: SearchResultItem) => {
    router.push(`/geicko?address=${item.address}`);
    setSearchValue("");
    setShowResults(false);
    setSearchResults([]);
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="relative flex-1 search-container">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search token..."
            className="w-full h-8 px-3 pr-8 text-sm bg-gray-900/80 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500"
          />
          <button
            type="submit"
            aria-label="Search"
            title="Search"
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <IconSearch className="h-4 w-4 text-gray-400" />
          </button>
          {showResults && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl z-[9999] max-h-80 overflow-y-auto search-container">
              <div className="relative z-10">
                {isSearching && (
                  <>
                    {/* Skeleton loaders for better UX */}
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-slate-700" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-slate-700 rounded w-3/4" />
                          <div className="h-3 bg-slate-700 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {!isSearching && searchError && (
                  <div className="p-3 text-red-400 text-sm">{searchError}</div>
                )}
                {!isSearching && searchValue.length >= 2 && searchResults.length === 0 && !searchError && (
                  <div className="p-3 text-slate-400 text-sm">No tokens found for &quot;{searchValue}&quot;</div>
                )}
                {!isSearching && searchResults.map(item => (
                  <div
                    key={item.address}
                    onClick={() => handleSelectResult(item)}
                    className="flex items-center gap-3 p-3 hover:bg-slate-700/50 cursor-pointer transition-colors"
                  >
                    <div className="relative">
                      {item.icon_url ? (
                        <img src={item.icon_url} alt={`${item.name} logo`} className="w-8 h-8 rounded-full bg-slate-700" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">
                          {item.name?.[0] || '?'}
                        </div>
                      )}
                      {(item.is_smart_contract_verified || VERIFIED_CONTRACT_ADDRESSES.has(item.address.toLowerCase())) && (
                        <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-600 text-white text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <div className="font-semibold text-white truncate flex items-center gap-2">
                        {item.name} {item.symbol && `(${item.symbol})`}
                        {(item.is_smart_contract_verified || VERIFIED_CONTRACT_ADDRESSES.has(item.address.toLowerCase())) && (
                          <span className="text-green-400 text-xs font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            VERIFIED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 capitalize">{item.type}</div>
                      <div className="text-xs text-slate-500 font-mono truncate">{item.address}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
