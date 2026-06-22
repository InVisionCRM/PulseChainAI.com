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

const REFRESH_MS = 60000;

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
  const [tab, setTab] = useState<ScreenerUiTab>('trending');
  const [window_, setWindow] = useState<ScreenerWindow>('h6');
  const [dexId, setDexId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey | null>(null);
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<ScreenerFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ScreenerRow[]>([]);
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
        const res = await fetch(`/api/screener?${qs}`, { signal: ctrl.signal });
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
    [tab, window_, dexId, sort, dir, filters, watchlistParam],
  );

  useEffect(() => {
    setPage(0);
    load(0, false);
  }, [load]);

  useEffect(() => {
    if (page > 0) return;
    const id = setInterval(() => load(0, false), REFRESH_MS);
    return () => clearInterval(id);
  }, [load, page]);

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

  // Watchlist rows sort client-side; server tabs are sorted by the API.
  const displayRows =
    tab === 'watchlist' && sort
      ? [...rows].sort((a, b) => (sortValue(a, sort, window_) - sortValue(b, sort, window_)) * (dir === 'asc' ? 1 : -1))
      : rows;

  return (
    <div className="w-full min-w-0 space-y-2">
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
                : 'No pairs found. Run the backfill (npm run screener:backfill) to populate the universe, or relax the filters.'
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
