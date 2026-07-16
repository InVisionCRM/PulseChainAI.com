'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DexInfo,
  ScreenerFilters,
  ScreenerResponse,
  ScreenerRow,
  ScreenerStats,
  ScreenerUiTab,
  ScreenerWindow,
} from '@/lib/screener/types';
import { EMPTY_FILTERS } from '@/lib/screener/types';
import type { SortKey } from '@/lib/screener/db';
import StatsBar from './StatsBar';
import FilterBar from './FilterBar';
import PairsTable from './PairsTable';
import MarketBubbles from './MarketBubbles';
import SearchModal from './SearchModal';
import { useScreenerWatchlist } from './watchlist';
import { fetchPinnedRows, isPinnedAddress } from '@/lib/screener/pinned';
import { usePollingEffect } from '@/hooks/usePollingEffect';

const REFRESH_MS = 60000;

// Chains selectable in the screener. PulseChain is served by the self-indexed
// universe (/api/screener); every other chain is served live from GeckoTerminal
// (/api/screener/live). Add a new EVM here + give it a geckoterminalSlug in the
// chain registry and it lights up — no other wiring.
type ScreenerChain = { key: 'pulsechain' | 'robinhood'; name: string; source: 'indexed' | 'live' };
const SCREENER_CHAINS: ScreenerChain[] = [
  { key: 'pulsechain', name: 'PulseChain', source: 'indexed' },
  { key: 'robinhood', name: 'Robinhood', source: 'live' },
];

function sortValue(row: ScreenerRow, key: SortKey, w: ScreenerWindow): number {
  switch (key) {
    case 'mcap': return row.marketCap ?? -Infinity;
    case 'price': return row.priceUsd ?? -Infinity;
    case 'age': return row.pairCreatedAt ? new Date(row.pairCreatedAt).getTime() : -Infinity;
    case 'txns': return row.txns[w] ?? -Infinity;
    case 'volume': return row.vol[w] ?? -Infinity;
    case 'm5': return row.chg.m5 ?? -Infinity;
    case 'h1': return row.chg.h1 ?? -Infinity;
    case 'h6': return row.chg.h6 ?? -Infinity;
    case 'h24': return row.chg.h24 ?? -Infinity;
    case 'liq': return row.liquidityUsd ?? -Infinity;
  }
}

export default function Screener() {
  const [chain, setChain] = useState<ScreenerChain>(SCREENER_CHAINS[0]);
  const [tab, setTab] = useState<ScreenerUiTab>('trending');
  const [window_, setWindow] = useState<ScreenerWindow>('h6');
  const [dexId, setDexId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey | null>(null);
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<ScreenerFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [pinnedRows, setPinnedRows] = useState<ScreenerRow[]>([]);
  const [stats, setStats] = useState<ScreenerStats | null>(null);
  const [dexes, setDexes] = useState<DexInfo[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [view, setView] = useState<'table' | 'bubbles'>('table');
  const abortRef = useRef<AbortController | null>(null);
  const watchlist = useScreenerWatchlist();

  const watchlistParam = watchlist.tokens.map((t) => `${t.chain}:${t.address}`).join(',');

  const load = useCallback(
    async (p: number, append: boolean) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        if (tab === 'watchlist') {
          if (watchlistParam === '') {
            setRows([]);
            setHasMore(false);
            setLoading(false);
            return;
          }
          const res = await fetch(`/api/watchlist?tokens=${encodeURIComponent(watchlistParam)}`, { signal: ctrl.signal });
          if (!res.ok) throw new Error(`watchlist ${res.status}`);
          const json: { rows: ScreenerRow[] } = await res.json();
          setRows(json.rows);
          setHasMore(false);
          setFetchedAt(Date.now());
          setLoading(false);
          return;
        }
        const qs = new URLSearchParams({ tab, window: window_, page: String(p) });
        if (dexId) qs.set('dex', dexId);
        if (sort) {
          qs.set('sort', sort);
          qs.set('dir', dir);
        }
        if (filters.minLiq !== null) qs.set('minLiq', String(filters.minLiq));
        if (filters.minVol24 !== null) qs.set('minVol', String(filters.minVol24));
        if (filters.minAgeH !== null) qs.set('minAgeH', String(filters.minAgeH));
        if (filters.maxAgeH !== null) qs.set('maxAgeH', String(filters.maxAgeH));
        // PulseChain uses the indexed universe; other chains stream live from
        // GeckoTerminal via /api/screener/live (same response shape).
        const endpoint =
          chain.source === 'indexed' ? `/api/screener?${qs}` : `/api/screener/live?chain=${chain.key}&${qs}`;
        const res = await fetch(endpoint, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`screener ${res.status}`);
        const json: ScreenerResponse = await res.json();
        setRows((prev) => (append ? [...prev, ...json.rows] : json.rows));
        setStats(json.stats);
        setDexes(json.dexes);
        setFetchedAt(Date.now());
        setHasMore(json.rows.length === json.pageSize);
        setLoading(false);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error(err);
          setLoading(false);
        }
      }
    },
    [chain, tab, window_, dexId, sort, dir, filters, watchlistParam],
  );

  useEffect(() => {
    setPage(0);
    load(0, false);
  }, [load]);

  // Pinned tokens (e.g. Morbius) are always shown at the top of the list,
  // resolved live and independently of the current tab/sort/filters. Refreshed
  // on the same cadence as the table.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchPinnedRows(ctrl.signal).then(setPinnedRows).catch(() => {});
    const id = setInterval(() => {
      fetchPinnedRows().then(setPinnedRows).catch(() => {});
    }, REFRESH_MS);
    return () => {
      ctrl.abort();
      clearInterval(id);
    };
  }, []);

  // Live refresh only on the first page; paused while a background tab and
  // while paginated away. Becoming visible again refreshes immediately.
  usePollingEffect(() => load(0, false), REFRESH_MS, { enabled: page === 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Header click cycles: tab default → desc → asc → tab default.
  const onSort = (key: SortKey) => {
    if (sort !== key) {
      setSort(key);
      setDir('desc');
    } else if (dir === 'desc') {
      setDir('asc');
    } else {
      setSort(null);
      setDir('desc');
    }
  };

  const onTab = (t: ScreenerUiTab) => {
    setTab(t);
    setSort(null);
    setDir('desc');
  };

  // Switching chains resets the dex facet (dexes differ per chain), sort, and
  // any active watchlist view back to a chain-appropriate default.
  const onChain = (c: ScreenerChain) => {
    if (c.key === chain.key) return;
    setChain(c);
    setDexId(null);
    setSort(null);
    setDir('desc');
    if (tab === 'watchlist') setTab('trending');
  };

  // Watchlist rows sort client-side; server tabs are sorted by the API.
  const sortedRows =
    tab === 'watchlist' && sort
      ? [...rows].sort((a, b) => (sortValue(a, sort, window_) - sortValue(b, sort, window_)) * (dir === 'asc' ? 1 : -1))
      : rows;

  // Pin the pinned tokens to the very top on the main (non-watchlist) tabs,
  // dropping any copy already present so they never appear twice. Pinned tokens
  // are PulseChain-specific, so they only apply on that chain. The watchlist tab
  // stays user-curated.
  const displayRows =
    chain.key !== 'pulsechain' || tab === 'watchlist' || pinnedRows.length === 0
      ? sortedRows
      : [...pinnedRows, ...sortedRows.filter((r) => !isPinnedAddress(r.baseAddress))];

  return (
    <div className="w-full min-w-0 space-y-2">
      {/* Chain selector — indexed PulseChain + live GeckoTerminal chains. */}
      <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 w-fit">
        {SCREENER_CHAINS.map((c) => {
          const active = c.key === chain.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onChain(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-[var(--surface-3)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <StatsBar stats={stats} fetchedAt={fetchedAt} />
      <FilterBar
        dexes={dexes}
        dexId={dexId}
        tab={tab}
        window={window_}
        filters={filters}
        onDex={(d) => setDexId(d)}
        onTab={onTab}
        onWindow={(w) => setWindow(w)}
        onFilters={(f) => setFilters(f)}
        view={view}
        onView={setView}
      />

      {view === 'bubbles' ? (
        <MarketBubbles tab={tab} dexId={dexId} filters={filters} watchlistParam={watchlistParam} />
      ) : (
        <>
          <PairsTable
            rows={displayRows}
            window={window_}
            loading={loading}
            sort={sort}
            dir={dir}
            onSort={onSort}
            watchlist={watchlist}
            emptyHint={
              tab === 'watchlist'
                ? 'Your watchlist is empty — star any pair to add it.'
                : chain.key === 'pulsechain'
                  ? 'No pairs found. Run the backfill (npm run screener:backfill) to populate the universe, or relax the filters.'
                  : `No ${chain.name} pairs match — try a different tab or relax the filters.`
            }
          />
          {hasMore && tab !== 'watchlist' ? (
            <div className="flex justify-center pb-6">
              <button
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  load(next, true);
                }}
                disabled={loading}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl px-6 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Show more'}
              </button>
            </div>
          ) : null}
        </>
      )}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} watchlist={watchlist} />
    </div>
  );
}
