'use client';

// Gauges — anything that reads as a dial.
//
// All of these animate by transition rather than keyframes: the value is a
// prop, so when it changes the needle/arc travels to the new one instead of
// replaying a canned animation. That also makes them honest under live data —
// nothing moves unless the number moved.
//
// Sizing is by viewBox + `w-full`, so a gauge fills whatever box it's given.

import { useEffect, useState } from 'react';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';

/** Brand ramp, shared by every gauge so a page of them reads as one family. */
export const RAMP = ['#7E089D', '#D83639', '#FB9438'] as const;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Plays the transition from zero on first paint, so a gauge sweeps up when the
 * page arrives rather than appearing already full. Skipped under reduced
 * motion — the gauge simply starts at its value.
 */
function useSweep(value: number) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setShown(true);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return shown ? value : 0;
}

/**
 * Speedometer. A 240° arc with a needle, tick marks and a value readout.
 *
 * `zones` paint coloured bands behind the track — use them for "good/warn/bad"
 * ranges so the dial says whether a number is fine, not just what it is.
 */
export function SpeedGauge({
  value,
  min = 0,
  max = 100,
  label,
  unit = '',
  zones,
  size = 200,
}: {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  /** Fractions of the range, 0-1, painted under the needle. */
  zones?: { from: number; to: number; color: string }[];
  size?: number;
}) {
  const frac = clamp01((value - min) / Math.max(1e-9, max - min));
  const shown = useSweep(frac);

  const SWEEP = 240; // degrees of dial
  const START = 150; // 150° puts the gap at the bottom
  const CX = 100;
  const CY = 100;
  const R = 78;

  const polar = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return [CX + Math.cos(rad) * r, CY - Math.sin(rad) * r] as const;
  };
  const arc = (fromF: number, toF: number, r: number) => {
    const a0 = START - fromF * SWEEP;
    const a1 = START - toF * SWEEP;
    const [x0, y0] = polar(a0, r);
    const [x1, y1] = polar(a1, r);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };

  const needleDeg = START - shown * SWEEP;

  return (
    <svg
      viewBox="0 0 200 175"
      style={{ maxWidth: size }}
      className="block h-auto w-full"
      role="img"
      aria-label={`${label ?? 'Gauge'}: ${value}${unit}`}
    >
      <defs>
        <linearGradient id="lab-speed" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={RAMP[0]} />
          <stop offset="0.5" stopColor={RAMP[1]} />
          <stop offset="1" stopColor={RAMP[2]} />
        </linearGradient>
      </defs>

      {/* track */}
      <path d={arc(0, 1, R)} fill="none" stroke="var(--surface-2)" strokeWidth="13" strokeLinecap="round" />

      {/* optional condition bands */}
      {zones?.map((z, i) => (
        <path
          key={i}
          d={arc(z.from, z.to, R)}
          fill="none"
          stroke={z.color}
          strokeWidth="13"
          opacity="0.35"
        />
      ))}

      {/* value arc — dash offset is the animated property */}
      <path
        d={arc(0, 1, R)}
        fill="none"
        stroke="url(#lab-speed)"
        strokeWidth="13"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - shown}
        className="transition-[stroke-dashoffset] duration-[900ms] ease-out"
      />

      {/* ticks */}
      {Array.from({ length: 9 }, (_, i) => i / 8).map((f) => {
        const [x0, y0] = polar(START - f * SWEEP, R - 11);
        const [x1, y1] = polar(START - f * SWEEP, R - 17);
        return (
          <line
            key={f}
            x1={x0}
            y1={y0}
            x2={x1}
            y2={y1}
            stroke="var(--text-faint)"
            strokeWidth="1.5"
            opacity="0.5"
          />
        );
      })}

      {/* needle */}
      <g
        style={{ transformOrigin: `${CX}px ${CY}px`, transform: `rotate(${-(needleDeg - 90)}deg)` }}
        className="transition-transform duration-[900ms] ease-out"
      >
        <line x1={CX} y1={CY} x2={CX} y2={CY - R + 16} stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <circle cx={CX} cy={CY} r="7" fill="var(--panel)" stroke="var(--line-strong)" strokeWidth="2" />

      <text
        x={CX}
        y={CY + 38}
        textAnchor="middle"
        className="fill-[var(--text)]"
        style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700 }}
      >
        {value.toLocaleString()}
        <tspan style={{ fontSize: 13 }}>{unit}</tspan>
      </text>
      {label && (
        <text
          x={CX}
          y={CY + 56}
          textAnchor="middle"
          className="fill-[var(--text-faint)]"
          style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.4 }}
        >
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  );
}

/**
 * Radial progress ring with the figure in the middle. The workhorse — use it
 * for anything that is a share of a whole.
 */
export function RadialProgress({
  value,
  max = 100,
  label,
  sub,
  size = 150,
  thickness = 12,
  trackColor = 'var(--surface-2)',
}: {
  value: number;
  max?: number;
  label?: string;
  sub?: string;
  size?: number;
  thickness?: number;
  trackColor?: string;
}) {
  const frac = clamp01(value / Math.max(1e-9, max));
  const shown = useSweep(frac);
  const R = 50 - thickness / 2;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="lab-radial" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={RAMP[0]} />
            <stop offset="0.55" stopColor={RAMP[1]} />
            <stop offset="1" stopColor={RAMP[2]} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={R} fill="none" stroke={trackColor} strokeWidth={thickness} />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="url(#lab-radial)"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - shown)}
          className="transition-[stroke-dashoffset] duration-[900ms] ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div
            className="font-bold tabular-nums text-[var(--text)]"
            style={{ fontFamily: MONO, fontSize: size * 0.19 }}
          >
            {label ?? `${Math.round(frac * 100)}%`}
          </div>
          {sub && (
            <div
              className="text-[var(--text-faint)]"
              style={{ fontFamily: MONO, fontSize: size * 0.062, letterSpacing: 1.1 }}
            >
              {sub.toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Segment meter — a row of blocks that fill left to right, the way a signal or
 * battery indicator reads. Coarser than a bar on purpose: good when "roughly
 * how full" matters more than the exact number.
 */
export function SegmentMeter({
  value,
  max = 100,
  segments = 12,
  label,
}: {
  value: number;
  max?: number;
  segments?: number;
  label?: string;
}) {
  const frac = clamp01(value / Math.max(1e-9, max));
  const shown = useSweep(frac);
  const lit = Math.round(shown * segments);

  return (
    <div className="w-full">
      {label && (
        <div
          className="mb-1.5 flex items-baseline justify-between text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
          style={{ fontFamily: MONO }}
        >
          <span>{label}</span>
          <span className="tabular-nums text-[var(--text)]">{Math.round(frac * 100)}%</span>
        </div>
      )}
      <div className="flex gap-[3px]">
        {Array.from({ length: segments }, (_, i) => {
          const on = i < lit;
          // Ramp across the row so a full meter shows the whole gradient.
          const c = i / Math.max(1, segments - 1);
          const color = c < 0.5 ? RAMP[0] : c < 0.8 ? RAMP[1] : RAMP[2];
          return (
            <span
              key={i}
              className="h-6 flex-1 rounded-[3px] transition-all duration-500 ease-out"
              style={{
                background: on ? color : 'var(--surface-2)',
                opacity: on ? 1 : 0.5,
                transitionDelay: `${i * 35}ms`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Tug-of-war needle: two competing sides, centre means level. Log-scaled and
 * capped so a lopsided reading still lands on the dial instead of pinning.
 */
export function VersusNeedle({
  ratio,
  leftLabel,
  rightLabel,
  cap = 3,
}: {
  /** >1 favours the right side, <1 the left. */
  ratio: number;
  leftLabel: string;
  rightLabel: string;
  cap?: number;
}) {
  const frac =
    ratio > 0 ? 0.5 + 0.5 * Math.max(-1, Math.min(1, Math.log(ratio) / Math.log(cap))) : 0.5;
  const shown = useSweep(frac);
  const rightAhead = ratio >= 1;

  return (
    <div className="w-full">
      <svg viewBox="0 0 200 96" className="block h-auto w-full" role="img"
        aria-label={`${rightAhead ? rightLabel : leftLabel} ahead by ${(rightAhead ? ratio : 1 / ratio).toFixed(2)} times`}>
        <defs>
          <linearGradient id="lab-vs" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={RAMP[0]} />
            <stop offset="0.5" stopColor={RAMP[1]} />
            <stop offset="1" stopColor={RAMP[2]} />
          </linearGradient>
        </defs>
        <path d="M18 78 A82 82 0 0 1 182 78" fill="none" stroke="var(--surface-2)" strokeWidth="10" strokeLinecap="round" />
        <path d="M18 78 A82 82 0 0 1 182 78" fill="none" stroke="url(#lab-vs)" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
        <line x1="100" y1="10" x2="100" y2="22" stroke="var(--text-faint)" strokeWidth="2" />
        <g
          style={{
            transformOrigin: '100px 78px',
            transform: `rotate(${(shown - 0.5) * 156}deg)`,
          }}
          className="transition-transform duration-[900ms] ease-out"
        >
          <line x1="100" y1="78" x2="100" y2="20" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="78" r="6" fill="var(--panel)" stroke="var(--line-strong)" strokeWidth="2" />
      </svg>
      <div
        className="mt-1 flex justify-between text-[9px] uppercase tracking-[0.12em]"
        style={{ fontFamily: MONO }}
      >
        <span className={rightAhead ? 'text-[var(--text-faint)]' : 'text-[var(--text)]'}>{leftLabel}</span>
        <span className={rightAhead ? 'text-[var(--text)]' : 'text-[var(--text-faint)]'}>{rightLabel}</span>
      </div>
    </div>
  );
}

/**
 * Bullet gauge — actual against a target, with the target as a hard marker.
 * Reads in one glance as "over" or "under", which a plain bar never does.
 */
export function BulletGauge({
  value,
  target,
  max,
  label,
  unit = '',
}: {
  value: number;
  target: number;
  max?: number;
  label?: string;
  unit?: string;
}) {
  const ceiling = max ?? Math.max(value, target) * 1.25;
  const frac = clamp01(value / ceiling);
  const tFrac = clamp01(target / ceiling);
  const shown = useSweep(frac);
  const over = value >= target;

  return (
    <div className="w-full">
      {label && (
        <div
          className="mb-1.5 flex items-baseline justify-between text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
          style={{ fontFamily: MONO }}
        >
          <span>{label}</span>
          <span className={`tabular-nums ${over ? 'text-[var(--up)]' : 'text-red-400'}`}>
            {value.toLocaleString()}{unit} / {target.toLocaleString()}{unit}
          </span>
        </div>
      )}
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
          style={{
            width: `${shown * 100}%`,
            background: `linear-gradient(90deg, ${RAMP[0]}, ${RAMP[1]} 55%, ${RAMP[2]})`,
          }}
        />
        <div
          className="absolute inset-y-0 w-[3px] rounded-full bg-[var(--text)]"
          style={{ left: `calc(${tFrac * 100}% - 1.5px)` }}
          title={`Target ${target}`}
        />
      </div>
    </div>
  );
}
