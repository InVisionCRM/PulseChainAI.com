'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TokenAIChat from '@/components/TokenAIChat';
import { search, fetchDexScreenerData } from '@/services/pulsechainService';
import { dexscreenerApi } from '@/services';
import type { DexScreenerData } from '@/types';
import AdminStatsPanel from '@/components/AdminStatsPanel';
import { LinkPreview } from '@/components/ui/link-preview';

type LinkItem = { label?: string; url: string };
type SocialItem = { type?: string; url: string };

const SocialIcon = ({ type }: { type?: string }) => {
  const variant = (type || '').toLowerCase();
  const color = '#ffffff';
  if (variant.includes('telegram')) {
    return (
      <svg viewBox="0 0 24 24" fill={color} width={16} height={16}>
        <path d="M4 12l6 4 9-7-11 5V4z" />
      </svg>
    );
  }
  if (variant.includes('discord')) {
    return (
      <svg viewBox="0 0 24 24" fill={color} width={16} height={16}>
        <path d="M7.91 11.35c-.18 0-.33-.16-.33-.35 0-.18.15-.34.33-.34.18 0 .33.16.33.34 0 .19-.15.35-.33.35zm8.09 0c-.18 0-.33-.16-.33-.35 0-.18.15-.34.33-.34.18 0 .33.16.33.34 0 .19-.15.35-.33.35z" />
        <path d="M8.12 4.5S7.4 5.7 9 6.5l.3-.4c-1.2.4-2.4.9-3.5 1.4-.1 1.7.5 4.6 4.4 5.2.2-.2.4-.3.6-.4l.2-.3c-1.1-.3-2.3-.7-3.3-1.2.2-.2.4-.3.6-.4 1.2-.4 2.6-.8 3.8-1.2l.1-.2c1.9-.8 2.7-2.2 2.7-2.2 1.3 1 2.8 2 4.1 2 .1-1.3-.4-2.6-1.2-3.7 0 0-1-1.2-1.8-1.4-.1 0-.6-.1-1.4.7-.4.4 1.2-1 1.1-.9-1.3-1.3-3.3-1.2-4.3-1.1-.2 0-.5.1-.6.2-1.1-.2-2.6-.5-4.2 1.1-.3.3.7-1 .6-1.1-.1 0-.1.1-.1.5" />
      </svg>
    );
  }
  if (variant.includes('twitter') || variant.includes('x')) {
    return (
      <svg viewBox="0 0 24 24" fill={color} width={16} height={16}>
        <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53A4.48 4.48 0 0 0 16 3a4.48 4.48 0 0 0-4.5 4.5c0 .35.04.7.12 1.03A12.7 12.7 0 0 1 3 4S-.07 13 8 17a9 9 0 0 1-5 1.5A9.25 9.25 0 0 1 0 18.19a12.8 12.8 0 0 0 7 2.08c8.5 0 13-7.12 13-13v-.59A9.22 9.22 0 0 0 23 3z" />
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

const DEFAULT_ADDRESS = '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e';
const PLACEHOLDERS = [
  'Search any PulseChain ticker',
  'Paste a contract address',
  'Try HEX, PLS, or meme coins',
];

type SearchResult = {
  address: string;
  name: string;
  symbol: string;
  type?: string;
};

export default function HeroTokenAiChat(): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [selectedToken, setSelectedToken] = useState<TokenMeta | null>(null);
  const [dexData, setDexData] = useState<DexScreenerData | null>(null);
  const [dexLoading, setDexLoading] = useState(false);
  const [dexError, setDexError] = useState<string | null>(null);
  const [tokenProfile, setTokenProfile] = useState<any | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const activePlaceholder = useMemo(
    () => PLACEHOLDERS[placeholderIndex % PLACEHOLDERS.length],
    [placeholderIndex]
  );

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const executeSearch = useCallback(
    async (value: string) => {
      if (value.trim().length < 2) {
        setResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
    try {
      const res = await search(value.trim());
      setResults(res || []);
      setShowResults((res || []).length > 0);
    } finally {
      setIsSearching(false);
    }
    },
    []
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (!value.trim()) {
        setResults([]);
        setIsSearching(false);
        setShowResults(false);
        return;
      }
      searchTimeoutRef.current = setTimeout(() => executeSearch(value), 350);
      setShowResults(true);
    },
    [executeSearch]
  );

  const handleSelectToken = useCallback((token: SearchResult) => {
    setSelectedToken({
      address: token.address,
      name: token.name || token.symbol || 'Token',
      symbol: token.symbol || token.name || '',
    });
    setQuery('');
    setResults([]);
    setPlaceholderIndex((prev) => prev + 1);
    setIsCollapsed(false);
    setShowResults(false);
  }, []);

  const handleManualSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
    if (!query.trim()) return;
    handleSelectToken({
      address: query.trim(),
      name: query.trim().slice(0, 6),
      symbol: query.trim().slice(-4),
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
      <form onSubmit={handleManualSubmit} className="space-y-2">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={activePlaceholder}
            inputMode="text"
            className="w-full rounded-2xl bg-white/5 border border-white/20 px-4 py-2 text-xs placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-xl text-[11px] bg-white/80 text-purple-900 font-semibold shadow"
          >
            Load
          </button>
        </div>
        {isSearching && (
          <div className="text-[11px] text-white/70">Searching…</div>
        )}
        {showResults && results.length > 0 && (
          <div className="bg-white/5 border border-white/15 rounded-2xl max-h-44 overflow-y-auto text-xs">
            {results.map((item) => (
              <button
                key={item.address}
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-white/10 transition"
                onClick={() => handleSelectToken(item)}
              >
                <div className="font-semibold text-white/90 truncate">
                  {item.name || item.symbol || 'Unknown'}{' '}
                  {item.symbol && item.name && (
                    <span className="text-white/60 font-normal">
                      ({item.symbol})
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-mono text-white/60 truncate">
                  {item.address}
                </div>
              </button>
            ))}
          </div>
        )}
      </form>

      {withAnalyzingCard && null}
    </div>
  );

  const renderAnalyzingCard = () => {
    if (!selectedToken) return null;
    return (
      <div className="inline-flex flex-col items-center rounded-2xl bg-white/5 border border-white/20 px-5 py-4 text-xs text-white/80 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">
          Now analyzing
        </p>
        <div className="text-base font-semibold text-white truncate max-w-full flex items-center gap-2">
          {analyzingLogo && (
            <img
              src={analyzingLogo}
              alt={`${selectedToken.name ?? 'Token'} logo`}
              className="w-6 h-6 rounded-full object-cover"
            />
          )}
          <span className="truncate">
            {selectedToken.name}{' '}
            {selectedToken.symbol && (
              <span className="text-white/70 text-sm">
                ({selectedToken.symbol})
              </span>
            )}
          </span>
        </div>
        <div className="text-[11px] font-mono text-white/70 truncate max-w-full">
          {selectedToken.address}
        </div>
        <div className="flex items-center gap-2 text-white/70">
          {socials.slice(0, 3).map((social, idx) => (
            <LinkPreview
              key={`${social.url}-${idx}`}
              url={social.url}
              className="text-white/80"
              width={200}
              height={120}
            >
              <span className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 border border-white/20">
                <SocialIcon type={social.type} />
              </span>
            </LinkPreview>
          ))}
        </div>
        <Link
          href={`/geicko?address=${selectedToken.address}`}
          className="px-3 py-1.5 rounded-full bg-white/80 text-purple-900 text-[11px] font-semibold hover:bg-white transition"
        >
          View Token Page
        </Link>
      </div>
    );
  };

  const renderInfoPanel = () => (
    <div className="rounded-3xl border border-white/15 bg-white/3 backdrop-blur-2xl p-3 space-y-3 text-xs">
      <p className="text-[10px] uppercase tracking-[0.3em] text-white/70">
        {primaryPair?.chainId?.toUpperCase() || 'PULSECHAIN'}
      </p>
      <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
        {dexLoading ? (
          <div className="text-white/70 text-[11px]">Loading token data…</div>
        ) : dexError ? (
          <div className="text-red-200 text-[11px]">{dexError}</div>
        ) : primaryPair ? (
          <div className="space-y-3">
            <div>
              <div className="text-xl font-semibold flex items-baseline gap-2">
                ${Number(primaryPair.priceUsd || 0).toFixed(6)}
                <span
                  className={`text-xs ${
                    (primaryPair.priceChange?.h24 || 0) >= 0
                      ? 'text-green-300'
                      : 'text-red-300'
                  }`}
                >
                  {(primaryPair.priceChange?.h24 || 0) >= 0 ? '▲' : '▼'}{' '}
                  {Math.abs(primaryPair.priceChange?.h24 || 0).toFixed(2)}%
                </span>
              </div>
              <p className="text-[11px] text-white/70">
                {primaryPair.baseToken?.symbol}/{primaryPair.quoteToken?.symbol}
              </p>
            </div>
            <div className="text-[11px] grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                <p className="text-white/60">Market Cap</p>
                <p className="text-sm font-semibold">
                  ${Number(primaryPair.marketCap || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                <p className="text-white/60">Liquidity</p>
                <p className="text-sm font-semibold">
                  ${Number(primaryPair.liquidity?.usd || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                <p className="text-white/60">24h Volume</p>
                <p className="text-sm font-semibold">
                  ${Number(primaryPair.volume?.h24 || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                <p className="text-white/60">24h Txns</p>
                <p className="text-sm font-semibold">
                  {(primaryPair.txns?.h24?.buys || 0) +
                    (primaryPair.txns?.h24?.sells || 0)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-white/70 text-[11px]">
            No Dex data found for this token yet.
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-white/4 border border-white/15 p-3 text-[11px] max-h-56 overflow-y-auto space-y-2">
        <p className="text-white/70 text-[11px] leading-relaxed">
          Detailed token stats are available on the right panel, while this
          left column surfaces the search + API explorer directly.
        </p>
      </div>
    </div>
  );

  return (
    <div className="relative z-20 w-full px-4 pt-24 pb-16 flex justify-center overflow-hidden">
      <div
        className="w-full rounded-[32px] border border-white/15 bg-white/4 shadow-[0_35px_120px_rgba(0,0,0,0.45)] backdrop-blur-[40px] p-4 sm:p-7 text-white space-y-5 max-w-full sm:max-w-[60rem] overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-xs uppercase tracking-[0.4em] text-white/70">
              <span className="text-sm sm:text-base font-semibold text-purple-700">Morbius</span>{' '}
              Token Analyzer
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
              Analyze any token in seconds.
            </h1>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 items-start">
          <div className="space-y-4 min-w-0">
            {renderSearchSection(false)}
            <div className="relative z-50 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-2xl p-3">
              <AdminStatsPanel
                initialAddress={selectedToken?.address || DEFAULT_ADDRESS}
                compact
                variant="hero"
                tokenSymbol={selectedToken?.symbol}
              />
            </div>
          </div>
          <div className="rounded-[28px] border border-white/15 bg-white/4 backdrop-blur-2xl p-4 sm:p-5 flex flex-col items-center gap-4 min-w-0 w-full">
            {renderAnalyzingCard()}
            <div className="w-full min-w-0">
              {selectedToken ? (
                <TokenAIChat
                  key={selectedToken.address}
                  contractAddress={selectedToken.address}
                  compact
                />
              ) : (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center text-white/70">
                  Select a token to load the AI assistant.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
