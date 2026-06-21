'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSearch, IconStar, IconStarFilled, IconX } from '@tabler/icons-react';
import type { SearchPair } from '@/lib/screener/types';
import { dexLogo, dexName, fmtAge, fmtPct, fmtPrice, fmtUsd, pctClass, shortAddr } from './format';
import type { ScreenerWatchlist } from './watchlist';
import { ChainLogo } from '@/components/ui/ChainLogo';
import { useWatchlistStore } from '@/lib/stores/watchlistStore';

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
  const prices = useWatchlistStore((s) => s.prices);
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
      void useWatchlistStore.getState().refresh();
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
        className="mx-auto mt-14 flex max-h-[80vh] w-[min(860px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-[var(--line-strong)] bg-[var(--panel)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
          <IconSearch className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by token name, symbol, or address…"
            className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
          />
          <button onClick={onClose} className="text-[var(--text-faint)] transition-colors hover:text-[var(--text)]" aria-label="Close search">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="space-y-4 p-4">
              {recent.length > 0 ? (
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Recent</div>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((r) => (
                      <button
                        key={r}
                        onClick={() => setQuery(r)}
                        className="rounded border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text)]"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {watchlist.tokens.length > 0 ? (
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Watchlist</div>
                  <div className="space-y-1">
                    {watchlist.tokens.map((t) => (
                      <div
                        key={`${t.chain}:${t.address}`}
                        onClick={() => {
                          onClose();
                          router.push(`/geicko?address=${t.address}`);
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded border border-[var(--line)] px-3 py-2 transition-colors hover:bg-[var(--surface)]"
                      >
                        <WatchAvatar
                          logo={prices[t.address]?.logoURI || t.logoURI}
                          symbol={t.symbol}
                        />
                        <span className="text-sm font-medium text-[var(--text)]">{t.symbol}</span>
                        {t.chain === 'ethereum' ? (
                          <ChainLogo chain="ethereum" size={14} />
                        ) : null}
                        <span className="truncate text-xs text-[var(--text-faint)]">{t.name}</span>
                        <span className="ml-auto tabular-nums text-[11px] text-[var(--text-faint)]">{shortAddr(t.address)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            watchlist.toggle({ address: t.address, chain: t.chain, symbol: t.symbol, name: t.name });
                          }}
                          className="text-[var(--text-faint)] transition-colors hover:text-red-400"
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
                <div className="py-10 text-center text-sm text-[var(--text-faint)]">
                  Search any PulseChain pair — every DEX, every token.
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              {searching && results.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--text-faint)]">Searching…</div>
              ) : null}
              {error ? <div className="py-10 text-center text-sm text-red-400">{error}</div> : null}
              {!searching && !error && results.length === 0 && query.trim().length >= 2 ? (
                <div className="py-10 text-center text-sm text-[var(--text-faint)]">No pairs found for “{query.trim()}”.</div>
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

function WatchAvatar({ logo, symbol }: { logo?: string | null; symbol: string }) {
  const [failed, setFailed] = useState(false);
  return !failed && logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt=""
      className="h-7 w-7 shrink-0 rounded-full"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] tabular-nums text-[11px] text-[var(--text-muted)]">
      {symbol.charAt(0)}
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
      className="flex cursor-pointer items-center gap-3 border-t border-[var(--line)] px-4 py-2.5 transition-colors hover:bg-[var(--surface)]"
    >
      <div className="flex w-12 shrink-0 items-center gap-1">
        {p.dexId && !dexFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dexLogo(p.dexId)} alt={dexName(p.dexId)} className="h-4 w-4 rounded-full" onError={() => setDexFailed(true)} />
        ) : null}
        {p.label ? (
          <span className="rounded border border-[var(--line-strong)] px-1 tabular-nums text-[9px] uppercase text-[var(--text-faint)]">{p.label}</span>
        ) : null}
      </div>
      {!logoFailed && p.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.imageUrl} alt="" className="h-7 w-7 shrink-0 rounded-full" onError={() => setLogoFailed(true)} />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] tabular-nums text-[11px] text-[var(--text-muted)]">
          {p.baseSymbol.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-medium text-[var(--text)]">{p.baseSymbol}</span>
          <span className="text-xs text-[var(--text-faint)]">/{p.quoteSymbol ?? '?'}</span>
          <span className="truncate text-xs text-[var(--text-faint)]">{p.baseName}</span>
        </div>
        <div className="flex flex-wrap gap-x-3 tabular-nums text-[11px] text-[var(--text-faint)]">
          <span>MCap {fmtUsd(p.marketCap)}</span>
          <span>Liq {fmtUsd(p.liquidityUsd)}</span>
          <span>Vol {fmtUsd(p.vol24)}</span>
          <span>{fmtAge(p.pairCreatedAt)}</span>
        </div>
      </div>
      <div className="hidden shrink-0 flex-col items-end sm:flex">
        <span className="tabular-nums text-sm text-[var(--text)]">{fmtPrice(p.priceUsd)}</span>
        <span className={`tabular-nums text-[11px] ${pctClass(p.chg24)}`}>{fmtPct(p.chg24)} 24h</span>
      </div>
      <div className="hidden shrink-0 flex-col items-end tabular-nums text-[10px] text-[var(--text-faint)] md:flex">
        <span>PAIR {shortAddr(p.pairAddress)}</span>
        <span>TOKEN {shortAddr(p.baseAddress)}</span>
      </div>
      <button
        onClick={(e) => onStar(p, e)}
        className={`shrink-0 transition-colors ${starred ? 'text-orange-400' : 'text-[var(--text-faint)] hover:text-orange-400'}`}
        aria-label={starred ? 'Remove from watchlist' : 'Add to watchlist'}
      >
        {starred ? <IconStarFilled className="h-4 w-4" /> : <IconStar className="h-4 w-4" />}
      </button>
    </div>
  );
}
