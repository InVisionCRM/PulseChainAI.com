'use client';

// The headline count, which climbs the last stretch on arrival.
//
// It starts three quarters of the way there and walks up to the real figure
// over a few seconds. That is a presentation choice, not a data one, and worth
// being precise about: the number it lands on and holds is the true count, and
// it is in the server-rendered HTML before this component ever runs. What the
// climb buys is the impression the page is a live thing rather than a
// screenshot — because it IS live, and a static figure hides that.
//
// It settles, deliberately. A number that never stops moving reads as a slot
// machine and stops meaning anything.

import { useEffect, useRef, useState } from 'react';

/** How much of the climb the viewer sees. The rest is already on screen. */
const FROM = 0.75;
const DURATION_MS = 2_600;

/** Ease-out cubic: quick off the mark, unhurried at the top. */
const ease = (p: number) => 1 - Math.pow(1 - p, 3);

export function RescueCounter({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const [shown, setShown] = useState(value);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const from = Math.floor(value * FROM);
    if (from >= value) {
      setShown(value);
      return;
    }
    let started = 0;
    const step = (now: number) => {
      if (!started) started = now;
      const p = Math.min(1, (now - started) / DURATION_MS);
      setShown(Math.round(from + (value - from) * ease(p)));
      if (p < 1) frame.current = requestAnimationFrame(step);
    };
    setShown(from);
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [value]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{ background: 'linear-gradient(135deg, #ff9e00 0%, #ff2e7e 52%, #ff00d4 100%)' }}
      />
      <div className="relative">
        <div className="font-poppins text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-faint)]">
          {label}
        </div>
        <div className="font-jost mt-1 text-[54px] font-bold leading-none tracking-tight text-[var(--text)] tabular-nums md:text-[72px]">
          {shown.toLocaleString()}
        </div>
        {sub && (
          <div className="font-poppins mt-1 flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
