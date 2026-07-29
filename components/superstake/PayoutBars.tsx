'use client';

// What the stake alone paid a $100 holder, cycle by cycle.
//
// The pSSH side of the head-to-head has two sources: the 1% of the ended stake
// that goes to holders, and reflections funded by trading volume. This chart
// isolates the first — `result.payouts` — because that is the part the machine
// itself produces. Reflections rise and fall with how much the pair happens to
// trade, which is a different story and belongs to the volume panel.
//
// The trend is strongly up, not monotonically up: the peak is not the latest
// cycle. The header states the real shape rather than implying a clean climb,
// and the bars are drawn from the actual figures, dips included.

import { useMemo } from 'react';
import type { CycleRow } from '@/components/superstake/CycleTable';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';

const gradText = {
  backgroundImage: GRAD,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
} as const;

/** HEX at reading scale — these run from ~3 to ~45, so one decimal is enough. */
const hex1 = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1));

export default function PayoutBars({ rows, amount }: { rows: CycleRow[]; amount: number }) {
  const model = useMemo(() => {
    const pts = rows
      .map(({ cycle, result }) => ({ i: cycle.i, v: result.payouts }))
      .filter((p) => Number.isFinite(p.v) && p.v > 0);
    if (pts.length === 0) return null;

    const max = Math.max(...pts.map((p) => p.v));
    const first = pts[0];
    const last = pts[pts.length - 1];
    const best = pts.reduce((a, b) => (b.v > a.v ? b : a));
    // How many of the moves were upward — the honest version of "it keeps
    // growing", stated as a count rather than implied by the shape.
    const ups = pts.slice(1).filter((p, k) => p.v > pts[k].v).length;

    return { pts, max, first, last, best, ups, steps: pts.length - 1 };
  }, [rows]);

  if (!model) return null;

  const { pts, max, first, last, best, ups, steps } = model;
  const W = 680;
  const H = 200;
  const TOP = 26; // headroom for the value labels
  const BASE = H - 18; // baseline, leaving room for cycle numbers
  const slot = W / pts.length;
  const bw = Math.min(34, slot * 0.62);
  const growth = first.v > 0 ? last.v / first.v : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <h3 className="text-sm font-bold tracking-tight text-[var(--text)]">
          What the stake alone paid a ${amount} holder
        </h3>
        <span className="text-xs text-[var(--text-faint)]">
          the 1% payout only — reflections excluded
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
        <Fig label={`Cycle ${first.i}`} value={`${hex1(first.v)} HEX`} sub="the first payout" />
        <Fig label={`Cycle ${last.i}`} value={`${hex1(last.v)} HEX`} sub="the latest payout" />
        <Fig
          label="Growth"
          value={`${growth.toFixed(1)}×`}
          sub={`first to latest, ${steps} cycles`}
          grad
        />
        <Fig label={`Best · cycle ${best.i}`} value={`${hex1(best.v)} HEX`} sub="the high-water mark" />
      </div>

      {/* Seventeen bars scaled into a phone width shrink the value labels to a
          few pixels, so the chart scrolls sideways below ~600px instead —
          the same treatment the cycle table above it gets. */}
      <div className="overflow-x-auto px-4 pb-3 pt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[560px] overflow-visible"
          role="img"
          aria-label={`HEX paid to a $${amount} holder from the stake, by cycle. Cycle ${first.i} paid ${hex1(first.v)} HEX and cycle ${last.i} paid ${hex1(last.v)} HEX, a ${growth.toFixed(1)} times increase. The largest was cycle ${best.i} at ${hex1(best.v)} HEX. ${ups} of ${steps} cycles paid more than the one before.`}
        >
          <defs>
            <linearGradient id="ssp-bar" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#7E089D" />
              <stop offset="0.5" stopColor="#D83639" />
              <stop offset="1" stopColor="#FB9438" />
            </linearGradient>
          </defs>

          {/* quarter gridlines, so the bar heights can be read as amounts */}
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
            const isBest = p.i === best.i;
            const isLast = p.i === last.i;
            return (
              <g key={p.i}>
                <title>{`Cycle ${p.i}: ${hex1(p.v)} HEX`}</title>
                <rect
                  x={x}
                  y={y}
                  width={bw}
                  height={h}
                  rx="3"
                  fill="url(#ssp-bar)"
                  opacity={isBest || isLast ? 1 : 0.72}
                />
                <text
                  x={x + bw / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className={isBest || isLast ? 'fill-[var(--text)]' : 'fill-[var(--text-muted)]'}
                  style={{ fontFamily: MONO, fontSize: 9, fontWeight: isBest ? 700 : 400 }}
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

      <p className="border-t border-[var(--line)] px-4 py-3 text-[11.5px] leading-relaxed text-[var(--text-faint)]">
        Each bar is the HEX a ${amount} holder&apos;s share of supply would have drawn from that
        cycle&apos;s 1% payout — the stake&apos;s own output, before any reflections. It has grown{' '}
        <b style={gradText}>{growth.toFixed(1)}×</b> from the first cycle to the latest, though not
        in a straight line: {ups} of {steps} cycles paid more than the one before, and the largest
        was cycle {best.i}. The payout tracks the size of the stake when it ends and how much supply
        has been burned by then, so it climbs as those do.
      </p>
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
