'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSearch, IconStar, IconStarFilled, IconX } from '@tabler/icons-react';
import type { SearchPair } from '@/lib/screener/types';
import { dexLogo, dexName, fmtAge, fmtPct, fmtPrice, fmtUsd, pctClass, shortAddr } from './format';
import type { ScreenerWatchlist } from './watchlist';

const RECENT_KEY = 'screener.recent';
const MAX_RECENT = 8;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  watchlist: ScreenerWatchlist;
}

export default function SearchModal({ open, onClose, watchlist }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchPair[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setRecent(readRecent());
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
    const next = [q, ...readRecent().filter((x) => x !== q)].slice(0, MAX_RECENT);
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

  if (!open) return null;

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

              {watchlist.tokens.length > 0 ? (
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-carbon-dim">Watchlist</div>
                  <div className="space-y-1">
                    {watchlist.tokens.map((t) => (
                      <div
                        key={`${t.chain}:${t.address}`}
                        onClick={() => {
                          onClose();
                          router.push(`/geicko?address=${t.address}`);
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded border border-carbon-line px-3 py-2 transition-colors hover:bg-carbon-surface"
                      >
                        <IconStarFilled className="h-3.5 w-3.5 shrink-0 text-carbon-gold" />
                        <span className="text-sm font-medium text-carbon-text">{t.symbol}</span>
                        {t.chain === 'ethereum' ? (
                          <span className="rounded-sm border border-carbon-line2 px-1 py-px font-plexmono text-[9px] uppercase text-carbon-muted">ETH</span>
                        ) : null}
                        <span className="truncate text-xs text-carbon-dim">{t.name}</span>
                        <span className="ml-auto font-plexmono text-[11px] text-carbon-dim">{shortAddr(t.address)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            watchlist.toggle({ address: t.address, chain: t.chain, symbol: t.symbol, name: t.name });
                          }}
                          className="text-carbon-dim transition-colors hover:text-carbon-red"
                          aria-label={`Remove ${t.symbol} from watchlist`}
                        >
                          <IconX className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {recent.length === 0 && watchlist.tokens.length === 0 ? (
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
                <SearchRow
                  key={p.pairAddress}
                  pair={p}
                  starred={watchlist.has(p.baseAddress)}
                  onOpen={openPair}
                  onStar={(pair, e) => {
                    e.stopPropagation();
                    watchlist.toggle({
                      address: pair.baseAddress,
                      symbol: pair.baseSymbol,
                      name: pair.baseName ?? pair.baseSymbol,
                      logoURI: pair.imageUrl ?? undefined,
                    });
                  }}
                />
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
  starred,
  onOpen,
  onStar,
}: {
  pair: SearchPair;
  starred: boolean;
  onOpen: (p: SearchPair) => void;
  onStar: (p: SearchPair, e: React.MouseEvent) => void;
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
        onClick={(e) => onStar(p, e)}
        className={`shrink-0 transition-colors ${starred ? 'text-carbon-gold' : 'text-carbon-dim hover:text-carbon-gold'}`}
        aria-label={starred ? 'Remove from watchlist' : 'Add to watchlist'}
      >
        {starred ? <IconStarFilled className="h-4 w-4" /> : <IconStar className="h-4 w-4" />}
      </button>
    </div>
  );
}
