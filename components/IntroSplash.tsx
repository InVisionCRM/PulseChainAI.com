'use client';

// Cinematic intro shown on a cold open: plays the 6-second brand clip
// full-screen, then fades out into the app. Shown once per browser session
// (so in-app navigations don't replay it) and skippable with a tap. The clip
// is muted so it can autoplay everywhere; it hard-stops at 6s regardless of
// the source length.

import { useEffect, useRef, useState } from 'react';

const SESSION_KEY = 'morbius-intro-seen-v1';
const MAX_MS = 6000;
const FADE_MS = 500;

export function IntroSplash() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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
      <video
        ref={videoRef}
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={dismiss}
        className="h-full w-full object-cover"
      />
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
