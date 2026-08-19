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
  fitText, gauge, grid, needle, ring, rr, statTile, text,
} from '@/lib/shareCards/paint';
import { fmtHexDate, fmtDuration, hexDayToDate } from '@/lib/hex/hexDay';
import { LEAGUES } from '@/lib/hex/leagues';

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
  tShareRateHex: number | null;
  tSharePriceUsd: number | null;
  /** HEX/day one T-Share earns (trailing 30-day average). */
  dailyPayoutPerTShare: number | null;
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
  /** Lazily fetched; the league cards wait on it. */
  leagues: {
    stakersFound: number;
    networkTShares: number;
    populations: Record<string, number>;
    rows: { rank: number; address: string; tShares: number; sharePct: number }[];
  } | null;
}

export interface CardKind {
  id: string;
  name: string;
  blurb: string;
  group: 'macro' | 'pulse' | 'leagues';
  /** Which lazily-fetched payload the card waits on, if any. */
  source?: 'pulse' | 'leagues';
}

export const CARDS: readonly CardKind[] = [
  // The wall's "% of all HEX alive" tile reads the pulse's supply snapshot, so
  // it asks for the fetch too — being the landing card, that starts the load
  // the moment the modal opens and the tile fills in when it arrives.
  { id: 'wall', name: 'The wall of HEX', blurb: 'How much of all HEX is locked away, and for how long.', group: 'macro', source: 'pulse' },
  { id: 'cliffs', name: 'The cliffs', blurb: 'Every future unlock — and the biggest single day.', group: 'macro' },
  { id: 'countdown', name: 'The countdown', blurb: 'When half of everything locked comes free.', group: 'macro' },
  { id: 'overdue', name: 'The overdue pile', blurb: 'Matured, unclaimed, and mostly frozen by good-accounting.', group: 'macro' },
  { id: 'yield', name: 'The yield', blurb: 'What one T-Share costs, and what it pays every day.', group: 'macro' },
  { id: 'flow', name: 'In vs out', blurb: '30 days of HEX staked in and unstaked out, day by day.', group: 'pulse', source: 'pulse' },
  { id: 'pulse', name: 'The pulse', blurb: 'The last 24 hours: starts, ends, penalties, minted yield.', group: 'pulse', source: 'pulse' },
  { id: 'loyalty', name: 'Held to term', blurb: 'How many stakes served their full term this month.', group: 'pulse', source: 'pulse' },
  { id: 'mint', name: 'Minted vs burned', blurb: '30 days of yield paid out against penalties taken.', group: 'pulse', source: 'pulse' },
  { id: 'foodchain', name: 'The food chain', blurb: 'Every staker on the chain, ranked into nine leagues.', group: 'leagues', source: 'leagues' },
  { id: 'whales', name: 'The whales', blurb: 'The five largest stakers and the share they hold.', group: 'leagues', source: 'leagues' },
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

  text(c, `${BRAND_URL}/hex-strategist`, PAD, CARD_H - 46, { size: 20, weight: 700 });
  text(c, o.footerRight, CARD_W - PAD, CARD_H - 46, { size: 17, color: TX_DIM, font: MONO, align: 'right' });
}

const frame = (
  c: CanvasRenderingContext2D, d: StrategistShareData, kicker: string, logo: HTMLImageElement | null,
) =>
  hexChrome(c, {
    // The site is the title — the card should say where to get this chart.
    title: 'SCAN.MORBIUS.IO',
    subtitle: d.network === 'pulsechain' ? 'HEX · PulseChain' : 'HEX · Ethereum',
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
  text(c, 'HEX unlocking each quarter, today through the last stake', chart.x + chart.w / 2, chart.y + chart.h + 34, {
    size: 16, color: TX_DIM, font: MONO, align: 'center',
  });

  if (peak) {
    const pct = d.totals.hex > 0 ? (peak.hex / d.totals.hex) * 100 : 0;
    text(c, 'THE BIGGEST UNLOCK DAY', CARD_W / 2, 760, { size: 19, color: TX_DIM, font: MONO, align: 'center', spacing: 4 });
    const line = `${fmtHexDate(peak.day)} unlocks ${hexAmt(peak.hex)} HEX`;
    text(c, line, CARD_W / 2, 812, { size: fitText(c, line, BOX_W - 40, 52, 800), weight: 800, align: 'center' });
    text(
      c,
      `${pct.toFixed(0)}% of all locked HEX, on one day — ${fmtDuration(peak.day - d.currentDay)} out, ${nf(peak.stakes)} stakes`,
      CARD_W / 2, 856, { size: 24, color: TX_MID, align: 'center' },
    );
  }
  const tiles = grid(PAD, 890, BOX_W, 100, 2, 1);
  statTile(c, tiles[0], { label: 'Locked in stakes', value: `${hexAmt(d.totals.hex)} HEX`, size: 40, accent: HEX_A });
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

/* ─────────────────────────── the countdown ─────────────────────────── */

function countdownCard(c: CanvasRenderingContext2D, d: StrategistShareData, logo: HTMLImageElement | null) {
  frame(c, d, 'THE COUNTDOWN', logo);

  // Cumulative release: what has already matured counts as released today.
  const future = d.buckets.filter(([day]) => day >= d.currentDay).sort((a, b) => a[0] - b[0]);
  const total = d.totals.hex || 1;
  let run = d.overdue.hex;
  const pts: [number, number][] = [[d.currentDay, run / total]];
  let halfDay: number | null = run / total >= 0.5 ? d.currentDay : null;
  for (const [day, hex] of future) {
    run += hex;
    pts.push([day, run / total]);
    if (halfDay == null && run / total >= 0.5) halfDay = day;
  }
  const lastDay = pts[pts.length - 1][0];

  text(c, 'HALF OF EVERYTHING LOCKED IS FREE BY', CARD_W / 2, 220, { size: 19, color: TX_DIM, font: MONO, align: 'center', spacing: 3 });
  const big = halfDay != null ? fmtHexDate(halfDay) : MISSING;
  text(c, big, CARD_W / 2, 312, { size: fitText(c, big, BOX_W - 60, 96, 900), weight: 900, color: hexGrad(c, 240, 240, 840, 320), align: 'center' });
  if (halfDay != null && halfDay > d.currentDay) {
    text(c, `${fmtDuration(halfDay - d.currentDay)} from today`, CARD_W / 2, 360, { size: 27, color: TX_MID, align: 'center' });
  }

  // The release curve, 0–100%, with the halfway marker.
  const chart = { x: PAD, y: 440, w: BOX_W, h: 380 };
  const span = Math.max(1, lastDay - d.currentDay);
  const px = (day: number) => chart.x + ((day - d.currentDay) / span) * chart.w;
  const py = (f: number) => chart.y + chart.h - f * chart.h;
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    c.strokeStyle = LINE;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(chart.x, py(f));
    c.lineTo(chart.x + chart.w, py(f));
    c.stroke();
    text(c, `${f * 100}%`, chart.x - 12, py(f) + 6, { size: 16, color: TX_DIM, font: MONO, align: 'right' });
  });
  c.beginPath();
  pts.forEach(([day, f], i) => (i ? c.lineTo(px(day), py(f)) : c.moveTo(px(day), py(f))));
  c.lineWidth = 6;
  c.lineJoin = 'round';
  c.strokeStyle = hexGrad(c, chart.x, chart.y + chart.h, chart.x + chart.w, chart.y);
  c.stroke();
  c.lineTo(chart.x + chart.w, py(pts[pts.length - 1][1]));
  c.lineTo(chart.x + chart.w, chart.y + chart.h);
  c.lineTo(chart.x, chart.y + chart.h);
  c.closePath();
  const wash = c.createLinearGradient(0, chart.y, 0, chart.y + chart.h);
  wash.addColorStop(0, 'rgba(255,158,0,0.16)');
  wash.addColorStop(1, 'rgba(255,46,126,0)');
  c.fillStyle = wash;
  c.fill();
  if (halfDay != null) {
    c.strokeStyle = TX;
    c.lineWidth = 2;
    c.setLineDash([6, 6]);
    c.beginPath();
    c.moveTo(px(halfDay), chart.y);
    c.lineTo(px(halfDay), chart.y + chart.h);
    c.stroke();
    c.setLineDash([]);
  }
  text(c, String(hexDayToDate(d.currentDay).getFullYear()), chart.x, chart.y + chart.h + 34, { size: 18, color: TX_DIM, font: MONO });
  text(c, String(hexDayToDate(lastDay).getFullYear()), chart.x + chart.w, chart.y + chart.h + 34, { size: 18, color: TX_DIM, font: MONO, align: 'right' });
  text(c, 'share of locked HEX unlocked, over time', CARD_W / 2, chart.y + chart.h + 34, { size: 16, color: TX_DIM, font: MONO, align: 'center' });

  const tiles = grid(PAD, 880, BOX_W, 110, 2, 1);
  statTile(c, tiles[0], { label: 'Locked today', value: `${hexAmt(d.networkHex)} HEX`, size: 40, accent: HEX_A });
  statTile(c, tiles[1], { label: 'Last stake matures', value: fmtHexDate(lastDay), size: 40, accent: HEX_B });
}

/* ────────────────────────── the overdue pile ────────────────────────── */

function overdueCard(c: CanvasRenderingContext2D, d: StrategistShareData, logo: HTMLImageElement | null) {
  frame(c, d, 'THE OVERDUE PILE', logo);

  text(c, 'MATURED AND STILL UNCLAIMED', CARD_W / 2, 250, { size: 19, color: TX_DIM, font: MONO, align: 'center', spacing: 4 });
  const big = `${hexAmt(d.overdue.hex)} HEX`;
  text(c, big, CARD_W / 2, 370, { size: fitText(c, big, BOX_W - 40, 130, 900), weight: 900, color: hexGrad(c, 240, 280, 840, 380), align: 'center' });
  text(c, `across ${nf(d.overdue.stakes)} stakes past their end day`, CARD_W / 2, 424, { size: 27, color: TX_MID, align: 'center' });
  if (d.priceUsd != null) {
    text(c, usdAmt(d.overdue.hex * d.priceUsd), CARD_W / 2, 470, { size: 30, weight: 700, align: 'center' });
  }

  // The split: frozen by good-accounting vs still bleeding the late penalty.
  const frozen = Math.min(d.frozenHex, d.overdue.hex);
  const bleeding = Math.max(0, d.overdue.hex - frozen);
  const fFrac = d.overdue.hex > 0 ? frozen / d.overdue.hex : 0;
  const bar = { x: PAD + 20, y: 560, w: BOX_W - 40, h: 40 };
  rr(c, bar.x, bar.y, Math.max(8, bar.w * fFrac - 2), bar.h, 10);
  c.fillStyle = 'rgba(148,163,184,0.75)';
  c.fill();
  rr(c, bar.x + bar.w * fFrac + 2, bar.y, Math.max(8, bar.w * (1 - fFrac) - 2), bar.h, 10);
  c.fillStyle = hexGrad(c, bar.x + bar.w * fFrac, bar.y, bar.x + bar.w, bar.y);
  c.fill();
  text(c, `❄ FROZEN ${(fFrac * 100).toFixed(0)}%`, bar.x, bar.y + 78, { size: 21, weight: 800, color: 'rgba(148,163,184,1)', spacing: 2 });
  text(c, `BLEEDING ${((1 - fFrac) * 100).toFixed(0)}% 🔥`, bar.x + bar.w, bar.y + 78, { size: 21, weight: 800, color: HEX_B, align: 'right', spacing: 2 });

  const tiles = grid(PAD, 720, BOX_W, 250, 2, 1);
  statTile(c, tiles[0], {
    label: 'Frozen by good-accounting',
    value: `${hexAmt(frozen)} HEX`,
    sub: 'shares returned, penalty locked in — waiting to be ended',
  });
  statTile(c, tiles[1], {
    label: 'Bleeding the late penalty',
    value: `${hexAmt(bleeding)} HEX`,
    sub: 'losing value every week until someone ends it',
    accent: HEX_B,
  });
}

/* ───────────────────────────── the yield ───────────────────────────── */

function yieldCard(c: CanvasRenderingContext2D, d: StrategistShareData, logo: HTMLImageElement | null) {
  frame(c, d, 'THE YIELD', logo);

  const rate = d.tShareRateHex;
  const daily = d.dailyPayoutPerTShare;
  const apy = rate && daily ? (daily * 365 / rate) * 100 : null;

  text(c, 'ONE T-SHARE PAYS, EVERY DAY', CARD_W / 2, 240, { size: 19, color: TX_DIM, font: MONO, align: 'center', spacing: 4 });
  const big = daily != null ? `${daily.toFixed(2)} HEX` : MISSING;
  text(c, big, CARD_W / 2, 350, { size: fitText(c, big, BOX_W - 60, 116, 900), weight: 900, color: hexGrad(c, 260, 260, 820, 360), align: 'center' });
  if (daily != null && d.priceUsd != null) {
    // Per-day USD on one T-Share is sub-cent — the yearly figure actually says something.
    text(c, `≈ $${(daily * 365 * d.priceUsd).toFixed(2)} a year at today's price · trailing 30-day average`, CARD_W / 2, 400, {
      size: 25, color: TX_MID, align: 'center',
    });
  }

  // The dial reads the implied simple yield against a 10% face.
  if (apy != null) {
    gauge(c, CARD_W / 2, 640, 190, Math.min(1, apy / 10), 28);
    needle(c, CARD_W / 2, 640, 136, Math.min(1, apy / 10));
    text(c, `${apy.toFixed(2)}%`, CARD_W / 2, 706, { size: 58, weight: 900, align: 'center' });
    text(c, 'implied simple yield, in HEX terms', CARD_W / 2, 744, { size: 23, color: TX_MID, align: 'center' });
    text(c, '0%', PAD + 100, 660, { size: 18, color: TX_DIM, font: MONO });
    text(c, '10%+', CARD_W - PAD - 100, 660, { size: 18, color: TX_DIM, font: MONO, align: 'right' });
  }

  const tiles = grid(PAD, 810, BOX_W, 160, 2, 1);
  statTile(c, tiles[0], {
    label: 'One T-Share costs',
    value: rate != null ? `${hexAmt(rate)} HEX` : MISSING,
    sub: d.tSharePriceUsd != null ? usdAmt(d.tSharePriceUsd) : undefined,
    accent: HEX_A,
  });
  statTile(c, tiles[1], {
    label: 'Pays per year',
    value: daily != null ? `${nf(daily * 365)} HEX` : MISSING,
    sub: 'the T-Share price only ever rises — it never gets cheaper to buy in',
    accent: HEX_B,
  });
}

/* ─────────────────────────── held to term ─────────────────────────── */

function loyaltyCard(c: CanvasRenderingContext2D, d: StrategistShareData, logo: HTMLImageElement | null) {
  frame(c, d, 'HELD TO TERM · 30D', logo);
  if (!d.pulse) {
    text(c, MISSING, CARD_W / 2, 500, { size: 56, color: TX_DIM, align: 'center' });
    text(c, 'The 30-day activity is still loading.', CARD_W / 2, 560, { size: 26, color: TX_MID, align: 'center' });
    return;
  }
  const w = d.pulse.windows['30d'];
  const frac = w.ends.count > 0 ? w.ends.fullTerm / w.ends.count : 0;

  ring(c, CARD_W / 2, 470, 200, frac, 34, hexGrad(c, CARD_W / 2 - 200, 270, CARD_W / 2 + 200, 670));
  text(c, `${Math.round(frac * 100)}%`, CARD_W / 2, 490, { size: 110, weight: 900, align: 'center' });
  text(c, 'served in full', CARD_W / 2, 540, { size: 26, color: TX_MID, align: 'center' });

  const tiles = grid(PAD, 760, BOX_W, 210, 3, 1);
  statTile(c, tiles[0], { label: 'Ends this month', value: nf(w.ends.count), sub: `${hexAmt(w.ends.principalHex)} HEX freed` });
  statTile(c, tiles[1], { label: 'Broke the promise', value: nf(w.ends.count - w.ends.fullTerm), sub: `${hexAmt(w.ends.penaltyHex)} HEX in penalties`, accent: HEX_B });
  statTile(c, tiles[2], { label: 'Late claims', value: nf(w.ends.late), sub: 'matured, ended after', accent: HEX_A });
}

/* ────────────────────────── minted vs burned ────────────────────────── */

function mintCard(c: CanvasRenderingContext2D, d: StrategistShareData, logo: HTMLImageElement | null) {
  frame(c, d, 'MINTED VS BURNED · 30D', logo);
  if (!d.pulse) {
    text(c, MISSING, CARD_W / 2, 500, { size: 56, color: TX_DIM, align: 'center' });
    text(c, 'The 30-day activity is still loading.', CARD_W / 2, 560, { size: 26, color: TX_MID, align: 'center' });
    return;
  }
  const w = d.pulse.windows['30d'];
  const minted = w.mintedHex;
  const burned = w.ends.penaltyHex;

  // Two opposing panels, scaled bars between them.
  text(c, 'YIELD MINTED TO STAKERS', PAD, 250, { size: 19, color: TX_DIM, font: MONO, spacing: 2 });
  text(c, `+${hexAmt(minted)}`, PAD, 340, { size: 84, weight: 900, color: '#4ade80' });
  if (d.priceUsd != null) text(c, usdAmt(minted * d.priceUsd), PAD, 386, { size: 26, color: TX_MID });

  text(c, 'TAKEN BACK IN PENALTIES', CARD_W - PAD, 470, { size: 19, color: TX_DIM, font: MONO, align: 'right', spacing: 2 });
  text(c, `−${hexAmt(burned)}`, CARD_W - PAD, 560, { size: 84, weight: 900, color: HEX_B, align: 'right' });
  if (d.priceUsd != null) text(c, usdAmt(burned * d.priceUsd), CARD_W - PAD, 606, { size: 26, color: TX_MID, align: 'right' });

  const maxV = Math.max(minted, burned, 1);
  const barY = [402, 622];
  [minted, burned].forEach((v, i) => {
    const bw = Math.max(12, (v / maxV) * (BOX_W - 40));
    const x = i === 0 ? PAD : CARD_W - PAD - bw;
    rr(c, x, barY[i], bw, 22, 8);
    c.fillStyle = i === 0 ? 'rgba(74,222,128,0.85)' : hexGrad(c, x, barY[i], x + bw, barY[i]);
    c.fill();
  });

  const ratio = burned > 0 ? minted / burned : null;
  if (ratio != null) {
    text(c, `${ratio.toFixed(1)}×`, CARD_W / 2, 770, { size: 76, weight: 900, color: hexGrad(c, 440, 700, 640, 780), align: 'center' });
    text(c, 'more minted than clawed back', CARD_W / 2, 812, { size: 25, color: TX_MID, align: 'center' });
  }

  const tiles = grid(PAD, 860, BOX_W, 110, 2, 1);
  statTile(c, tiles[0], { label: 'Yield claimed on ends', value: `${hexAmt(w.ends.payoutHex)} HEX`, size: 38 });
  statTile(c, tiles[1], { label: 'Good-accounted', value: `${nf(w.goodAccounted.count)} stakes`, size: 38, sub: `${hexAmt(w.goodAccounted.hex)} HEX frozen` });
}

/* ─────────────────────────── the food chain ─────────────────────────── */

function foodchainCard(c: CanvasRenderingContext2D, d: StrategistShareData, logo: HTMLImageElement | null) {
  frame(c, d, 'THE FOOD CHAIN', logo);
  if (!d.leagues) {
    text(c, MISSING, CARD_W / 2, 500, { size: 56, color: TX_DIM, align: 'center' });
    text(c, 'The league census is still loading.', CARD_W / 2, 560, { size: 26, color: TX_MID, align: 'center' });
    return;
  }
  const total = d.leagues.stakersFound;
  text(c, `${nf(total)} STAKERS, NINE LEAGUES`, CARD_W / 2, 210, { size: 21, color: TX_DIM, font: MONO, align: 'center', spacing: 3 });

  // Log-width bars: populations run 1 → 40k+, linear would erase the apex.
  const counts = LEAGUES.map((l) => d.leagues!.populations[l.key] ?? 0);
  const maxLog = Math.log10(Math.max(...counts, 10) + 1);
  const rowH = 76;
  const y0 = 258;
  const barX = PAD + 250;
  const barW = BOX_W - 250 - 130;
  LEAGUES.forEach((l, i) => {
    const y = y0 + i * rowH;
    const n = counts[i];
    hexPath(c, PAD + 26, y + 26, 24);
    c.fillStyle = `${l.color}28`;
    c.fill();
    c.lineWidth = 3.5;
    c.strokeStyle = l.color;
    c.stroke();
    text(c, l.name.toUpperCase(), PAD + 66, y + 36, { size: 26, weight: 800, color: l.color, spacing: 2 });
    const w = n > 0 ? Math.max(10, (Math.log10(n + 1) / maxLog) * barW) : 4;
    rr(c, barX, y + 12, w, 28, 9);
    c.fillStyle = `${l.color}cc`;
    c.fill();
    text(c, n > 0 ? nf(n) : '—', CARD_W - PAD, y + 36, { size: 26, weight: 700, align: 'right' });
  });
  text(c, 'bar widths are log scale — one Poseidon outweighs 33,000 Shells', CARD_W / 2, y0 + 9 * rowH + 14, {
    size: 17, color: TX_DIM, font: MONO, align: 'center',
  });
}

/* ────────────────────────────── the whales ────────────────────────────── */

function whalesCard(c: CanvasRenderingContext2D, d: StrategistShareData, logo: HTMLImageElement | null) {
  frame(c, d, 'THE WHALES', logo);
  if (!d.leagues) {
    text(c, MISSING, CARD_W / 2, 500, { size: 56, color: TX_DIM, align: 'center' });
    text(c, 'The board is still loading.', CARD_W / 2, 560, { size: 26, color: TX_MID, align: 'center' });
    return;
  }
  const top = d.leagues.rows.slice(0, 5);
  const held = top.reduce((s, r) => s + r.sharePct, 0);
  text(c, 'FIVE ADDRESSES HOLD', CARD_W / 2, 230, { size: 19, color: TX_DIM, font: MONO, align: 'center', spacing: 4 });
  text(c, `${held.toFixed(1)}%`, CARD_W / 2, 340, { size: 120, weight: 900, color: hexGrad(c, 340, 250, 740, 350), align: 'center' });
  text(c, `of all ${nf(d.leagues.networkTShares)} live T-Shares`, CARD_W / 2, 390, { size: 26, color: TX_MID, align: 'center' });

  const max = top[0]?.tShares ?? 1;
  const y0 = 460;
  const rowH = 96;
  top.forEach((r, i) => {
    const y = y0 + i * rowH;
    text(c, `#${r.rank}`, PAD, y + 34, { size: 27, weight: 900, color: i === 0 ? HEX_A : TX_DIM, font: MONO });
    text(c, `${r.address.slice(0, 6)}…${r.address.slice(-4)}`, PAD + 78, y + 34, { size: 25, color: TX_MID, font: MONO });
    const bw = Math.max(12, (r.tShares / max) * (BOX_W - 400));
    rr(c, PAD + 300, y + 12, bw, 26, 9);
    c.fillStyle = i === 0 ? hexGrad(c, PAD + 300, y, PAD + 300 + bw, y) : 'rgba(255,158,0,0.45)';
    c.fill();
    text(c, `${nf(r.tShares)} T`, CARD_W - PAD, y + 26, { size: 25, weight: 800, align: 'right' });
    text(c, `${r.sharePct.toFixed(2)}% of the network`, CARD_W - PAD, y + 54, { size: 18, color: TX_DIM, align: 'right' });
  });
}

export function drawCard(
  c: CanvasRenderingContext2D, id: string, d: StrategistShareData, logo: HTMLImageElement | null,
) {
  c.clearRect(0, 0, CARD_W, CARD_H);
  if (id === 'wall') wallCard(c, d, logo);
  else if (id === 'cliffs') cliffsCard(c, d, logo);
  else if (id === 'countdown') countdownCard(c, d, logo);
  else if (id === 'overdue') overdueCard(c, d, logo);
  else if (id === 'yield') yieldCard(c, d, logo);
  else if (id === 'flow') flowCard(c, d, logo);
  else if (id === 'pulse') pulseCard(c, d, logo);
  else if (id === 'loyalty') loyaltyCard(c, d, logo);
  else if (id === 'mint') mintCard(c, d, logo);
  else if (id === 'foodchain') foodchainCard(c, d, logo);
  else if (id === 'whales') whalesCard(c, d, logo);
  else {
    frame(c, d, '', logo);
    text(c, 'Unknown card', CARD_W / 2, 500, { size: 40, color: TX, align: 'center' });
  }
}
