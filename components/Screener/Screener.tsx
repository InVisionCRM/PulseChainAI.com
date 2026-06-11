'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DexInfo, ScreenerResponse, ScreenerRow, ScreenerStats, ScreenerTab, ScreenerWindow } from '@/lib/screener/types';
import StatsBar from './StatsBar';
import FilterBar from './FilterBar';
import PairsTable from './PairsTable';
import SearchModal from './SearchModal';

const REFRESH_MS = 60000;

export default function Screener() {
  const [tab, setTab] = useState<ScreenerTab>('trending');
  const [window_, setWindow] = useState<ScreenerWindow>('h6');
  const [dexId, setDexId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [stats, setStats] = useState<ScreenerStats | null>(null);
  const [dexes, setDexes] = useState<DexInfo[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (p: number, append: boolean) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ tab, window: window_, page: String(p) });
        if (dexId) qs.set('dex', dexId);
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
    [tab, window_, dexId],
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

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-3 px-3 py-4 font-plex md:px-6">
      <StatsBar stats={stats} fetchedAt={fetchedAt} />
      <FilterBar
        dexes={dexes}
        dexId={dexId}
        tab={tab}
        window={window_}
        onDex={(d) => setDexId(d)}
        onTab={(t) => setTab(t)}
        onWindow={(w) => setWindow(w)}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <PairsTable rows={rows} window={window_} loading={loading} />
      {hasMore ? (
        <div className="flex justify-center pb-6">
          <button
            onClick={() => {
              const next = page + 1;
              setPage(next);
              load(next, true);
            }}
            disabled={loading}
            className="rounded border border-carbon-line bg-carbon-surface px-6 py-2 text-xs font-medium text-carbon-muted transition-colors hover:border-carbon-line2 hover:text-carbon-text disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Show more'}
          </button>
        </div>
      ) : null}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
