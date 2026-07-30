'use client';

// The live strip across the top of /superstake.
//
// Every number a returning holder opens the page for lives here, so the page
// underneath is free to explain rather than report. Cells size to their own
// content and the row scrolls sideways when it runs out of width — sharing the
// row evenly means a long value gets squashed or overlapped, and a wrong-looking
// number is worse than a swipe.

import { useEffect, useState, type ReactNode } from 'react';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';

export interface StatBannerProps {
  cycleNo: number | null;
  daysLeft: number;
  cycleDays: number;
  /** End of the running cycle, so the cell can tick down to it. */
  endISO?: string | null;
  /** pSSH price, USD. */
  pSsh: number | null;
  /** What 5,555 pSSH costs today. */
  sShareCost: number | null;
  /** HEX per $1 per cycle, holding pSSH vs staking the HEX yourself. */
  hexPerDollar: number | null;
  hexPerDollarStaking: number | null;
  /** HEX the 2% has bought and is holding until the next end-stake. */
  hexWaiting: number | null;
  burned: number | null;
  burnedPct: number | null;
  /** True when the prices came from the subgraph rather than the snapshot. */
  isLive: boolean;
  asOf?: string;
}

const num = (n: number, dp = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(0);

export default function StatBanner({
  cycleNo, daysLeft, cycleDays, endISO, pSsh, sShareCost, hexPerDollar, hexPerDollarStaking,
  hexWaiting, burned, burnedPct, isLive, asOf,
}: StatBannerProps) {
  const elapsed = cycleDays > 0 ? Math.min(1, Math.max(0, (cycleDays - daysLeft) / cycleDays)) : 0;
  const clock = useCountdown(endISO);

  return (
    <div className="relative border-b border-[var(--line)] bg-[var(--panel)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px opacity-90"
        style={{ background: GRAD }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(180deg,rgba(126,8,157,0.10),transparent 70%)' }}
      />
      {/* `scrollbar-hide` is already used by the geicko tab rail for exactly this. */}
      <div className="scrollbar-hide relative flex items-stretch overflow-x-auto">
        <div className="flex flex-none items-center gap-2 border-r border-[var(--line)] px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/superstake-logo.png" alt="" className="h-6 w-6 flex-none object-contain" />
          <span className="leading-tight">
            <span className="block text-[12.5px] font-bold tracking-[-0.01em] text-[var(--text)]">
              pSSH
            </span>
            <span
              className="block text-[8.5px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
              style={{ fontFamily: MONO }}
            >
              SuperStake
            </span>
          </span>
        </div>

        {/* The countdown was the one part of the old header that earned its
            space, so it keeps its live clock rather than becoming a flat "49d". */}
        <Cell
          label="Cycle"
          value={cycleNo != null ? `${cycleNo} · ${daysLeft}d left` : '—'}
          sub={clock ?? undefined}
          subMono
        >
          <span className="mt-1 block h-[2px] overflow-hidden rounded bg-[var(--line-strong)]">
            <span
              className="block h-full rounded transition-[width] duration-700"
              style={{ width: `${elapsed * 100}%`, background: GRAD }}
            />
          </span>
        </Cell>

        <Cell
          label="pSSH"
          value={pSsh != null ? `$${pSsh.toFixed(6)}` : '—'}
          sub={isLive ? 'live · PulseX' : `snapshot · ${asOf ?? '—'}`}
        />

        <Cell
          label="1 S-share"
          value={sShareCost != null ? `$${sShareCost.toFixed(2)}` : '—'}
          sub="5,555 pSSH"
        />

        {/* The page's whole argument as one figure, so it isn't buried in a
            comparison table two thirds of the way down. */}
        <Cell
          label="HEX per $1"
          value={hexPerDollar != null ? hexPerDollar.toFixed(2) : '—'}
          sub={
            hexPerDollarStaking != null
              ? `vs ${hexPerDollarStaking.toFixed(2)} staking it yourself`
              : undefined
          }
          gradient
        />

        <Cell
          label="HEX this cycle"
          value={hexWaiting != null ? num(Math.round(hexWaiting)) : '—'}
          sub="bought, not yet staked"
          good
        />

        <Cell
          label="Burned"
          value={burned != null ? compact(burned) : '—'}
          sub={burnedPct != null ? `${burnedPct.toFixed(1)}% · never returns` : undefined}
          last
        />
      </div>
    </div>
  );
}

/**
 * Time to the cycle's end, hh:mm:ss. Null until after mount so the server's
 * first paint and the client's agree — a countdown can't be rendered on the
 * server without them disagreeing a second later.
 */
function useCountdown(endISO?: string | null): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!endISO) return;
    const end = Date.parse(`${endISO}T00:00:00Z`);
    if (!Number.isFinite(end)) return;
    const tick = () => {
      const ms = end - Date.now();
      if (ms <= 0) return setText('00:00:00');
      const s = Math.floor(ms / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setText(`${pad(Math.floor((s % 86_400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endISO]);
  return text;
}

function Cell({
  label, value, sub, subMono, children, gradient, good, last,
}: {
  label: string;
  value: string;
  sub?: string;
  subMono?: boolean;
  children?: ReactNode;
  gradient?: boolean;
  good?: boolean;
  last?: boolean;
}) {
  return (
    // `min-w-max` is what stops a neighbour ever squashing or overlapping this.
    <div
      className={`flex min-w-max flex-auto flex-col gap-px px-4 py-2 ${
        last ? '' : 'border-r border-[var(--line)]'
      }`}
    >
      <span
        className="whitespace-nowrap text-[8px] uppercase tracking-[0.15em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        {label}
      </span>
      <span
        className={`whitespace-nowrap text-[14px] font-bold tracking-[-0.02em] tabular-nums ${
          good ? 'text-[var(--up)]' : 'text-[var(--text)]'
        }`}
        style={
          gradient
            ? {
                backgroundImage: GRAD,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }
            : undefined
        }
      >
        {value}
      </span>
      {sub && (
        <span
          className="whitespace-nowrap text-[9px] tabular-nums text-[var(--text-muted)]"
          style={subMono ? { fontFamily: MONO } : undefined}
        >
          {sub}
        </span>
      )}
      {children}
    </div>
  );
}
