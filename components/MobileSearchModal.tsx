"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { IconSearch, IconStar, IconStarFilled, IconX } from "@tabler/icons-react";
import { search } from "@/services";
import { searchCache } from "@/lib/searchCache";
import { useWatchlistStore } from "@/lib/stores/watchlistStore";
import type { SearchResultItem } from "@/types";

// Contract addresses to force-show as verified even if the API omits it.
const VERIFIED_CONTRACT_ADDRESSES = new Set<string>([]);

// Recent searches — persisted so the empty state is useful on reopen.
const RECENT_KEY = "morbius.search.recent";
const MAX_RECENT = 8;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

interface MobileSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileSearchModal = ({ isOpen, onClose }: MobileSearchModalProps) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const watchTokens = useWatchlistStore((s) => s.tokens);
  const watchAdd = useWatchlistStore((s) => s.add);
  const watchRemove = useWatchlistStore((s) => s.remove);
  const isWatched = useCallback(
    (address: string) =>
      watchTokens.some(
        (t) => t.address === address.trim().toLowerCase() && t.chain === "pulsechain",
      ),
    [watchTokens],
  );

  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  // Focus input + load recent on open; reset on close.
  useEffect(() => {
    if (isOpen) {
      setRecent(readRecent());
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setSearchValue("");
    setSearchResults([]);
    setIsSearching(false);
    setSearchError(null);
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Optimized search with multi-layer caching (memory → IndexedDB → API).
  useEffect(() => {
    if (searchValue.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(searchValue);
    if (isAddress) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const memoryCachedResults = searchCache.get(searchValue);
    if (memoryCachedResults) {
      setSearchResults(memoryCachedResults.slice(0, 10));
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    let isCancelled = false;

    (async () => {
      try {
        const indexedDBResults = await searchCache.getAsync(searchValue);
        if (isCancelled) return;

        if (indexedDBResults) {
          setSearchResults(indexedDBResults.slice(0, 10));
          setIsSearching(false);
          setSearchError(null);
          return;
        }

        const timer = setTimeout(async () => {
          if (isCancelled) return;
          try {
            const results = await search(searchValue);
            if (isCancelled) return;
            searchCache.set(searchValue, results);
            setSearchResults(results.slice(0, 10));
            setSearchError(null);
          } catch (error) {
            if (isCancelled) return;
            console.error("Search error:", error);
            setSearchResults([]);
            setSearchError(error instanceof Error ? error.message : "Search failed");
          } finally {
            if (!isCancelled) setIsSearching(false);
          }
        }, 300);

        return () => {
          isCancelled = true;
          clearTimeout(timer);
        };
      } catch (error) {
        console.error("Cache check error:", error);
        if (isCancelled) return;
        try {
          const results = await search(searchValue);
          if (isCancelled) return;
          searchCache.set(searchValue, results);
          setSearchResults(results.slice(0, 10));
          setSearchError(null);
        } catch (err) {
          if (isCancelled) return;
          setSearchResults([]);
          setSearchError(err instanceof Error ? err.message : "Search failed");
        } finally {
          if (!isCancelled) setIsSearching(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [searchValue]);

  const rememberQuery = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const next = [trimmed, ...readRecent().filter((x) => x !== trimmed)].slice(0, MAX_RECENT);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // ignore quota / private-mode errors
    }
    setRecent(next);
  }, []);

  const goToToken = useCallback(
    (address: string, label?: string) => {
      if (label) rememberQuery(label);
      router.push(`/geicko?address=${address}`);
      onClose();
    },
    [router, onClose, rememberQuery],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) goToToken(searchValue.trim(), searchValue.trim());
  };

  const toggleWatch = (item: SearchResultItem) => {
    const addr = item.address;
    if (isWatched(addr)) {
      watchRemove(addr, "pulsechain");
    } else {
      watchAdd({
        address: addr,
        chain: "pulsechain",
        symbol: (item as { symbol?: string }).symbol || item.name || "???",
        name: item.name || "Unknown",
        logoURI: (item as { icon_url?: string }).icon_url || undefined,
      });
    }
  };

  if (!isOpen) return null;

  const showResults = searchValue.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute top-0 left-0 right-0 flex max-h-[88vh] flex-col bg-gradient-to-b from-[#2C3E50] to-[#1f2d3a] border-b border-orange-500/40 shadow-2xl pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-4 pb-3 border-b border-white/10"
        >
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
            <input
              ref={inputRef}
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by token name, symbol, or address…"
              className="w-full h-10 pl-9 pr-3 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="flex items-center justify-center h-10 w-10 rounded-lg bg-white/10 border border-white/20 text-white/70 hover:text-white hover:bg-white/20 transition-colors"
          >
            <IconX className="h-5 w-5" />
          </button>
        </form>

        <div className="overflow-y-auto">
          {!showResults ? (
            /* Empty state: recent searches + watchlist */
            <div className="space-y-4 p-4">
              {recent.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-white/50">Recent</div>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSearchValue(r)}
                        className="rounded border border-white/15 px-2.5 py-1 text-xs text-white/70 hover:border-white/30 hover:text-white transition-colors"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {watchTokens.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-white/50">Watchlist</div>
                  <div className="space-y-1">
                    {watchTokens.map((t) => (
                      <div
                        key={`${t.chain}:${t.address}`}
                        onClick={() => goToToken(t.address)}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5 transition-colors"
                      >
                        <IconStarFilled className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                        <span className="text-sm font-medium text-white">{t.symbol}</span>
                        <span className="truncate text-xs text-white/50">{t.name}</span>
                        <span className="ml-auto font-mono text-[11px] text-white/40">
                          0x…{t.address.slice(-4)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            watchRemove(t.address, t.chain);
                          }}
                          aria-label={`Remove ${t.symbol} from watchlist`}
                          className="text-white/40 hover:text-red-400 transition-colors"
                        >
                          <IconX className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recent.length === 0 && watchTokens.length === 0 && (
                <div className="py-10 text-center text-sm text-white/50">
                  Search any PulseChain token — by name, symbol, or address.
                </div>
              )}
            </div>
          ) : (
            /* Results */
            <div>
              {isSearching && (
                <div className="space-y-1 p-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-white/10 rounded w-3/4" />
                        <div className="h-3 bg-white/10 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!isSearching && searchError && (
                <div className="p-4 text-red-400 text-sm text-center">{searchError}</div>
              )}
              {!isSearching && searchResults.length === 0 && !searchError && (
                <div className="p-6 text-white/50 text-sm text-center">
                  No tokens found for &quot;{searchValue.trim()}&quot;
                </div>
              )}
              {!isSearching &&
                searchResults.map((item) => {
                  const symbol = (item as { symbol?: string }).symbol;
                  const iconUrl = (item as { icon_url?: string }).icon_url;
                  const watched = isWatched(item.address);
                  return (
                    <div
                      key={item.address}
                      onClick={() => goToToken(item.address, symbol || item.name)}
                      className="flex items-center gap-3 px-4 py-2.5 border-t border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <div className="relative shrink-0">
                        {iconUrl ? (
                          <img
                            src={iconUrl}
                            alt={`${item.name} logo`}
                            className="w-8 h-8 rounded-full bg-white/10"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-blue-300 font-bold text-sm">
                            {item.name?.[0] || "?"}
                          </div>
                        )}
                        {(item.is_smart_contract_verified ||
                          VERIFIED_CONTRACT_ADDRESSES.has(item.address.toLowerCase())) && (
                          <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-600 text-white text-[10px]">
                            ✓
                          </span>
                        )}
                      </div>
                      <div className="overflow-hidden flex-1">
                        <div className="font-semibold text-white truncate">
                          {item.name} {symbol && `(${symbol})`}
                        </div>
                        <div className="text-xs text-white/50 capitalize">{item.type}</div>
                        <div className="text-xs text-white/40 font-mono truncate">{item.address}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatch(item);
                        }}
                        aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
                        className={`shrink-0 transition-colors ${
                          watched ? "text-orange-400" : "text-white/40 hover:text-orange-400"
                        }`}
                      >
                        {watched ? (
                          <IconStarFilled className="h-5 w-5" />
                        ) : (
                          <IconStar className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
