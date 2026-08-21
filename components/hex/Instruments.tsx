'use client';

// The instrument kit the HEX surfaces share: a sweeping speedometer, big
// count-up figures, and the one-shot animation hook they all run on.
//
// Extracted from the Rescue Wall because the Strategist's Macro and Micro tabs
// want exactly these, and a second copy of a dial is a second dial to keep in
// sync. Nothing in here knows anything about rescues.
//
// EVERY animation runs once, on arrival, and settles. The wall's predecessor
// re-rendered at 60fps on an infinite loop and read as the page glitching; a
// dial that sweeps to its reading and stays put says "measured". Reduced
// motion gets the settled state with transitions off entirely.
//
// Colors come from --viz-* custom properties set by the host page, so each
// surface supplies its own validated palette and these draw whatever they are
// given.

import { useEffect, useState } from 'react';
import CountUp from '@/components/hex-strategist/CountUp';
import { fmtHex } from '@/lib/hex/hexDay';

export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function useSettled(): { on: boolean; instant: boolean } {
  // `on` flips one frame after mount and the CSS transitions do the rest;
  // reduced-motion flips it with the transitions switched off entirely, so the
  // settled state simply appears.
  const [on, setOn] = useState(false);
  const [instant, setInstant] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInstant(true);
      setOn(true);
      return;
    }
    const raf = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return { on, instant };
}

/* ────────────────────────────── speedometer ────────────────────────────── */

/**
 * A half-circle speedometer that sweeps once to its reading.
 * `frac` is 0–1; the figure in the middle is whatever the caller formats.
 */
export function Speedo({
  frac,
  figure,
  label,
  sub,
  tone = 'a',
}: {
  frac: number;
  figure: string;
  label: string;
  sub?: string;
  tone?: 'a' | 'b';
}) {
  const { on, instant } = useSettled();
  const f = Math.max(0, Math.min(1, frac));
  const shown = on ? f : 0;

  // Arc geometry: half circle, r=80, centred at (100, 100) in a 200×112 box.
  const R = 80;
  const LEN = Math.PI * R;
  const color = tone === 'a' ? 'var(--viz-a)' : 'var(--viz-b)';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="font-poppins text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        {label}
      </div>
      <div className="mx-auto mt-2 w-full max-w-[240px]">
        <svg viewBox="0 0 200 108" className="w-full">
          {/* ticks, so the dial reads as an instrument rather than a ring */}
          {Array.from({ length: 11 }, (_, i) => {
            const a = Math.PI - (i / 10) * Math.PI;
            const x1 = 100 + Math.cos(a) * (R + 10);
            const y1 = 100 - Math.sin(a) * (R + 10);
            const x2 = 100 + Math.cos(a) * (R + 15);
            const y2 = 100 - Math.sin(a) * (R + 15);
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--text-faint)" strokeWidth={i % 5 === 0 ? 2 : 1} opacity={0.55} />
            );
          })}
          <path
            d={`M 20 100 A ${R} ${R} 0 0 1 180 100`}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d={`M 20 100 A ${R} ${R} 0 0 1 180 100`}
            fill="none"
            stroke={color}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={LEN}
            strokeDashoffset={LEN * (1 - shown)}
            style={{ transition: instant ? 'none' : `stroke-dashoffset 1.3s ${EASE}` }}
          />
          {/* needle — sweeps with the arc, stops short of the figure */}
          <g
            style={{
              transform: `rotate(${shown * 180 - 90}deg)`,
              transformOrigin: '100px 100px',
              transition: instant ? 'none' : `transform 1.3s ${EASE}`,
            }}
          >
            <line x1="100" y1="92" x2="100" y2="40" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
          </g>
          <circle cx="100" cy="100" r="7" fill="var(--text)" />
          <circle cx="100" cy="100" r="3" fill={color} />
        </svg>
        <div className="-mt-1 text-center">
          <span className="font-jost text-[36px] font-bold leading-none tracking-tight text-[var(--text)] tabular-nums">
            {figure}
          </span>
        </div>
      </div>
      {sub && (
        <div className="font-poppins mt-3 text-center text-[12px] text-[var(--text-muted)]">{sub}</div>
      )}
    </div>
  );
}

/* ────────────────────────────── big figures ────────────────────────────── */

export type StatFmt = 'int' | 'hex' | 'waitHours';

/** Named formats, because a server page cannot pass a function across the
 *  client boundary. */
const FMT: Record<StatFmt, (n: number) => string> = {
  int: (n) => Math.round(n).toLocaleString(),
  hex: (n) => fmtHex(n),
  waitHours: (n) => (n >= 48 ? `${Math.round(n / 24)}d` : `${Math.round(n)}h`),
};

export function BigStat({
  label,
  value,
  fmt,
  sub,
  color = 'var(--text)',
}: {
  label: string;
  value: number;
  fmt: StatFmt;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="font-poppins text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        {label}
      </div>
      <div
        className="font-jost mt-1.5 text-[38px] font-bold leading-none tracking-tight tabular-nums md:text-[46px]"
        style={{ color }}
      >
        <CountUp value={value} format={FMT[fmt]} />
      </div>
      {sub && <div className="font-poppins mt-1.5 text-[12px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

/** A hero figure with no card chrome — the always-dark hero panel is its frame. */
export function HeroNumber({
  label,
  value,
  fmt,
  sub,
  gradient = false,
}: {
  label: string;
  value: number;
  fmt: StatFmt;
  sub?: string;
  gradient?: boolean;
}) {
  return (
    <div>
      <div className="font-poppins text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div
        className={`font-jost mt-1 text-[40px] font-bold leading-none tracking-tight tabular-nums md:text-[56px] ${
          gradient ? 'bg-clip-text text-transparent' : 'text-white'
        }`}
        style={gradient ? { backgroundImage: 'linear-gradient(115deg, #ff9e00, #ff2e7e)' } : undefined}
      >
        <CountUp value={value} format={FMT[fmt]} />
      </div>
      {sub && <div className="font-poppins mt-2 text-[12.5px] text-white/55">{sub}</div>}
    </div>
  );
}
