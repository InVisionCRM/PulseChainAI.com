'use client';

// Indicators — the small status pieces. Individually trivial, collectively
// most of what makes a page feel alive: a streak, a step, a state pill.

import { useEffect, useRef, useState } from 'react';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
export const RAMP = ['#7E089D', '#D83639', '#FB9438'] as const;

function useSeen<T extends HTMLElement>() {
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
      (es) => es.some((e) => e.isIntersecting) && (setSeen(true), io.disconnect()),
      { threshold: 0.3 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

/** Progress bar. Optionally striped and moving, for "in flight". */
export function ProgressBar({
  value,
  max = 100,
  label,
  striped = false,
  height = 8,
}: {
  value: number;
  max?: number;
  label?: string;
  striped?: boolean;
  height?: number;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const frac = Math.max(0, Math.min(1, value / Math.max(1e-9, max)));
  return (
    <div ref={ref} className="w-full">
      {label && (
        <div
          className="mb-1.5 flex items-baseline justify-between text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
          style={{ fontFamily: MONO }}
        >
          <span>{label}</span>
          <span className="tabular-nums text-[var(--text)]">{Math.round(frac * 100)}%</span>
        </div>
      )}
      <div className="w-full overflow-hidden rounded-full bg-[var(--surface-2)]" style={{ height }}>
        <div
          className={`h-full rounded-full transition-[width] duration-[900ms] ease-out ${
            striped ? 'animate-[lab-pan_1.2s_linear_infinite] motion-reduce:animate-none' : ''
          }`}
          style={{
            width: seen ? `${frac * 100}%` : '0%',
            background: striped
              ? `repeating-linear-gradient(45deg, ${RAMP[1]} 0 8px, ${RAMP[2]} 8px 16px)`
              : `linear-gradient(90deg, ${RAMP[0]}, ${RAMP[1]} 60%, ${RAMP[2]})`,
            backgroundSize: striped ? '200% 100%' : undefined,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Streak dots — a run of pass/fail results as a row of pips. Reads as a
 * pattern before it reads as data, which is the point.
 */
export function StreakDots({
  results,
  label,
}: {
  /** true = hit. */
  results: boolean[];
  label?: string;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const hits = results.filter(Boolean).length;
  return (
    <div ref={ref} className="w-full">
      {label && (
        <div
          className="mb-1.5 flex items-baseline justify-between text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
          style={{ fontFamily: MONO }}
        >
          <span>{label}</span>
          <span className="tabular-nums text-[var(--text)]">
            {hits}/{results.length}
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {results.map((hit, i) => (
          <span
            key={i}
            title={`#${i + 1}: ${hit ? 'hit' : 'miss'}`}
            className="h-3 w-3 rounded-[3px] transition-all duration-300"
            style={{
              background: hit ? RAMP[2] : 'var(--surface-2)',
              opacity: seen ? 1 : 0,
              transform: seen ? 'scale(1)' : 'scale(0.4)',
              transitionDelay: `${i * 28}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Status pill with a live dot. Four states, one shape. */
export function StatusPill({
  state,
  children,
}: {
  state: 'live' | 'ok' | 'warn' | 'off';
  children: React.ReactNode;
}) {
  const cfg = {
    live: { dot: '#4ade80', cls: 'border-[var(--up)]/40 bg-[var(--up)]/10 text-[var(--up)]', pulse: true },
    ok: { dot: '#4ade80', cls: 'border-[var(--up)]/40 bg-[var(--up)]/10 text-[var(--up)]', pulse: false },
    warn: { dot: '#FB9438', cls: 'border-orange-400/40 bg-orange-500/10 text-orange-300', pulse: false },
    off: { dot: 'var(--text-faint)', cls: 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-faint)]', pulse: false },
  }[state];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cfg.cls}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {cfg.pulse && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:animate-none"
            style={{ background: cfg.dot }}
          />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
      </span>
      {children}
    </span>
  );
}

/** Step tracker — where something is in a fixed sequence. */
export function StepTrack({
  steps,
  current,
}: {
  steps: string[];
  /** Zero-based index of the step in progress. */
  current: number;
}) {
  return (
    <ol className="flex w-full items-center">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={i} className={`flex items-center ${i === steps.length - 1 ? '' : 'flex-1'}`}>
            <div className="flex flex-col items-center gap-1">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border text-[10px] font-bold transition-colors duration-500 ${
                  done
                    ? 'border-transparent text-white'
                    : active
                      ? 'border-orange-400 text-orange-300'
                      : 'border-[var(--line)] text-[var(--text-faint)]'
                }`}
                style={done ? { background: RAMP[1] } : undefined}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={`whitespace-nowrap text-[9px] uppercase tracking-wide ${
                  active ? 'text-[var(--text)]' : 'text-[var(--text-faint)]'
                }`}
                style={{ fontFamily: MONO }}
              >
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="mx-1 mb-4 h-[2px] flex-1 rounded-full bg-[var(--surface-2)]">
                <span
                  className="block h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: done ? '100%' : '0%', background: RAMP[1] }}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Delta chip — a signed change with its direction built into the colour. */
export function DeltaChip({
  value,
  suffix = '%',
  decimals = 2,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
        up ? 'bg-[var(--up)]/15 text-[var(--up)]' : 'bg-red-500/15 text-red-400'
      }`}
    >
      <span aria-hidden>{up ? '▲' : '▼'}</span>
      {Math.abs(value).toFixed(decimals)}
      {suffix}
    </span>
  );
}

/** Stat tile — label, figure, sub, optional trailing slot for a chart or chip. */
export function StatTile({
  label,
  value,
  sub,
  accent = false,
  children,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3">
      <div
        className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-[clamp(18px,2.6vw,24px)] font-bold tracking-[-0.03em] tabular-nums text-[var(--text)]"
        style={
          accent
            ? {
                backgroundImage: `linear-gradient(135deg,${RAMP[0]},${RAMP[1]} 55%,${RAMP[2]})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }
            : undefined
        }
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-[var(--text-faint)]">{sub}</div>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
