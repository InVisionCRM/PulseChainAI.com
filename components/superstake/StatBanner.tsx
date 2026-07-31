'use client';

// The live strip across the top of /superstake.
//
// Every number a returning holder opens the page for lives here, so the page
// underneath is free to explain rather than report.
//
// There are six of them and only room to read three at a time, so the strip is
// three equal columns that flip between the two sets — staggered, so the row
// rolls over rather than snapping, then holds long enough to actually read.
// Equal columns are the point: the old strip sized cells to their content and
// the cycle box ate a third of the width on its own, which left the figures
// that matter at eight and fourteen pixels. At a third each they can be twice
// that.
//
// The flip pauses on hover or keyboard focus — a number sliding away mid-read
// is worse than no animation — and is skipped entirely for anyone who has asked
// for reduced motion, who gets all six laid out at once instead.

import { useEffect, useState, type ReactNode } from 'react';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';

/** How long one card takes to turn over. */
const FLIP_MS = 700;
/** The lag between columns — what makes it a roll rather than a switch. */
const STAGGER_MS = 160;
/** Time the set stays put once the last column has landed. */
const HOLD_MS = 3000;
const PERIOD = FLIP_MS + STAGGER_MS * 2 + HOLD_MS;

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

interface Card {
  key: string;
  label: string;
  value: string;
  sub?: string;
  /**
   * Shorter wording for phone widths. A third of 390px is 116px, and the full
   * copy overran it on three of the six cards — clipping a label is how you end
   * up with "HEX PER $1, A CYCL".
   */
  labelShort?: string;
  subShort?: string;
  /** Percent move; green up, red down. Sits on the sub line so the figure above it gets the full column. */
  change?: number | null;
  gradient?: boolean;
  good?: boolean;
  /** Rendered under the value instead of `sub` — the cycle's progress bar. */
  extra?: ReactNode;
}

export default function StatBanner({
  cycleNo, daysLeft, cycleDays, endISO, pSsh, psshChangePct, sShareCost, hexPerDollar,
  hexPerDollarStaking, hexWaiting, burned, burnedPct, isLive, asOf,
}: StatBannerProps) {
  const elapsed = cycleDays > 0 ? Math.min(1, Math.max(0, (cycleDays - daysLeft) / cycleDays)) : 0;
  const clock = useCountdown(endISO);
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [face, setFace] = useState(0);

  useEffect(() => {
    if (reduce || paused) return;
    const id = setInterval(() => setFace((f) => 1 - f), PERIOD);
    return () => clearInterval(id);
  }, [reduce, paused]);

  const cards: Card[] = [
    // ── front ──
    {
      key: 'cycle',
      label: cycleNo != null ? `Cycle ${cycleNo} ends in` : 'Cycle',
      // The clock alone beside "49d" once read as a three-hour timer; it is the
      // hours *within* the final day, so the two stay welded into one figure.
      value: cycleNo != null ? `${daysLeft}d` : '—',
      change: null,
      extra: (
        <span className="mt-1 flex items-center gap-2">
          <span className="h-[3px] flex-1 overflow-hidden rounded bg-[var(--line-strong)]">
            <span
              className="block h-full rounded transition-[width] duration-700"
              style={{ width: `${elapsed * 100}%`, background: GRAD }}
            />
          </span>
          {clock && (
            <span
              className="whitespace-nowrap text-[clamp(9px,1.05vw,11.5px)] font-semibold tabular-nums text-[var(--text-muted)]"
              style={{ fontFamily: MONO }}
            >
              {clock}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'pssh',
      label: 'pSSH',
      value: pSsh != null ? `$${pSsh.toFixed(6)}` : '—',
      change: psshChangePct,
      sub: isLive ? 'live · PulseX' : `snapshot · ${asOf ?? '—'}`,
    },
    {
      // The page's whole argument as one figure, so it isn't buried in a
      // comparison table two thirds of the way down.
      key: 'perdollar',
      label: 'HEX per $1, a cycle',
      labelShort: 'HEX per $1',
      value: hexPerDollar != null ? hexPerDollar.toFixed(2) : '—',
      sub:
        hexPerDollarStaking != null
          ? `${hexPerDollarStaking.toFixed(2)} staking HEX yourself`
          : undefined,
      subShort: hexPerDollarStaking != null ? `vs ${hexPerDollarStaking.toFixed(2)} staked` : undefined,
      gradient: true,
    },
    // ── back ──
    {
      // Same token as pSSH, so it moves by exactly the same percent.
      key: 'sshare',
      label: '1 S-share',
      value: sShareCost != null ? `$${sShareCost.toFixed(2)}` : '—',
      change: psshChangePct,
      sub: '5,555 pSSH',
    },
    {
      key: 'waiting',
      label: 'HEX this cycle',
      value: hexWaiting != null ? num(Math.round(hexWaiting)) : '—',
      sub: 'bought, not yet staked',
      subShort: 'not yet staked',
      good: true,
    },
    {
      key: 'burned',
      label: 'Burned',
      value: burned != null ? compact(burned) : '—',
      sub: burnedPct != null ? `${burnedPct.toFixed(1)}% · never returns` : undefined,
      subShort: burnedPct != null ? `${burnedPct.toFixed(1)}% · for good` : undefined,
    },
  ];

  return (
    <div
      className="relative border-b border-[var(--line)] bg-[var(--panel)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
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
        {/* The mark stays put rather than riding a card, so it doesn't vanish
            for three seconds out of every eight. */}
        <div className="flex flex-none items-center border-r border-[var(--line)] px-2 sm:px-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/superstake-logo.png"
            alt="SuperStake"
            className="h-6 w-6 object-contain sm:h-7 sm:w-7"
          />
        </div>

        {reduce ? (
          // No motion: all six at once, two rows of three.
          <div className="grid flex-1 grid-cols-3">
            {cards.map((c, i) => (
              <div
                key={c.key}
                className={`${i % 3 === 2 ? '' : 'border-r border-[var(--line)]'} ${
                  i < 3 ? 'border-b border-[var(--line)]' : ''
                }`}
              >
                <Face card={c} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`[perspective:900px] ${i === 2 ? '' : 'border-r border-[var(--line)]'}`}
              >
                <div
                  className="relative h-[clamp(64px,8.6vw,84px)] w-full transition-transform [transform-style:preserve-3d]"
                  style={{
                    transform: `rotateX(${face * 180}deg)`,
                    transitionDuration: `${FLIP_MS}ms`,
                    transitionDelay: `${i * STAGGER_MS}ms`,
                  }}
                >
                  {/* Both faces stay in the accessibility tree — a screen reader
                      should get all six figures, not whichever three happen to
                      be pointing outward at the time. */}
                  <Face card={cards[i]} className="absolute inset-0 [backface-visibility:hidden]" />
                  <Face
                    card={cards[i + 3]}
                    className="absolute inset-0 [backface-visibility:hidden] [transform:rotateX(180deg)]"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
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

/** False until after mount, so the server's markup and the client's agree. */
function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

/** One side of one column. Every card is this shape, so the flip stays square. */
function Face({ card, className = '' }: { card: Card; className?: string }) {
  const { label, labelShort, value, sub, subShort, change, gradient, good, extra } = card;
  const hasChange = change != null && Number.isFinite(change);
  return (
    <div
      className={`flex flex-col justify-center gap-px overflow-hidden bg-[var(--panel)] px-2.5 py-1.5 sm:px-3.5 ${className}`}
    >
      {/* The percent rides the label row: the value row needs the full column
          for the figure, and the sub row was left with 53px of 96 once the
          badge had taken its share. The label is four to ten characters and has
          the slack. */}
      <span className="flex items-baseline justify-between gap-1">
        <span
          className="truncate text-[clamp(8px,1.05vw,10px)] uppercase leading-tight tracking-[0.15em] text-[var(--text-faint)]"
          style={{ fontFamily: MONO }}
        >
          <Resp full={label} short={labelShort} />
        </span>
        {hasChange && (
          <b
            className={`flex-none whitespace-nowrap text-[clamp(9px,1.05vw,11.5px)] font-bold tabular-nums ${
              // `--up` is the only signed token in globals.css; red-400 is what
              // the rest of the app uses for the down case.
              change >= 0 ? 'text-[var(--up)]' : 'text-red-400'
            }`}
          >
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}%
          </b>
        )}
      </span>
      {/* The figure owns the whole column. Sitting the percent beside it left
          $0.003635 with 51 of 96 usable pixels and clipped mid-number. */}
      <span
        className={`truncate text-[clamp(15px,2.5vw,24px)] font-bold leading-none tracking-[-0.03em] tabular-nums ${
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
      {extra ??
        (sub && (
          <span className="truncate text-[clamp(9px,1.05vw,11.5px)] leading-tight tabular-nums text-[var(--text-muted)]">
            <Resp full={sub} short={subShort} />
          </span>
        ))}
    </div>
  );
}

/** Full wording from `sm` up, the short one below it — when a short one exists. */
function Resp({ full, short }: { full: string; short?: string }) {
  if (!short) return <>{full}</>;
  return (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{full}</span>
    </>
  );
}
