'use client';

import { useState } from 'react';
import { IconBolt, IconRadar2, IconTrophy, IconChartBubble } from '@tabler/icons-react';
import type { Network } from '@/lib/hex/strategistData';
import HexStrategist from './HexStrategist';
import WhaleRadar from './WhaleRadar';
import TopHundred from './TopHundred';
import StakeBubbleMap from './StakeBubbleMap';

type Mode = 'designer' | 'radar' | 'top100' | 'bubbles';

const SUBTITLE: Record<Mode, string> = {
  designer: 'Design a stake — the math tells you the best length, not just the numbers.',
  radar: 'Whale radar — big stakes unlocking soon, who’s likely to sell, and how well that call backtests.',
  top100: 'Top 100 leaderboards — biggest stakes, best ROI, latest activity, and the largest holders.',
  bubbles: 'Stake bubble map — every staker sized by their total stake, with linked-wallet clusters.',
};

const TABS: { key: Mode; label: string; icon: React.ReactNode; active: string }[] = [
  { key: 'designer', label: 'Designer', icon: <IconBolt className="h-3.5 w-3.5" />, active: 'text-orange-300' },
  { key: 'radar', label: 'Radar', icon: <IconRadar2 className="h-3.5 w-3.5" />, active: 'text-cyan-300' },
  { key: 'top100', label: 'Top 100', icon: <IconTrophy className="h-3.5 w-3.5" />, active: 'text-amber-300' },
  { key: 'bubbles', label: 'Bubble Map', icon: <IconChartBubble className="h-3.5 w-3.5" />, active: 'text-purple-300' },
];

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

      {mode === 'designer' ? (
        <HexStrategist net={net} />
      ) : mode === 'radar' ? (
        <WhaleRadar net={net} />
      ) : mode === 'top100' ? (
        <TopHundred net={net} />
      ) : (
        <StakeBubbleMap net={net} />
      )}
    </div>
  );
}
