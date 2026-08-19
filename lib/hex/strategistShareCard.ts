// Share cards for the HEX Strategist — the chain-wide story, drawn HEX-themed:
// the orange-to-pink HEX gradient carries every mark, and a faint hexagon
// lattice sits behind the chrome instead of the house magenta bloom.
//
// Two data sources. The unlock schedule and rates are already in memory when
// the share button exists; the pulse (24h/30d activity) is fetched lazily when
// one of its cards is opened, and until it lands those cards say so rather
// than drawing blanks. Nothing is invented: a missing figure is MISSING.

import {
  BOX_W, CARD_H, CARD_W, INK, LINE, MISSING, MONO, PAD, TX, TX_DIM, TX_MID,
  fitText, gauge, grid, needle, rr, statTile, text,
} from '@/lib/shareCards/paint';
import { fmtHexDate, fmtDuration, hexDayToDate } from '@/lib/hex/hexDay';

export { CARD_W, CARD_H };

export const BRAND_URL = 'scan.Morbius.io';

/** The HEX brand ramp, orange through pink. */
const HEX_A = '#ff9e00';
const HEX_B = '#ff2e7e';

export interface StrategistShareData {
  network: 'pulsechain' | 'ethereum';
  asOf: string;
  currentDay: number;
  /** [day, hex, tShares, stakes] — the same wire shape the Macro tab holds. */
  buckets: [number, number, number, number][];
  totals: { hex: number; tShares: number; stakes: number };
  networkHex: number;
  networkTShares: number;
  overdue: { hex: number; stakes: number };
  frozenHex: number;
  priceUsd: number | null;
  /** Lazily fetched; the pulse cards wait on it. */
  pulse: {
    windows: Record<'24h' | '7d' | '30d', {
      starts: { count: number; hex: number; stakers: number; avgDays: number; biggestHex: number };
      ends: { count: number; principalHex: number; payoutHex: number; penaltyHex: number; fullTerm: number; late: number };
      goodAccounted: { count: number; hex: number };
      mintedHex: number;
      netHex: number;
    }>;
    daily: [number, number, number, number, number][];
    now: { lockedHex: number; supplyHex: number } | null;
  } | null;
}

export interface CardKind {
  id: string;
  name: string;
  blurb: string;
  group: 'macro' | 'pulse';
  /** Needs the lazily-fetched pulse payload. */
  needsPulse?: boolean;
}

export const CARDS: readonly CardKind[] = [
  // The wall's "% of all HEX alive" tile reads the pulse's supply snapshot, so
  // it asks for the fetch too — being the landing card, that starts the load
  // the moment the modal opens and the tile fills in when it arrives.
  { id: 'wall', name: 'The wall of HEX', blurb: 'How much of all HEX is locked away, and for how long.', group: 'macro', needsPulse: true },
  { id: 'cliffs', name: 'The cliffs', blurb: 'The whole unlock schedule — and the one day that dwarfs it.', group: 'macro' },
  { id: 'flow', name: 'In vs out', blurb: '30 days of HEX staked in and unstaked out, day by day.', group: 'pulse', needsPulse: true },
  { id: 'pulse', name: 'The pulse', blurb: 'The last 24 hours: starts, ends, penalties, minted yield.', group: 'pulse', needsPulse: true },
] as const;

const hexAmt = (h: number) =>
  h >= 1e9 ? `${(h / 1e9).toFixed(2)}B` : h >= 1e6 ? `${(h / 1e6).toFixed(2)}M` : h >= 1e3 ? `${(h / 1e3).toFixed(1)}K` : h.toFixed(0);
const usdAmt = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;
const nf = (n: number) => Math.round(n).toLocaleString();

const hexGrad = (c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, HEX_A);
  g.addColorStop(1, HEX_B);
  return g;
};

/** A flat-top hexagon path centred on (cx, cy). */
function hexPath(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
}

/**
 * The HEX frame: ink base, a warm orange-to-pink bloom off the top corner, a
 * faint hexagon lattice fading out of it, and the same header/footer geometry
 * as the house chrome so the cards still read as one family.
 */
function hexChrome(
  c: CanvasRenderingContext2D,
  o: { title: string; subtitle: string; kicker: string; footerRight: string; logo: HTMLImageElement | null },
) {
  c.fillStyle = INK;
  c.fillRect(0, 0, CARD_W, CARD_H);

  const bloom = c.createRadialGradient(CARD_W * 0.9, -80, 0, CARD_W * 0.9, -80, 760);
  bloom.addColorStop(0, 'rgba(255,158,0,0.34)');
  bloom.addColorStop(0.5, 'rgba(255,46,126,0.12)');
  bloom.addColorStop(1, 'rgba(6,24,46,0)');
  c.fillStyle = bloom;
  c.fillRect(0, 0, CARD_W, CARD_H);

  // The lattice: honeycomb rows that fade with distance from the bloom.
  c.save();
  const R = 46;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 16; col++) {
      const cx = col * R * 1.74 + (row % 2 ? R * 0.87 : 0);
      const cy = row * R * 1.5 - 20;
      const d = Math.hypot(cx - CARD_W * 0.9, cy + 80) / 760;
      const a = Math.max(0, 0.16 * (1 - d));
      if (a <= 0.005) continue;
      c.strokeStyle = `rgba(255,158,0,${a.toFixed(3)})`;
      c.lineWidth = 1.5;
      hexPath(c, cx, cy, R);
      c.stroke();
    }
  }
  c.restore();

  if (o.logo) {
    c.save();
    c.beginPath();
    c.arc(94, 86, 30, 0, Math.PI * 2);
    c.clip();
    c.drawImage(o.logo, 64, 56, 60, 60);
    c.restore();
  }
  text(c, o.title, o.logo ? 140 : PAD, 78, { size: 30, weight: 800, spacing: 2 });
  text(c, o.subtitle, o.logo ? 140 : PAD, 106, { size: 19, color: TX_MID });
  text(c, o.kicker, CARD_W - PAD, 84, { size: 17, color: TX_DIM, font: MONO, align: 'right', spacing: 3 });

  c.strokeStyle = LINE;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(PAD, 136);
  c.lineTo(CARD_W - PAD, 136);
  c.stroke();

  text(c, BRAND_URL, PAD, CARD_H - 46, { size: 20, weight: 700 });
  text(c, o.footerRight, CARD_W - PAD, CARD_H - 46, { size: 17, color: TX_DIM, font: MONO, align: 'right' });
}

const frame = (
  c: CanvasRenderingContext2D, d: StrategistShareData, kicker: string, logo: HTMLImageElement | null,
) =>
  hexChrome(c, {
    title: 'HEX STRATEGIST',
    subtitle: d.network === 'pulsechain' ? 'PulseChain' : 'Ethereum',
    kicker,
    footerRight: d.asOf,
    logo,
  });

/* ───────────────────────────── the wall ───────────────────────────── */

function wallCard(c: CanvasRenderingContext2D, d: StrategistShareData, logo: HTMLImageElement | null) {
  frame(c, d, 'THE WALL', logo);

  // The centrepiece hexagon, holding the locked figure.
  const cx = CARD_W / 2;
  const cy = 420;
  c.save();
  c.shadowColor = HEX_B;
  c.shadowBlur = 90;
  hexPath(c, cx, cy, 210);
  c.fillStyle = 'rgba(255,158,0,0.06)';
  c.fill();
  c.shadowBlur = 0;
  c.lineWidth = 10;
  c.strokeStyle = hexGrad(c, cx - 210, cy - 210, cx + 210, cy + 210);
  c.stroke();
  c.restore();

  text(c, 'LOCKED IN STAKES', cx, cy - 90, { size: 19, color: TX_DIM, font: MONO, align: 'center', spacing: 4 });
  const big = `${hexAmt(d.networkHex)}`;
  text(c, big, cx, cy + 4, { size: fitText(c, big, 330, 120, 900), weight: 900, color: hexGrad(c, cx - 160, cy - 60, cx + 160, cy + 30), align: 'center' });
  text(c, 'HEX', cx, cy + 52, { size: 30, weight: 800, color: TX_MID, align: 'center', spacing: 6 });
  if (d.priceUsd != null) {
    text(c, usdAmt(d.networkHex * d.priceUsd), cx, cy + 100, { size: 30, weight: 700, color: TX, align: 'center' });
  }

  const staked = d.pulse?.now && d.pulse.now.lockedHex + d.pulse.now.supplyHex > 0
    ? (d.pulse.now.lockedHex / (d.pulse.now.lockedHex + d.pulse.now.supplyHex)) * 100
    : null;
  const tiles = grid(PAD, 720, BOX_W, 240, 3, 1);
  statTile(c, tiles[0], { label: 'T-Shares live', value: nf(d.networkTShares), accent: HEX_A });
  statTile(c, tiles[1], {
    label: 'Locked stakes',
    value: nf(d.totals.stakes),
    sub: `${hexAmt(d.overdue.hex)} already matured`,
  });
  statTile(c, tiles[2], {
    label: 'Of all HEX alive',
    value: staked != null ? `${staked.toFixed(1)}%` : MISSING,
    sub: staked != null ? 'is locked in a stake' : undefined,
    accent: HEX_B,
  });
}

/* ──────────────────────────── the cliffs ──────────────────────────── */

function cliffsCard(c: CanvasRenderingContext2D, d: StrategistShareData, logo: HTMLImageElement | null) {
  frame(c, d, 'THE CLIFFS', logo);

  // Quarter buckets across the whole schedule, sqrt-scaled like the tab.
  const Q = 91;
  const byQ = new Map<number, number>();
  let peak: { day: number; hex: number; stakes: number } | null = null;
  for (const [day, hex, , stakes] of d.buckets) {
    if (day < d.currentDay) continue;
    const q = Math.floor((day - d.currentDay) / Q);
    byQ.set(q, (byQ.get(q) ?? 0) + hex);
    if (!peak || hex > peak.hex) peak = { day, hex, stakes };
  }
  const qs = [...byQ.keys()];
  const nQ = Math.max(...qs) + 1;
  const vals = Array.from({ length: nQ }, (_, i) => byQ.get(i) ?? 0);
  const maxV = Math.max(...vals, 1);

  const chart = { x: PAD, y: 230, w: BOX_W, h: 420 };
  const bw = chart.w / nQ;
  const peakQ = peak ? Math.floor((peak.day - d.currentDay) / Q) : -1;
  vals.forEach((v, i) => {
    if (v <= 0) return;
    const h = Math.max(4, Math.sqrt(v / maxV) * chart.h);
    const x = chart.x + i * bw;
    const isPeak = i === peakQ;
    rr(c, x + 1, chart.y + chart.h - h, Math.max(2, bw - 3), h, 3);
    c.fillStyle = isPeak ? hexGrad(c, x, chart.y, x, chart.y + chart.h) : 'rgba(255,158,0,0.55)';
    c.fill();
  });
  c.strokeStyle = LINE;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(chart.x, chart.y + chart.h + 1);
  c.lineTo(chart.x + chart.w, chart.y + chart.h + 1);
  c.stroke();
  const yr = (q: number) => hexDayToDate(d.currentDay + q * Q).getFullYear();
  text(c, String(yr(0)), chart.x, chart.y + chart.h + 34, { size: 18, color: TX_DIM, font: MONO });
  text(c, String(yr(nQ - 1)), chart.x + chart.w, chart.y + chart.h + 34, { size: 18, color: TX_DIM, font: MONO, align: 'right' });
  text(c, '√ scale — every quarter of the schedule', chart.x + chart.w / 2, chart.y + chart.h + 34, {
    size: 16, color: TX_DIM, font: MONO, align: 'center',
  });

  if (peak) {
    const pct = d.totals.hex > 0 ? (peak.hex / d.totals.hex) * 100 : 0;
    text(c, 'THE SCHEDULE IS NOT SMOOTH', CARD_W / 2, 760, { size: 19, color: TX_DIM, font: MONO, align: 'center', spacing: 4 });
    const line = `${fmtHexDate(peak.day)} frees ${hexAmt(peak.hex)} HEX`;
    text(c, line, CARD_W / 2, 812, { size: fitText(c, line, BOX_W - 40, 52, 800), weight: 800, align: 'center' });
    text(
      c,
      `${pct.toFixed(0)}% of everything mapped, on one day — ${fmtDuration(peak.day - d.currentDay)} out, ${nf(peak.stakes)} stakes`,
      CARD_W / 2, 856, { size: 24, color: TX_MID, align: 'center' },
    );
  }
  const tiles = grid(PAD, 890, BOX_W, 100, 2, 1);
  statTile(c, tiles[0], { label: 'Mapped', value: `${hexAmt(d.totals.hex)} HEX`, size: 40, accent: HEX_A });
  statTile(c, tiles[1], {
    label: 'Already matured, unclaimed',
    value: `${hexAmt(d.overdue.hex)} HEX`,
    size: 40,
    accent: HEX_B,
  });
}

/* ───────────────────────────── in vs out ───────────────────────────── */

function flowCard(c: CanvasRenderingContext2D, d: StrategistShareData, logo: HTMLImageElement | null) {
  frame(c, d, 'IN VS OUT', logo);
  if (!d.pulse) {
    text(c, MISSING, CARD_W / 2, 500, { size: 56, color: TX_DIM, align: 'center' });
    text(c, 'The 30-day activity is still loading.', CARD_W / 2, 560, { size: 26, color: TX_MID, align: 'center' });
    return;
  }
  const w = d.pulse.windows['30d'];
  const daily = d.pulse.daily;

  const net = w.netHex;
  const headline = `${net >= 0 ? '+' : '−'}${hexAmt(Math.abs(net))} HEX`;
  text(c, 'NET FLOW · LAST 30 DAYS', CARD_W / 2, 220, { size: 19, color: TX_DIM, font: MONO, align: 'center', spacing: 4 });
  text(c, headline, CARD_W / 2, 306, {
    size: fitText(c, headline, BOX_W - 60, 96, 900), weight: 900,
    color: net >= 0 ? '#4ade80' : '#f87171', align: 'center',
  });
  text(c, net >= 0 ? 'more HEX locked than freed' : 'more HEX freed than locked', CARD_W / 2, 352, {
    size: 26, color: TX_MID, align: 'center',
  });

  // The mirrored daily chart: staked up in orange, unstaked down in pink.
  const chart = { x: PAD, y: 420, w: BOX_W, h: 360 };
  const mid = chart.y + chart.h / 2;
  const maxSide = Math.max(...daily.map(([, , sh, , eh]) => Math.max(sh, eh)), 1);
  const bw = chart.w / daily.length;
  daily.forEach(([, , sh, , eh], i) => {
    const x = chart.x + i * bw;
    if (sh > 0) {
      const h = Math.max(3, (sh / maxSide) * (chart.h / 2 - 6));
      rr(c, x + 1.5, mid - h - 1, Math.max(2, bw - 4), h, 3);
      c.fillStyle = HEX_A;
      c.fill();
    }
    if (eh > 0) {
      const h = Math.max(3, (eh / maxSide) * (chart.h / 2 - 6));
      rr(c, x + 1.5, mid + 1, Math.max(2, bw - 4), h, 3);
      c.fillStyle = HEX_B;
      c.fill();
    }
  });
  c.strokeStyle = LINE;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(chart.x, mid);
  c.lineTo(chart.x + chart.w, mid);
  c.stroke();
  text(c, '▲ staked in', chart.x, chart.y - 14, { size: 19, color: HEX_A, weight: 700 });
  text(c, 'unstaked out ▼', chart.x + chart.w, chart.y + chart.h + 30, { size: 19, color: HEX_B, weight: 700, align: 'right' });

  const tiles = grid(PAD, 850, BOX_W, 140, 3, 1);
  statTile(c, tiles[0], { label: 'Staked in', value: `${hexAmt(w.starts.hex)}`, sub: `${nf(w.starts.count)} stakes`, accent: HEX_A });
  statTile(c, tiles[1], { label: 'Unstaked out', value: `${hexAmt(w.ends.principalHex)}`, sub: `${nf(w.ends.count)} stakes`, accent: HEX_B });
  statTile(c, tiles[2], { label: 'Yield minted', value: `${hexAmt(w.mintedHex)}`, sub: 'inflation to stakers' });
}

/* ───────────────────────────── the pulse ───────────────────────────── */

function pulseCard(c: CanvasRenderingContext2D, d: StrategistShareData, logo: HTMLImageElement | null) {
  frame(c, d, 'THE PULSE · 24H', logo);
  if (!d.pulse) {
    text(c, MISSING, CARD_W / 2, 500, { size: 56, color: TX_DIM, align: 'center' });
    text(c, 'The 24-hour activity is still loading.', CARD_W / 2, 560, { size: 26, color: TX_MID, align: 'center' });
    return;
  }
  const w = d.pulse.windows['24h'];

  // The flow dial: how much of the day's moved HEX went IN.
  const frac = w.starts.hex + w.ends.principalHex > 0 ? w.starts.hex / (w.starts.hex + w.ends.principalHex) : 0.5;
  gauge(c, CARD_W / 2, 460, 210, frac, 30);
  needle(c, CARD_W / 2, 460, 150, frac);
  const netLine = `${w.netHex >= 0 ? '+' : '−'}${hexAmt(Math.abs(w.netHex))}`;
  text(c, netLine, CARD_W / 2, 540, { size: 64, weight: 900, color: w.netHex >= 0 ? '#4ade80' : '#f87171', align: 'center' });
  text(c, 'net HEX flow today', CARD_W / 2, 580, { size: 25, color: TX_MID, align: 'center' });
  text(c, 'OUT', PAD + 40, 480, { size: 20, color: HEX_B, weight: 800, spacing: 3 });
  text(c, 'IN', CARD_W - PAD - 40, 480, { size: 20, color: HEX_A, weight: 800, align: 'right', spacing: 3 });

  const top = grid(PAD, 640, BOX_W, 150, 2, 1);
  statTile(c, top[0], {
    label: 'Stakes started',
    value: nf(w.starts.count),
    sub: `${hexAmt(w.starts.hex)} HEX · biggest ${hexAmt(w.starts.biggestHex)}`,
    accent: HEX_A,
  });
  statTile(c, top[1], {
    label: 'Stakes ended',
    value: nf(w.ends.count),
    sub: `${hexAmt(w.ends.principalHex)} HEX freed · ${nf(w.ends.late)} were late claims`,
    accent: HEX_B,
  });
  const bottom = grid(PAD, 810, BOX_W, 150, 3, 1);
  statTile(c, bottom[0], { label: 'Yield minted', value: hexAmt(w.mintedHex), sub: 'to all stakers' });
  statTile(c, bottom[1], { label: 'Penalties paid', value: hexAmt(w.ends.penaltyHex), sub: 'early + late ends' });
  statTile(c, bottom[2], { label: 'Good-accounted', value: nf(w.goodAccounted.count), sub: `${hexAmt(w.goodAccounted.hex)} frozen` });
}

export function drawCard(
  c: CanvasRenderingContext2D, id: string, d: StrategistShareData, logo: HTMLImageElement | null,
) {
  c.clearRect(0, 0, CARD_W, CARD_H);
  if (id === 'wall') wallCard(c, d, logo);
  else if (id === 'cliffs') cliffsCard(c, d, logo);
  else if (id === 'flow') flowCard(c, d, logo);
  else if (id === 'pulse') pulseCard(c, d, logo);
  else {
    frame(c, d, '', logo);
    text(c, 'Unknown card', CARD_W / 2, 500, { size: 40, color: TX, align: 'center' });
  }
}
