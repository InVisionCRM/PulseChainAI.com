'use client';

// Counters — numbers that arrive rather than appear.
//
// The rule these all follow: the final value is correct from the first frame
// for anything that reads it programmatically (aria, title, the DOM text once
// settled). Animation is decoration on top, never the source of the figure,
// and reduced motion drops straight to the answer.

import { useEffect, useRef, useState } from 'react';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';

function prefersReduced() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === 'undefined') return;
    if (prefersReduced() || !('IntersectionObserver' in window)) {
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

/**
 * Counts up to a value when it scrolls into view, easing out.
 *
 * `decimals` and `fmt` keep it honest — the number you pass is the number it
 * lands on, formatted the same way throughout the climb, so it never settles
 * on a differently-rounded figure than it was showing a frame earlier.
 */
export function CountUp({
  to,
  duration = 1200,
  decimals = 0,
  prefix = '',
  suffix = '',
  fmt,
  className = '',
}: {
  to: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  fmt?: (v: number) => string;
  className?: string;
}) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const [v, setV] = useState(0);

  useEffect(() => {
    if (!seen) return;
    if (prefersReduced()) {
      setV(to);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, duration]);

  const shown = fmt
    ? fmt(v)
    : v.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span ref={ref} className={`tabular-nums ${className}`} title={`${prefix}${to}${suffix}`}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}

/**
 * Odometer — digits roll to their new value like a mechanical counter. Best on
 * a figure that ticks up while you watch; overkill for a static stat.
 */
export function Odometer({
  value,
  digits,
  className = '',
}: {
  value: number;
  /** Pad to this many digits. Defaults to however many the number needs. */
  digits?: number;
  className?: string;
}) {
  const text = String(Math.max(0, Math.round(value)));
  const padded = digits ? text.padStart(digits, '0') : text;
  const reduced = typeof window !== 'undefined' && prefersReduced();

  return (
    <span
      className={`inline-flex overflow-hidden tabular-nums ${className}`}
      style={{ fontFamily: MONO }}
      aria-label={String(value)}
    >
      {padded.split('').map((ch, i) => {
        const n = Number(ch);
        if (Number.isNaN(n)) return <span key={i}>{ch}</span>;
        return (
          <span key={i} className="relative inline-block h-[1.15em] w-[0.62em] overflow-hidden align-bottom">
            <span
              className={reduced ? '' : 'transition-transform duration-700 ease-out'}
              style={{ display: 'block', transform: `translateY(${-n * 1.15}em)` }}
            >
              {Array.from({ length: 10 }, (_, d) => (
                <span key={d} className="block h-[1.15em] leading-[1.15em]">
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * Marquee — a row that scrolls forever. The content is duplicated so the loop
 * has no seam, and the copy is `aria-hidden` so a screen reader hears the list
 * once rather than twice.
 */
export function Marquee({
  children,
  speed = 40,
  reverse = false,
  className = '',
}: {
  children: React.ReactNode;
  /** Seconds for one full pass. */
  speed?: number;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div className={`group relative flex overflow-hidden ${className}`}>
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className="flex shrink-0 items-center gap-6 pr-6 motion-reduce:animate-none group-hover:[animation-play-state:paused]"
          style={{
            animation: `lab-marquee ${speed}s linear infinite${reverse ? ' reverse' : ''}`,
          }}
        >
          {children}
        </div>
      ))}
      {/* Feathered edges, so items enter and leave instead of being cut. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--panel)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--panel)] to-transparent" />
    </div>
  );
}

/**
 * A value that flashes green or red when it changes — the live-price tell.
 * The flash is on the change, not on a timer, so a still market stays still.
 */
export function FlashValue({
  value,
  fmt = (v: number) => v.toLocaleString(),
  className = '',
}: {
  value: number;
  fmt?: (v: number) => string;
  className?: string;
}) {
  const prev = useRef(value);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value === prev.current) return;
    setDir(value > prev.current ? 'up' : 'down');
    prev.current = value;
    const id = setTimeout(() => setDir(null), 700);
    return () => clearTimeout(id);
  }, [value]);

  return (
    <span
      className={`rounded px-1 tabular-nums transition-colors duration-500 ${className} ${
        dir === 'up'
          ? 'bg-[var(--up)]/20 text-[var(--up)]'
          : dir === 'down'
            ? 'bg-red-500/20 text-red-400'
            : 'text-[var(--text)]'
      }`}
    >
      {fmt(value)}
    </span>
  );
}

/**
 * Typewriter — types a line out, then holds. Loops through several if given
 * more than one. Reduced motion shows the first string outright.
 */
export function Typewriter({
  lines,
  speed = 55,
  hold = 1600,
  className = '',
}: {
  lines: string[];
  speed?: number;
  hold?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const [erasing, setErasing] = useState(false);
  const reduced = typeof window !== 'undefined' && prefersReduced();

  useEffect(() => {
    if (reduced || lines.length === 0) return;
    const full = lines[i % lines.length];
    if (!erasing && n < full.length) {
      const id = setTimeout(() => setN(n + 1), speed);
      return () => clearTimeout(id);
    }
    if (!erasing && n === full.length) {
      if (lines.length === 1) return;
      const id = setTimeout(() => setErasing(true), hold);
      return () => clearTimeout(id);
    }
    if (erasing && n > 0) {
      const id = setTimeout(() => setN(n - 1), speed / 2);
      return () => clearTimeout(id);
    }
    setErasing(false);
    setI((v) => v + 1);
  }, [n, erasing, i, lines, speed, hold, reduced]);

  const text = reduced ? (lines[0] ?? '') : (lines[i % lines.length] ?? '').slice(0, n);

  return (
    <span className={className}>
      {text}
      {!reduced && <span className="ml-0.5 inline-block w-[1px] animate-[lab-caret_1s_steps(2)_infinite] bg-current align-middle" style={{ height: '1em' }} />}
    </span>
  );
}
