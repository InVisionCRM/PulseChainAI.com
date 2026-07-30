'use client';

// Two views on what holding pSSH from day one actually did, in one panel.
//
// PAYOUT — $100 bought once at cycle 1's price and never touched. The share of
// supply is fixed, so the payout tracks one thing: the size of the stake when
// it ends. Deliberately NOT the same series as the cycle table, which re-enters
// at each cycle's own price and swings with it.
//
// BURN — what the buy-and-burn did to that same share. Burned pSSH is parked at
// 0x…dEaD rather than deducted from totalSupply, so the float shrinks and a
// balance that never moved owns a larger slice of it each cycle. Read off chain
// by /api/superstake/burns.
//
// Both series only ever rise, for different reasons, and the panel says which
// reason is which rather than letting one borrow the other's credibility.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SuperStakeCycle } from '@/lib/superstake/model';
import type { Cover } from '@/components/superstake/CycleTable';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';
/** Burn gets its own heat, so the two tabs never read as the same measurement. */
const BURN_GRAD = 'linear-gradient(135deg,#DC2626,#F97316 55%,#FBBF24)';
/** The 1% of the ended stake that goes to holders. */
const HOLDER_RATE = 0.01;
/** Buy-side toll, so $100 in is not $100 of pSSH. */
const TOLL = 0.055;

const gradText = {
  backgroundImage: GRAD,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
} as const;
const burnText = {
  backgroundImage: BURN_GRAD,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
} as const;

const hex1 = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(2));
const pct2 = (v: number) => `${v.toFixed(2)}%`;
const num0 = (v: number) => Math.round(v).toLocaleString();

interface BurnCycle {
  i: number;
  burnedAtOpen: number;
  burnedInCycle: number | null;
  supply: number;
  growthPct: number | null;
}

/**
 * Flips true the first time the element is seen, and stays true.
 *
 * The animation is a plain CSS transition with a staggered delay — it plays
 * once, on arrival, and does not rewind or track the wheel. IntersectionObserver
 * rather than a scroll listener on purpose: this app scrolls inside
 * `<main class="overflow-y-auto">` and the document never scrolls, so a window
 * scroll listener hears nothing. The observer doesn't care what scrolls.
 */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === 'undefined') return;

    if (
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      setSeen(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return [ref, seen] as const;
}

type Tab = 'payout' | 'burn';

export default function PayoutBars({
  cycles,
  coverage,
  supply,
  amount,
}: {
  cycles: SuperStakeCycle[];
  coverage: Map<number, Cover>;
  supply: number;
  amount: number;
}) {
  const [wrapRef, shown] = useInView<HTMLDivElement>();
  const [tab, setTab] = useState<Tab>('payout');
  const [burns, setBurns] = useState<BurnCycle[] | null>(null);
  const [burnState, setBurnState] = useState<'idle' | 'loading' | 'error'>('idle');

  // Fetched only when the burn tab is first opened. A cold build walks eighteen
  // archive reads one at a time and takes ~19s; nobody who came for the payout
  // chart should pay that.
  const loadBurns = useCallback(async () => {
    if (burns || burnState === 'loading') return;
    setBurnState('loading');
    try {
      const res = await fetch('/api/superstake/burns');
      const json = (await res.json()) as { cycles?: BurnCycle[] };
      if (!res.ok || !json.cycles?.length) throw new Error('unavailable');
      setBurns(json.cycles);
      setBurnState('idle');
    } catch {
      setBurnState('error');
    }
  }, [burns, burnState]);

  useEffect(() => {
    if (tab === 'burn') void loadBurns();
  }, [tab, loadBurns]);

  const model = useMemo(() => {
    const done = cycles.filter((c) => c.done);
    if (done.length === 0 || !(supply > 0)) return null;

    const psshBought = (amount * (1 - TOLL)) / done[0].pS0;
    if (!(psshBought > 0)) return null;
    const share = psshBought / supply;

    let cum = 0;
    const pts = done.map((c) => {
      const v = share * HOLDER_RATE * (c.hex + c.nY);
      cum += v;
      return { i: c.i, v };
    });

    const ratios = done
      .map((c) => coverage.get(c.i)?.ratio)
      .filter((r): r is number => typeof r === 'number' && Number.isFinite(r) && r > 0);

    return {
      pts,
      share,
      psshBought,
      total: cum,
      first: pts[0],
      last: pts[pts.length - 1],
      rose: pts.slice(1).filter((p, k) => p.v > pts[k].v).length,
      steps: pts.length - 1,
      covered: ratios.filter((r) => r >= 1).length,
      ratioCount: ratios.length,
      minRatio: ratios.length ? Math.min(...ratios) : null,
    };
  }, [cycles, coverage, supply, amount]);

  // Only cycles that have closed have a burn step to show.
  const burnModel = useMemo(() => {
    if (!burns) return null;
    const pts = burns
      .filter((b) => b.growthPct != null && b.growthPct > 0)
      .map((b) => ({ i: b.i, v: b.growthPct as number, burned: b.burnedInCycle ?? 0 }));
    if (pts.length === 0) return null;
    const best = pts.reduce((a, b) => (b.v > a.v ? b : a));
    const firstSupply = burns[0].supply;
    const lastSupply = burns[burns.length - 1].supply;
    return {
      pts,
      best,
      last: pts[pts.length - 1],
      burnedAllTime: burns[burns.length - 1].burnedAtOpen,
      supplyNow: lastSupply,
      allTimeGrowth: lastSupply > 0 ? (firstSupply / lastSupply - 1) * 100 : 0,
      everyCycle: pts.length === burns.length - 1,
    };
  }, [burns]);

  if (!model) return null;

  const { pts, psshBought, share, first, last, rose, steps, covered, ratioCount, minRatio } = model;
  const everyCycle = rose === steps;
  const alwaysCovered = ratioCount > 0 && covered === ratioCount;

  return (
    <div
      ref={wrapRef}
      className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <h3 className="text-sm font-bold tracking-tight text-[var(--text)]">
          {tab === 'payout'
            ? `$${amount} on day one, never touched`
            : 'What the burn does to that same share'}
        </h3>

        <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {(
            [
              ['payout', 'Payout'],
              ['burn', 'Burn'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                tab === key
                  ? 'text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
              style={
                tab === key
                  ? { background: key === 'burn' ? BURN_GRAD : GRAD, color: '#fff' }
                  : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'payout' ? (
        <>
          <div className="grid grid-cols-2 gap-px border-b border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
            <Fig
              label="Bought once"
              value={num0(psshBought)}
              sub={`pSSH · ${(share * 100).toFixed(4)}% of supply, fixed`}
            />
            <Fig label={`Cycle ${first.i}`} value={`${hex1(first.v)} HEX`} sub="the first payout" />
            <Fig
              label={`Cycle ${last.i}`}
              value={`${hex1(last.v)} HEX`}
              sub="the latest payout"
              grad
            />
            <Fig
              label="Collected so far"
              value={`${hex1(model.total)} HEX`}
              sub={`across ${pts.length} cycles`}
            />
          </div>

          <Bars
            pts={pts}
            shown={shown}
            gradId="ssp-hold"
            stops={['#7E089D', '#D83639', '#FB9438']}
            fmt={hex1}
            unit="HEX"
            ariaLabel={`HEX paid each cycle to a $${amount} holder who bought on day one and held. It rises every cycle, from ${hex1(first.v)} HEX at cycle ${first.i} to ${hex1(last.v)} HEX at cycle ${last.i}, ${hex1(model.total)} HEX in total.`}
          />

          <div className="border-t border-[var(--line)] px-4 py-3">
            <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              Buy once and your share of supply stops moving. From then on the payout depends on one
              thing — how big the stake is when it ends. A cycle hands holders{' '}
              <b className="text-[var(--text)]">1% of the pool</b> and puts back its yield plus
              whatever the buy-tax bought.{' '}
              <b className="text-[var(--text)]">
                While more comes in than the 1% that goes out, the pool is bigger next cycle
              </b>{' '}
              — and 1% of a bigger pool is a bigger payout on a share that never changed.
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-faint)]">
              {alwaysCovered ? (
                <>
                  That has held for every cycle so far: all {ratioCount} brought in more HEX than
                  they paid out
                  {minRatio != null && (
                    <>
                      , <b style={gradText}>{minRatio.toFixed(2)}×</b> at the tightest
                    </>
                  )}
                  . The condition is what carries it forward, not the record — while HEX keeps
                  paying a yield and the buy-tax keeps buying, the pool keeps growing and so does
                  this bar.
                </>
              ) : (
                <>
                  {covered} of {ratioCount} cycles brought in more HEX than they paid out. The
                  payout only climbs while that holds.
                </>
              )}{' '}
              {everyCycle ? `All ${steps} moves were up. ` : `${rose} of ${steps} moves were up. `}
              Figures are HEX, not dollars — the stake is measured in HEX and so is what it pays.
            </p>
          </div>
        </>
      ) : burnState === 'loading' ? (
        <div className="px-4 py-14 text-center text-xs text-[var(--text-faint)]">
          Reading the burn off chain, one cycle boundary at a time…
        </div>
      ) : burnState === 'error' || !burnModel ? (
        <div className="px-4 py-14 text-center text-xs text-[var(--text-faint)]">
          Couldn&apos;t read the full burn history just now.
          <button
            type="button"
            onClick={() => {
              setBurnState('idle');
              void loadBurns();
            }}
            className="ml-2 rounded-md border border-[var(--line-strong)] px-2.5 py-1 font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px border-b border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
            <Fig
              label="Burned all time"
              value={num0(burnModel.burnedAllTime)}
              sub={`pSSH · float down to ${num0(burnModel.supplyNow)}`}
            />
            <Fig
              label={`Best · cycle ${burnModel.best.i}`}
              value={`+${pct2(burnModel.best.v)}`}
              sub={`${num0(burnModel.best.burned)} pSSH burned`}
            />
            <Fig
              label={`Cycle ${burnModel.last.i}`}
              value={`+${pct2(burnModel.last.v)}`}
              sub={`${num0(burnModel.last.burned)} pSSH burned`}
            />
            <Fig
              label="Share growth all time"
              value={`+${pct2(burnModel.allTimeGrowth)}`}
              sub={`across ${burnModel.pts.length} cycles`}
              burn
            />
          </div>

          <Bars
            pts={burnModel.pts}
            shown={shown}
            gradId="ssp-burn"
            stops={['#DC2626', '#F97316', '#FBBF24']}
            fmt={(v) => v.toFixed(2)}
            unit="%"
            ariaLabel={`Percentage growth in a fixed pSSH holding's share of supply each cycle, caused by the burn. The largest was cycle ${burnModel.best.i} at ${pct2(burnModel.best.v)} and the total across ${burnModel.pts.length} cycles is ${pct2(burnModel.allTimeGrowth)}.`}
          />

          <div className="border-t border-[var(--line)] px-4 py-3">
            <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              Burned pSSH isn&apos;t deducted from the total — it&apos;s sent to the dead address
              and parked there, which is why total supply still reads 55,550,000. What shrinks is
              the float.{' '}
              <b className="text-[var(--text)]">
                Every burn makes a balance that never moved a larger slice of what&apos;s left
              </b>
              , so this stacks on top of the payout rather than competing with it: a bigger share of
              a bigger pool.
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-faint)]">
              {burnModel.everyCycle
                ? 'Every cycle so far has burned something, so the float has only ever fallen. '
                : 'The float falls in any cycle that burns. '}
              Each bar is that cycle&apos;s gain in ownership for an untouched balance — read from
              the dead address&apos;s pSSH balance at each cycle&apos;s opening block, not modelled.
              Compounded, they come to{' '}
              <b style={burnText}>+{pct2(burnModel.allTimeGrowth)}</b> since cycle{' '}
              {burnModel.pts[0].i}.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/** The shared chart. Both tabs are "a value per cycle", so they share one. */
function Bars({
  pts,
  shown,
  gradId,
  stops,
  fmt,
  unit,
  ariaLabel,
}: {
  pts: { i: number; v: number }[];
  shown: boolean;
  gradId: string;
  stops: [string, string, string] | string[];
  fmt: (v: number) => string;
  unit: string;
  ariaLabel: string;
}) {
  const W = 680;
  const H = 210;
  const TOP = 28;
  const BASE = H - 18;
  // Gutter for the axis labels. Without it the plot starts at x=0 and the bars,
  // which paint after the gridlines, cover the numbers — invisible on the
  // payout tab where the first bar is the shortest, obvious on burn where it is
  // the tallest and read "1.31, 0, 0, 0".
  const PAD_L = 34;
  const plotW = W - PAD_L;
  const slot = plotW / pts.length;
  const bw = Math.min(34, slot * 0.62);
  const max = Math.max(...pts.map((p) => p.v));

  return (
    <div className="overflow-x-auto px-4 pb-3 pt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full min-w-[560px] overflow-visible"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={stops[0]} />
            <stop offset="0.5" stopColor={stops[1]} />
            <stop offset="1" stopColor={stops[2]} />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = BASE - f * (BASE - TOP);
          return (
            <g key={f}>
              <line x1={PAD_L} y1={y} x2={W} y2={y} stroke="var(--line)" strokeWidth="1" />
              {f > 0 && (
                <text
                  x={PAD_L - 4}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[var(--text-faint)]"
                  style={{ fontFamily: MONO, fontSize: 8.5 }}
                >
                  {fmt(max * f)}
                </text>
              )}
            </g>
          );
        })}

        {pts.map((p, k) => {
          const h = Math.max(2, (p.v / max) * (BASE - TOP));
          const x = PAD_L + k * slot + (slot - bw) / 2;
          const y = BASE - h;
          const delay = k * 60;
          return (
            <g key={p.i}>
              <title>{`Cycle ${p.i}: ${fmt(p.v)}${unit === '%' ? '%' : ` ${unit}`}`}</title>
              <rect
                x={x}
                y={y}
                width={bw}
                height={h}
                rx="3"
                fill={`url(#${gradId})`}
                className="origin-bottom transition-transform duration-700 ease-out [transform-box:fill-box]"
                style={{
                  transform: shown ? 'scaleY(1)' : 'scaleY(0)',
                  transitionDelay: `${delay}ms`,
                }}
              />
              <text
                x={x + bw / 2}
                y={y - 6}
                textAnchor="middle"
                className={`transition-opacity duration-300 ease-out ${
                  k === pts.length - 1 ? 'fill-[var(--text)]' : 'fill-[var(--text-muted)]'
                }`}
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  fontWeight: k === pts.length - 1 ? 700 : 400,
                  opacity: shown ? 1 : 0,
                  // Waits out its bar's full 700ms rise, not part of it. At
                  // 420ms the number was legible while the bar was still short
                  // — mid-build the last bar read 19.62 while standing lower
                  // than the one before it, which looks like bad data.
                  transitionDelay: `${delay + 700}ms`,
                }}
              >
                {fmt(p.v)}
              </text>
              <text
                x={x + bw / 2}
                y={H - 4}
                textAnchor="middle"
                className="fill-[var(--text-faint)]"
                style={{ fontFamily: MONO, fontSize: 9 }}
              >
                {p.i}
              </text>
            </g>
          );
        })}

        <line x1={PAD_L} y1={BASE} x2={W} y2={BASE} stroke="var(--line-strong)" strokeWidth="1" />
      </svg>
    </div>
  );
}

function Fig({
  label,
  value,
  sub,
  grad,
  burn,
}: {
  label: string;
  value: string;
  sub: string;
  grad?: boolean;
  burn?: boolean;
}) {
  return (
    <div className="bg-[var(--panel)] px-3.5 py-3">
      <div
        className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-[clamp(18px,2.6vw,24px)] font-bold tracking-[-0.03em] tabular-nums text-[var(--text)]"
        style={burn ? burnText : grad ? gradText : undefined}
      >
        {value}
      </div>
      <div className="text-[10px] text-[var(--text-faint)]">{sub}</div>
    </div>
  );
}
