'use client';

// The screen you land on when you open /superstake, held over the page while
// its data lands.
//
// The progress here is real: each step is a fetch the page is actually waiting
// on, and the bar fills as they settle. Nothing counts up on a timer. A step
// that fails says so rather than sitting at "loading" forever — the page
// degrades to the snapshot in that case, and the loader gets out of the way.

import { useEffect, useMemo, useState } from 'react';

/** `wait` = still in flight, `ok` = answered, `fail` = gave up (page degrades). */
export type LoadPhase = 'wait' | 'ok' | 'fail';

export interface LoaderStep {
  label: string;
  phase: LoadPhase;
}

const FADE_MS = 450;
/** Held this long even on a warm cache, so it can't strobe. */
const MIN_MS = 700;
/** Hard stop — a hung upstream must not trap anyone on a splash screen. */
const MAX_MS = 8_000;

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';

export default function SuperStakeLoader({
  /** The page has enough to paint — everything after this is layering. */
  ready,
  steps,
}: {
  ready: boolean;
  steps: LoaderStep[];
}) {
  const [gone, setGone] = useState(false);
  const [fading, setFading] = useState(false);
  const [minPassed, setMinPassed] = useState(false);

  const settled = steps.every((s) => s.phase !== 'wait');
  const done = steps.filter((s) => s.phase === 'ok').length;

  useEffect(() => {
    const min = setTimeout(() => setMinPassed(true), MIN_MS);
    const hard = setTimeout(() => setFading(true), MAX_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(hard);
    };
  }, []);

  // Waits for every step to settle rather than just the first, so the figures
  // don't shift under the reader a second after the reveal.
  useEffect(() => {
    if (minPassed && ready && settled) setFading(true);
  }, [minPassed, ready, settled]);

  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(t);
  }, [fading]);

  // The page behind is still mostly empty while this is up; letting it scroll
  // underneath just means landing somewhere arbitrary when it clears.
  useEffect(() => {
    if (gone) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [gone]);

  const pct = useMemo(
    () => (steps.length ? Math.round((done / steps.length) * 100) : 0),
    [done, steps.length],
  );

  if (gone) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading SuperStake"
      onClick={() => setFading(true)}
      className="fixed inset-0 z-[100] cursor-pointer select-none overflow-hidden bg-[#0b1018] transition-opacity duration-[450ms]"
      style={{ opacity: fading ? 0 : 1 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/superstake-loading.jpg"
        alt=""
        aria-hidden
        // It is the first paint of the page — nothing else on the route should
        // outrank it in the queue.
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-center animate-[ssload-zoom_14s_ease-out_forwards] motion-reduce:animate-none"
      />

      {/* Scrims: the artwork's own sky is dark enough at the top, but the path
          runs bright straight through where the copy sits. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg,rgba(6,8,14,0.72) 0%,rgba(6,8,14,0.18) 32%,rgba(6,8,14,0.62) 66%,rgba(6,8,14,0.94) 100%)',
        }}
      />

      <div className="relative flex h-full w-full flex-col justify-between p-5 md:p-10">
        {/* ── mark ── */}
        <div className="flex items-center gap-2.5 animate-[ssload-rise_0.6s_ease-out_both] motion-reduce:animate-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/superstake-logo.png" alt="" className="h-8 w-8 object-contain drop-shadow-lg" />
          <span
            className="text-[10px] uppercase tracking-[0.24em] text-white/70"
            style={{ fontFamily: MONO }}
          >
            SuperStake · pSSH
          </span>
        </div>

        {/* ── copy + real progress ── */}
        <div className="mx-auto w-full max-w-2xl animate-[ssload-rise_0.7s_ease-out_0.12s_both] motion-reduce:animate-none">
          <h1 className="text-[clamp(24px,5vw,42px)] font-bold leading-[1.05] tracking-[-0.035em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            A HEX stake that{' '}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>
              restakes itself
            </span>
          </h1>
          <p className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-white/70">
            Replaying every cycle from the HEX and PulseX subgraphs.
          </p>

          {/* The bar is `done / steps`, nothing else. */}
          <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-white/15">
            <span
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%`, background: GRAD }}
            />
            {/* A light travelling the remaining path — decoration, not a value. */}
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1/3 animate-[ssload-travel_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/35 to-transparent motion-reduce:hidden"
            />
          </div>

          <ul className="mt-3.5 grid gap-1.5">
            {steps.map((s) => (
              <li
                key={s.label}
                className="flex items-center gap-2 text-[11.5px]"
                style={{ fontFamily: MONO }}
              >
                <Dot phase={s.phase} />
                <span className={s.phase === 'ok' ? 'text-white/85' : 'text-white/50'}>
                  {s.label}
                </span>
                <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-white/40">
                  {s.phase === 'ok' ? 'ready' : s.phase === 'fail' ? 'unavailable' : '…'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── skip ── */}
        <div className="flex justify-end">
          <span
            className="text-[10px] uppercase tracking-[0.18em] text-white/35"
            style={{ fontFamily: MONO }}
          >
            tap to skip
          </span>
        </div>
      </div>
    </div>
  );
}

function Dot({ phase }: { phase: LoadPhase }) {
  if (phase === 'ok') {
    return (
      <span className="grid h-3.5 w-3.5 place-items-center rounded-full" style={{ background: GRAD }}>
        <svg viewBox="0 0 10 10" className="h-2 w-2" aria-hidden>
          <path
            d="M1.5 5.2 L4 7.5 L8.5 2.6"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (phase === 'fail') {
    return <span className="h-3.5 w-3.5 rounded-full border border-white/25" />;
  }
  return (
    <span className="grid h-3.5 w-3.5 place-items-center">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60 motion-reduce:animate-none" />
    </span>
  );
}
