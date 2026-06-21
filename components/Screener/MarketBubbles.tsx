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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconRefresh } from '@tabler/icons-react';
import type { ScreenerRow, ScreenerUiTab, ScreenerFilters } from '@/lib/screener/types';
import { fmtUsd } from '@/lib/format';

const COUNT_OPTIONS = [100, 250, 500] as const;
const DEFAULT_COUNT = 250;
const PAGE_SIZE = 50;
const CANVAS_H = 580;

const METRICS = [
  { id: 'chg24', label: '24h %' },
  { id: 'chg6', label: '6h %' },
  { id: 'chg1', label: '1h %' },
  { id: 'vol', label: 'Volume' },
  { id: 'mcap', label: 'Mkt Cap' },
  { id: 'liq', label: 'Liquidity' },
] as const;
type Metric = (typeof METRICS)[number]['id'];

// Colour endpoints — dim (small move) → bright (big move), per direction.
const GREEN_DIM = [16, 94, 70] as const;
const GREEN_BRIGHT = [34, 230, 156] as const;
const RED_DIM = [128, 36, 44] as const;
const RED_BRIGHT = [245, 70, 92] as const;
const NEUTRAL = [100, 116, 139] as const;
const CHG_CAP = 25;

// Sizing: a steep power keeps the top movers dramatically huge; a generous MIN
// floor keeps the long tail big enough to pack the field FULL (not a sea of
// dots). Floor + max both shrink as the count grows so it stays fittable.
const SIZE_EXP = 0.9;
function sizeParamsFor(count: number): { min: number; max: number } {
  if (count <= 100) return { min: 14, max: 120 };
  if (count <= 250) return { min: 11, max: 92 };
  return { min: 8, max: 68 };
}

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
    case 'chg6': return Math.abs(row.chg.h6 ?? 0);
    case 'chg1': return Math.abs(row.chg.h1 ?? 0);
    case 'vol': return row.vol.h24 ?? 0;
    case 'mcap': return row.marketCap ?? 0;
    case 'liq': return row.liquidityUsd ?? 0;
  }
}
function colorChg(row: ScreenerRow, m: Metric): number | null {
  switch (m) {
    case 'chg6': return row.chg.h6;
    case 'chg1': return row.chg.h1;
    default: return row.chg.h24;
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
    case 'chg6': return fmtSignedPct(row.chg.h6);
    case 'chg1': return fmtSignedPct(row.chg.h1);
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
}

interface Props {
  tab: ScreenerUiTab;
  dexId: string | null;
  filters: ScreenerFilters;
  watchlistParam: string;
}

export default function MarketBubbles({ tab, dexId, filters, watchlistParam }: Props) {
  const router = useRouter();
  const [count, setCount] = useState<number>(DEFAULT_COUNT);
  const [metric, setMetric] = useState<Metric>('chg24');
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [simKey, setSimKey] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const dataRef = useRef<{ nodes: MNode[] } | null>(null);
  const metricRef = useRef<Metric>(metric);
  const retargetRef = useRef<(() => void) | null>(null);

  const { min: minR, max: maxRadius } = sizeParamsFor(count);

  const fetchRows = useCallback(async (): Promise<ScreenerRow[]> => {
    // The screener is PAIR-based: one token can have many pairs (WPLS/DAI,
    // WPLS/USDC, … and the same pair across several DEXes). One bubble per token
    // is what people expect, so we dedupe by base token — keeping the
    // highest-ranked pair (first seen in the tab's order) — and over-fetch pages
    // until we have `count` DISTINCT tokens.
    const keyOf = (r: ScreenerRow) =>
      r.baseAddress ? `${r.chainId ?? 'p'}:${r.baseAddress.toLowerCase()}` : `pair:${r.pairAddress}`;
    const seen = new Map<string, ScreenerRow>();

    if (tab === 'watchlist') {
      if (!watchlistParam) return [];
      const res = await fetch(`/api/watchlist?tokens=${encodeURIComponent(watchlistParam)}`);
      if (!res.ok) throw new Error(`watchlist ${res.status}`);
      const json: { rows: ScreenerRow[] } = await res.json();
      for (const r of json.rows) { const k = keyOf(r); if (!seen.has(k)) seen.set(k, r); }
      return [...seen.values()].slice(0, count);
    }

    const MAX_PAGES = 24; // safety cap (~1200 pairs scanned)
    for (let p = 0; p < MAX_PAGES && seen.size < count; p++) {
      const qs = new URLSearchParams({ tab, window: 'h24', page: String(p) });
      if (dexId) qs.set('dex', dexId);
      if (filters.minLiq !== null) qs.set('minLiq', String(filters.minLiq));
      if (filters.minVol24 !== null) qs.set('minVol', String(filters.minVol24));
      if (filters.minAgeH !== null) qs.set('minAgeH', String(filters.minAgeH));
      if (filters.maxAgeH !== null) qs.set('maxAgeH', String(filters.maxAgeH));
      const res = await fetch(`/api/screener?${qs}`);
      if (!res.ok) throw new Error(`screener ${res.status}`);
      const json = await res.json();
      const rows: ScreenerRow[] = json.rows ?? [];
      for (const r of rows) { const k = keyOf(r); if (!seen.has(k)) seen.set(k, r); }
      if (rows.length < PAGE_SIZE) break;
    }
    return [...seen.values()].slice(0, count);
  }, [tab, dexId, filters, watchlistParam, count]);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const rows = await fetchRows();
      const usable = rows.filter((r) => r.baseSymbol);
      if (usable.length === 0) { dataRef.current = null; setStatus('empty'); return; }

      const m = metricRef.current;
      const maxV = Math.max(1e-9, ...usable.map((r) => sizeVal(r, m)));
      const nodes: MNode[] = usable.map((r) => {
        const tr = minR + Math.pow(sizeVal(r, m) / maxV, SIZE_EXP) * (maxRadius - minR);
        const tcol = colFor(colorChg(r, m));
        let img: HTMLImageElement | null = null;
        const node: MNode = {
          address: r.baseAddress,
          symbol: r.baseSymbol ?? '?',
          row: r,
          r: tr * 0.2, tr,
          col: [...tcol] as RGB, tcol,
          x: 0, y: 0, vx: 0, vy: 0, fixed: false,
          img: null, imgOk: false,
        };
        if (r.imageUrl) {
          img = new Image();
          // No crossOrigin — many logo hosts lack CORS headers; drawImage still
          // renders fine (canvas just becomes read-tainted, which we don't need).
          img.onload = () => { node.imgOk = true; };
          img.onerror = () => { node.imgOk = false; };
          img.src = r.imageUrl;
          node.img = img;
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
  }, [fetchRows, minR, maxRadius]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    metricRef.current = metric;
    retargetRef.current?.();
  }, [metric]);

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
      W = r.width; H = CANVAS_H;
      cvs.width = W * DPR; cvs.height = H * DPR;
    }
    measure();
    // Scatter across the whole field (not the centre) so they start spread out.
    nodes.forEach((n) => {
      n.x = n.r + Math.random() * Math.max(1, W - 2 * n.r);
      n.y = n.r + Math.random() * Math.max(1, H - 2 * n.r);
      const a = Math.random() * Math.PI * 2, s = 0.3 + Math.random() * 0.6;
      n.vx = Math.cos(a) * s; n.vy = Math.sin(a) * s;
    });

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

    const glass = getGlassSprite();
    const TAU = 6.2831853;
    function drawCover(img: HTMLImageElement, ix: number, iy: number, w: number, h: number) {
      const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale, dh = ih * scale;
      try { ctx.drawImage(img, ix - dw / 2, iy - dh / 2, dw, dh); } catch { /* tainted/decoding */ }
    }

    function drawNode(n: MNode) {
      const r = n.r;
      const hasLogo = !!(n.img && n.imgOk);

      // Outer performance glow — the up/down signal + depth, brighter for big moves.
      const mag = colorMag(n.row, metricRef.current);
      if (r >= 7) {
        ctx.globalAlpha = 0.12 + mag * 0.26;
        ctx.lineWidth = Math.max(2, r * 0.16);
        ctx.strokeStyle = rgbStr(n.col, 1);
        ctx.beginPath(); ctx.arc(n.x, n.y, r + ctx.lineWidth * 0.35, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Base fill: the logo IS the whole bubble. Fallback = frosted tinted disc.
      ctx.save();
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, TAU); ctx.clip();
      if (hasLogo) {
        drawCover(n.img!, n.x, n.y, r * 2, r * 2);
      } else {
        const g = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.34, r * 0.1, n.x, n.y, r);
        g.addColorStop(0, rgbStr([n.col[0] + 55, n.col[1] + 55, n.col[2] + 55] as RGB, 0.95));
        g.addColorStop(1, rgbStr(n.col, 0.92));
        ctx.fillStyle = g; ctx.fillRect(n.x - r, n.y - r, r * 2, r * 2);
        if (r >= 13) {
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.font = `700 ${Math.min(15, Math.max(9, r * 0.4))}px ui-sans-serif,system-ui,sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(n.symbol.slice(0, 6), n.x, n.y);
        }
      }
      // Refraction band: a magnified redraw of the logo in the outer ring bends
      // the content at the rim like a real glass lens — the "distortion border".
      if (hasLogo && r >= 13) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, TAU);
        ctx.arc(n.x, n.y, r * 0.78, 0, TAU, true);
        ctx.clip('evenodd');
        drawCover(n.img!, n.x, n.y, r * 2 * 1.34, r * 2 * 1.34);
      }
      ctx.restore();

      // Apple-glass overlay: specular highlight + top light + rim sheen (cached).
      if (glass) ctx.drawImage(glass, n.x - r, n.y - r, r * 2, r * 2);

      // Coloured glass rim (performance) — a bright lit edge.
      ctx.lineWidth = Math.max(1.4, r * 0.05);
      ctx.strokeStyle = rgbStr([
        Math.min(255, n.col[0] + 30), Math.min(255, n.col[1] + 30), Math.min(255, n.col[2] + 30),
      ] as RGB, 0.95);
      ctx.beginPath(); ctx.arc(n.x, n.y, r - ctx.lineWidth / 2, 0, TAU); ctx.stroke();

      if (n === hover) {
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 2.5, 0, TAU); ctx.stroke();
      }

      // Value chip near the bottom for big bubbles, so the logo stays clear.
      if (r >= 26) {
        const txt = valLabel(n.row, metricRef.current);
        ctx.font = `800 ${Math.min(13, r * 0.24)}px ui-sans-serif,system-ui,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(txt).width, ch = Math.min(16, r * 0.3), yy = n.y + r * 0.54;
        ctx.fillStyle = 'rgba(6,14,26,0.72)';
        ctx.fillRect(n.x - tw / 2 - 5, yy - ch / 2, tw + 10, ch);
        ctx.fillStyle = 'rgba(255,255,255,0.98)';
        ctx.fillText(txt, n.x, yy);
      }
    }

    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = '#0a1525'; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.1, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(120,160,210,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
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

    retargetRef.current = () => {
      const m = metricRef.current;
      const maxV = Math.max(1e-9, ...nodes.map((n) => sizeVal(n.row, m)));
      for (const n of nodes) {
        n.tr = minR + Math.pow(sizeVal(n.row, m) / maxV, SIZE_EXP) * (maxRadius - minR);
        n.tcol = colFor(colorChg(n.row, m));
      }
    };

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
      html += `<div style="${row}"><span>Liquidity</span><span>${fmtUsd(r.liquidityUsd)}</span></div>`;
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
    const onResize = () => { measure(); separate(8); };

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

  const headerCount = useMemo(() => dataRef.current?.nodes.length ?? 0, [simKey]);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Market bubbles
          {status === 'ready' && (
            <span className="font-normal normal-case text-[var(--text-faint)]">{headerCount} tokens · size = {METRICS.find((m) => m.id === metric)?.label}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
            {COUNT_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setCount(opt)}
                disabled={status === 'loading'}
                className={`px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-colors disabled:opacity-40 ${
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
            onClick={() => void load()}
            disabled={status === 'loading'}
            className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-40"
            title="Refresh"
          >
            <IconRefresh className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {status === 'error' ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
      ) : status === 'empty' ? (
        <div className="py-10 text-center text-sm text-[var(--text-faint)]">No tokens for this tab/filters.</div>
      ) : status === 'loading' ? (
        <div className="grid place-items-center rounded-lg bg-[var(--surface)]" style={{ height: CANVAS_H }}>
          <span className="inline-flex items-center gap-2 text-sm text-[var(--text-faint)]">
            <IconRefresh className="h-4 w-4 animate-spin" /> Loading top {count} tokens…
          </span>
        </div>
      ) : (
        <>
          <div className="relative w-full">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Floating bubble map of tokens sized by the selected metric, coloured by 24h performance"
              className="block w-full rounded-lg border border-[var(--line)]"
              style={{ height: CANVAS_H }}
            />
            <div
              ref={tipRef}
              className="pointer-events-none absolute z-10 w-[184px] rounded-[10px] border border-[var(--line)] px-2.5 py-2 text-xs leading-snug text-[var(--text)] opacity-0 transition-opacity"
              style={{ background: 'rgba(6,18,34,.95)' }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-faint)]">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#22e69c' }} /> Up</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#f5465c' }} /> Down</span>
            <span>· brighter = bigger move · size = {METRICS.find((m) => m.id === metric)?.label} · drag to fling · click to open</span>
          </div>
        </>
      )}
    </div>
  );
}
