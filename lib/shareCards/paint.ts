// The canvas kit every share card is drawn with.
//
// This is the SuperStake painter's generic half, lifted out unchanged so the
// token cards draw on exactly the same furniture — same panel radius, same
// type scale, same brand gradient — rather than a second look that drifts.
// SuperStake keeps its own card list and painters; only the primitives moved.
//
// Cards are painted straight to a canvas rather than rasterised from DOM: the
// output is byte-identical everywhere and needs no extra dependency.

export const CARD_W = 1080;
export const CARD_H = 1080;

/** Content box between the header rule and the footer rule. */
export const PAD = 64;
export const BOX_W = CARD_W - PAD * 2;

export const INK = '#06182E';
export const PANEL = '#0C2340';
export const LINE = 'rgba(255,255,255,0.12)';
export const LINE_2 = 'rgba(255,255,255,0.26)';
export const TX = '#ffffff';
export const TX_MID = 'rgba(226,231,245,0.72)';
export const TX_DIM = 'rgba(226,231,245,0.45)';
export const UP = '#4ade80';
export const DOWN = '#f87171';
export const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * A card's colour scheme. The eleven fixed cards and SuperStake's all draw in
 * Midnight, which is why the constants above stay exported and unchanged; the
 * builder passes one of these to the helpers that take a palette so a custom
 * card can be carbon or light without touching anything else.
 */
export interface Pal {
  ink: string; panel: string; line: string; line2: string;
  tx: string; txMid: string; txDim: string;
}

export const PALETTES = {
  midnight: { ink: INK, panel: PANEL, line: LINE, line2: LINE_2, tx: TX, txMid: TX_MID, txDim: TX_DIM },
  carbon: {
    ink: '#08090C', panel: '#131519', line: 'rgba(255,255,255,0.10)', line2: 'rgba(255,255,255,0.22)',
    tx: '#ffffff', txMid: 'rgba(233,236,242,0.70)', txDim: 'rgba(233,236,242,0.42)',
  },
  paper: {
    ink: '#F5F3EE', panel: '#FFFFFF', line: 'rgba(16,24,40,0.10)', line2: 'rgba(16,24,40,0.22)',
    tx: '#0D1424', txMid: 'rgba(13,20,36,0.68)', txDim: 'rgba(13,20,36,0.45)',
  },
  wash: {
    ink: '#160A24', panel: 'rgba(255,255,255,0.06)', line: 'rgba(255,255,255,0.16)', line2: 'rgba(255,255,255,0.30)',
    tx: '#ffffff', txMid: 'rgba(240,235,250,0.76)', txDim: 'rgba(240,235,250,0.50)',
  },
} satisfies Record<string, Pal>;

export type PaletteName = keyof typeof PALETTES;

/** Accents the collages reach for, named so cards don't sprinkle hex codes. */
export const ACCENT = {
  amber: '#FB9438',
  red: '#D83639',
  magenta: '#AE176A',
  purple: '#7E089D',
  orange: '#E96635',
  steel: '#5E7BA6',
} as const;

/** What a card prints where a figure is missing. Drawn dim, never headline-size. */
export const MISSING = '—';

export const nf = (n: number, dp = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const compact = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B`
    : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M`
      : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k`
        : nf(n);

export const money = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
    : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M`
      : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k`
        : `$${n.toFixed(2)}`;

/** A gain or loss, signed rather than left to `money()`'s bare minus. */
export function signed(n: number): string {
  return `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;
}

/** A percentage with its sign, at a precision that suits its size. */
export function signedPct(n: number): string {
  const abs = Math.abs(n);
  const dp = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${n >= 0 ? '+' : '−'}${abs.toFixed(dp)}%`;
}

/** A live price: cents need 2 digits, a token at 0.0000004 needs all of them. */
export function price(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return MISSING;
  if (n >= 1) return `$${nf(n, 2)}`;
  // Trailing zeros are noise at this size — $0.00318700 is just $0.003187.
  const trim = (s: string) => s.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  if (n >= 0.01) return `$${trim(n.toFixed(4))}`;
  if (n >= 0.000001) return `$${trim(n.toFixed(8))}`;
  return `$${n.toExponential(2)}`;
}

export function rr(
  c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

/** The house gradient, purple through to orange. */
export function brand(
  c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number,
) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#7E089D');
  g.addColorStop(0.3, '#AE176A');
  g.addColorStop(0.58, '#D83639');
  g.addColorStop(0.8, '#E96635');
  g.addColorStop(1, '#FB9438');
  return g;
}

export interface T {
  size?: number;
  weight?: number | string;
  color?: string | CanvasGradient;
  align?: CanvasTextAlign;
  font?: string;
  spacing?: number;
}

export function text(
  c: CanvasRenderingContext2D, s: string, x: number, y: number, o: T = {},
) {
  const { size = 32, weight = 400, color = TX, align = 'left', font = SANS, spacing = 0 } = o;
  c.save();
  c.font = `${weight} ${size}px ${font}`;
  c.fillStyle = color;
  c.textAlign = spacing ? 'left' : align;
  c.textBaseline = 'alphabetic';
  if (spacing) {
    const chars = [...s];
    const total = chars.reduce((w, ch) => w + c.measureText(ch).width + spacing, -spacing);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    for (const ch of chars) {
      c.fillText(ch, cx, y);
      cx += c.measureText(ch).width + spacing;
    }
  } else {
    c.fillText(s, x, y);
  }
  c.restore();
}

/** Width a string will occupy, for laying a caption out beside a big figure. */
export function measure(
  c: CanvasRenderingContext2D, s: string, size: number, weight: number,
): number {
  c.save();
  c.font = `${weight} ${size}px ${SANS}`;
  const w = c.measureText(s).width;
  c.restore();
  return w;
}

/** Shrink a string until it fits, so a long token name can't run off the card. */
export function fitText(
  c: CanvasRenderingContext2D, s: string, maxW: number, size: number, weight: number,
): number {
  let px = size;
  while (px > 12 && measure(c, s, px, weight) > maxW) px -= 2;
  return px;
}

/** Semicircular dial. */
export function gauge(
  c: CanvasRenderingContext2D, cx: number, cy: number, r: number, frac: number, width = 26,
) {
  c.save();
  c.lineCap = 'round';
  c.lineWidth = width;
  c.strokeStyle = LINE;
  c.beginPath();
  c.arc(cx, cy, r, Math.PI, 2 * Math.PI);
  c.stroke();
  if (frac > 0.001) {
    c.strokeStyle = brand(c, cx - r, cy, cx + r, cy);
    c.beginPath();
    c.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * Math.min(1, frac));
    c.stroke();
  }
  c.restore();
}

export function needle(
  c: CanvasRenderingContext2D, cx: number, cy: number, len: number, frac: number,
) {
  const a = Math.PI * (1 - Math.max(0, Math.min(1, frac)));
  c.save();
  c.strokeStyle = TX;
  c.lineWidth = 8;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(a) * len, cy - Math.sin(a) * len);
  c.stroke();
  c.fillStyle = TX;
  c.beginPath();
  c.arc(cx, cy, 12, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** A ring, filled clockwise from twelve o'clock. */
export function ring(
  c: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, frac: number, width: number,
  stroke?: string | CanvasGradient,
) {
  c.save();
  c.lineWidth = width;
  c.strokeStyle = LINE;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.stroke();
  if (frac > 0.0005) {
    c.strokeStyle = stroke ?? brand(c, cx - r, cy - r, cx + r, cy + r);
    c.lineCap = 'round';
    c.beginPath();
    c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac));
    c.stroke();
  }
  c.restore();
}

export function areaChart(
  c: CanvasRenderingContext2D, vals: number[], x: number, y: number, w: number, h: number,
) {
  if (vals.length < 2) return;
  const max = Math.max(...vals) * 1.02 || 1;
  const pts = vals.map((v, i) => [x + (i / (vals.length - 1)) * w, y + h - (v / max) * h]);
  const fill = c.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, 'rgba(216,54,57,0.42)');
  fill.addColorStop(1, 'rgba(216,54,57,0)');
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
  c.lineTo(x + w, y + h);
  c.lineTo(x, y + h);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
  c.strokeStyle = brand(c, x, 0, x + w, 0);
  c.lineWidth = 7;
  c.lineJoin = 'round';
  c.stroke();
  const last = pts[pts.length - 1];
  c.fillStyle = '#FB9438';
  c.beginPath();
  c.arc(last[0], last[1], 11, 0, Math.PI * 2);
  c.fill();
}

/**
 * Several series on one set of axes. `areaChart` is the single brand-coloured
 * curve; this one has to keep lines apart, so each carries its own colour and
 * nothing is filled.
 */
export function lineChart(
  c: CanvasRenderingContext2D,
  series: { values: number[]; color: string; width?: number }[],
  x: number, y: number, w: number, h: number,
  fmt: (v: number) => string = money,
) {
  const all = series.flatMap((s) => s.values);
  if (all.length < 2) return;
  const hi = Math.max(...all, 1);
  const lo = Math.min(...all, hi);
  // All series usually start at the same figure, so a zero floor would flatten
  // them into the top strip. The floor lifts and both ends are printed beside it.
  const floor = lo <= 0 ? 0 : Math.max(0, lo - (hi > lo ? (hi - lo) * 0.25 : lo * 0.05));
  const top = hi * 1.04;
  const span = Math.max(top - floor, 1e-9);
  const n = Math.max(...series.map((s) => s.values.length), 2);
  c.save();
  c.strokeStyle = LINE;
  c.lineWidth = 2;
  for (const g of [0, 0.25, 0.5, 0.75, 1]) {
    c.beginPath();
    c.moveTo(x, y + h * g);
    c.lineTo(x + w, y + h * g);
    c.stroke();
  }
  c.restore();
  for (const s of series) {
    c.save();
    c.beginPath();
    s.values.forEach((v, i) => {
      const px = x + (i / Math.max(1, n - 1)) * w;
      const py = y + h - ((v - floor) / span) * h;
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    });
    c.strokeStyle = s.color;
    c.lineWidth = s.width ?? 6;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
    c.restore();
  }
  text(c, fmt(top), x + 10, y + 26, { size: 19, color: TX_DIM, font: MONO, spacing: 1 });
  text(c, fmt(floor), x + 10, y + h - 12, { size: 19, color: TX_DIM, font: MONO, spacing: 1 });
}

/** Vertical bars on a shared baseline, brand-filled. */
export function bars(
  c: CanvasRenderingContext2D, vals: number[], x: number, y: number, w: number, h: number,
) {
  if (!vals.length) return;
  const max = Math.max(...vals) || 1;
  const gap = vals.length > 60 ? 1 : Math.min(6, w / (vals.length * 4));
  const bw = (w - gap * (vals.length - 1)) / vals.length;
  vals.forEach((v, i) => {
    const bh = Math.max(2, (v / max) * h);
    const bx = x + i * (bw + gap);
    c.fillStyle = brand(c, x, 0, x + w, 0);
    rr(c, bx, y + h - bh, bw, bh, Math.min(4, bw / 2));
    c.fill();
  });
}

export function panel(
  c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  pal: Pal = PALETTES.midnight, radius = 28,
) {
  c.fillStyle = pal.panel;
  rr(c, x, y, w, h, radius);
  c.fill();
  c.strokeStyle = pal.line;
  c.lineWidth = 2;
  c.stroke();
}

/** Big centred headline + supporting line, the shape most cards share. */
export function headline(
  c: CanvasRenderingContext2D, big: string, sub: string, y: number, grad = true,
) {
  const missing = big === MISSING;
  const g = missing ? TX_DIM : grad ? brand(c, 180, y - 90, CARD_W - 180, y) : TX;
  const size = missing ? 56 : fitText(c, big, BOX_W - 40, 128, 800);
  text(c, big, CARD_W / 2, y, { size, weight: 800, color: g, align: 'center' });
  text(c, sub, CARD_W / 2, y + 56, { size: 28, weight: 500, color: TX_MID, align: 'center' });
}

export type Box = [x: number, y: number, w: number, h: number];

/** Split a box into an even grid, filled left-to-right then top-to-bottom. */
export function grid(
  x: number, y: number, w: number, h: number, cols: number, rows: number, gap = 18,
): Box[] {
  const cw = (w - gap * (cols - 1)) / cols;
  const ch = (h - gap * (rows - 1)) / rows;
  const out: Box[] = [];
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) out.push([x + i * (cw + gap), y + r * (ch + gap), cw, ch]);
  }
  return out;
}

export interface TileSpec {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  /** Force the figure's size when the default would overflow the box. */
  size?: number;
}

/** One labelled block of a collage. */
export function statTile(
  c: CanvasRenderingContext2D, [x, y, w, h]: Box, t: TileSpec, pal: Pal = PALETTES.midnight,
) {
  panel(c, x, y, w, h, pal);
  if (t.accent) {
    c.save();
    rr(c, x, y, w, h, 28);
    c.clip();
    c.fillStyle = t.accent;
    c.fillRect(x, y, 6, h);
    c.restore();
  }
  // Centre the label/value/sub block rather than pinning it to the top — tiles
  // vary a lot in height, and a fixed offset leaves the taller ones half-empty.
  // A missing figure is drawn small and dim: an em-dash at headline size reads
  // as a solid bar, which looks like a number rather than the absence of one.
  const missing = t.value === MISSING;
  const want = missing ? 34 : (t.size ?? Math.min(72, h * 0.34));
  const vs = fitText(c, t.value, w - 52, want, 800);
  const blockH = 16 + 16 + vs + (t.sub ? 12 + 19 : 0);
  const top = y + Math.max(20, (h - blockH) / 2);
  text(c, t.label.toUpperCase(), x + 26, top + 16, {
    size: 16, color: pal.txDim, font: MONO, spacing: 2,
  });
  const vy = top + 32 + vs;
  text(c, t.value, x + 26, vy, {
    size: vs, weight: 800, color: missing ? pal.txDim : (t.accent ?? pal.tx),
  });
  if (t.sub) {
    text(c, t.sub, x + 26, vy + 31, { size: fitText(c, t.sub, w - 52, 19, 400), color: pal.txMid });
  }
}

/** How the token's mark is cut. Token art is rarely square and rarely round. */
export type LogoStyle = 'round' | 'square' | 'ring' | 'plain' | 'none';

/** What to do with the wide DexScreener banner, when the token has one. */
export type HeaderStyle = 'off' | 'band' | 'full';

export interface ChromeSpec {
  logo: HTMLImageElement | null;
  /** Palette; defaults to Midnight, which every fixed card uses. */
  pal?: Pal;
  /** Defaults to `round` when `roundLogo` is set, else `plain`. */
  logoStyle?: LogoStyle;
  /** The token's DexScreener banner, already loaded (and same-origin). */
  header?: HTMLImageElement | null;
  headerStyle?: HeaderStyle;
  /** Big left-hand wordmark — the product, or the token's symbol. */
  title: string;
  /** The line under it: the ticker, or the chain. */
  subtitle?: string | null;
  /** Right-hand label naming the card. */
  kicker?: string;
  footerLeft: string;
  footerRight?: string;
  /** Draw the logo inside a circular mask — token art isn't square. */
  roundLogo?: boolean;
}

/**
 * Draw an image to cover a box, cropping the overflow rather than squashing it
 * — the banners are 3:1 and the slots they go in are not.
 */
function cover(
  c: CanvasRenderingContext2D, img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  c.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Background, bloom, header and footer: the frame every card shares. */
export function chrome(c: CanvasRenderingContext2D, o: ChromeSpec) {
  const pal = o.pal ?? PALETTES.midnight;
  const light = pal === PALETTES.paper;
  c.fillStyle = pal.ink;
  c.fillRect(0, 0, CARD_W, CARD_H);
  if (!light) {
    const bloom = c.createRadialGradient(CARD_W * 0.92, -60, 0, CARD_W * 0.92, -60, 720);
    bloom.addColorStop(0, 'rgba(174,23,106,0.42)');
    bloom.addColorStop(0.55, 'rgba(126,8,157,0.14)');
    bloom.addColorStop(1, 'rgba(6,24,46,0)');
    c.fillStyle = bloom;
    c.fillRect(0, 0, CARD_W, CARD_H);
  }

  // The banner goes down before anything else, under a scrim heavy enough that
  // white type stays readable over whatever art the token happens to have.
  const hs = o.headerStyle ?? 'off';
  if (o.header && hs !== 'off') {
    const h = hs === 'full' ? CARD_H : 300;
    c.save();
    cover(c, o.header, 0, 0, CARD_W, h);
    const scrim = c.createLinearGradient(0, 0, 0, h);
    if (hs === 'full') {
      // Dark enough for type to sit on, light enough that the art is still art.
      scrim.addColorStop(0, light ? 'rgba(245,243,238,0.70)' : 'rgba(6,24,46,0.62)');
      scrim.addColorStop(1, light ? 'rgba(245,243,238,0.92)' : 'rgba(6,24,46,0.90)');
    } else {
      scrim.addColorStop(0, light ? 'rgba(245,243,238,0.45)' : 'rgba(6,24,46,0.45)');
      scrim.addColorStop(0.6, light ? 'rgba(245,243,238,0.72)' : 'rgba(6,24,46,0.72)');
      scrim.addColorStop(1, pal.ink);
    }
    c.fillStyle = scrim;
    c.fillRect(0, 0, CARD_W, h);
    c.restore();
  }

  const style: LogoStyle = o.logoStyle ?? (o.roundLogo ? 'round' : 'plain');
  if (o.logo && style !== 'none') {
    c.save();
    if (style === 'round' || style === 'ring') {
      c.beginPath();
      c.arc(94, 86, 30, 0, Math.PI * 2);
      c.clip();
    } else if (style === 'square') {
      rr(c, 64, 56, 60, 60, 14);
      c.clip();
    }
    c.drawImage(o.logo, 64, 56, 60, 60);
    c.restore();
    if (style === 'ring') {
      c.save();
      c.lineWidth = 4;
      c.strokeStyle = brand(c, 64, 56, 124, 116);
      c.beginPath();
      c.arc(94, 86, 32, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }
  const titleX = o.logo && style !== 'none' ? 140 : 64;
  text(c, o.title.toUpperCase(), titleX, 88, {
    size: fitText(c, o.title.toUpperCase(), 560, 27, 800), weight: 800, spacing: 5, color: pal.tx,
  });
  if (o.subtitle) {
    text(c, o.subtitle, titleX, 118, {
      size: 20, weight: 500, color: pal.txDim, font: MONO, spacing: 3,
    });
  }
  if (o.kicker) {
    text(c, o.kicker.toUpperCase(), CARD_W - 64, 96, {
      size: 19, weight: 500, color: pal.txDim, align: 'right', font: MONO, spacing: 3,
    });
  }

  c.fillStyle = pal.line;
  c.fillRect(64, 150, CARD_W - 128, 2);

  c.fillStyle = pal.line;
  c.fillRect(64, CARD_H - 116, CARD_W - 128, 2);
  text(c, o.footerLeft, 64, CARD_H - 62, { size: 24, weight: 700, color: pal.txMid });
  if (o.footerRight) {
    text(c, o.footerRight.toUpperCase(), CARD_W - 64, CARD_H - 62, {
      size: 18, weight: 500, color: pal.txDim, align: 'right', font: MONO, spacing: 2,
    });
  }
}

/** What a card can't draw, said plainly rather than drawn as a zero. */
export function nothingToDraw(c: CanvasRenderingContext2D, why: string) {
  text(c, why, CARD_W / 2, CARD_H / 2 - 10, {
    size: 34, weight: 700, color: TX_MID, align: 'center',
  });
  text(c, 'Nothing is invented to fill the gap.', CARD_W / 2, CARD_H / 2 + 34, {
    size: 24, color: TX_DIM, align: 'center',
  });
}
