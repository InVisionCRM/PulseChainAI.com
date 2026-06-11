'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSearch, IconStar, IconStarFilled, IconX } from '@tabler/icons-react';
import type { SearchPair } from '@/lib/screener/types';
import { dexLogo, dexName, fmtAge, fmtPct, fmtPrice, fmtUsd, pctClass, shortAddr } from './format';

const RECENT_KEY = 'screener.recent';
const FAVS_KEY = 'screener.favs';
const MAX_RECENT = 8;

interface Favorite {
  pairAddress: string;
  baseAddress: string;
  baseSymbol: string;
  quoteSymbol: string | null;
  dexId: string | null;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchModal({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchPair[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [favs, setFavs] = useState<Favorite[]>([]);

  useEffect(() => {
    if (open) {
      setRecent(readJson<string[]>(RECENT_KEY, []));
      setFavs(readJson<Favorite[]>(FAVS_KEY, []));
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setResults([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setError(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const json = await res.json();
        setResults(json.pairs ?? []);
        setError(null);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Search failed — try again.');
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, open]);

  const rememberQuery = useCallback((q: string) => {
    const next = [q, ...readJson<string[]>(RECENT_KEY, []).filter((x) => x !== q)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setRecent(next);
  }, []);

  const openPair = useCallback(
    (p: SearchPair) => {
      rememberQuery(p.baseSymbol);
      onClose();
      router.push(`/geicko?address=${p.baseAddress}`);
    },
    [onClose, rememberQuery, router],
  );

  const toggleFav = useCallback((p: SearchPair, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = readJson<Favorite[]>(FAVS_KEY, []);
    const exists = current.some((f) => f.pairAddress === p.pairAddress);
    const next = exists
      ? current.filter((f) => f.pairAddress !== p.pairAddress)
      : [
          ...current,
          {
            pairAddress: p.pairAddress,
            baseAddress: p.baseAddress,
            baseSymbol: p.baseSymbol,
            quoteSymbol: p.quoteSymbol,
            dexId: p.dexId,
          },
        ];
    localStorage.setItem(FAVS_KEY, JSON.stringify(next));
    setFavs(next);
  }, []);

  const removeFav = useCallback((pairAddress: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = readJson<Favorite[]>(FAVS_KEY, []).filter((f) => f.pairAddress !== pairAddress);
    localStorage.setItem(FAVS_KEY, JSON.stringify(next));
    setFavs(next);
  }, []);

  if (!open) return null;
  const favSet = new Set(favs.map((f) => f.pairAddress));

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-14 flex max-h-[80vh] w-[min(860px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-carbon-line2 bg-carbon-bg font-plex shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-carbon-line px-4 py-3">
          <IconSearch className="h-4 w-4 shrink-0 text-carbon-dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by token name, symbol, or address…"
            className="w-full bg-transparent text-sm text-carbon-text outline-none placeholder:text-carbon-dim"
          />
          <button onClick={onClose} className="text-carbon-dim transition-colors hover:text-carbon-text" aria-label="Close search">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="space-y-4 p-4">
              {recent.length > 0 ? (
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-carbon-dim">Recent</div>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((r) => (
                      <button
                        key={r}
                        onClick={() => setQuery(r)}
                        className="rounded border border-carbon-line px-2.5 py-1 text-xs text-carbon-muted transition-colors hover:border-carbon-line2 hover:text-carbon-text"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {favs.length > 0 ? (
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-carbon-dim">Favorites</div>
                  <div className="space-y-1">
                    {favs.map((f) => (
                      <div
                        key={f.pairAddress}
                        onClick={() => {
                          onClose();
                          router.push(`/geicko?address=${f.baseAddress}`);
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded border border-carbon-line px-3 py-2 transition-colors hover:bg-carbon-surface"
                      >
                        <IconStarFilled className="h-3.5 w-3.5 shrink-0 text-carbon-gold" />
                        <span className="text-sm font-medium text-carbon-text">{f.baseSymbol}</span>
                        <span className="text-xs text-carbon-dim">/{f.quoteSymbol ?? '?'}</span>
                        <span className="text-xs text-carbon-dim">{dexName(f.dexId)}</span>
                        <span className="ml-auto font-plexmono text-[11px] text-carbon-dim">{shortAddr(f.pairAddress)}</span>
                        <button
                          onClick={(e) => removeFav(f.pairAddress, e)}
                          className="text-carbon-dim transition-colors hover:text-carbon-red"
                          aria-label={`Remove ${f.baseSymbol} from favorites`}
                        >
                          <IconX className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {recent.length === 0 && favs.length === 0 ? (
                <div className="py-10 text-center text-sm text-carbon-dim">
                  Search any PulseChain pair — every DEX, every token.
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              {searching && results.length === 0 ? (
                <div className="py-10 text-center text-sm text-carbon-dim">Searching…</div>
              ) : null}
              {error ? <div className="py-10 text-center text-sm text-carbon-red">{error}</div> : null}
              {!searching && !error && results.length === 0 && query.trim().length >= 2 ? (
                <div className="py-10 text-center text-sm text-carbon-dim">No pairs found for “{query.trim()}”.</div>
              ) : null}
              {results.map((p) => (
                <SearchRow key={p.pairAddress} pair={p} fav={favSet.has(p.pairAddress)} onOpen={openPair} onFav={toggleFav} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchRow({
  pair: p,
  fav,
  onOpen,
  onFav,
}: {
  pair: SearchPair;
  fav: boolean;
  onOpen: (p: SearchPair) => void;
  onFav: (p: SearchPair, e: React.MouseEvent) => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [dexFailed, setDexFailed] = useState(false);
  return (
    <div
      onClick={() => onOpen(p)}
      className="flex cursor-pointer items-center gap-3 border-t border-carbon-line px-4 py-2.5 transition-colors hover:bg-carbon-surface"
    >
      <div className="flex w-12 shrink-0 items-center gap-1">
        {p.dexId && !dexFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dexLogo(p.dexId)} alt={dexName(p.dexId)} className="h-4 w-4 rounded-full" onError={() => setDexFailed(true)} />
        ) : null}
        {p.label ? (
          <span className="rounded border border-carbon-line2 px-1 font-plexmono text-[9px] uppercase text-carbon-dim">{p.label}</span>
        ) : null}
      </div>
      {!logoFailed && p.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.imageUrl} alt="" className="h-7 w-7 shrink-0 rounded-full" onError={() => setLogoFailed(true)} />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-carbon-raised font-plexmono text-[11px] text-carbon-muted">
          {p.baseSymbol.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-medium text-carbon-text">{p.baseSymbol}</span>
          <span className="text-xs text-carbon-dim">/{p.quoteSymbol ?? '?'}</span>
          <span className="truncate text-xs text-carbon-dim">{p.baseName}</span>
        </div>
        <div className="flex flex-wrap gap-x-3 font-plexmono text-[11px] text-carbon-dim">
          <span>MCap {fmtUsd(p.marketCap)}</span>
          <span>Liq {fmtUsd(p.liquidityUsd)}</span>
          <span>Vol {fmtUsd(p.vol24)}</span>
          <span>{fmtAge(p.pairCreatedAt)}</span>
        </div>
      </div>
      <div className="hidden shrink-0 flex-col items-end sm:flex">
        <span className="font-plexmono text-sm text-carbon-text">{fmtPrice(p.priceUsd)}</span>
        <span className={`font-plexmono text-[11px] ${pctClass(p.chg24)}`}>{fmtPct(p.chg24)} 24h</span>
      </div>
      <div className="hidden shrink-0 flex-col items-end font-plexmono text-[10px] text-carbon-dim md:flex">
        <span>PAIR {shortAddr(p.pairAddress)}</span>
        <span>TOKEN {shortAddr(p.baseAddress)}</span>
      </div>
      <button
        onClick={(e) => onFav(p, e)}
        className={`shrink-0 transition-colors ${fav ? 'text-carbon-gold' : 'text-carbon-dim hover:text-carbon-gold'}`}
        aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
      >
        {fav ? <IconStarFilled className="h-4 w-4" /> : <IconStar className="h-4 w-4" />}
      </button>
    </div>
  );
}
