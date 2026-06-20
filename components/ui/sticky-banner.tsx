'use client';

import React, { useEffect, useState } from 'react';
import { IconX } from '@tabler/icons-react';

// Generic, dismissable sticky banner (Aceternity "sticky banner" pattern).
// Callers control position / background / height via `className` + `style`;
// `children` is the message. Exported as a NAMED export so callers can compose
// their own content (e.g. the AI-agent "contract not verified" notice).
export function StickyBanner({
  className = '',
  style,
  hideOnScroll = false,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  /** When true, the banner hides itself once the page is scrolled. */
  hideOnScroll?: boolean;
  children: React.ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [scrolledAway, setScrolledAway] = useState(false);

  useEffect(() => {
    if (!hideOnScroll) return;
    const onScroll = () => setScrolledAway(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hideOnScroll]);

  if (dismissed || scrolledAway) return null;

  return (
    <div className={`w-full ${className}`} style={style}>
      <div className="mx-auto flex w-full items-center justify-between gap-2 px-3 py-2 md:px-4">
        <div className="flex-1 text-center">{children}</div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-white/10 transition-colors"
          aria-label="Close banner"
          title="Close banner"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Default export: the Morbius poker / BlackJack promo shown on the home page.
// A thin preset over <StickyBanner> so there's a single banner implementation.
export default function PokerPromoBanner() {
  return (
    <StickyBanner className="sticky top-0 z-50 bg-black/25 text-white backdrop-blur-sm">
      <p className="font-poppins font-bold text-[11px] md:text-sm">
        Poker and Multiplayer BlackJack are now live on Morbius.io! Click{' '}
        <a
          href="https://win.morbius.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-cyan-300 transition-colors"
        >
          HERE
        </a>{' '}
        to Play Now!
      </p>
    </StickyBanner>
  );
}
