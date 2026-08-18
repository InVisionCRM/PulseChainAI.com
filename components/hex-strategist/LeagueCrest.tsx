'use client';

// League insignia. Drawn as SVG rather than shipped as artwork so it scales to
// any size, recolors per tier, and adds nothing to the bundle.
//
// The shape is a hexagon — HEX's own mark — carrying military-style rank
// chevrons: more chevrons the higher the tier, with a star crowning the top
// three. Sharp geometry and a metallic ramp, no mascots.

import type { League } from '@/lib/hex/leagues';

interface Props {
  league: League;
  /** Rendered size in px. */
  size?: number;
  /** Dim the crest — used for tiers the viewer has not reached. */
  muted?: boolean;
  className?: string;
}

// Hexagon with a flat top, drawn in a 100×100 box.
const HEX_PATH = 'M50 4 L92 27 L92 73 L50 96 L8 73 L8 27 Z';

/** Chevron pointing up, `i` steps down from the crest's middle. */
function chevron(i: number) {
  const y = 52 + i * 15;
  return `M28 ${y + 11} L50 ${y} L72 ${y + 11}`;
}

export default function LeagueCrest({ league, size = 44, muted = false, className }: Props) {
  const id = `crest-${league.key}`;
  const c = league.color;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${league.name} league insignia`}
      style={{ opacity: muted ? 0.35 : 1, filter: muted ? 'grayscale(0.7)' : `drop-shadow(0 0 ${size / 8}px ${c}44)` }}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.30" />
          <stop offset="55%" stopColor={c} stopOpacity="0.08" />
          <stop offset="100%" stopColor={c} stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="1" />
          <stop offset="50%" stopColor={c} stopOpacity="0.55" />
          <stop offset="100%" stopColor={c} stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Body + double edge — the inner rule is what reads as "forged". */}
      <path d={HEX_PATH} fill={`url(#${id}-fill)`} stroke={`url(#${id}-edge)`} strokeWidth="4" strokeLinejoin="miter" />
      <path d={HEX_PATH} fill="none" stroke={c} strokeOpacity="0.35" strokeWidth="1.5" transform="translate(50 50) scale(0.84) translate(-50 -50)" />

      {league.star && (
        <path
          d="M50 20 L56.5 36 L73 37.5 L60.5 48 L64.5 64 L50 55 L35.5 64 L39.5 48 L27 37.5 L43.5 36 Z"
          fill={c}
          fillOpacity="0.9"
          transform={`translate(50 ${league.chevrons > 0 ? 30 : 50}) scale(${league.chevrons > 0 ? 0.62 : 0.86}) translate(-50 -42)`}
        />
      )}

      {Array.from({ length: league.chevrons }, (_, i) => (
        <path
          key={i}
          d={chevron(i)}
          fill="none"
          stroke={c}
          strokeOpacity={1 - i * 0.16}
          strokeWidth="7"
          strokeLinecap="square"
          strokeLinejoin="miter"
          // With a star above, the chevrons sit lower and tighter so the crest
          // stays balanced instead of colliding in the middle.
          transform={
            league.star
              ? `translate(50 63) scale(0.62) translate(-50 -63)`
              : `translate(50 56) scale(0.86) translate(-50 -56)`
          }
        />
      ))}

      {/* Entry tier has no rank marks at all — just the empty frame and a core. */}
      {league.chevrons === 0 && !league.star && <circle cx="50" cy="50" r="7" fill={c} fillOpacity="0.65" />}
    </svg>
  );
}
