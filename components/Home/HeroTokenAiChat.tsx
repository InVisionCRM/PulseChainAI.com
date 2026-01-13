'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import TokenAIChat from '@/components/TokenAIChat';
import { search, fetchDexScreenerData } from '@/services/pulsechainService';
import { dexscreenerApi } from '@/services';
import type { DexScreenerData, SearchResultItem } from '@/types';
import { searchCache } from '@/lib/searchCache';
// import AdminStatsPanel from '@/components/AdminStatsPanel';
import { LinkPreview } from '@/components/ui/link-preview';
import { Copy, Check } from 'lucide-react';
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';
import { useRouter } from 'next/navigation';

type LinkItem = { label?: string; url: string };
type SocialItem = { type?: string; url: string };

const SocialIcon = ({ type }: { type?: string }) => {
  const variant = (type || '').toLowerCase();
  const color = '#ffffff';
  
  if (variant.includes('telegram')) {
    return (
      <svg viewBox="0 0 24 24" fill={color} width={16} height={16}>
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    );
  }
  
  if (variant.includes('discord')) {
    return (
      <svg viewBox="0 0 24 24" fill={color} width={16} height={16}>
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    );
  }
  
  if (variant.includes('twitter') || variant.includes('x')) {
    return (
      <svg viewBox="0 0 24 24" fill={color} width={16} height={16}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    );
  }
  
  return (
    <svg viewBox="0 0 24 24" fill={color} width={16} height={16}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
};

const normalizeWebsites = (...sources: any[]): LinkItem[] => {
  const items: LinkItem[] = [];
  sources.forEach((src) => {
    if (!src) return;
    if (Array.isArray(src)) {
      src.forEach((entry) => {
        if (!entry) return;
        if (typeof entry === 'string') {
          items.push({ label: 'Website', url: entry });
        } else if (typeof entry === 'object' && entry.url) {
          items.push({
            label: entry.label || entry.title || 'Website',
            url: entry.url,
          });
        }
      });
    } else if (typeof src === 'object') {
      Object.entries(src).forEach(([label, value]) => {
        if (!value) return;
        if (typeof value === 'string') {
          items.push({ label, url: value });
        } else if (typeof value === 'object' && value.url) {
          items.push({ label, url: value.url });
        }
      });
    }
  });
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeSocials = (...sources: any[]): SocialItem[] => {
  const items: SocialItem[] = [];
  sources.forEach((src) => {
    if (!src) return;
    if (Array.isArray(src)) {
      src.forEach((entry) => {
        if (!entry) return;
        if (typeof entry === 'string') {
          items.push({ type: 'link', url: entry });
        } else if (typeof entry === 'object' && entry.url) {
          items.push({
            type: entry.type || entry.label || 'link',
            url: entry.url,
          });
        }
      });
    } else if (typeof src === 'object') {
      Object.entries(src).forEach(([type, value]) => {
        if (!value) return;
        if (typeof value === 'string') {
          items.push({ type, url: value });
        } else if (typeof value === 'object' && value.url) {
          items.push({ type, url: value.url });
        }
      });
    }
  });
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// const DEFAULT_ADDRESS = '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e';
const PLACEHOLDERS = [
  'Search by Ticker, Name, or Address...',
  'Search For pSSH...',
  'Search for Morbius...',
  'Search by Address...',
  'Make Sure To Follow Morbius.io on X!',
];

export default function HeroTokenAiChat(): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenMeta | null>(null);
  const [dexData, setDexData] = useState<DexScreenerData | null>(null);
  const [dexLoading, setDexLoading] = useState(false);
  const [dexError, setDexError] = useState<string | null>(null);
  const [tokenProfile, setTokenProfile] = useState<any | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isCachedResult, setIsCachedResult] = useState(false);
  const router = useRouter();

  // Optimized search effect with multi-layer caching
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsSearching(false);
      setShowResults(false);
      setIsCachedResult(false);
      setSearchError(null);
      return;
    }

    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(query);
    if (isAddress) {
      setResults([]);
      setIsSearching(false);
      setShowResults(false);
      setIsCachedResult(false);
      return;
    }

    // Show dropdown immediately
    setShowResults(true);

    // Check in-memory cache first - INSTANT results if cached
    const memoryCachedResults = searchCache.get(query);
    if (memoryCachedResults) {
      setResults(memoryCachedResults.slice(0, 10));
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
        const indexedDBResults = await searchCache.getAsync(query);

        if (isCancelled) return;

        if (indexedDBResults) {
          // Found in IndexedDB - return quickly
          setResults(indexedDBResults.slice(0, 10));
          setIsSearching(false);
          setSearchError(null);
          setIsCachedResult(true);
          return;
        }

        // Not in any cache - fetch from API with debounce
        const timer = setTimeout(async () => {
          if (isCancelled) return;

          try {
            const results = await search(query);

            if (isCancelled) return;

            const limitedResults = results.slice(0, 10);

            // Only cache positive results (don't cache empty arrays)
            if (results.length > 0) {
              searchCache.set(query, results);
            }

            setResults(limitedResults);
            setSearchError(null);
          } catch (error) {
            if (isCancelled) return;
            console.error('Search error:', error);
            setResults([]);
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
        if (isCancelled) return;

        const timer = setTimeout(async () => {
          if (isCancelled) return;

          try {
            const results = await search(query);

            if (isCancelled) return;

            const limitedResults = results.slice(0, 10);

            // Only cache positive results (don't cache empty arrays)
            if (results.length > 0) {
              searchCache.set(query, results);
            }

            setResults(limitedResults);
            setSearchError(null);
          } catch (error) {
            if (isCancelled) return;
            console.error('Search error:', error);
            setResults([]);
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
  }, [query]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
    },
    []
  );

  const handleSelectToken = useCallback((token: SearchResultItem) => {
    // Navigate directly to geicko page instead of showing info in chat
    router.push(`/geicko?address=${token.address}&tab=chart`);
  }, [router]);

  const handleManualSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
    if (!query.trim()) return;
    handleSelectToken({
      address: query.trim(),
      name: query.trim().slice(0, 6),
      symbol: query.trim().slice(-4),
      type: 'address',
    });
    setShowResults(false);
  },
    [handleSelectToken, query]
  );

  useEffect(() => {
    let cancelled = false;
    setDexLoading(true);
    setDexError(null);

    if (!selectedToken?.address) {
      setDexData(null);
      setTokenProfile(null);
      setDexLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const profilePromise = dexscreenerApi
      .getTokenProfile(selectedToken.address)
      .catch((err: Error) => {
        console.warn('Failed to fetch token profile:', err.message);
        return { success: false };
      });

    const dataPromise = fetchDexScreenerData(selectedToken.address).catch(
      (err: Error) => {
        throw err;
      }
    );

    Promise.all([dataPromise, profilePromise])
      .then((res) => {
        if (cancelled) return;
        const [dex, profile] = res;
        setDexData(dex?.data || null);
        if (profile && (profile as any).success === false) {
          setTokenProfile(null);
        } else {
          setTokenProfile(profile || null);
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setDexError(err.message || 'Failed to load token data');
      })
      .finally(() => {
        if (!cancelled) setDexLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedToken?.address]);

  const primaryPair = dexData?.pairs?.[0];
  const description =
    tokenProfile?.profile?.description ||
    tokenProfile?.cms?.description ||
    tokenProfile?.tokenInfo?.description ||
    tokenProfile?.info?.description ||
    primaryPair?.info?.description ||
    '';

  const websites = normalizeWebsites(
    tokenProfile?.profile?.websites,
    tokenProfile?.info?.websites,
    tokenProfile?.cms?.links,
    primaryPair?.info?.websites,
    primaryPair?.baseToken?.links?.website
      ? [{ label: 'Website', url: primaryPair.baseToken.links.website }]
      : null
  );

  const socials = normalizeSocials(
    tokenProfile?.profile?.socials,
    tokenProfile?.info?.socials,
    tokenProfile?.baseToken?.links,
    primaryPair?.info?.socials,
    primaryPair?.baseToken?.links
  );

  const analyzingLogo =
    tokenProfile?.profile?.logo ||
    tokenProfile?.profile?.imageUrl ||
    tokenProfile?.info?.logo ||
    tokenProfile?.info?.imageUrl ||
    tokenProfile?.tokenInfo?.iconUrl ||
    tokenProfile?.cms?.logo ||
    primaryPair?.info?.imageUrl ||
    primaryPair?.baseToken?.logoURI ||
    selectedToken?.logoURI ||
    selectedToken?.image;

  const renderSearchSection = (withAnalyzingCard = false) => (
    <div className="space-y-3">
      <div className="space-y-2">
        <PlaceholdersAndVanishInput
          placeholders={PLACEHOLDERS}
          onChange={handleInputChange}
          onSubmit={handleManualSubmit}
        />
        {showResults && (
          <div className="bg-white/35 border border-white/15 rounded-2xl max-h-44 overflow-y-auto text-md">
            {isSearching && (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-3 py-2 animate-pulse">
                    <div className="h-5 bg-slate-300/50 rounded w-3/4 mb-1" />
                    <div className="h-3 bg-slate-300/40 rounded w-1/2" />
                  </div>
                ))}
              </>
            )}
            {!isSearching && searchError && (
              <div className="px-3 py-2 text-red-600 text-sm">{searchError}</div>
            )}
            {!isSearching && query.length >= 2 && results.length === 0 && !searchError && (
              <div className="px-3 py-2 text-slate-900/80 text-sm">No tokens found for &quot;{query}&quot;</div>
            )}
            {!isSearching && results.map((item) => (
              <button
                key={item.address}
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-purple-900/30 transition"
                onClick={() => handleSelectToken(item)}
              >
                <div className="font-semibold text-slate-900 truncate flex items-center gap-1">
                  {item.name || item.symbol || 'Unknown'}{' '}
                  {item.symbol && item.name && (
                    <span className="text-slate-900/80 font-bold">
                      ({item.symbol})
                    </span>
                  )}
                  {item.is_smart_contract_verified && (
                    <span className="text-green-800 font-bold font-poppins flex items-center gap-1 ml-2">
                      <Check className="w-4 h-4" />
                      VERIFIED
                    </span>
                  )}
                </div>
                <div className="text-[12px] font-mono text-slate-900/80 truncate">
                  {item.address}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {withAnalyzingCard && null}
    </div>
  );

  const renderAnalyzingCard = () => {
    if (!selectedToken) return null;
    return (
      <div className="flex flex-col items-center rounded-2xl bg-white/5 border border-white/20 px-5 py-4 text-md text-slate-900/80 space-y-3">
        <div className="text-lg font-semibold text-slate-900/80 truncate max-w-full flex items-center gap-2">
          {analyzingLogo && (
            <img
              src={analyzingLogo}
              alt={`${selectedToken.name ?? 'Token'} logo`}
              className="w-8 h-8 rounded-full object-cover"
            />
          )}
          <span className="truncate">
            {selectedToken.name}{' '}
            {selectedToken.symbol && (
              <span className="text-slate-900/80 text-base">
                ({selectedToken.symbol})
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-poppins text-slate-900/80 max-w-full">
          <span>
            {selectedToken.address.slice(0, 5)}...{selectedToken.address.slice(-5)}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(selectedToken.address);
            }}
            className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
            title="Copy address"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
        {socials.length > 0 && (
          <div className="flex items-center gap-2 text-slate-900/80">
            {socials.slice(0, 3).map((social, idx) => (
              <LinkPreview
                key={`${social.url}-${idx}`}
                url={social.url}
                className="text-slate-900/80"
                width={200}
                height={120}
              >
                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition">
                  <SocialIcon type={social.type} />
                </span>
              </LinkPreview>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1 justify-center">
          <a
            href={`/geicko?address=${selectedToken.address}&tab=chart`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded bg-white/60 text-slate-900/80 text-xs font-medium hover:bg-white/80 transition"
          >
            Chart
          </a>
          <a
            href={`/geicko?address=${selectedToken.address}&tab=holders`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded bg-white/60 text-slate-900/80 text-xs font-medium hover:bg-white/80 transition"
          >
            Holders
          </a>
          <a
            href={`/geicko?address=${selectedToken.address}&tab=liquidity`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded bg-white/60 text-slate-900/80 text-xs font-medium hover:bg-white/80 transition"
          >
            Liquidity
          </a>
          <a
            href={`/geicko?address=${selectedToken.address}&tab=contract`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded bg-white/60 text-slate-900/80 text-xs font-medium hover:bg-white/80 transition"
          >
            Code
          </a>
          <a
            href={`/geicko?address=${selectedToken.address}&tab=switch`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded bg-white/60 text-slate-900/80 text-xs font-medium hover:bg-white/80 transition"
          >
            Switch
          </a>
          <a
            href={`/geicko?address=${selectedToken.address}&tab=stats`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded bg-white/60 text-slate-900/80 text-xs font-medium hover:bg-white/80 transition"
          >
            Stats
          </a>
        </div>
        <a
          href={`/geicko?address=${selectedToken.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-full bg-white/80 text-slate-900/80 text-sm font-semibold hover:bg-white transition"
        >
          View Token Page
        </a>
      </div>
    );
  };

  const renderInfoPanel = () => (
    <div className="rounded-3xl border border-white/15 bg-white/3 backdrop-blur-2xl p-3 space-y-3 text-md">
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-900/80">
        {primaryPair?.chainId?.toUpperCase() || 'PULSECHAIN'}
      </p>
      <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
        {dexLoading ? (
          <div className="text-slate-900/80 text-[16px]">Loading token data…</div>
        ) : dexError ? (
          <div className="text-red-200 text-[11px]">{dexError}</div>
        ) : primaryPair ? (
          <div className="space-y-3">
            <div>
              <div className="text-xl font-semibold flex items-baseline gap-2">
                ${Number(primaryPair.priceUsd || 0).toFixed(6)}
                <span
                  className={`text-md ${
                    (primaryPair.priceChange?.h24 || 0) >= 0
                      ? 'text-green-300'
                      : 'text-red-300'
                  }`}
                >
                  {(primaryPair.priceChange?.h24 || 0) >= 0 ? '▲' : '▼'}{' '}
                  {Math.abs(primaryPair.priceChange?.h24 || 0).toFixed(2)}%
                </span>
              </div>
              <p className="text-[16px] text-slate-900/80">
                {primaryPair.baseToken?.symbol}/{primaryPair.quoteToken?.symbol}
              </p>
            </div>
            <div className="text-[16px] grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                <p className="text-slate-900/80">Market Cap</p>
                <p className="text-md font-semibold text-slate-900/80">
                  ${Number(primaryPair.marketCap || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                <p className="text-slate-900/80">Liquidity</p>
                <p className="text-md font-semibold text-slate-900/80">
                  ${Number(primaryPair.liquidity?.usd || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                <p className="text-slate-900/80">24h Volume</p>
                <p className="text-md font-semibold text-slate-900/80">
                  ${Number(primaryPair.volume?.h24 || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                <p className="text-slate-900/80">24h Txns</p>
                <p className="text-md font-semibold text-slate-900/80">
                  {(primaryPair.txns?.h24?.buys || 0) +
                    (primaryPair.txns?.h24?.sells || 0)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-900/80 text-[16px]">
            No Dex data found for this token yet.
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-white/4 border border-white/15 p-3 text-[11px] max-h-56 overflow-y-auto space-y-2">
        <p className="text-slate-900/80 text-[16px] leading-relaxed">
          Detailed token stats are available on the right panel, while this
          left column surfaces the search + API explorer directly.
        </p>
      </div>
    </div>
  );

  return (
    <div className="relative z-20 w-full px-4 -mt-[100px] pb-16 flex justify-center overflow-hidden">
      <div className="w-full rounded-[32px] bg-gradient-to-b from-white to-gray-400/50 via-white/50 backdrop-blur-[40px] p-4 sm:p-7 text-slate-600 space-y-5 max-w-full sm:max-w-2xl overflow-hidden">
        <div className="text-center space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-500">
            <span className="text-lg sm:text-lg font-bold text-purple-600">Morbius</span>{' '}
            Token Analyzer
          </p>
          <h1 className="text-2xl sm:text-xl font-semibold leading-tight">
            Analyze any token in seconds.
          </h1>
        </div>

        <div className="space-y-4">
          {renderSearchSection(false)}
          {selectedToken && renderAnalyzingCard()}
        </div>
      </div>
    </div>
  );
}
