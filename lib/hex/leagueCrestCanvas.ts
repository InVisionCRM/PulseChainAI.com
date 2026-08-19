// The league crests, painted onto a canvas — for the share cards, which are
// drawn, not rendered. Path2D takes SVG path data directly, so these are the
// SAME silhouettes as components/hex-strategist/LeagueCrest.tsx (the on-page
// SVG crest): if a sigil changes there, change it here too. Circles from the
// SVG are written as arc paths; cut-out details (eyes, shell ribs) are painted
// in the card's ink so they read as holes.

import type { League } from '@/lib/hex/leagues';

/** Flat-top hexagon in a 100×100 box — LeagueCrest's frame. */
const HEX_PATH = 'M50 3 L91 26.5 L91 73.5 L50 97 L9 73.5 L9 26.5 Z';

/** An SVG <circle> as path data, so everything runs through Path2D. */
const circle = (cx: number, cy: number, r: number) =>
  `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;

interface GlyphOp {
  d: string;
  /** fill: 'body' = league color (default), 'cut' = ink hole, 'none' = stroke only. */
  fill?: 'body' | 'cut' | 'none';
  stroke?: 'body' | 'cut';
  strokeWidth?: number;
  dash?: number[];
  cap?: CanvasLineCap;
  opacity?: number;
}

const GLYPHS: Record<string, GlyphOp[]> = {
  poseidon: [
    { d: 'M46 44 L50 8 L54 44 Z' },
    { d: 'M22 48 L26 15 L30 48 Z' },
    { d: 'M70 48 L74 15 L78 48 Z' },
    { d: 'M22 43 Q50 34 78 43 L78 49 Q50 40 22 49 Z' },
    { d: 'M47 42 h6 v44 h-6 Z' },
    { d: 'M40 86 h20 v5 h-20 Z' },
  ],
  whale: [
    {
      d: 'M50 52 C44 34 27 18 7 10 C3 8 0 14 4 18 C24 32 38 46 43 60 C45 68 45 77 44 89 L56 89 C55 77 55 68 57 60 C62 46 76 32 96 18 C100 14 97 8 93 10 C73 18 56 34 50 52 Z',
    },
    { d: 'M12 92 C20 87 28 87 36 92 M64 92 C72 87 80 87 88 92', fill: 'none', stroke: 'body', strokeWidth: 4, cap: 'round', opacity: 0.7 },
  ],
  shark: [
    {
      d: 'M9 58 C18 48 31 43 43 44 L51 23 L61 46 C70 48 77 51 82 55 L97 31 L89 58 L95 77 L82 62 C75 68 63 72 49 70 C29 68 11 63 9 58 Z',
    },
    { d: circle(20, 55, 2.4), fill: 'cut' },
    { d: 'M28 56 l3 6 M34 57 l3 6 M40 58 l3 6', fill: 'none', stroke: 'cut', strokeWidth: 2.4, cap: 'round' },
  ],
  dolphin: [
    {
      d: 'M3 63 C10 59 16 55 23 53 C27 44 35 38 46 37 C53 37 59 38 63 41 C67 33 73 27 82 24 C80 33 77 40 72 45 C79 48 84 53 88 58 L97 47 L93 60 L97 75 L88 64 C82 70 69 74 55 72 C41 70 29 66 23 62 C16 62 9 63 3 63 Z',
    },
    { d: 'M41 63 C35 77 48 82 55 73 C58 69 57 65 54 63 Z' },
    { d: circle(29, 53, 2.8), fill: 'cut' },
  ],
  squid: [
    { d: 'M50 8 C59 21 65 34 65 45 C65 55 58 61 50 61 C42 61 35 55 35 45 C35 34 41 21 50 8 Z' },
    { d: 'M35 27 C24 22 21 33 32 38 Z M65 27 C76 22 79 33 68 38 Z' },
    { d: circle(42, 46, 4.2), fill: 'cut' },
    { d: circle(58, 46, 4.2), fill: 'cut' },
    {
      d: 'M40 60 C34 71 30 79 24 90 M46 61 C44 73 43 81 41 92 M54 61 C56 73 57 81 59 92 M60 60 C66 71 70 79 76 90',
      fill: 'none', stroke: 'body', strokeWidth: 4, cap: 'round',
    },
    { d: 'M44 61 C38 76 26 84 14 86 M56 61 C62 76 74 84 86 86', fill: 'none', stroke: 'body', strokeWidth: 3, cap: 'round' },
  ],
  turtle: [
    { d: 'M50 20 C69 20 82 34 82 51 C82 68 69 81 50 81 C31 81 18 68 18 51 C18 34 31 20 50 20 Z' },
    { d: 'M50 6 C57 6 61 11 61 17 C61 22 56 25 50 25 C44 25 39 22 39 17 C39 11 43 6 50 6 Z' },
    { d: 'M20 30 C12 26 6 32 12 40 C16 45 22 44 24 39 Z M80 30 C88 26 94 32 88 40 C84 45 78 44 76 39 Z' },
    { d: 'M22 72 C14 76 16 86 26 84 C31 83 33 78 31 74 Z M78 72 C86 76 84 86 74 84 C69 83 67 78 69 74 Z' },
    {
      d: 'M50 30 L64 40 L59 57 L41 57 L36 40 Z M50 20 L50 30 M18 51 L36 40 M82 51 L64 40 M35 76 L41 57 M65 76 L59 57',
      fill: 'none', stroke: 'cut', strokeWidth: 2.6,
    },
  ],
  crab: [
    { d: 'M50 44 C65 44 76 52 76 62 C76 73 65 80 50 80 C35 80 24 73 24 62 C24 52 35 44 50 44 Z' },
    { d: circle(41, 36, 5) },
    { d: circle(59, 36, 5) },
    { d: 'M39 42 h4 v-6 h-4 Z M57 42 h4 v-6 h-4 Z' },
    { d: 'M16 30 C6 34 4 46 12 52 C18 56 24 52 24 46 L16 44 L24 40 C24 34 21 29 16 30 Z' },
    { d: 'M84 30 C94 34 96 46 88 52 C82 56 76 52 76 46 L84 44 L76 40 C76 34 79 29 84 30 Z' },
    {
      d: 'M27 66 L12 70 M29 73 L16 82 M34 78 L26 90 M73 66 L88 70 M71 73 L84 82 M66 78 L74 90',
      fill: 'none', stroke: 'body', strokeWidth: 4, cap: 'round',
    },
  ],
  shrimp: [
    {
      d: 'M66 30 C38 27 16 46 21 68 C23 78 30 85 39 89',
      fill: 'none', stroke: 'body', strokeWidth: 21, dash: [13.5, 3.5], cap: 'butt',
    },
    { d: 'M64 17 C80 19 88 34 81 47 C76 56 65 59 59 52 C52 44 53 24 64 17 Z' },
    { d: 'M40 80 L20 95 L40 90 L58 96 Z' },
    { d: 'M76 12 C82 7 88 5 94 5 M84 22 C89 19 93 18 96 18', fill: 'none', stroke: 'body', strokeWidth: 3.2, cap: 'round' },
    { d: circle(66, 31, 3.4), fill: 'cut' },
    { d: 'M36 62 L24 70 M42 74 L33 84 M39 48 L27 52', fill: 'none', stroke: 'body', strokeWidth: 3, cap: 'round' },
  ],
  shell: [
    {
      d: 'M12 46 Q17 28 24 40 Q30 24 37 37 Q43 21 50 35 Q57 21 63 37 Q70 24 76 40 Q83 28 88 46 C90 66 73 86 50 88 C27 86 10 66 12 46 Z',
    },
    {
      d: 'M50 86 L50 34 M50 86 L36 38 M50 86 L64 38 M50 86 L23 44 M50 86 L77 44',
      fill: 'none', stroke: 'cut', strokeWidth: 2.6, cap: 'round',
    },
  ],
};

/** A hex color plus an 0–1 alpha, as an 8-digit hex string. */
const withAlpha = (hex: string, a: number) =>
  `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`;

/**
 * Paint one league crest with its top-left corner at (x, y), `size` px square.
 * `ink` is the card's background — it fills the sigil's cut-out details.
 */
export function paintLeagueCrest(
  c: CanvasRenderingContext2D, league: Pick<League, 'key' | 'color'>, x: number, y: number, size: number, ink: string,
) {
  const frame = new Path2D(HEX_PATH);
  c.save();
  c.translate(x, y);
  c.scale(size / 100, size / 100);

  // Body wash + double edge, matching the SVG crest's gradients closely
  // enough that the two read as the same badge.
  const wash = c.createLinearGradient(0, 0, 0, 100);
  wash.addColorStop(0, withAlpha(league.color, 0.28));
  wash.addColorStop(0.55, withAlpha(league.color, 0.07));
  wash.addColorStop(1, withAlpha(league.color, 0.22));
  c.fillStyle = wash;
  c.fill(frame);
  c.lineWidth = 4;
  c.strokeStyle = league.color;
  c.stroke(frame);
  c.save();
  c.translate(50, 50);
  c.scale(0.845, 0.845);
  c.translate(-50, -50);
  c.lineWidth = 1.5 / 0.845;
  c.strokeStyle = withAlpha(league.color, 0.3);
  c.stroke(frame);
  c.restore();

  // The sigil, clipped to the frame like the SVG version.
  c.clip(frame);
  c.translate(50, 50);
  c.scale(0.62, 0.62);
  c.translate(-50, -50);
  for (const op of GLYPHS[league.key] ?? []) {
    const p = new Path2D(op.d);
    c.globalAlpha = op.opacity ?? 1;
    if (op.fill !== 'none') {
      c.fillStyle = op.fill === 'cut' ? ink : league.color;
      c.fill(p);
    }
    if (op.stroke) {
      c.strokeStyle = op.stroke === 'cut' ? ink : league.color;
      c.lineWidth = op.strokeWidth ?? 3;
      c.lineCap = op.cap ?? 'butt';
      c.setLineDash(op.dash ?? []);
      c.stroke(p);
      c.setLineDash([]);
    }
  }
  c.restore();
}
