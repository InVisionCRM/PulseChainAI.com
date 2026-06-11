'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  IconSearch,
  IconFlame,
  IconTrophy,
  IconTrendingUp,
  IconSparkles,
  IconClock,
  IconStar,
  IconFilter,
  IconX,
} from '@tabler/icons-react';
import type { DexInfo, ScreenerFilters, ScreenerUiTab, ScreenerWindow } from '@/lib/screener/types';
import { dexLogo, dexName } from './format';

interface Props {
  dexes: DexInfo[];
  dexId: string | null;
  tab: ScreenerUiTab;
  window: ScreenerWindow;
  filters: ScreenerFilters;
  onDex: (dexId: string | null) => void;
  onTab: (tab: ScreenerUiTab) => void;
  onWindow: (w: ScreenerWindow) => void;
  onFilters: (f: ScreenerFilters) => void;
  onOpenSearch: () => void;
}

const WINDOWS: { id: ScreenerWindow; label: string }[] = [
  { id: 'm5', label: '5M' },
  { id: 'h1', label: '1H' },
  { id: 'h6', label: '6H' },
  { id: 'h24', label: '24H' },
];

const TABS: { id: ScreenerUiTab; label: string; icon: React.ReactNode }[] = [
  { id: 'trending', label: 'Trending', icon: <IconFlame className="h-3.5 w-3.5" /> },
  { id: 'top', label: 'Top', icon: <IconTrophy className="h-3.5 w-3.5" /> },
  { id: 'gainers', label: 'Gainers', icon: <IconTrendingUp className="h-3.5 w-3.5" /> },
  { id: 'new', label: 'New Pairs', icon: <IconClock className="h-3.5 w-3.5" /> },
  { id: 'gold', label: 'Gold', icon: <IconSparkles className="h-3.5 w-3.5" /> },
  { id: 'watchlist', label: 'Watchlist', icon: <IconStar className="h-3.5 w-3.5" /> },
];

function DexIcon({ dexId }: { dexId: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dexLogo(dexId)} alt="" className="h-4 w-4 rounded-full" onError={() => setFailed(true)} />
  );
}

function FiltersPopover({
  filters,
  onApply,
  onClose,
}: {
  filters: ScreenerFilters;
  onApply: (f: ScreenerFilters) => void;
  onClose: () => void;
}) {
  const [unit, setUnit] = useState<'h' | 'd'>('d');
  const toUnit = (h: number | null) => (h === null ? '' : String(unit === 'd' ? h / 24 : h));
  const [minLiq, setMinLiq] = useState(filters.minLiq === null ? '' : String(filters.minLiq));
  const [minVol, setMinVol] = useState(filters.minVol24 === null ? '' : String(filters.minVol24));
  const [minAge, setMinAge] = useState(toUnit(filters.minAgeH));
  const [maxAge, setMaxAge] = useState(toUnit(filters.maxAgeH));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const parse = (s: string): number | null => {
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const toHours = (s: string): number | null => {
    const n = parse(s);
    return n === null ? null : unit === 'd' ? n * 24 : n;
  };

  const field = 'w-full rounded border border-carbon-line bg-carbon-bg px-2 py-1.5 font-plexmono text-xs text-carbon-text outline-none placeholder:text-carbon-dim focus:border-carbon-gold';
  const label = 'mb-1 block text-[10px] uppercase tracking-wider text-carbon-dim';

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-30 mt-1 w-64 rounded-md border border-carbon-line2 bg-carbon-surface p-3 shadow-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-carbon-text">Filters</span>
        <button onClick={onClose} className="text-carbon-dim hover:text-carbon-text" aria-label="Close filters">
          <IconX className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-2.5">
        <div>
          <label className={label}>Min liquidity (USD)</label>
          <input value={minLiq} onChange={(e) => setMinLiq(e.target.value)} placeholder="e.g. 10000" inputMode="decimal" className={field} />
        </div>
        <div>
          <label className={label}>Min 24h volume (USD)</label>
          <input value={minVol} onChange={(e) => setMinVol(e.target.value)} placeholder="e.g. 5000" inputMode="decimal" className={field} />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className={label}>Min age</label>
            <input value={minAge} onChange={(e) => setMinAge(e.target.value)} placeholder="–" inputMode="decimal" className={field} />
          </div>
          <div className="flex-1">
            <label className={label}>Max age</label>
            <input value={maxAge} onChange={(e) => setMaxAge(e.target.value)} placeholder="–" inputMode="decimal" className={field} />
          </div>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as 'h' | 'd')}
            className="rounded border border-carbon-line bg-carbon-bg px-1.5 py-1.5 font-plexmono text-xs text-carbon-muted outline-none"
            aria-label="Age unit"
          >
            <option value="h">hrs</option>
            <option value="d">days</option>
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onApply({ minLiq: parse(minLiq), minVol24: parse(minVol), minAgeH: toHours(minAge), maxAgeH: toHours(maxAge) })}
            className="flex-1 rounded bg-carbon-gold px-3 py-1.5 text-xs font-medium text-black transition-opacity hover:opacity-90"
          >
            Apply
          </button>
          <button
            onClick={() => onApply({ minLiq: null, minVol24: null, minAgeH: null, maxAgeH: null })}
            className="rounded border border-carbon-line px-3 py-1.5 text-xs text-carbon-muted transition-colors hover:border-carbon-line2 hover:text-carbon-text"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FilterBar({ dexes, dexId, tab, window, filters, onDex, onTab, onWindow, onFilters, onOpenSearch }: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const onServerTab = tab !== 'watchlist';
  const activeFilterCount = [filters.minLiq, filters.minVol24, filters.minAgeH, filters.maxAgeH].filter((v) => v !== null).length;

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          onServerTab ? '' : 'pointer-events-none opacity-40'
        }`}
      >
        <button
          onClick={() => onDex(null)}
          className={`flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            dexId === null
              ? 'bg-carbon-gold text-black'
              : 'border border-carbon-line text-carbon-muted hover:border-carbon-line2 hover:text-carbon-text'
          }`}
        >
          All DEXes
        </button>
        {dexes.map((d) => (
          <button
            key={d.dexId}
            onClick={() => onDex(d.dexId)}
            className={`flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              dexId === d.dexId
                ? 'bg-carbon-gold text-black'
                : 'border border-carbon-line text-carbon-muted hover:border-carbon-line2 hover:text-carbon-text'
            }`}
          >
            <DexIcon dexId={d.dexId} />
            {dexName(d.dexId)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 overflow-x-auto rounded border border-carbon-line bg-carbon-surface p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              className={`flex shrink-0 items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === t.id ? 'bg-carbon-raised text-carbon-gold' : 'text-carbon-muted hover:text-carbon-text'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 rounded border border-carbon-line bg-carbon-surface p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              onClick={() => onWindow(w.id)}
              className={`rounded px-2.5 py-1 font-plexmono text-xs transition-colors ${
                window === w.id ? 'bg-carbon-gold font-medium text-black' : 'text-carbon-muted hover:text-carbon-text'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className={`relative ${onServerTab ? '' : 'pointer-events-none opacity-40'}`}>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFilterCount > 0
                ? 'border-carbon-gold text-carbon-gold'
                : 'border-carbon-line text-carbon-muted hover:border-carbon-line2 hover:text-carbon-text'
            }`}
          >
            <IconFilter className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="rounded-sm bg-carbon-gold px-1 font-plexmono text-[10px] font-semibold text-black">{activeFilterCount}</span>
            ) : null}
          </button>
          {filtersOpen ? (
            <FiltersPopover
              filters={filters}
              onApply={(f) => {
                onFilters(f);
                setFiltersOpen(false);
              }}
              onClose={() => setFiltersOpen(false)}
            />
          ) : null}
        </div>

        <button
          onClick={onOpenSearch}
          className="ml-auto flex items-center gap-2 rounded border border-carbon-line bg-carbon-surface px-3 py-1.5 text-xs text-carbon-dim transition-colors hover:border-carbon-line2 hover:text-carbon-text"
        >
          <IconSearch className="h-3.5 w-3.5" />
          <span>Search pairs</span>
          <kbd className="rounded border border-carbon-line2 px-1 font-plexmono text-[10px]">/</kbd>
        </button>
      </div>
    </div>
  );
}
