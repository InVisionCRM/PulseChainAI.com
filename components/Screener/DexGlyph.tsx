"use client";

// The one dex icon used everywhere a dex is named: real artwork when
// DexScreener has it, a coloured letter badge when it doesn't.
//
// The badge is not a nicety — dd.dexscreener.com serves a generic "?" image
// with HTTP 200 for dexes it doesn't know, so before dexLogo() learned to
// return null for those, every Robinhood dex (and PulseX v2!) rendered as a
// question mark and onError never had a chance to save it.

import React from 'react';
import { dexBadgeHue, dexLogo, dexName } from './format';

export function DexGlyph({ dexId, className = 'h-4 w-4' }: { dexId: string; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  const url = dexLogo(dexId);

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={dexName(dexId)}
        className={`${className} shrink-0 rounded-full object-cover`}
        onError={() => setFailed(true)}
        loading="lazy"
      />
    );
  }

  const hue = dexBadgeHue(dexId);
  return (
    <span
      role="img"
      aria-label={dexName(dexId)}
      className={`${className} flex shrink-0 items-center justify-center rounded-full text-[9px] font-bold uppercase leading-none`}
      style={{
        backgroundColor: `hsl(${hue} 60% 22%)`,
        color: `hsl(${hue} 85% 72%)`,
      }}
    >
      {dexName(dexId).charAt(0)}
    </span>
  );
}

export default DexGlyph;
