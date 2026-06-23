'use client';

import { useState } from 'react';
import { IconBolt, IconChartHistogram, IconRadar2 } from '@tabler/icons-react';
import type { Network } from '@/lib/hex/strategistData';
import HexStrategist from './HexStrategist';
import RealizedReturns from './RealizedReturns';
import WhaleRadar from './WhaleRadar';

type Mode = 'designer' | 'returns' | 'radar';

const SUBTITLE: Record<Mode, string> = {
  designer: 'Design a stake — the math tells you the best length, not just the numbers.',
  returns: 'What stakers actually earned, by the term they committed to — the reality check on the projection.',
  radar: 'Whale radar — big stakes unlocking soon, who’s likely to sell, and how well that call backtests.',
};

const TABS: { key: Mode; label: string; icon: React.ReactNode; active: string }[] = [
  { key: 'designer', label: 'Designer', icon: <IconBolt className="h-3.5 w-3.5" />, active: 'text-orange-300' },
  { key: 'returns', label: 'Returns', icon: <IconChartHistogram className="h-3.5 w-3.5" />, active: 'text-emerald-300' },
  { key: 'radar', label: 'Radar', icon: <IconRadar2 className="h-3.5 w-3.5" />, active: 'text-cyan-300' },
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
      ) : mode === 'returns' ? (
        <RealizedReturns net={net} />
      ) : (
        <WhaleRadar net={net} />
      )}
    </div>
  );
}
