'use client';

// The screen you land on when you open a page, held over it while its data
// lands. Shared: /superstake and /hex-strategist both dress it, and anything
// else with a slow first paint can.
//
// The progress here is real: each step is a fetch the page is actually waiting
// on, and the bar fills as they settle. Nothing counts up on a timer. A step
// that fails says so rather than sitting at "loading" forever — the page
// degrades to whatever it has and the loader gets out of the way.

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
/**
 * The default ramp is the bright half of the brand ramp. The full ramp opens on
 * a deep purple (#7E089D) which, laid over artwork, put the word "restakes" in
 * magenta directly on the monolith's magenta face and the word disappeared —
 * every stop here is light enough to hold against a picture. A page whose
 * artwork needs different colours passes its own.
 */
const DEFAULT_GRAD = 'linear-gradient(135deg,#FF5BA8,#FF6E58 38%,#FF9445 72%,#FFC94F)';

export interface EntryLoaderProps {
  /** The page has enough to paint — everything after this is layering. */
  ready: boolean;
  steps: LoaderStep[];
  /** Wide and tall crops of the same scene; only the one shown is fetched. */
  art: { landscape: string; portrait: string };
  /** Small mark and the label beside it, top-left. */
  markSrc: string;
  markLabel: string;
  /** Headline. `accent` is the part that takes the gradient. */
  title: { lead: string; accent: string; tail?: string };
  sub: string;
  /** Announced to screen readers, and the hook the tests grab. */
  ariaLabel: string;
  /** Override the headline/progress gradient when the artwork calls for it. */
  gradient?: string;
}

export default function EntryLoader({
  ready,
  steps,
  art,
  markSrc,
  markLabel,
  title,
  sub,
  ariaLabel,
  gradient,
}: EntryLoaderProps) {
  const GRAD = gradient ?? DEFAULT_GRAD;
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
      aria-label={ariaLabel}
      onClick={() => setFading(true)}
      className="fixed inset-0 z-[100] cursor-pointer select-none overflow-hidden bg-[#0b1018] transition-opacity duration-[450ms]"
      style={{ opacity: fading ? 0 : 1 }}
    >
      {/* Two crops of the same scene. A phone shown the landscape frame loses
          the mountains either side and most of the path; `picture` picks one
          and only that one is fetched. */}
      <picture>
        <source media="(max-width: 767px)" srcSet={art.portrait} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={art.landscape}
          alt=""
          aria-hidden
          // It is the first paint of the page — nothing else on the route should
          // outrank it in the queue.
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-center animate-[ssload-zoom_14s_ease-out_forwards] motion-reduce:animate-none"
        />
      </picture>

      {/* Scrims. These crops share a shape — a dark sky, a bright path running
          up the middle, a lit monolith where the headline sits — so one pair of
          scrims serves both. The linear pass handles top and bottom; the radial
          one darkens the band the copy actually occupies, and fades out before
          it reads as a box drawn on the picture. Contrast was measured against
          the artwork rather than eyeballed; see the loader's own PR. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg,rgba(6,8,14,0.70) 0%,rgba(6,8,14,0.18) 30%,rgba(6,8,14,0.52) 72%,rgba(6,8,14,0.90) 100%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 40% at 50% 58%, rgba(3,5,11,0.74) 0%, rgba(3,5,11,0.58) 45%, rgba(3,5,11,0.20) 74%, transparent 92%)',
        }}
      />

      <div className="relative flex h-full w-full flex-col justify-between p-5 md:p-10">
        {/* ── mark ── */}
        <div className="flex items-center gap-2.5 animate-[ssload-rise_0.6s_ease-out_both] motion-reduce:animate-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markSrc} alt="" className="h-8 w-8 object-contain drop-shadow-lg" />
          <span
            className="text-[10px] uppercase tracking-[0.24em] text-white/70"
            style={{ fontFamily: MONO }}
          >
            {markLabel}
          </span>
        </div>

        {/* ── copy + real progress ── */}
        <div className="mx-auto w-full max-w-2xl animate-[ssload-rise_0.7s_ease-out_0.12s_both] motion-reduce:animate-none">
          <h1 className="text-[clamp(24px,5vw,42px)] font-bold leading-[1.05] tracking-[-0.035em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            {title.lead}{' '}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>
              {title.accent}
            </span>
            {title.tail ? ` ${title.tail}` : ''}
          </h1>
          <p className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-white/70">{sub}</p>

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
                <Dot phase={s.phase} gradient={GRAD} />
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

function Dot({ phase, gradient }: { phase: LoadPhase; gradient: string }) {
  if (phase === 'ok') {
    return (
      <span className="grid h-3.5 w-3.5 place-items-center rounded-full" style={{ background: gradient }}>
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
