'use client';

// "HEX earned, two ways" — holding pSSH against one HEX stake as long as the
// run, counted in HEX. The axes span the whole run and the lines reveal up to
// the playhead, so pressing play draws them across rather than stretching a
// shorter chart. Both lines are resampled to the same fixed number of points
// along a monotone curve, which lets any slider change — the length included —
// morph them smoothly instead of jumping. Drawn at the container's real pixel
// width so the labels stay crisp on a phone.

import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { SimCycle } from '@/lib/superstake/simulate';
import { fmtHex } from '@/lib/hex/hexDay';

const H = 260;
const PAD = { l: 46, r: 14, t: 22, b: 30 };
/** Points per line. Fixed, so every path has the same shape to morph between. */
const SAMPLES = 120;
const PSSH = '#FB9438';
const STAKE = '#C0267E';
const EASE = [0.22, 1, 0.36, 1] as const;
const JOST = 'var(--font-jost), ui-sans-serif, system-ui, sans-serif';
/** An end badge's height, and its gap from its dot. */
const BADGE_H = 22;
const BADGE_GAP = 8;

/**
 * Monotone cubic (Fritsch–Carlson) through the knots: smooth, and never
 * overshooting, so a running total never appears to dip.
 */
function monotone(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
  const m = xs.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = Math.min(1, Math.max(0, (x - xs[i]) / h));
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** A round step for the y gridlines: 1, 2, 2.5 or 5 of a power of ten. */
function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

const pathOf = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

export default function EarnedChart({
  cycles, nowN, totalDays, stakeLabel,
}: {
  /** Every cycle of the run: the axes span all of it. */
  cycles: SimCycle[];
  /** The playhead's cycle — the lines are drawn up to here. */
  nowN: number;
  totalDays: number;
  stakeLabel: string;
}) {
  const uid = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cycleDays = totalDays / cycles.length;
  const knotX = [0, ...cycles.map((c) => c.n * cycleDays)];
  const psshY = [0, ...cycles.map((c) => c.holderHexCumulative)];
  const stakeY = [0, ...cycles.map((c) => c.stakeHexEarned)];

  const step = niceStep(Math.max(...psshY, ...stakeY, 1) / 4);
  const top = Math.ceil((Math.max(...psshY, ...stakeY, 1) * 1.04) / step) * step;
  const W = Math.max(width, 280);
  const x = (day: number) => PAD.l + (day / totalDays) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / top) * (H - PAD.t - PAD.b);
  const base = H - PAD.b;

  const line = (ys: number[]) => {
    const f = monotone(knotX, ys);
    return Array.from({ length: SAMPLES }, (_, i): [number, number] => {
      const day = (i / (SAMPLES - 1)) * totalDays;
      return [x(day), y(f(day))];
    });
  };
  const psshPts = line(psshY);
  const stakePts = line(stakeY);
  const area = (pts: [number, number][]) =>
    `${pathOf(pts)} L${x(totalDays).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`;
  const flat = pathOf(psshPts.map(([px]) => [px, base]));
  const flatArea = `${flat} L${x(totalDays).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`;

  const nowX = x(nowN * cycleDays);
  const now = cycles[nowN - 1];
  // Every 6 months on a short run, every 1–10 years on a long one.
  const ticks = (() => {
    const years = totalDays / 365.25;
    const out: { day: number; label: string }[] = [];
    if (years < 3) {
      for (let m = 6; m * (365.25 / 12) <= totalDays + 1e-9; m += 6) {
        out.push({ day: m * (365.25 / 12), label: m % 12 === 0 ? `${m / 12}y` : `${m}mo` });
      }
      return out;
    }
    const every = [1, 2, 3, 5, 10].find((s) => years / s <= 7) ?? 10;
    for (let k = every; k <= years + 1e-9; k += every) out.push({ day: k * 365.25, label: `${k}y` });
    return out;
  })();

  const t = (duration: number) => (reduce ? { duration: 0 } : { duration, ease: EASE });

  // End badges. The higher value's badge sits above its dot; the lower one's
  // below its dot, or above it when that would run into the axis labels, with
  // the higher badge lifted clear so the two never stack.
  const pY = y(now.holderHexCumulative);
  const sY = y(now.stakeHexEarned);
  const hiY = Math.min(pY, sY);
  const loY = Math.max(pY, sY);
  let loTop = loY + BADGE_GAP;
  if (loTop + BADGE_H > base - 2) loTop = loY - BADGE_GAP - BADGE_H;
  let hiTop = hiY - BADGE_GAP - BADGE_H;
  if (hiTop + BADGE_H + 4 > loTop && loTop < loY) hiTop = loTop - BADGE_H - 4;
  const psshTop = pY <= sY ? hiTop : loTop;
  const stakeTop = pY <= sY ? loTop : hiTop;
  const badgeLeft = nowX > W - 150;

  const hovered = hover != null ? cycles[hover - 1] : null;
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const day = ((e.clientX - r.left - PAD.l) / (W - PAD.l - PAD.r)) * totalDays;
    setHover(Math.min(nowN, Math.max(1, Math.round(day / cycleDays))));
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0B1A33]"
      style={{ fontFamily: JOST }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(110% 90% at 100% 0%, rgba(251,148,56,0.16), rgba(216,54,57,0.07) 40%, transparent 70%)' }}
      />
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pt-2.5 text-[11px] text-white/70">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full" style={{ background: `linear-gradient(90deg,#D83639,${PSSH})` }} />
          Hold pSSH
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full" style={{ background: `linear-gradient(90deg,#7E089D,${STAKE})` }} />
          {stakeLabel}
        </span>
      </div>

      <div
        ref={box}
        className="relative touch-pan-y"
        style={{ height: H }}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {width > 0 && (
          <svg
            width={W}
            height={H}
            className="block"
            role="img"
            aria-label={`HEX earned by cycle ${nowN}: ${fmtHex(now.holderHexCumulative)} HEX holding pSSH, ${fmtHex(now.stakeHexEarned)} HEX from ${stakeLabel}`}
          >
            <defs>
              <linearGradient id={`${uid}-ps`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#D83639" />
                <stop offset="1" stopColor={PSSH} />
              </linearGradient>
              <linearGradient id={`${uid}-st`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#7E089D" />
                <stop offset="1" stopColor={STAKE} />
              </linearGradient>
              <linearGradient id={`${uid}-psa`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={PSSH} stopOpacity="0.34" />
                <stop offset="1" stopColor="#D83639" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${uid}-sta`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={STAKE} stopOpacity="0.30" />
                <stop offset="1" stopColor="#7E089D" stopOpacity="0" />
              </linearGradient>
              <filter id={`${uid}-glow`} x="-10%" y="-30%" width="120%" height="160%">
                <feGaussianBlur stdDeviation="3.2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <clipPath id={`${uid}-reveal`}>
                <motion.rect
                  x={0}
                  y={0}
                  height={H}
                  initial={{ width: reduce ? nowX + 8 : 0 }}
                  animate={{ width: nowX + 8 }}
                  transition={t(0.9)}
                />
              </clipPath>
            </defs>

            {/* the axis it's drawn against */}
            {Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step).map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.07)" />
                <text x={PAD.l - 8} y={y(v) + 3.5} textAnchor="end" fontSize="10.5" fill="rgba(255,255,255,0.42)">
                  {v === 0 ? '0' : fmtHex(v)}
                </text>
              </g>
            ))}
            <text x={PAD.l} y={H - 9} fontSize="10.5" fill="rgba(255,255,255,0.42)">today</text>
            {ticks.map(({ day, label }) => (
              <g key={label}>
                <line x1={x(day)} x2={x(day)} y1={base} y2={base + 4} stroke="rgba(255,255,255,0.25)" />
                <text x={x(day)} y={H - 9} textAnchor="middle" fontSize="10.5" fill="rgba(255,255,255,0.42)">
                  {label}
                </text>
              </g>
            ))}

            {/* where the run is headed, faint, past the playhead */}
            <path d={pathOf(stakePts)} fill="none" stroke={STAKE} strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="3 5" />
            <path d={pathOf(psshPts)} fill="none" stroke={PSSH} strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="3 5" />

            <g clipPath={`url(#${uid}-reveal)`}>
              <motion.path
                initial={{ d: reduce ? area(psshPts) : flatArea }}
                animate={{ d: area(psshPts) }}
                transition={t(0.7)}
                fill={`url(#${uid}-psa)`}
              />
              <motion.path
                initial={{ d: reduce ? area(stakePts) : flatArea }}
                animate={{ d: area(stakePts) }}
                transition={t(0.7)}
                fill={`url(#${uid}-sta)`}
              />
              <motion.path
                initial={{ d: reduce ? pathOf(stakePts) : flat }}
                animate={{ d: pathOf(stakePts) }}
                transition={t(0.7)}
                fill="none"
                stroke={`url(#${uid}-st)`}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${uid}-glow)`}
              />
              <motion.path
                initial={{ d: reduce ? pathOf(psshPts) : flat }}
                animate={{ d: pathOf(psshPts) }}
                transition={t(0.7)}
                fill="none"
                stroke={`url(#${uid}-ps)`}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${uid}-glow)`}
              />
            </g>

            {/* the playhead's end of each line */}
            {[
              { v: now.stakeHexEarned, c: STAKE },
              { v: now.holderHexCumulative, c: PSSH },
            ].map(({ v, c }) => (
              <g key={c}>
                {!reduce && (
                  <motion.circle
                    fill={c}
                    initial={false}
                    animate={{ cx: nowX, cy: y(v), r: [4, 12], opacity: [0.45, 0] }}
                    transition={{
                      cx: t(0.6), cy: t(0.6),
                      r: { duration: 1.8, repeat: Infinity, ease: 'easeOut' },
                      opacity: { duration: 1.8, repeat: Infinity, ease: 'easeOut' },
                    }}
                  />
                )}
                <motion.circle
                  r={4.5}
                  fill={c}
                  stroke="#0B1A33"
                  strokeWidth={2}
                  initial={false}
                  animate={{ cx: nowX, cy: y(v) }}
                  transition={t(0.6)}
                />
              </g>
            ))}

            {hovered && (
              <g pointerEvents="none">
                <line
                  x1={x(hovered.n * cycleDays)} x2={x(hovered.n * cycleDays)} y1={PAD.t} y2={base}
                  stroke="rgba(255,255,255,0.35)" strokeDasharray="3 3"
                />
                <circle cx={x(hovered.n * cycleDays)} cy={y(hovered.stakeHexEarned)} r={4} fill={STAKE} stroke="#fff" strokeWidth={1.5} />
                <circle cx={x(hovered.n * cycleDays)} cy={y(hovered.holderHexCumulative)} r={4} fill={PSSH} stroke="#fff" strokeWidth={1.5} />
              </g>
            )}
          </svg>
        )}

        {width > 0 && !hovered && (
          <>
            <Badge x={nowX} top={psshTop} left={badgeLeft} color={PSSH} label="pSSH" value={now.holderHexCumulative} t={t(0.6)} />
            <Badge x={nowX} top={stakeTop} left={badgeLeft} color={STAKE} label="stake" value={now.stakeHexEarned} t={t(0.6)} />
          </>
        )}

        {width > 0 && hovered && (
          <HoverCard
            x={x(hovered.n * cycleDays)}
            width={W}
            cycle={hovered}
            years={(hovered.n * cycleDays) / 365.25}
          />
        )}
      </div>
    </div>
  );
}

function Badge({
  x, top, left, color, label, value, t,
}: {
  x: number;
  /** The badge's top edge, in the plot's pixels. */
  top: number;
  /** Hang to the left of the dot (near the right edge) rather than the right. */
  left: boolean;
  color: string;
  label: string;
  value: number;
  t: object;
}) {
  // The outer box moves to the dot; the inner one hangs off it to the side.
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0"
      initial={false}
      animate={{ x: left ? x - 10 : x + 10, y: top }}
      transition={t}
    >
      <div
        className="flex items-center whitespace-nowrap rounded-md border px-1.5 text-[11.5px] font-semibold tabular-nums text-white shadow-lg backdrop-blur-sm"
        style={{
          height: BADGE_H,
          borderColor: `${color}66`,
          background: 'rgba(11,26,51,0.82)',
          transform: `translateX(${left ? '-100%' : '0'})`,
        }}
      >
        <span className="mr-1 text-[10px] font-medium" style={{ color }}>{label}</span>
        {fmtHex(value)} HEX
      </div>
    </motion.div>
  );
}

function HoverCard({ x, width, cycle, years }: { x: number; width: number; cycle: SimCycle; years: number }) {
  const lead = cycle.holderHexCumulative - cycle.stakeHexEarned;
  const left = x > width / 2;
  return (
    <div
      className="pointer-events-none absolute top-3 w-[190px] rounded-lg border border-white/10 bg-[rgba(6,16,32,0.92)] px-3 py-2 text-[11.5px] text-white/80 shadow-xl backdrop-blur"
      style={{ left: left ? x - 202 : x + 12 }}
    >
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-white/45">
        Cycle {cycle.n} · {years.toFixed(1)} years
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: PSSH }} />Hold pSSH</span>
        <b className="tabular-nums text-white">{fmtHex(cycle.holderHexCumulative)} HEX</b>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: STAKE }} />HEX stake</span>
        <b className="tabular-nums text-white">{fmtHex(cycle.stakeHexEarned)} HEX</b>
      </div>
      <div className={`mt-1.5 border-t border-white/10 pt-1.5 text-right font-semibold tabular-nums ${lead >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {lead >= 0 ? 'pSSH' : 'stake'} ahead by {fmtHex(Math.abs(lead))} HEX
      </div>
    </div>
  );
}
