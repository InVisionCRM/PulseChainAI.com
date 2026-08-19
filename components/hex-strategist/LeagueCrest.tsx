'use client';

// League insignia — one hand-drawn sigil per rung of the ladder, set in a
// hexagonal crest (HEX's own mark).
//
// These are drawn as SVG paths rather than shipped as artwork or borrowed from
// an emoji font: emoji render differently on every platform, go blurry the
// moment they are scaled up, and cannot take the tier's color. Paths scale to
// any size, recolor per tier, and add nothing to the bundle.
//
// Everything is drawn as a filled silhouette inside x 4..96, y 4..96 — the
// glyph is scaled to 0.62 inside the hexagon, and anything wider than that
// clips on the frame's diagonals. Cut-out details (eyes, gills, shell ribs) are
// painted in `--panel` so they read as holes in both themes.

import type { League } from '@/lib/hex/leagues';

interface Props {
  league: League;
  /** Rendered size in px. */
  size?: number;
  /** Dim the crest — used for tiers the viewer has not reached. */
  muted?: boolean;
  className?: string;
}

// Flat-top hexagon in a 100×100 box.
const HEX_PATH = 'M50 3 L91 26.5 L91 73.5 L50 97 L9 73.5 L9 26.5 Z';

const CUT = 'var(--panel)';

const GLYPHS: Record<string, React.ReactNode> = {
  // Poseidon's trident — the god, not a creature, so the sigil is his weapon.
  poseidon: (
    <>
      <path d="M46 44 L50 8 L54 44 Z" />
      <path d="M22 48 L26 15 L30 48 Z" />
      <path d="M70 48 L74 15 L78 48 Z" />
      <path d="M22 43 Q50 34 78 43 L78 49 Q50 40 22 49 Z" />
      <path d="M47 42 h6 v44 h-6 Z" />
      <path d="M40 86 h20 v5 h-20 Z" />
    </>
  ),
  // A side-on whale reads as a fat fish at badge size however it is drawn; the
  // diving fluke is the one whale silhouette nothing else shares.
  whale: (
    <>
      <path
        d="M50 52 C44 34 27 18 7 10 C3 8 0 14 4 18 C24 32 38 46 43 60
           C45 68 45 77 44 89 L56 89 C55 77 55 68 57 60
           C62 46 76 32 96 18 C100 14 97 8 93 10 C73 18 56 34 50 52 Z"
      />
      <g fill="none" strokeWidth="4" strokeLinecap="round" opacity="0.7">
        <path d="M12 92 C20 87 28 87 36 92 M64 92 C72 87 80 87 88 92" />
      </g>
    </>
  ),
  shark: (
    <>
      <path
        d="M9 58 C18 48 31 43 43 44 L51 23 L61 46 C70 48 77 51 82 55 L97 31 L89 58 L95 77 L82 62
           C75 68 63 72 49 70 C29 68 11 63 9 58 Z"
      />
      <circle cx="20" cy="55" r="2.4" fill={CUT} />
      <path
        d="M28 56 l3 6 M34 57 l3 6 M40 58 l3 6"
        fill="none"
        strokeWidth="2.4"
        stroke={CUT}
        strokeLinecap="round"
      />
    </>
  ),
  // The long beak and the small sickle dorsal are what keep this from reading
  // as the shark one tier above.
  dolphin: (
    <>
      <path
        d="M3 63 C10 59 16 55 23 53 C27 44 35 38 46 37 C53 37 59 38 63 41
           C67 33 73 27 82 24 C80 33 77 40 72 45 C79 48 84 53 88 58
           L97 47 L93 60 L97 75 L88 64 C82 70 69 74 55 72 C41 70 29 66 23 62
           C16 62 9 63 3 63 Z"
      />
      <path d="M41 63 C35 77 48 82 55 73 C58 69 57 65 54 63 Z" />
      <circle cx="29" cy="53" r="2.8" fill={CUT} />
    </>
  ),
  squid: (
    <>
      <path d="M50 8 C59 21 65 34 65 45 C65 55 58 61 50 61 C42 61 35 55 35 45 C35 34 41 21 50 8 Z" />
      <path d="M35 27 C24 22 21 33 32 38 Z M65 27 C76 22 79 33 68 38 Z" />
      <circle cx="42" cy="46" r="4.2" fill={CUT} />
      <circle cx="58" cy="46" r="4.2" fill={CUT} />
      <g fill="none" strokeWidth="4" strokeLinecap="round">
        <path d="M40 60 C34 71 30 79 24 90" />
        <path d="M46 61 C44 73 43 81 41 92" />
        <path d="M54 61 C56 73 57 81 59 92" />
        <path d="M60 60 C66 71 70 79 76 90" />
      </g>
      {/* The two long feeding tentacles — the squid tell over an octopus. */}
      <g fill="none" strokeWidth="3" strokeLinecap="round">
        <path d="M44 61 C38 76 26 84 14 86" />
        <path d="M56 61 C62 76 74 84 86 86" />
      </g>
    </>
  ),
  turtle: (
    <>
      <path d="M50 20 C69 20 82 34 82 51 C82 68 69 81 50 81 C31 81 18 68 18 51 C18 34 31 20 50 20 Z" />
      <path d="M50 6 C57 6 61 11 61 17 C61 22 56 25 50 25 C44 25 39 22 39 17 C39 11 43 6 50 6 Z" />
      <path d="M20 30 C12 26 6 32 12 40 C16 45 22 44 24 39 Z M80 30 C88 26 94 32 88 40 C84 45 78 44 76 39 Z" />
      <path d="M22 72 C14 76 16 86 26 84 C31 83 33 78 31 74 Z M78 72 C86 76 84 86 74 84 C69 83 67 78 69 74 Z" />
      <g fill="none" stroke={CUT} strokeWidth="2.6">
        <path d="M50 30 L64 40 L59 57 L41 57 L36 40 Z" />
        <path d="M50 20 L50 30 M18 51 L36 40 M82 51 L64 40 M35 76 L41 57 M65 76 L59 57" />
      </g>
    </>
  ),
  crab: (
    <>
      <path d="M50 44 C65 44 76 52 76 62 C76 73 65 80 50 80 C35 80 24 73 24 62 C24 52 35 44 50 44 Z" />
      <circle cx="41" cy="36" r="5" />
      <circle cx="59" cy="36" r="5" />
      <path d="M39 42 h4 v-6 h-4 Z M57 42 h4 v-6 h-4 Z" />
      <path d="M16 30 C6 34 4 46 12 52 C18 56 24 52 24 46 L16 44 L24 40 C24 34 21 29 16 30 Z" />
      <path d="M84 30 C94 34 96 46 88 52 C82 56 76 52 76 46 L84 44 L76 40 C76 34 79 29 84 30 Z" />
      <g fill="none" strokeWidth="4" strokeLinecap="round">
        <path d="M27 66 L12 70 M29 73 L16 82 M34 78 L26 90" />
        <path d="M73 66 L88 70 M71 73 L84 82 M66 78 L74 90" />
      </g>
    </>
  ),
  // The giveaway is a curved, SEGMENTED shell — the dashed arc puts real gaps
  // in the outline, which an unbroken tube never did.
  shrimp: (
    <>
      <path
        d="M66 30 C38 27 16 46 21 68 C23 78 30 85 39 89"
        fill="none"
        strokeWidth="21"
        strokeDasharray="13.5 3.5"
        strokeLinecap="butt"
      />
      <path d="M64 17 C80 19 88 34 81 47 C76 56 65 59 59 52 C52 44 53 24 64 17 Z" />
      <path d="M40 80 L20 95 L40 90 L58 96 Z" />
      <path
        d="M76 12 C82 7 88 5 94 5 M84 22 C89 19 93 18 96 18"
        fill="none"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="66" cy="31" r="3.4" fill={CUT} />
      <g fill="none" strokeWidth="3" strokeLinecap="round">
        <path d="M36 62 L24 70 M42 74 L33 84 M39 48 L27 52" />
      </g>
    </>
  ),
  shell: (
    <>
      <path
        d="M12 46 Q17 28 24 40 Q30 24 37 37 Q43 21 50 35 Q57 21 63 37 Q70 24 76 40 Q83 28 88 46
           C90 66 73 86 50 88 C27 86 10 66 12 46 Z"
      />
      <g fill="none" stroke={CUT} strokeWidth="2.6" strokeLinecap="round">
        <path d="M50 86 L50 34 M50 86 L36 38 M50 86 L64 38 M50 86 L23 44 M50 86 L77 44" />
      </g>
    </>
  ),
};

export default function LeagueCrest({ league, size = 44, muted = false, className }: Props) {
  const id = `crest-${league.key}-${size}`;
  const c = league.color;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${league.name} league insignia`}
      style={{ opacity: muted ? 0.35 : 1, filter: muted ? 'grayscale(0.7)' : `drop-shadow(0 0 ${size / 9}px ${c}55)` }}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.28" />
          <stop offset="55%" stopColor={c} stopOpacity="0.07" />
          <stop offset="100%" stopColor={c} stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="1" />
          <stop offset="50%" stopColor={c} stopOpacity="0.5" />
          <stop offset="100%" stopColor={c} stopOpacity="1" />
        </linearGradient>
        {/* The frame clips the sigil, so a glyph can bleed to the hexagon's
            edge without spilling past its diagonals. */}
        <clipPath id={`${id}-clip`}>
          <path d={HEX_PATH} />
        </clipPath>
      </defs>

      {/* Body + double edge — the inner rule is what reads as "forged". */}
      <path d={HEX_PATH} fill={`url(#${id}-fill)`} stroke={`url(#${id}-edge)`} strokeWidth="4" strokeLinejoin="miter" />
      <path
        d={HEX_PATH}
        fill="none"
        stroke={c}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        transform="translate(50 50) scale(0.845) translate(-50 -50)"
      />

      <g
        clipPath={`url(#${id}-clip)`}
        fill={c}
        stroke={c}
        transform="translate(50 50) scale(0.62) translate(-50 -50)"
      >
        {GLYPHS[league.key] ?? null}
      </g>
    </svg>
  );
}
