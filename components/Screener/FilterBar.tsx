'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
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
  view: 'table' | 'bubbles';
  onView: (v: 'table' | 'bubbles') => void;
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

const CHIP_ACTIVE = 'bg-orange-500 text-[var(--text)]';
const CHIP_IDLE = 'border border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]';

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

  const field = 'w-full rounded-lg bg-[var(--surface-2)] border border-[var(--line)] px-2 py-1.5 text-xs text-[var(--text)] tabular-nums outline-none placeholder:text-[var(--text-faint)] focus:border-orange-500/60';
  const label = 'mb-1 block text-[10px] uppercase tracking-wider text-[var(--text-muted)]';

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-30 mt-1 w-64 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text)]">Filters</span>
        <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text)]" aria-label="Close filters">
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
            className="rounded-lg bg-[var(--surface-2)] border border-[var(--line)] px-1.5 py-1.5 text-xs text-[var(--text-muted)] outline-none"
            aria-label="Age unit"
          >
            <option value="h">hrs</option>
            <option value="d">days</option>
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onApply({ minLiq: parse(minLiq), minVol24: parse(minVol), minAgeH: toHours(minAge), maxAgeH: toHours(maxAge) })}
            className="flex-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-orange-400"
          >
            Apply
          </button>
          <button
            onClick={() => onApply({ minLiq: null, minVol24: null, minAgeH: null, maxAgeH: null })}
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FilterBar({ dexes, dexId, tab, window, filters, onDex, onTab, onWindow, onFilters, view, onView }: Props) {
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
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            dexId === null ? CHIP_ACTIVE : CHIP_IDLE
          }`}
        >
          All DEXes
        </button>
        {dexes.map((d) => (
          <button
            key={d.dexId}
            onClick={() => onDex(d.dexId)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              dexId === d.dexId ? CHIP_ACTIVE : CHIP_IDLE
            }`}
          >
            <DexIcon dexId={d.dexId} />
            {dexName(d.dexId)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === t.id ? 'bg-[var(--surface-2)] text-orange-300' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              onClick={() => onWindow(w.id)}
              className={`rounded-lg px-2.5 py-1 text-xs tabular-nums transition-colors ${
                window === w.id ? 'bg-orange-500 font-semibold text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className={`relative ${onServerTab ? '' : 'pointer-events-none opacity-40'}`}>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFilterCount > 0
                ? 'border-orange-500/60 text-orange-300'
                : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
            }`}
          >
            <IconFilter className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="rounded bg-orange-500 px-1 text-[10px] font-semibold text-[var(--text)] tabular-nums">{activeFilterCount}</span>
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

        <div className="ml-auto flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0.5 backdrop-blur-xl">
          {(['table', 'bubbles'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                view === v ? 'bg-[var(--surface-2)] text-orange-300' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
