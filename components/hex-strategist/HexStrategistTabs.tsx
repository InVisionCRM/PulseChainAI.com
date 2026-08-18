'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { IconBolt, IconRadar2, IconTrophy, IconShieldBolt, IconChartHistogram } from '@tabler/icons-react';
import type { Network, RatesSource } from '@/lib/hex/strategistData';
import EntryLoader, { type LoadPhase } from '@/components/EntryLoader';
// Macro is the landing tab — import it directly so it renders immediately with
// no loading flash (lazy-loading the always-shown view buys nothing).
import StakeHorizon from './StakeHorizon';

// The non-default tabs are loaded on demand — each pulls heavy libs (recharts
// for the radar, d3-force for the bubble map), so their chunk is only fetched
// when you open that tab. next/dynamic options must be inline literals (SWC).
const TabSkeleton = () => (
  <div className="grid h-[420px] place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-sm text-[var(--text-faint)]">
    Loading…
  </div>
);
const HexStrategist = dynamic(() => import('./HexStrategist'), { loading: TabSkeleton, ssr: false });
const WhaleRadar = dynamic(() => import('./WhaleRadar'), { loading: TabSkeleton, ssr: false });
const TopHundred = dynamic(() => import('./TopHundred'), { loading: TabSkeleton, ssr: false });
const StakerLeagues = dynamic(() => import('./StakerLeagues'), { loading: TabSkeleton, ssr: false });

type Mode = 'macro' | 'designer' | 'radar' | 'leagues' | 'top100';

const SUBTITLE: Record<Mode, string> = {
  macro: 'Every locked stake on the chain, plotted by the day it comes due — and where the cliffs are.',
  designer: 'Design a stake — the math tells you the best length, not just the numbers.',
  radar: 'Whale radar — big stakes unlocking soon, who’s likely to sell, and how well that call backtests.',
  leagues: 'Staker leagues — every tier is a slice of the chain’s T-Shares. Find your rank, then see what it costs to climb.',
  top100: 'Top 100 leaderboards — biggest stakes, best ROI, latest activity, and the largest holders.',
};

const TABS: { key: Mode; label: string; icon: React.ReactNode; active: string }[] = [
  { key: 'macro', label: 'Macro', icon: <IconChartHistogram className="h-3.5 w-3.5" />, active: 'text-sky-300' },
  { key: 'designer', label: 'Designer', icon: <IconBolt className="h-3.5 w-3.5" />, active: 'text-orange-300' },
  { key: 'radar', label: 'Radar', icon: <IconRadar2 className="h-3.5 w-3.5" />, active: 'text-cyan-300' },
  { key: 'leagues', label: 'Leagues', icon: <IconShieldBolt className="h-3.5 w-3.5" />, active: 'text-rose-300' },
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
  const [mode, setMode] = useState<Mode>('macro');
  /**
   * The two HEX feeds the landing tab waits on, reported as each settles. The
   * entry loader shows one step per feed, so every step names a request the
   * page is genuinely blocked on rather than counting up on a timer. Macro is
   * the landing tab and reports these; the Designer reports them too, for when
   * someone deep-links straight into it.
   */
  const [feeds, setFeeds] = useState<Record<RatesSource, LoadPhase>>({
    live: 'wait',
    daily: 'wait',
  });
  const onSource = useCallback(
    (source: RatesSource, ok: boolean) =>
      setFeeds((prev) => ({ ...prev, [source]: ok ? 'ok' : 'fail' })),
    [],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4">
      {/* eHEX short-circuits to ComingSoon before any fetch, so there is
          nothing to wait on and no loader to hold over it. */}
      {net === 'pulsechain' && (
        <EntryLoader
          ready={feeds.live !== 'wait' || feeds.daily !== 'wait'}
          steps={[
            { label: 'Live HEX rates', phase: feeds.live },
            { label: 'Daily series', phase: feeds.daily },
          ]}
          art={{
            landscape: '/hex-strategist-loading.jpg',
            portrait: '/hex-strategist-loading-portrait.jpg',
          }}
          markSrc="/hex-logo.svg"
          markLabel="HEX · Stake Strategist"
          title={{ lead: 'The math tells you', accent: 'the best length' }}
          sub="Reading the live T-Share rate and the daily series off the HEX contract."
          ariaLabel="Loading HEX Strategist"
          // This artwork is molten orange where SuperStake's is magenta, so the
          // ramp warms to sit with it rather than fight it.
          gradient="linear-gradient(135deg,#FF9445,#FF7A3D 40%,#FF5E3A 75%,#FFC94F)"
        />
      )}
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

      {/* Mode switch — scrolls rather than wraps, so a narrow phone keeps one
          clean row of tabs instead of breaking a label across two lines. */}
      <div className="flex max-w-full flex-nowrap overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setMode(t.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === t.key ? `bg-[var(--surface-2)] ${t.active}` : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {net === 'ethereum' ? (
        <ComingSoon />
      ) : mode === 'macro' ? (
        <StakeHorizon net={net} onSource={onSource} />
      ) : mode === 'designer' ? (
        <HexStrategist net={net} onSource={onSource} />
      ) : mode === 'radar' ? (
        <WhaleRadar net={net} />
      ) : mode === 'leagues' ? (
        <StakerLeagues net={net} />
      ) : (
        <TopHundred net={net} />
      )}
    </div>
  );
}
