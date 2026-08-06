"use client";

// Nav glyphs that colour themselves by whether their route is the one you're on.
//
// The rest of the nav uses Tabler line icons and `currentColor`, so these are
// drawn the same way — stroked paths on a 24-box, inheriting colour — rather
// than as two PNGs per state. That keeps them crisp at any size, correct in
// both themes, and it means the idle/active pair is a colour swap instead of a
// second image to keep in sync.
//
// Active is cyan rather than the label's orange because that's the accent the
// supplied artwork uses.

import React from 'react';
import { usePathname } from 'next/navigation';

const BOX = 'h-5 w-5 shrink-0';

type GlyphProps = {
  /** Route this glyph belongs to; matching the current path turns it on. */
  href?: string;
  className?: string;
  /** Force the state instead of deriving it (external links never "match"). */
  active?: boolean;
};

function useActive(href?: string, forced?: boolean) {
  const pathname = usePathname();
  if (forced !== undefined) return forced;
  if (!href || href.startsWith('http')) return false;
  return pathname === href;
}

function tone(on: boolean) {
  return on ? 'text-cyan-400' : 'text-[var(--text-muted)]';
}

const STROKE = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** A house: roof chevron, body, and a door notch in the near wall. */
export function HomeGlyph({ href = '/', className, active }: GlyphProps) {
  const on = useActive(href, active);
  return (
    <svg viewBox="0 0 24 24" className={`${BOX} ${tone(on)} ${className || ''}`} aria-hidden {...STROKE}>
      <path d="M3 10.8 12 3.8l9 7" />
      <path d="M5.7 9.8v10.4h4.1v-4.5h4.4v4.5h4.1V9.8" />
    </svg>
  );
}

/** A wallet: body, card slot, and the round add button on the outer edge. */
export function WalletGlyph({ href = '/portfolio', className, active }: GlyphProps) {
  const on = useActive(href, active);
  return (
    <svg viewBox="0 0 24 24" className={`${BOX} ${tone(on)} ${className || ''}`} aria-hidden {...STROKE}>
      <rect x="3" y="5.8" width="18" height="12.4" rx="2.6" />
      <path d="M3 10.4h18" />
      <circle cx="17" cy="14.3" r="1.9" />
      <path d="M17 13.2v2.2M15.9 14.3h2.2" />
    </svg>
  );
}

/** A fanned hand of cards, heart up. Three reads better than four at 20px. */
export function CardsGlyph({ href, className, active }: GlyphProps) {
  const on = useActive(href, active);
  return (
    <svg viewBox="0 0 24 24" className={`${BOX} ${tone(on)} ${className || ''}`} aria-hidden {...STROKE}>
      <rect x="3.4" y="7.4" width="8.4" height="12" rx="1.5" transform="rotate(-20 7.6 13.4)" />
      <rect x="7.8" y="6.4" width="8.4" height="12" rx="1.5" transform="rotate(-7 12 12.4)" />
      <rect x="12.4" y="6.6" width="8.4" height="12" rx="1.5" transform="rotate(9 16.6 12.6)" />
      {/* Heart pip on the front card, following its tilt. */}
      <path
        d="M16.6 14.2c-1.5-1-2.2-1.8-2.2-2.7a1.2 1.2 0 0 1 2.2-.7 1.2 1.2 0 0 1 2.2.7c0 .9-.7 1.7-2.2 2.7z"
        transform="rotate(9 16.6 12.6)"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
