'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { IconBolt, IconRadar2, IconTrophy } from '@tabler/icons-react';
import type { Network } from '@/lib/hex/strategistData';
// Designer is the default tab — import it directly so it renders immediately
// with no loading flash (lazy-loading the always-shown view buys nothing).
import HexStrategist from './HexStrategist';

// The non-default tabs are loaded on demand — each pulls heavy libs (recharts
// for the radar, d3-force for the bubble map), so their chunk is only fetched
// when you open that tab. next/dynamic options must be inline literals (SWC).
const TabSkeleton = () => (
  <div className="grid h-[420px] place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-sm text-[var(--text-faint)]">
    Loading…
  </div>
);
const WhaleRadar = dynamic(() => import('./WhaleRadar'), { loading: TabSkeleton, ssr: false });
const TopHundred = dynamic(() => import('./TopHundred'), { loading: TabSkeleton, ssr: false });

type Mode = 'designer' | 'radar' | 'top100';

const SUBTITLE: Record<Mode, string> = {
  designer: 'Design a stake — the math tells you the best length, not just the numbers.',
  radar: 'Whale radar — big stakes unlocking soon, who’s likely to sell, and how well that call backtests.',
  top100: 'Top 100 leaderboards — biggest stakes, best ROI, latest activity, and the largest holders.',
};

const TABS: { key: Mode; label: string; icon: React.ReactNode; active: string }[] = [
  { key: 'designer', label: 'Designer', icon: <IconBolt className="h-3.5 w-3.5" />, active: 'text-orange-300' },
  { key: 'radar', label: 'Radar', icon: <IconRadar2 className="h-3.5 w-3.5" />, active: 'text-cyan-300' },
  { key: 'top100', label: 'Top 100', icon: <IconTrophy className="h-3.5 w-3.5" />, active: 'text-amber-300' },
];

// eHEX (HEX on Ethereum) is gated off until the Ethereum data source is wired
// up — the four tabs short-circuit to this rather than attempting a fetch.
function ComingSoon() {
  return (
    <div className="grid place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-20 text-center">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-base font-semibold text-[var(--text)]">
          <IconBolt className="h-5 w-5 text-orange-400" /> eHEX — coming soon
        </div>
        <p className="mx-auto max-w-sm text-xs text-[var(--text-muted)]">
          HEX-on-Ethereum support is on the way. For now, switch to PulseChain to use the Designer, Radar, and Top 100.
        </p>
      </div>
    </div>
  );
}

export default function HexStrategistTabs() {
  const [net, setNet] = useState<Network>('pulsechain');
  const [mode, setMode] = useState<Mode>('designer');

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-[var(--text)]">
            <IconBolt className="h-5 w-5 text-orange-400" /> HEX Stake Strategist
          </h1>
          <p className="text-xs text-[var(--text-muted)]">{SUBTITLE[mode]}</p>
        </div>
        <div className="flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {(['pulsechain', 'ethereum'] as const).map((n) => (
            <button
              key={n}
              onClick={() => setNet(n)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                net === n ? 'bg-[var(--surface-2)] text-orange-300' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Mode switch */}
      <div className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setMode(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === t.key ? `bg-[var(--surface-2)] ${t.active}` : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {net === 'ethereum' ? (
        <ComingSoon />
      ) : mode === 'designer' ? (
        <HexStrategist net={net} />
      ) : mode === 'radar' ? (
        <WhaleRadar net={net} />
      ) : (
        <TopHundred net={net} />
      )}
    </div>
  );
}
