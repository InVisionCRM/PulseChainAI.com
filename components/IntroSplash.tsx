'use client';

// Cinematic intro shown on a cold open: displays the Morbius loader
// full-screen (the same animated mark used across the app), then fades
// out into the app. Shown once per browser session (so in-app navigations
// don't replay it) and skippable with a tap. Auto-dismisses after MAX_MS.

import { useEffect, useState } from 'react';
import { LoaderThree } from '@/components/ui/loader';

const SESSION_KEY = 'morbius-intro-seen-v1';
const MAX_MS = 6000;
const FADE_MS = 500;

export function IntroSplash() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      seen = false;
    }
    // Respect users who prefer reduced motion — skip the splash entirely.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (seen || reduce) return;

    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    const hardStop = setTimeout(dismiss, MAX_MS);
    return () => clearTimeout(hardStop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  function dismiss() {
    setFading(true);
    setTimeout(() => setShow(false), FADE_MS);
  }

  if (!show) return null;

  return (
    <div
      onClick={dismiss}
      className="fixed inset-0 z-[100] grid place-items-center bg-[#0b0613] transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1 }}
      aria-hidden
    >
      <LoaderThree />

      {/* Tagline — fades in over the lower third for legibility */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-6 pb-20 pt-24 text-center">
        <h1 className="intro-fade flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-lg font-semibold tracking-tight text-white sm:text-2xl">
          <span>Token Analyzer</span>
          <span className="text-white/30">/</span>
          <span>AI Code Reader</span>
          <span className="text-white/30">/</span>
          <span>Portfolio Manager</span>
        </h1>
        <p className="intro-fade intro-fade-delay text-sm font-medium tracking-wide text-purple-300 sm:text-base">
          Morbius.io
        </p>
      </div>

      <style>{`
        @keyframes introFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .intro-fade { opacity: 0; animation: introFadeUp 0.8s ease-out 0.5s forwards; }
        .intro-fade-delay { animation-delay: 0.9s; }
      `}</style>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        className="absolute bottom-8 right-6 rounded-full border border-white/20 bg-black/40 px-4 py-1.5 text-xs font-semibold text-white/80 backdrop-blur hover:bg-black/60"
      >
        Skip
      </button>
    </div>
  );
}
