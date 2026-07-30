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
  /** pSSH move since the previous day's close, as a percent. */
  psshChangePct: number | null;
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
  cycleNo, daysLeft, cycleDays, endISO, pSsh, psshChangePct, sShareCost, hexPerDollar,
  hexPerDollarStaking, hexWaiting, burned, burnedPct, isLive, asOf,
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
      <div className="relative flex items-stretch">
        {/* ── the cycle, in its own box ──
            It isn't a market figure like the rest of the row, and the countdown
            needs room to say what it is: the clock alone next to "49d left" read
            as a three-hour timer, when it was the hours *within* the last day. */}
        <div className="flex flex-none items-center gap-2.5 border-r-2 border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/superstake-logo.png" alt="" className="h-7 w-7 flex-none object-contain" />
          <span className="leading-tight">
            <span
              className="block text-[8px] uppercase tracking-[0.15em] text-[var(--text-faint)]"
              style={{ fontFamily: MONO }}
            >
              {cycleNo != null ? `Cycle ${cycleNo} ends in` : 'Cycle'}
            </span>
            <span className="block whitespace-nowrap text-[15px] font-bold tracking-[-0.02em] tabular-nums text-[var(--text)]">
              {cycleNo != null ? (
                <>
                  {daysLeft}
                  <span className="text-[10px] font-semibold text-[var(--text-faint)]">d</span>
                  {clock && (
                    <span className="ml-1.5 text-[12px] font-semibold" style={{ fontFamily: MONO }}>
                      {clock}
                    </span>
                  )}
                </>
              ) : (
                '—'
              )}
            </span>
            <span className="mt-1 block h-[3px] w-full overflow-hidden rounded bg-[var(--line-strong)]">
              <span
                className="block h-full rounded transition-[width] duration-700"
                style={{ width: `${elapsed * 100}%`, background: GRAD }}
              />
            </span>
          </span>
        </div>

        {/* `scrollbar-hide` is already used by the geicko tab rail for exactly this. */}
        <div className="scrollbar-hide flex flex-1 items-stretch overflow-x-auto">
          <Cell
            label="pSSH"
            value={pSsh != null ? `$${pSsh.toFixed(6)}` : '—'}
            change={psshChangePct}
            sub={isLive ? 'live · PulseX' : `snapshot · ${asOf ?? '—'}`}
          />

          {/* Same token, so it moves by exactly the same percent. */}
          <Cell
            label="1 S-share"
            value={sShareCost != null ? `$${sShareCost.toFixed(2)}` : '—'}
            change={psshChangePct}
            sub="5,555 pSSH"
          />

          {/* The page's whole argument as one figure, so it isn't buried in a
              comparison table two thirds of the way down. */}
          <Cell
            label="HEX per $1, a cycle"
            value={hexPerDollar != null ? hexPerDollar.toFixed(2) : '—'}
            sub={
              hexPerDollarStaking != null
                ? `${hexPerDollarStaking.toFixed(2)} if you stake HEX instead`
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
  label, value, sub, change, children, gradient, good, last,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Percent move to show beside the value; green up, red down. */
  change?: number | null;
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
      <span className="flex items-baseline gap-1.5">
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
        {change != null && Number.isFinite(change) && (
          <span
            className={`whitespace-nowrap text-[10px] font-bold tabular-nums ${
              // `--up` is the only signed token in globals.css; red-400 is what
              // the rest of the app uses for the down case.
              change >= 0 ? 'text-[var(--up)]' : 'text-red-400'
            }`}
          >
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}%
          </span>
        )}
      </span>
      {sub && (
        <span className="whitespace-nowrap text-[9px] tabular-nums text-[var(--text-muted)]">
          {sub}
        </span>
      )}
      {children}
    </div>
  );
}
