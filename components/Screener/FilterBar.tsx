'use client';

import React from 'react';
import { IconSearch, IconFlame, IconTrophy, IconTrendingUp, IconSparkles, IconClock } from '@tabler/icons-react';
import type { DexInfo, ScreenerTab, ScreenerWindow } from '@/lib/screener/types';
import { dexLogo, dexName } from './format';

interface Props {
  dexes: DexInfo[];
  dexId: string | null;
  tab: ScreenerTab;
  window: ScreenerWindow;
  onDex: (dexId: string | null) => void;
  onTab: (tab: ScreenerTab) => void;
  onWindow: (w: ScreenerWindow) => void;
  onOpenSearch: () => void;
}

const WINDOWS: { id: ScreenerWindow; label: string }[] = [
  { id: 'm5', label: '5M' },
  { id: 'h1', label: '1H' },
  { id: 'h6', label: '6H' },
  { id: 'h24', label: '24H' },
];

const TABS: { id: ScreenerTab; label: string; icon: React.ReactNode }[] = [
  { id: 'trending', label: 'Trending', icon: <IconFlame className="h-3.5 w-3.5" /> },
  { id: 'top', label: 'Top', icon: <IconTrophy className="h-3.5 w-3.5" /> },
  { id: 'gainers', label: 'Gainers', icon: <IconTrendingUp className="h-3.5 w-3.5" /> },
  { id: 'new', label: 'New Pairs', icon: <IconClock className="h-3.5 w-3.5" /> },
  { id: 'gold', label: 'Gold', icon: <IconSparkles className="h-3.5 w-3.5" /> },
];

function DexIcon({ dexId }: { dexId: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dexLogo(dexId)}
      alt=""
      className="h-4 w-4 rounded-full"
      onError={() => setFailed(true)}
    />
  );
}

export default function FilterBar({ dexes, dexId, tab, window, onDex, onTab, onWindow, onOpenSearch }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        <div className="flex items-center gap-0.5 rounded border border-carbon-line bg-carbon-surface p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
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
                window === w.id ? 'bg-carbon-gold text-black font-medium' : 'text-carbon-muted hover:text-carbon-text'
              }`}
            >
              {w.label}
            </button>
          ))}
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
