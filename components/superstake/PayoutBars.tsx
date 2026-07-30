'use client';

// $100 bought on day one and never touched.
//
// This is the buy-and-hold view, and it is deliberately NOT the same series as
// the cycle table's Payout column. That column re-enters at each cycle's own
// pSSH price, so it swings with the entry price — six of its sixteen moves are
// down, every one of them a cycle where pSSH opened dearer. Here the pSSH is
// bought once, so the holder's share of supply is fixed and the payout tracks
// one thing only: the size of the stake when it ends.
//
// That is why this series only ever rises. The mechanism is a ratchet: a cycle
// pays out 1% of the pool and puts back its yield plus whatever the buy-tax
// bought. While what comes in beats the 1% that goes out, the pool is larger
// next cycle, and 1% of a larger pool is a larger payout on an unchanged share.
// It has held for all 17 cycles, 1.66x at the tightest.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SuperStakeCycle } from '@/lib/superstake/model';
import type { Cover } from '@/components/superstake/CycleTable';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';
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

const hex1 = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(2));

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Scroll-linked progress, 0 to 1, for the element the ref is on.
 *
 * Deliberately scroll-LINKED rather than scroll-triggered: the value is
 * recomputed from the element's position every frame, so scrolling back up
 * runs it backwards. A triggered animation fires once on a threshold and has
 * no way to rewind, which is what the previous version did.
 *
 * The band runs from the chart's top crossing 88% of the viewport height
 * (just as it appears) to it crossing 30% (comfortably read), which is enough
 * runway for seventeen bars without demanding a long scroll. Returns 1 flat
 * when motion is reduced, so the chart is simply complete.
 */
function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === 'undefined') return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setP(1);
      return;
    }

    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = node.getBoundingClientRect();
      const vh = window.innerHeight || 0;
      if (vh === 0) return;
      const start = vh * 0.88;
      const end = vh * 0.3;
      setP(clamp01((start - r.top) / Math.max(1, start - end)));
    };
    const onScroll = () => {
      if (raf === 0) raf = requestAnimationFrame(measure);
    };

    measure();
    // Capture phase on the document, NOT a window scroll listener: this app
    // scrolls inside `<main class="overflow-y-auto">`, the document itself
    // never scrolls, and scroll events don't bubble. A window listener sits
    // silent here and the bars never move.
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return [ref, p] as const;
}

/**
 * Turn overall progress into one bar's own 0-1, so the bars resolve in
 * sequence rather than together. Each bar gets a slice of the runway and the
 * slices overlap, which keeps the build continuous instead of steppy.
 */
function barProgress(p: number, index: number, count: number) {
  const span = 1 / count;
  const overlap = span * 1.9;
  const raw = (p - index * span) / overlap;
  // Ease out, so a bar settles into its final height rather than snapping.
  return 1 - Math.pow(1 - clamp01(raw), 3);
}

export default function PayoutBars({
  cycles,
  coverage,
  supply,
  amount,
}: {
  /** Finished cycles, in order. */
  cycles: SuperStakeCycle[];
  /** Cycle number -> what that cycle brought in against the 1% it paid out. */
  coverage: Map<number, Cover>;
  /** pSSH supply the model prices a share against. */
  supply: number;
  amount: number;
}) {
  const [wrapRef, scroll] = useScrollProgress<HTMLDivElement>();

  const model = useMemo(() => {
    const done = cycles.filter((c) => c.done);
    if (done.length === 0 || !(supply > 0)) return null;

    // Bought once, at the first cycle's opening price. This share never moves
    // again — no re-entry, no averaging in.
    const psshBought = (amount * (1 - TOLL)) / done[0].pS0;
    if (!(psshBought > 0)) return null;
    const share = psshBought / supply;

    let cum = 0;
    const pts = done.map((c) => {
      const pool = c.hex + c.nY;
      const v = share * HOLDER_RATE * pool;
      cum += v;
      return { i: c.i, v, pool };
    });

    const ratios = done
      .map((c) => coverage.get(c.i)?.ratio)
      .filter((r): r is number => typeof r === 'number' && Number.isFinite(r) && r > 0);
    const covered = ratios.filter((r) => r >= 1).length;

    return {
      pts,
      share,
      psshBought,
      total: cum,
      max: Math.max(...pts.map((p) => p.v)),
      first: pts[0],
      last: pts[pts.length - 1],
      // Stated, not assumed: if a cycle ever paid more than it took in, this
      // stops being "every cycle" and the copy below says so.
      rose: pts.slice(1).filter((p, k) => p.v > pts[k].v).length,
      steps: pts.length - 1,
      covered,
      ratioCount: ratios.length,
      minRatio: ratios.length ? Math.min(...ratios) : null,
    };
  }, [cycles, coverage, supply, amount]);

  // The running total is the sum of what has actually been drawn, so the
  // figure and the bars can never disagree mid-scroll — scroll halfway and it
  // reads the total of the bars standing.
  const total = useMemo(() => {
    if (!model) return 0;
    return model.pts.reduce(
      (sum, p, k) => sum + p.v * barProgress(scroll, k, model.pts.length),
      0,
    );
  }, [model, scroll]);

  if (!model) return null;

  const { pts, psshBought, share, max, first, last, rose, steps, covered, ratioCount, minRatio } =
    model;
  const everyCycle = rose === steps;
  const alwaysCovered = ratioCount > 0 && covered === ratioCount;

  const W = 680;
  const H = 210;
  const TOP = 28;
  const BASE = H - 18;
  const slot = W / pts.length;
  const bw = Math.min(34, slot * 0.62);

  return (
    <div
      ref={wrapRef}
      className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <h3 className="text-sm font-bold tracking-tight text-[var(--text)]">
          ${amount} on day one, never touched
        </h3>
        <span className="text-xs text-[var(--text-faint)]">
          {everyCycle ? (
            <>
              every cycle has paid more than the last —{' '}
              <b style={gradText}>{steps} for {steps}</b>
            </>
          ) : (
            <>
              {rose} of {steps} cycles paid more than the last
            </>
          )}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
        <Fig
          label="Bought once"
          value={Math.round(psshBought).toLocaleString()}
          sub={`pSSH · ${(share * 100).toFixed(4)}% of supply, fixed`}
        />
        <Fig label={`Cycle ${first.i}`} value={`${hex1(first.v)} HEX`} sub="the first payout" />
        <Fig label={`Cycle ${last.i}`} value={`${hex1(last.v)} HEX`} sub="the latest payout" grad />
        <Fig
          label="Collected so far"
          value={`${hex1(total)} HEX`}
          sub={`across ${pts.length} cycles`}
        />
      </div>

      <div className="overflow-x-auto px-4 pb-3 pt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[560px] overflow-visible"
          role="img"
          aria-label={`HEX paid each cycle to a $${amount} holder who bought on day one and held. It rises every cycle, from ${hex1(first.v)} HEX at cycle ${first.i} to ${hex1(last.v)} HEX at cycle ${last.i}, ${hex1(model.total)} HEX in total.`}
        >
          <defs>
            <linearGradient id="ssp-hold" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#7E089D" />
              <stop offset="0.5" stopColor="#D83639" />
              <stop offset="1" stopColor="#FB9438" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = BASE - f * (BASE - TOP);
            return (
              <g key={f}>
                <line x1="0" y1={y} x2={W} y2={y} stroke="var(--line)" strokeWidth="1" />
                {f > 0 && (
                  <text
                    x="2"
                    y={y - 3}
                    className="fill-[var(--text-faint)]"
                    style={{ fontFamily: MONO, fontSize: 8.5 }}
                  >
                    {hex1(max * f)}
                  </text>
                )}
              </g>
            );
          })}

          {pts.map((p, k) => {
            const h = Math.max(2, (p.v / max) * (BASE - TOP));
            const x = k * slot + (slot - bw) / 2;
            const y = BASE - h;
            // Scroll position drives this directly — no CSS transition, or the
            // easing would fight the scrub and lag behind the wheel. Scrolling
            // back up lowers it again for free.
            const bp = barProgress(scroll, k, pts.length);
            return (
              <g key={p.i}>
                <title>{`Cycle ${p.i}: ${hex1(p.v)} HEX`}</title>
                <rect
                  x={x}
                  y={y}
                  width={bw}
                  height={h}
                  rx="3"
                  fill="url(#ssp-hold)"
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'bottom',
                    transform: `scaleY(${bp.toFixed(3)})`,
                  }}
                />
                <text
                  x={x + bw / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className={k === pts.length - 1 ? 'fill-[var(--text)]' : 'fill-[var(--text-muted)]'}
                  style={{
                    fontFamily: MONO,
                    fontSize: 9,
                    fontWeight: k === pts.length - 1 ? 700 : 400,
                    // Trails its bar, so a number never floats above a stub.
                    opacity: clamp01((bp - 0.55) / 0.45),
                  }}
                >
                  {hex1(p.v)}
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

          <line x1="0" y1={BASE} x2={W} y2={BASE} stroke="var(--line-strong)" strokeWidth="1" />
        </svg>
      </div>

      <div className="border-t border-[var(--line)] px-4 py-3">
        <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">
          Buy once and your share of supply stops moving. From then on the payout depends on one
          thing — how big the stake is when it ends. A cycle hands holders{' '}
          <b className="text-[var(--text)]">1% of the pool</b> and puts back its yield plus whatever
          the buy-tax bought.{' '}
          <b className="text-[var(--text)]">
            While more comes in than the 1% that goes out, the pool is bigger next cycle
          </b>{' '}
          — and 1% of a bigger pool is a bigger payout on a share that never changed.
        </p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-faint)]">
          {alwaysCovered ? (
            <>
              That has held for every cycle so far: all {ratioCount} brought in more HEX than they
              paid out
              {minRatio != null && (
                <>
                  , <b style={gradText}>{minRatio.toFixed(2)}×</b> at the tightest
                </>
              )}
              . The condition is what carries it forward, not the record — while HEX keeps paying a
              yield and the buy-tax keeps buying, the pool keeps growing and so does this bar.
            </>
          ) : (
            <>
              {covered} of {ratioCount} cycles brought in more HEX than they paid out. The payout
              only climbs while that holds.
            </>
          )}{' '}
          Figures are HEX, not dollars — the stake is measured in HEX and so is what it pays.
        </p>
      </div>
    </div>
  );
}

function Fig({
  label,
  value,
  sub,
  grad,
}: {
  label: string;
  value: string;
  sub: string;
  grad?: boolean;
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
        style={grad ? gradText : undefined}
      >
        {value}
      </div>
      <div className="text-[10px] text-[var(--text-faint)]">{sub}</div>
    </div>
  );
}
