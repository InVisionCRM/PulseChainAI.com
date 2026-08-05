'use client';

// Market bubble view for the screener — the token universe as a live "crypto
// bubbles" field. Each bubble is a token; colour is its 24h performance (green
// up / red down, brighter = bigger move), size is the selected metric. Bubbles
// softly drift, bounce off each other (elastic, mass ∝ area) and off the walls,
// and never settle — switching the metric smoothly tweens every bubble's size
// and re-packs the field. Token logos are drawn inside each bubble. Click a
// bubble to open it in the geicko analyzer.
//
// Custom physics (not d3-force) because we want perpetual floaty motion, not an
// equilibrium layout. Data comes from /api/screener, paged up to the chosen
// count, respecting the screener's current tab / dex / filters.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconRefresh, IconMaximize, IconMinimize, IconShare2, IconX } from '@tabler/icons-react';
import type { ScreenerRow, ScreenerUiTab, ScreenerFilters } from '@/lib/screener/types';
import { fetchPinnedRows } from '@/lib/screener/pinned';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import { fmtUsd } from '@/lib/format';

// Counts above 100 look cramped on a phone, so mobile gets a lighter set.
const COUNT_OPTIONS_DESKTOP = [100, 250, 500] as const;
const COUNT_OPTIONS_MOBILE = [25, 50, 100] as const;
const DEFAULT_COUNT = 100;
const DEFAULT_COUNT_MOBILE = 25;
const PAGE_SIZE = 50;
const CANVAS_H = 580;

const METRICS = [
  { id: 'chg24', label: '24h %' },
  { id: 'vol', label: 'Vol' },
  { id: 'mcap', label: 'MC' },
  { id: 'liq', label: 'Liq' },
] as const;
type Metric = (typeof METRICS)[number]['id'];

// "Main" quote tokens — a token's liquidity is measured ONLY against pairs
// quoted in these, so junk/wash pairs (TOKEN/scamcoin) don't inflate it.
// Covers PulseChain majors + bridged majors incl. Ethereum HEX (eHEX).
const MAIN_QUOTES = new Set(['WPLS', 'PLSX', 'HEX', 'EHEX', 'INC', 'WETH', 'DAI', 'USDC', 'USDT']);
function isMainQuote(sym: string | null): boolean {
  return !!sym && MAIN_QUOTES.has(sym.trim().toUpperCase());
}

// Colour endpoints — dim (small move) → bright (big move), per direction.
const GREEN_DIM = [16, 94, 70] as const;
const GREEN_BRIGHT = [34, 230, 156] as const;
const RED_DIM = [128, 36, 44] as const;
const RED_BRIGHT = [245, 70, 92] as const;
const NEUTRAL = [100, 116, 139] as const;
const CHG_CAP = 25;

// Sizing: a steep power keeps the top movers dramatically huge. Min/max are
// derived from the ACTUAL canvas area + token count at render time (see
// computeTargets), and the total bubble area is capped so the field never crams
// — and grows to fill the extra room in fullscreen.
const SIZE_EXP = 0.9;
const FILL = 0.6; // max fraction of the canvas the bubbles may cover

// Physics.
const RESTITUTION = 0.86; // bounciness on collisions / walls
const DAMP = 0.992; // very light friction so motion persists
const WANDER = 0.03; // tiny random accel — keeps the field alive
const MAX_V = 1.5;
const MIN_V = 0.16;

type RGB = [number, number, number];

function sizeVal(row: ScreenerRow, m: Metric): number {
  switch (m) {
    case 'chg24': return Math.abs(row.chg.h24 ?? 0);
    case 'vol': return row.vol.h24 ?? 0;
    case 'mcap': return row.marketCap ?? 0;
    case 'liq': return row.liquidityUsd ?? 0;
  }
}
// Colour is always 24h performance for the remaining metrics.
function colorChg(row: ScreenerRow, m: Metric): number | null {
  switch (m) {
    case 'chg24': case 'vol': case 'mcap': case 'liq': return row.chg.h24;
  }
}
function fmtSignedPct(v: number | null): string {
  if (v == null) return '—';
  const d = Math.abs(v) >= 10 ? 0 : 1;
  return `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
}
function valLabel(row: ScreenerRow, m: Metric): string {
  switch (m) {
    case 'chg24': return fmtSignedPct(row.chg.h24);
    case 'vol': return fmtUsd(row.vol.h24);
    case 'mcap': return fmtUsd(row.marketCap);
    case 'liq': return fmtUsd(row.liquidityUsd);
  }
}
function colFor(chg: number | null): RGB {
  if (chg == null) return [...NEUTRAL] as RGB;
  const up = chg >= 0;
  const mag = Math.min(Math.abs(chg), CHG_CAP) / CHG_CAP;
  const a = up ? GREEN_DIM : RED_DIM;
  const b = up ? GREEN_BRIGHT : RED_BRIGHT;
  return [
    Math.round(a[0] + (b[0] - a[0]) * mag),
    Math.round(a[1] + (b[1] - a[1]) * mag),
    Math.round(a[2] + (b[2] - a[2]) * mag),
  ];
}
const rgbStr = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

function colorMag(row: ScreenerRow, m: Metric): number {
  const chg = colorChg(row, m);
  if (chg == null) return 0;
  return Math.min(Math.abs(chg), CHG_CAP) / CHG_CAP;
}

// Pre-rendered "Apple glass" overlay — specular highlight, a top-light → bottom
// shade, and a bright rim sheen — drawn once and stamped over each bubble's
// logo. Caching it (vs. building gradients per bubble per frame) is what keeps
// 100+ animated bubbles smooth.
let _glassSprite: HTMLCanvasElement | null = null;
function getGlassSprite(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (_glassSprite) return _glassSprite;
  const S = 320, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  if (!g) return null;
  const cx = S / 2, cy = S / 2, r = S / 2, TAU = Math.PI * 2;
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
  const lin = g.createLinearGradient(0, 0, 0, S);
  lin.addColorStop(0, 'rgba(255,255,255,0.26)');
  lin.addColorStop(0.45, 'rgba(255,255,255,0.02)');
  lin.addColorStop(1, 'rgba(0,0,0,0.24)');
  g.fillStyle = lin; g.fillRect(0, 0, S, S);
  const hl = g.createRadialGradient(cx - r * 0.38, cy - r * 0.44, r * 0.03, cx - r * 0.38, cy - r * 0.44, r * 0.95);
  hl.addColorStop(0, 'rgba(255,255,255,0.82)');
  hl.addColorStop(0.32, 'rgba(255,255,255,0.14)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl; g.fillRect(0, 0, S, S);
  const spark = g.createRadialGradient(cx + r * 0.32, cy + r * 0.36, 0, cx + r * 0.32, cy + r * 0.36, r * 0.45);
  spark.addColorStop(0, 'rgba(255,255,255,0.16)');
  spark.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = spark; g.fillRect(0, 0, S, S);
  // Inset shadow — transparent centre darkening to the rim (biased to the
  // bottom) so the bubble reads as a 3D recessed/domed glass button.
  const inset = g.createRadialGradient(cx, cy - r * 0.12, r * 0.5, cx, cy + r * 0.06, r);
  inset.addColorStop(0, 'rgba(0,0,0,0)');
  inset.addColorStop(0.74, 'rgba(0,0,0,0)');
  inset.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = inset; g.fillRect(0, 0, S, S);
  g.restore();
  g.lineCap = 'round';
  g.lineWidth = S * 0.024;
  g.strokeStyle = 'rgba(255,255,255,0.62)';
  g.beginPath(); g.arc(cx, cy, r - g.lineWidth, Math.PI * 1.02, Math.PI * 1.82); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.20)';
  g.beginPath(); g.arc(cx, cy, r - g.lineWidth, Math.PI * 0.08, Math.PI * 0.7); g.stroke();
  _glassSprite = c;
  return c;
}

// Bake a token's bubble face ONCE: circular-clipped logo (cover) + the glass
// highlight overlay. Drawn per frame as a single scaled image, so no expensive
// clipping happens in the animation loop.
//
// There used to be a "refraction band" here — the logo redrawn at 1.34x, clipped
// to the ring between 0.78r and r, meant to read as glass bending the image at
// the rim. It doesn't: a magnified copy of the SAME logo lands in that ring, so
// every mark near the edge appears twice, offset. On the HEX logo the hexagon
// outline is visibly doubled. The effect scales with the bubble, so the biggest
// bubbles — the ones people actually look at — ghosted the worst. The glass
// sprite's rim sheen and inset shadow already carry the 3D read on their own.
// `size` is the baked resolution: 240 is plenty on screen, but the share image
// renders bubbles far larger than they ever appear live, so it bakes at 512.
function buildNodeSprite(img: HTMLImageElement, size = 240): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const S = size, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  if (!g) return null;
  const cx = S / 2, cy = S / 2, r = S / 2, TAU = Math.PI * 2;
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
  const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
  const sc = Math.max((r * 2) / iw, (r * 2) / ih);
  const dw = iw * sc, dh = ih * sc;
  try { g.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh); } catch { /* tainted */ }
  g.restore();
  const glass = getGlassSprite();
  if (glass) g.drawImage(glass, 0, 0, S, S);
  return c;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Generated identity for logo-less tokens: a unique 2-colour gradient (hues
// hashed from the address, so it's deterministic and distinct per token) + the
// ticker in bold, finished with the same glass + inset-shadow overlay as logo
// bubbles. Premium, Stripe/Linear-style — colour is identity here, not perf.
function buildFallbackSprite(symbol: string, address: string | null): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const S = 240, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  if (!g) return null;
  const cx = S / 2, cy = S / 2, r = S / 2, TAU = Math.PI * 2;
  const seed = hashStr((address || symbol || '?').toLowerCase());
  const h1 = seed % 360;
  const h2 = (h1 + 30 + ((seed >> 9) % 60)) % 360;
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
  const grad = g.createLinearGradient(S * 0.15, 0, S * 0.85, S);
  grad.addColorStop(0, `hsl(${h1},66%,56%)`);
  grad.addColorStop(1, `hsl(${h2},60%,40%)`);
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  const txt = symbol.slice(0, 8);
  let fontPx = 120;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${fontPx}px ui-sans-serif,system-ui,sans-serif`;
  const maxW = S * 0.82, w = g.measureText(txt).width;
  if (w > maxW) {
    fontPx = Math.max(26, Math.floor((fontPx * maxW) / w));
    g.font = `700 ${fontPx}px ui-sans-serif,system-ui,sans-serif`;
  }
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillText(txt, cx, cy + S * 0.016);
  g.fillStyle = 'rgba(255,255,255,0.97)';
  g.fillText(txt, cx, cy);
  g.restore();
  const glass = getGlassSprite();
  if (glass) g.drawImage(glass, 0, 0, S, S);
  return c;
}

const TAU = 6.2831853;

/**
 * Paint one bubble at an arbitrary position/size onto an arbitrary context.
 *
 * Shared by the live animation loop and the share-image renderer so the two can
 * never drift — the exported PNG is the same bubble the user was looking at,
 * just bigger. Position and radius are passed in rather than read off the node
 * because the share render draws the same field at a different scale.
 */
function paintBubble(
  ctx: CanvasRenderingContext2D,
  n: MNode,
  x: number,
  y: number,
  r: number,
  sprite: HTMLCanvasElement | null,
  metric: Metric,
  glass: HTMLCanvasElement | null,
  /** True when one of the viewer's portfolio wallets holds this token. */
  held = false,
) {
  const chg = n.row.chg.h24;
  // Performance ring colour — green up / red down (grey when unknown).
  const ring: RGB = chg == null ? [120, 140, 160] : chg >= 0 ? [34, 230, 156] : [245, 70, 92];

  // Dust fast-path: tiny bubbles render as a single coloured dot.
  if (r < 7) {
    ctx.fillStyle = rgbStr(ring, 0.95);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    return;
  }

  // Body: the pre-baked circular logo + glass sprite — one draw, no clipping.
  // Fallback to a tinted disc + symbol until the sprite is ready / for no logo.
  if (sprite) {
    ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  } else {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.34, r * 0.1, x, y, r);
    g.addColorStop(0, rgbStr([n.col[0] + 55, n.col[1] + 55, n.col[2] + 55] as RGB, 0.95));
    g.addColorStop(1, rgbStr(n.col, 0.92));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (r >= 13) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `700 ${Math.min(15, Math.max(9, r * 0.4))}px ui-sans-serif,system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.symbol.slice(0, 6), x, y);
    }
    // Give fallback discs the same glass + inset-shadow treatment as logos.
    if (glass) ctx.drawImage(glass, x - r, y - r, r * 2, r * 2);
  }

  // Performance ring — green up / red down, hugging the bubble edge.
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.strokeStyle = rgbStr(ring, 0.95);
  ctx.beginPath(); ctx.arc(x, y, r - ctx.lineWidth / 2, 0, TAU); ctx.stroke();

  // Ownership ring — a gold halo OUTSIDE the performance ring, so "you hold
  // this" reads at a glance without hiding whether it's up or down today.
  if (held) {
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.strokeStyle = 'rgba(245,158,11,0.92)';
    ctx.beginPath(); ctx.arc(x, y, r + ctx.lineWidth / 2 + 1.5, 0, TAU); ctx.stroke();
  }

  // Value chip near the bottom for big bubbles, so the logo stays clear.
  // Font scales with bubble size (capped) so large bubbles read clearly.
  if (r >= 30) {
    const txt = valLabel(n.row, metric);
    const fs = Math.max(11, Math.min(30, r * 0.26));
    ctx.font = `800 ${fs}px ui-sans-serif,system-ui,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(txt).width, ch = fs + 7, yy = y + r * 0.5;
    ctx.fillStyle = 'rgba(6,14,26,0.72)';
    ctx.fillRect(x - tw / 2 - 6, yy - ch / 2, tw + 12, ch);
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fillText(txt, x, yy);
  }
}

/** Held = the viewer's wallet holds it. PulseChain rows only — the holdings
 *  set is built from PulseChain wallet enumeration, so ringing a same-address
 *  token on another chain would be a lie. (PulseChain rows omit chainId.) */
function isHeld(n: MNode, held: ReadonlySet<string>): boolean {
  return !!n.address && (!n.row.chainId || n.row.chainId === 'pulsechain') && held.has(n.address.toLowerCase());
}

/** Field backdrop — same two layers the live canvas paints. */
function paintBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = '#0a1525';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.1, W / 2, H / 2, Math.max(W, H) * 0.7);
  g.addColorStop(0, 'rgba(120,160,210,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------------
// Share image
// ---------------------------------------------------------------------------

/** Output width of the shared PNG; height follows the field's aspect ratio. */
const SHARE_W = 1600;
/** Brand strip under the field. Scaled with SHARE_W. */
const SHARE_FOOTER_H = 104;
const BRAND = 'scan.Morbius.io';
/** Whole-batch deadline for fetching logos into the share render. */
const SHARE_LOGO_BUDGET_MS = 6000;

/**
 * Load a logo through our own origin so the share canvas stays exportable.
 *
 * The CDNs the screener points at send no `Access-Control-Allow-Origin`, so an
 * image loaded straight from them taints the canvas and `toBlob()` throws. The
 * live field doesn't care (it never exports), but the share render does — hence
 * the round trip through /api/token-logo, which adds the CORS header.
 *
 * Resolves null rather than rejecting: one missing logo should cost that bubble
 * its artwork, not sink the whole image.
 */
function loadShareLogo(url: string, timeoutMs = 8000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const done = (v: HTMLImageElement | null) => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(v);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = `/api/token-logo?url=${encodeURIComponent(url)}`;
  });
}

/**
 * Render the CURRENT bubble field to an offscreen canvas, watermarked.
 *
 * Positions are taken live from the nodes and scaled up, so the picture is the
 * arrangement on screen at the moment the button was pressed.
 */
async function renderShareImage(
  nodes: MNode[],
  W: number,
  H: number,
  metric: Metric,
  subtitle: string,
  held: ReadonlySet<string>,
): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined' || W <= 0 || H <= 0) return null;

  const scale = SHARE_W / W;
  const fieldH = Math.round(H * scale);
  const cvs = document.createElement('canvas');
  cvs.width = SHARE_W;
  cvs.height = fieldH + SHARE_FOOTER_H;
  const ctx = cvs.getContext('2d');
  if (!ctx) return null;

  // Freeze the layout NOW. Fetching logos takes a moment and the field never
  // stops drifting, so painting from live coordinates would export a slightly
  // different arrangement than the one on screen when the button was pressed.
  const frozen = nodes.map((n) => ({ n, x: n.x * scale, y: n.y * scale, r: n.r * scale }));

  // Re-bake every visible logo from the proxy. A node whose logo failed on the
  // live canvas already holds a GENERATED fallback sprite, which is untainted
  // and can be reused as-is.
  const sprites = new Map<MNode, HTMLCanvasElement | null>();
  const loads = Promise.all(
    frozen.map(async ({ n, r }) => {
      if (r < 7) return; // renders as a dot; no sprite needed
      if (!n.imgOk || !n.row.imageUrl) {
        sprites.set(n, n.sprite ?? buildFallbackSprite(n.symbol, n.address));
        return;
      }
      const img = await loadShareLogo(n.row.imageUrl);
      sprites.set(
        n,
        img ? buildNodeSprite(img, 512) : buildFallbackSprite(n.symbol, n.address),
      );
    }),
  );

  // A hundred bubbles means a hundred proxied logo fetches. Waiting for the
  // slowest is how the button ends up appearing to do nothing, so the whole
  // batch gets one deadline and stragglers fall back to their generated
  // identity — a card that's a little plainer beats a card that never arrives.
  await Promise.race([loads, new Promise((r) => setTimeout(r, SHARE_LOGO_BUDGET_MS))]);

  paintBackdrop(ctx, SHARE_W, fieldH);
  const glass = getGlassSprite();
  for (const { n, x, y, r } of frozen) {
    let sprite = sprites.get(n);
    if (sprite === undefined && r >= 7) sprite = buildFallbackSprite(n.symbol, n.address);
    paintBubble(ctx, n, x, y, r, sprite ?? null, metric, glass, isHeld(n, held));
  }

  // Brand strip.
  const fy = fieldH;
  ctx.fillStyle = '#060f1c';
  ctx.fillRect(0, fy, SHARE_W, SHARE_FOOTER_H);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, fy, SHARE_W, 1);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = '800 42px ui-sans-serif,system-ui,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.fillText(BRAND, 44, fy + SHARE_FOOTER_H / 2);

  ctx.textAlign = 'right';
  ctx.font = '600 26px ui-sans-serif,system-ui,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(subtitle, SHARE_W - 44, fy + SHARE_FOOTER_H / 2);

  return cvs;
}

interface MNode {
  address: string | null;
  symbol: string;
  row: ScreenerRow;
  r: number; tr: number;
  col: RGB; tcol: RGB;
  x: number; y: number; vx: number; vy: number;
  fixed: boolean; // being dragged
  img: HTMLImageElement | null;
  imgOk: boolean;
  // Pre-rendered circular logo + baked glass treatment — drawn as ONE image per
  // frame (no per-frame clipping), which is what keeps 500 bubbles at 60fps.
  sprite: HTMLCanvasElement | null;
}

/**
 * Preview of the rendered card, with the hand-off actions as their own buttons.
 *
 * Each action runs from its own click, which is what makes `navigator.share()`
 * work: Web Share requires transient user activation, and the render that
 * precedes this dialog is far too slow to keep the original click's activation
 * alive.
 */
function SharePreview({
  url, blob, onClose,
}: {
  url: string;
  blob: Blob;
  onClose: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const file = new File([blob], 'morbius-bubbles.png', { type: 'image/png' });
  type ShareData_ = { files?: File[]; title?: string; text?: string };
  const nav = typeof navigator === 'undefined'
    ? null
    : (navigator as Navigator & { canShare?: (d: ShareData_) => boolean });
  const canShareFiles = !!nav?.canShare?.({ files: [file] });

  const download = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'morbius-bubbles.png';
    a.click();
    setNote('Saved');
  };

  const doShare = async () => {
    try {
      await navigator.share({ files: [file], title: BRAND, text: BRAND } as ShareData_);
    } catch (e) {
      // Dismissing the sheet rejects with AbortError — that's not a failure.
      // Anything else is, and used to vanish silently.
      if ((e as Error)?.name !== 'AbortError') setNote("Sharing didn't work — saving instead");
      if ((e as Error)?.name !== 'AbortError') download();
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setNote('Copied');
    } catch {
      // Image writes are blocked in some browsers; a download always works.
      download();
    }
  };

  const btn =
    'rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold transition-colors ' +
    'text-[var(--text)] hover:bg-[var(--surface-2)]';

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Share the bubble map"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5">
          <h2 className="text-sm font-bold text-[var(--text)]">Share this view</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--text-faint)] hover:text-[var(--text)]">
            <IconX className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto bg-[var(--surface)] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Bubble map preview" className="mx-auto block w-full rounded-lg" />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-4 py-3">
          {canShareFiles && (
            <button type="button" onClick={() => void doShare()} className={btn}>Share…</button>
          )}
          <button type="button" onClick={download} className={btn}>Save image</button>
          <button type="button" onClick={() => void copy()} className={btn}>Copy</button>
          <span className="ml-auto text-[11px] text-[var(--text-faint)]">{note ?? BRAND}</span>
        </div>
      </div>
    </div>
  );
}

interface Props {
  tab: ScreenerUiTab;
  dexId: string | null;
  filters: ScreenerFilters;
  watchlistParam: string;
}

export default function MarketBubbles({ tab, dexId, filters, watchlistParam }: Props) {
  const router = useRouter();
  const wallets = usePortfolioStore((st) => st.wallets);
  const mobileInit = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
  const [isMobile, setIsMobile] = useState(mobileInit);
  const [count, setCount] = useState<number>(mobileInit ? DEFAULT_COUNT_MOBILE : DEFAULT_COUNT);
  const [metric, setMetric] = useState<Metric>('chg24');
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [simKey, setSimKey] = useState(0);
  const [fs, setFs] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'rendering' | 'error'>('idle');
  /** The rendered PNG awaiting the user's choice (share / save / copy). */
  const [share_, setShare] = useState<{ blob: Blob; url: string } | null>(null);

  // Tokens any of the user's wallets hold, for the gold ownership ring. A ref
  // (not state) because the rAF loop repaints every frame anyway — the ring
  // shows up on the next frame after the fetch lands, no re-render needed.
  const heldRef = useRef<Set<string>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Mirrors `share_` so unmount cleanup can revoke without re-running. */
  const shareRef = useRef<{ blob: Blob; url: string } | null>(null);
  shareRef.current = share_;
  const tipRef = useRef<HTMLDivElement | null>(null);
  const dataRef = useRef<{ nodes: MNode[] } | null>(null);
  const metricRef = useRef<Metric>(metric);
  const retargetRef = useRef<(() => void) | null>(null);

  const fetchRows = useCallback(async (): Promise<ScreenerRow[]> => {
    // The screener is PAIR-based: one token has many pairs (WPLS/DAI, WPLS/USDC,
    // the same pair across DEXes, plus junk pairs). We want ONE bubble per token
    // with its liquidity measured ONLY against the main quote tokens (summed
    // across those pairs). So we group every fetched pair by base token, sum
    // main-pair liquidity, and represent the token by its deepest main pair
    // (falling back to its biggest pair if it has none). Over-fetch pages until
    // we have `count` distinct tokens.
    interface Agg { rep: ScreenerRow; repLiq: number; repMain: boolean; mainLiq: number }
    const byToken = new Map<string, Agg>();
    const keyOf = (r: ScreenerRow) =>
      r.baseAddress ? `${r.chainId ?? 'p'}:${r.baseAddress.toLowerCase()}` : `pair:${r.pairAddress}`;
    const addPair = (r: ScreenerRow) => {
      if (!r.baseSymbol) return;
      const k = keyOf(r);
      const main = isMainQuote(r.quoteSymbol);
      const liq = r.liquidityUsd ?? 0;
      const e = byToken.get(k);
      if (!e) { byToken.set(k, { rep: r, repLiq: liq, repMain: main, mainLiq: main ? liq : 0 }); return; }
      if (main) e.mainLiq += liq;
      // Prefer a main pair as the representative; among equals, the deepest one.
      if ((main && !e.repMain) || (main === e.repMain && liq > e.repLiq)) {
        e.rep = r; e.repLiq = liq; e.repMain = main;
      }
    };
    // Override each token's liquidity with its summed main-pair liquidity.
    const finalize = (): ScreenerRow[] =>
      [...byToken.values()].slice(0, count).map((e) => ({ ...e.rep, liquidityUsd: e.mainLiq }));

    // Pinned tokens (e.g. Morbius) go in first so they always get a bubble and
    // survive the `count` slice, on every tab.
    const pinned = await fetchPinnedRows();
    pinned.forEach(addPair);

    if (tab === 'watchlist') {
      if (!watchlistParam) return [];
      const res = await fetch(`/api/watchlist?tokens=${encodeURIComponent(watchlistParam)}`);
      if (!res.ok) throw new Error(`watchlist ${res.status}`);
      const json: { rows: ScreenerRow[] } = await res.json();
      json.rows.forEach(addPair);
      return finalize();
    }

    const MAX_PAGES = 24; // safety cap (~1200 pairs scanned)
    for (let p = 0; p < MAX_PAGES && byToken.size < count; p++) {
      const qs = new URLSearchParams({ tab, window: 'h24', page: String(p) });
      if (dexId) qs.set('dex', dexId);
      if (filters.minLiq !== null) qs.set('minLiq', String(filters.minLiq));
      if (filters.minVol24 !== null) qs.set('minVol', String(filters.minVol24));
      if (filters.minAgeH !== null) qs.set('minAgeH', String(filters.minAgeH));
      if (filters.maxAgeH !== null) qs.set('maxAgeH', String(filters.maxAgeH));
      try {
        const res = await fetch(`/api/screener?${qs}`);
        if (!res.ok) throw new Error(`screener ${res.status}`);
        const json = await res.json();
        const rows: ScreenerRow[] = json.rows ?? [];
        rows.forEach(addPair);
        if (rows.length < PAGE_SIZE) break;
      } catch (err) {
        // If the screener feed fails we still want the pinned tokens to show, so
        // only surface the error when there's genuinely nothing to render.
        if (byToken.size === 0) throw err;
        break;
      }
    }
    return finalize();
  }, [tab, dexId, filters, watchlistParam, count]);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const rows = await fetchRows();
      const usable = rows.filter((r) => r.baseSymbol);
      if (usable.length === 0) { dataRef.current = null; setStatus('empty'); return; }

      const m = metricRef.current;
      // Radii (tr) are computed in the canvas effect (computeTargets) once the
      // real canvas size is known, so sizing fits whatever space is available.
      const nodes: MNode[] = usable.map((r) => {
        const tcol = colFor(colorChg(r, m));
        let img: HTMLImageElement | null = null;
        const node: MNode = {
          address: r.baseAddress,
          symbol: r.baseSymbol ?? '?',
          row: r,
          r: 0, tr: 0,
          col: [...tcol] as RGB, tcol,
          x: 0, y: 0, vx: 0, vy: 0, fixed: false,
          img: null, imgOk: false, sprite: null,
        };
        if (r.imageUrl) {
          img = new Image();
          // No crossOrigin — many logo hosts lack CORS headers; drawImage still
          // renders fine (canvas just becomes read-tainted, which we don't need).
          img.onload = () => { node.imgOk = true; node.sprite = buildNodeSprite(img!); };
          // Failed logo → fall back to the generated seeded-gradient identity.
          img.onerror = () => { node.imgOk = false; node.sprite = buildFallbackSprite(node.symbol, node.address); };
          img.src = r.imageUrl;
          node.img = img;
        } else {
          // No logo at all → generated identity straight away.
          node.sprite = buildFallbackSprite(node.symbol, node.address);
        }
        return node;
      });
      dataRef.current = { nodes };
      setStatus('ready');
      setSimKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load market bubbles');
      setStatus('error');
    }
  }, [fetchRows]);

  useEffect(() => { void load(); }, [load]);

  // Build the held-token set: ONE /api/portfolio/balances call per wallet
  // (Blockscout enumerates everything the wallet holds), not a per-token fan
  // out — this is what makes ringing 500 bubbles affordable. PulseChain only.
  useEffect(() => {
    if (wallets.length === 0) { heldRef.current = new Set(); return; }
    let alive = true;
    Promise.all(
      wallets.map(async (w) => {
        try {
          const r = await fetch('/api/portfolio/balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: w.address, chain: 'pulsechain' }),
          });
          const d = r.ok ? await r.json() : null;
          return (d?.tokens ?? []).map((t: { address: string }) => String(t.address).toLowerCase());
        } catch { return []; }
      }),
    ).then((lists) => {
      if (!alive) return;
      heldRef.current = new Set<string>(lists.flat());
    });
    return () => { alive = false; };
  }, [wallets]);

  useEffect(() => {
    metricRef.current = metric;
    retargetRef.current?.();
  }, [metric]);

  /**
   * Render the field, then SHOW it. The button used to render and immediately
   * hand off, which produced nothing visible either way:
   *
   *  • Where the browser can't share files (most desktop browsers) it triggered
   *    a silent programmatic download — no window, no confirmation.
   *  • Where it can, `navigator.share()` was called only AFTER awaiting every
   *    logo fetch. Web Share needs transient user activation, which expires a
   *    few seconds after the click, so a slow render made share() reject with
   *    NotAllowedError — and that rejection was swallowed by a bare `.catch()`.
   *
   * Showing a preview fixes both: the user always sees something, and Share now
   * fires from its own fresh click inside the dialog, with activation intact.
   */
  const share = useCallback(async () => {
    const cvs = canvasRef.current;
    const nodes = dataRef.current?.nodes;
    if (!cvs || !nodes?.length) return;
    setShareState('rendering');
    try {
      const box = cvs.getBoundingClientRect();
      const metricLabel = METRICS.find((m) => m.id === metricRef.current)?.label ?? '';
      const out = await renderShareImage(
        nodes,
        box.width,
        box.height,
        metricRef.current,
        `${nodes.length} tokens · sized by ${metricLabel}`,
        heldRef.current,
      );
      if (!out) throw new Error('render failed');

      const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/png'));
      if (!blob) throw new Error('encode failed');

      setShare({ blob, url: URL.createObjectURL(blob) });
      setShareState('idle');
    } catch {
      setShareState('error');
      setTimeout(() => setShareState('idle'), 2600);
    }
  }, []);

  /** Free the object URL whenever the preview closes or the view unmounts. */
  const closeShare = useCallback(() => {
    setShare((s) => {
      if (s) URL.revokeObjectURL(s.url);
      return null;
    });
  }, []);
  useEffect(() => () => { if (shareRef.current) URL.revokeObjectURL(shareRef.current.url); }, []);

  // Track phone vs desktop; clamp count to the mobile set (≤100) on a phone.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  useEffect(() => {
    if (isMobile && count > 100) setCount(100);
  }, [isMobile, count]);

  // Exit fullscreen on Escape.
  useEffect(() => {
    if (!fs) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFs(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fs]);

  // After the fullscreen layout settles, re-measure the canvas (triggers the
  // running sim's resize handler → re-fit bubble sizes to the new area).
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    return () => clearTimeout(t);
  }, [fs]);

  // Canvas + custom physics loop. Rebuilt only when a fresh dataset arrives.
  useEffect(() => {
    if (status !== 'ready' || !dataRef.current) return;
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext('2d')!;
    const tip = tipRef.current!;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const nodes = dataRef.current.nodes;
    let W = 0, H = 0, raf = 0;
    let hover: MNode | null = null;
    let drag: MNode | null = null;
    let downXY: { x: number; y: number } | null = null;
    let moved = false;
    let lastDrag: { x: number; y: number } | null = null;

    function measure() {
      const r = cvs.getBoundingClientRect();
      W = r.width; H = Math.max(1, r.height);
      cvs.width = W * DPR; cvs.height = H * DPR;
    }
    // Target radius per bubble from the CURRENT canvas area + token count, then
    // cap total coverage so the field never crams — and grows to fill the extra
    // room in fullscreen. Re-run on metric change and on resize.
    function computeTargets() {
      const m = metricRef.current;
      const area = W * H;
      const unit = Math.sqrt(area / Math.max(1, nodes.length));
      const min = Math.max(4, unit * 0.34);
      const max = Math.min(Math.min(W, H) * 0.44, Math.max(min * 3, unit * 3.4));
      const maxV = Math.max(1e-9, ...nodes.map((n) => sizeVal(n.row, m)));
      let total = 0;
      for (const n of nodes) {
        n.tr = min + Math.pow(sizeVal(n.row, m) / maxV, SIZE_EXP) * (max - min);
        n.tcol = colFor(colorChg(n.row, m));
        total += Math.PI * n.tr * n.tr;
      }
      if (total > FILL * area) {
        const s = Math.sqrt((FILL * area) / total);
        for (const n of nodes) n.tr *= s;
      }
    }
    retargetRef.current = computeTargets;

    function separate(passes: number) {
      for (let p = 0; p < passes; p++) {
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let d = Math.hypot(dx, dy);
            const minD = a.r + b.r;
            if (d < minD) {
              if (d < 0.01) { d = 0.01; dx = Math.random() - 0.5; dy = Math.random() - 0.5; }
              const ov = (minD - d) / 2, nx = dx / d, ny = dy / d;
              a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
            }
          }
        }
      }
    }

    measure();
    computeTargets();
    nodes.forEach((n) => { n.r = n.tr * 0.25; }); // grow-in
    // Scatter across the whole field (not the centre) so they start spread out.
    nodes.forEach((n) => {
      n.x = n.tr + Math.random() * Math.max(1, W - 2 * n.tr);
      n.y = n.tr + Math.random() * Math.max(1, H - 2 * n.tr);
      const a = Math.random() * Math.PI * 2, s = 0.3 + Math.random() * 0.6;
      n.vx = Math.cos(a) * s; n.vy = Math.sin(a) * s;
    });
    separate(40); // resolve initial overlaps before motion starts

    function physics() {
      // Drift + light friction + speed floor/ceiling so it floats forever.
      for (const n of nodes) {
        if (n.fixed) continue;
        n.vx += (Math.random() - 0.5) * WANDER;
        n.vy += (Math.random() - 0.5) * WANDER;
        n.vx *= DAMP; n.vy *= DAMP;
        let sp = Math.hypot(n.vx, n.vy);
        if (sp > MAX_V) { n.vx = (n.vx / sp) * MAX_V; n.vy = (n.vy / sp) * MAX_V; sp = MAX_V; }
        if (sp < MIN_V) {
          if (sp < 1e-4) { const a = Math.random() * 6.2832; n.vx = Math.cos(a) * MIN_V; n.vy = Math.sin(a) * MIN_V; }
          else { n.vx = (n.vx / sp) * MIN_V; n.vy = (n.vy / sp) * MIN_V; }
        }
        n.x += n.vx; n.y += n.vy;
      }
      // Wall bounce.
      for (const n of nodes) {
        if (n.x - n.r < 0) { n.x = n.r; n.vx = Math.abs(n.vx) * RESTITUTION; }
        else if (n.x + n.r > W) { n.x = W - n.r; n.vx = -Math.abs(n.vx) * RESTITUTION; }
        if (n.y - n.r < 0) { n.y = n.r; n.vy = Math.abs(n.vy) * RESTITUTION; }
        else if (n.y + n.r > H) { n.y = H - n.r; n.vy = -Math.abs(n.vy) * RESTITUTION; }
      }
      // Elastic ball-to-ball collisions (mass ∝ area).
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          const minD = a.r + b.r;
          if (d >= minD) continue;
          if (d < 0.01) { d = 0.01; dx = Math.random() - 0.5; dy = Math.random() - 0.5; }
          const nx = dx / d, ny = dy / d, overlap = minD - d;
          const ma = a.r * a.r, mb = b.r * b.r, tot = ma + mb;
          // Positional separation, weighted by mass.
          if (!a.fixed) { a.x -= nx * overlap * (mb / tot); a.y -= ny * overlap * (mb / tot); }
          if (!b.fixed) { b.x += nx * overlap * (ma / tot); b.y += ny * overlap * (ma / tot); }
          // Velocity exchange along the normal.
          const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const imp = (-(1 + RESTITUTION) * vn) / tot;
            if (!a.fixed) { a.vx -= imp * mb * nx; a.vy -= imp * mb * ny; }
            if (!b.fixed) { b.vx += imp * ma * nx; b.vy += imp * ma * ny; }
          }
        }
      }
    }

    const glass = getGlassSprite(); // shared overlay for fallback discs (logos bake their own)

    function drawNode(n: MNode) {
      paintBubble(ctx, n, n.x, n.y, n.r, n.sprite, metricRef.current, glass, isHeld(n, heldRef.current));
      if (n === hover) {
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 2.5, 0, TAU); ctx.stroke();
      }
    }

    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      paintBackdrop(ctx, W, H);
      for (const n of nodes) drawNode(n);
    }

    function frame() {
      for (const n of nodes) {
        n.r += (n.tr - n.r) * 0.14;
        n.col = [
          n.col[0] + (n.tcol[0] - n.col[0]) * 0.14,
          n.col[1] + (n.tcol[1] - n.col[1]) * 0.14,
          n.col[2] + (n.tcol[2] - n.col[2]) * 0.14,
        ];
      }
      physics();
      draw();
      raf = requestAnimationFrame(frame);
    }

    function mpos(e: MouseEvent) { const r = cvs.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function pick(p: { x: number; y: number }) {
      // Topmost hit (iterate from end). Bias toward bigger bubbles is natural.
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (Math.hypot(n.x - p.x, n.y - p.y) <= n.r) return n;
      }
      return null;
    }
    function showTip(n: MNode) {
      const r = n.row;
      const sub = 'font-size:11px;color:rgba(255,255,255,.55);margin-top:1px';
      const row = 'display:flex;justify-content:space-between;gap:14px;color:rgba(255,255,255,.82);margin-top:2px';
      const chg = r.chg.h24;
      const chgCol = chg == null ? '#94a3b8' : chg >= 0 ? '#22c55e' : '#ef4444';
      let html = `<div style="font-weight:600">${n.symbol}</div>`;
      if (r.baseName && r.baseName !== n.symbol) html += `<div style="${sub}">${r.baseName}</div>`;
      html += `<div style="${row}"><span>Price</span><span>${fmtUsd(r.priceUsd)}</span></div>`;
      html += `<div style="${row}"><span>24h</span><span style="color:${chgCol}">${fmtSignedPct(r.chg.h24)}</span></div>`;
      html += `<div style="${row}"><span>Vol 24h</span><span>${fmtUsd(r.vol.h24)}</span></div>`;
      html += `<div style="${row}"><span>Mkt cap</span><span>${fmtUsd(r.marketCap)}</span></div>`;
      html += `<div style="${row}"><span>Liq (main)</span><span>${fmtUsd(r.liquidityUsd)}</span></div>`;
      if (isHeld(n, heldRef.current)) {
        html += `<div style="font-size:11px;color:#fbbf24;margin-top:4px;font-weight:600">◉ You hold this</div>`;
      }
      html += `<div style="${sub};margin-top:5px">Click to open in analyzer →</div>`;
      tip.innerHTML = html; tip.style.opacity = '1';
      let tx = n.x + 16; if (tx > W - 184) tx = n.x - 184;
      tip.style.left = `${tx}px`; tip.style.top = `${Math.max(2, n.y - 12)}px`;
    }
    const hideTip = () => { tip.style.opacity = '0'; };
    const onMove = (e: MouseEvent) => {
      const p = mpos(e);
      if (drag) {
        if (downXY && Math.hypot(p.x - downXY.x, p.y - downXY.y) > 4) moved = true;
        if (lastDrag) { drag.vx = p.x - lastDrag.x; drag.vy = p.y - lastDrag.y; }
        drag.x = p.x; drag.y = p.y; lastDrag = { x: p.x, y: p.y };
        showTip(drag); return;
      }
      hover = pick(p); cvs.style.cursor = hover ? 'pointer' : 'default';
      if (hover) showTip(hover); else hideTip();
    };
    const onDown = (e: MouseEvent) => {
      const p = mpos(e), n = pick(p);
      if (n) { drag = n; n.fixed = true; downXY = p; lastDrag = p; moved = false; }
    };
    const onUp = () => {
      if (drag) {
        const n = drag; drag = null; n.fixed = false; lastDrag = null;
        // fling velocity is already on n.vx/vy from the last move
        const sp = Math.hypot(n.vx, n.vy);
        if (sp > MAX_V * 2.5) { n.vx = (n.vx / sp) * MAX_V * 2.5; n.vy = (n.vy / sp) * MAX_V * 2.5; }
        if (!moved && n.address) router.push(`/geicko?address=${n.address}`);
      }
    };
    const onLeave = () => { if (!drag) { hover = null; hideTip(); } };
    const onResize = () => {
      const oldW = W, oldH = H;
      measure();
      // Proportionally spread positions into the new canvas (e.g. entering
      // fullscreen) so the field fills the space immediately instead of slowly
      // drifting out from the old, smaller region.
      if (oldW > 0 && oldH > 0 && (W !== oldW || H !== oldH)) {
        const sx = W / oldW, sy = H / oldH;
        for (const n of nodes) { n.x *= sx; n.y *= sy; }
      }
      computeTargets();
      separate(8);
    };

    cvs.addEventListener('mousemove', onMove);
    cvs.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    cvs.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      retargetRef.current = null;
      cvs.removeEventListener('mousemove', onMove);
      cvs.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      cvs.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simKey]);

  return (
    <div
      className={
        fs
          ? 'fixed inset-0 z-[130] flex flex-col bg-[var(--app-bg)] p-3 sm:p-4'
          : 'rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3'
      }
    >
      <div className="mb-2 flex flex-wrap items-center justify-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-md border border-[var(--line)] overflow-hidden">
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetric(m.id)}
                className={`px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  m.id === metric ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-faint)] hover:text-[var(--text)]'
                }`}
                title={`Size bubbles by ${m.label}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-md border border-[var(--line)] overflow-hidden">
            {(isMobile ? COUNT_OPTIONS_MOBILE : COUNT_OPTIONS_DESKTOP).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setCount(opt)}
                disabled={status === 'loading'}
                className={`px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors disabled:opacity-40 ${
                  opt === count ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-faint)] hover:text-[var(--text)]'
                }`}
                title={`Show top ${opt} tokens`}
              >
                {opt}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void share()}
            disabled={status !== 'ready' || shareState === 'rendering'}
            className={`transition-colors disabled:opacity-40 ${
              shareState === 'error' ? 'text-red-400' : 'text-[var(--text-faint)] hover:text-[var(--text)]'
            }`}
            title={
              shareState === 'error'
                ? "Couldn't build the image"
                : `Share this view as an image (${BRAND})`
            }
            aria-label="Share bubbles as an image"
          >
            {shareState === 'rendering'
              ? <IconRefresh className="h-4 w-4 animate-spin" />
              : <IconShare2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={status === 'loading'}
            className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-40"
            title="Refresh"
          >
            <IconRefresh className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setFs((v) => !v)}
            className="text-[var(--text-faint)] hover:text-[var(--text)]"
            title={fs ? 'Exit full screen (Esc)' : 'Full screen'}
          >
            {fs ? <IconMinimize className="h-4 w-4" /> : <IconMaximize className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {status === 'error' ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
      ) : status === 'empty' ? (
        <div className="py-10 text-center text-sm text-[var(--text-faint)]">No tokens for this tab/filters.</div>
      ) : status === 'loading' ? (
        <div className={`grid place-items-center rounded-lg bg-[var(--surface)] ${fs ? 'flex-1' : ''}`} style={fs ? undefined : { height: CANVAS_H }}>
          <span className="inline-flex items-center gap-2 text-sm text-[var(--text-faint)]">
            <IconRefresh className="h-4 w-4 animate-spin" /> Loading top {count} tokens…
          </span>
        </div>
      ) : (
        <>
          <div className={fs ? 'relative w-full flex-1 min-h-0' : 'relative w-full'}>
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Floating bubble map of tokens sized by the selected metric, coloured by 24h performance"
              className="block w-full rounded-lg border border-[var(--line)]"
              style={{ height: fs ? '100%' : CANVAS_H }}
            />
            <div
              ref={tipRef}
              className="pointer-events-none absolute z-10 w-[184px] rounded-[10px] border border-[var(--line)] px-2.5 py-2 text-xs leading-snug text-[var(--text)] opacity-0 transition-opacity"
              style={{ background: 'rgba(6,18,34,.95)' }}
            />
          </div>
        </>
      )}

      {share_ && <SharePreview url={share_.url} blob={share_.blob} onClose={closeShare} />}
    </div>
  );
}
