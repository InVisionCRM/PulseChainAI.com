// Share cards for a staker's league standing — the picker and painter follow
// the SuperStake/token-page pattern: card definitions here, the shared modal in
// components/share renders whatever `drawCard` paints at 1080×1080.
//
// Everything on a card comes from data the Leagues tab already holds when the
// share button appears: the live on-chain standing, the mirror's board slice,
// and the loaded rates. Nothing is fetched at draw time, and a figure that
// didn't load is drawn as MISSING rather than invented.

import {
  BOX_W, CARD_H, CARD_W, MISSING, MONO, PAD, PALETTES, TX, TX_DIM, TX_MID,
  brand, chrome, fitText, gauge, grid, measure, needle, panel, rr, statTile, text,
} from '@/lib/shareCards/paint';

export { CARD_W, CARD_H };

export const BRAND_URL = 'scan.Morbius.io';

export interface ShareNeighbor {
  address: string;
  tShares: number;
}

export interface StakerShareData {
  network: 'pulsechain' | 'ethereum';
  address: string;
  /** "Aug 19, 2026" — stamped in the footer. */
  asOf: string;
  league: { name: string; color: string };
  next: { name: string; color: string } | null;
  tShares: number;
  principalHex: number;
  principalUsd: number | null;
  sharePct: number;
  rank: number | null;
  of: number | null;
  /** Progress through the current tier, 0–100. */
  progressPct: number;
  toPromotion: number | null;
  /** What promotion costs as one max-bonus stake, when rates loaded. */
  promoCostHex: number | null;
  promoCostUsd: number | null;
  stakes: number;
  board: { above: ShareNeighbor[]; below: ShareNeighbor[] } | null;
}

export interface CardKind {
  id: string;
  name: string;
  blurb: string;
}

export const CARDS: readonly CardKind[] = [
  { id: 'league', name: 'My league', blurb: 'Crest, rank, T-Shares — the flex card.' },
  { id: 'board', name: 'The board around me', blurb: 'Your slice of the ranking, rivals and gaps.' },
  { id: 'climb', name: 'The climb', blurb: 'Progress through the tier and what promotion costs.' },
] as const;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const tsh = (t: number) => (t >= 1000 ? Math.round(t).toLocaleString() : t >= 1 ? t.toFixed(1) : t.toFixed(3));
const hexAmt = (h: number) =>
  h >= 1e9 ? `${(h / 1e9).toFixed(2)}B` : h >= 1e6 ? `${(h / 1e6).toFixed(2)}M` : h >= 1e3 ? `${(h / 1e3).toFixed(1)}K` : h.toFixed(0);
const usdAmt = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;
const pctOfNetwork = (pct: number) => (pct >= 0.01 ? `${pct.toFixed(2)}%` : pct > 0 ? `${pct.toFixed(4)}%` : '0%');

/** The flat-top hexagon the LeagueCrest component uses, scaled onto canvas. */
function crest(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  const pts: [number, number][] = [[50, 3], [91, 26.5], [91, 73.5], [50, 96], [9, 73.5], [9, 26.5]];
  c.save();
  // Glow, then fill, then edge — the same halo the on-page crest carries.
  c.shadowColor = color;
  c.shadowBlur = r * 0.55;
  c.beginPath();
  pts.forEach(([x, y], i) => {
    const px = cx + ((x - 50) / 50) * r;
    const py = cy + ((y - 50) / 50) * r;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  });
  c.closePath();
  const g = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, `${color}30`);
  g.addColorStop(1, `${color}08`);
  c.fillStyle = g;
  c.fill();
  c.shadowBlur = 0;
  c.lineWidth = Math.max(5, r * 0.075);
  c.strokeStyle = color;
  c.stroke();
  c.restore();
}

function footerChrome(c: CanvasRenderingContext2D, d: StakerShareData, kicker: string, logo: HTMLImageElement | null) {
  chrome(c, {
    logo,
    logoStyle: 'plain',
    title: 'HEX Staker Leagues',
    subtitle: d.network === 'pulsechain' ? 'PulseChain' : 'Ethereum',
    kicker,
    footerLeft: BRAND_URL,
    footerRight: `${short(d.address)} · ${d.asOf}`,
  });
}

/* ─────────────────────────── the three cards ─────────────────────────── */

function leagueCard(c: CanvasRenderingContext2D, d: StakerShareData, logo: HTMLImageElement | null) {
  footerChrome(c, d, 'MY LEAGUE', logo);

  crest(c, CARD_W / 2, 400, 190, d.league.color);
  const size = fitText(c, d.league.name.toUpperCase(), BOX_W - 120, 108, 900);
  text(c, d.league.name.toUpperCase(), CARD_W / 2, 682, {
    size, weight: 900, color: d.league.color, align: 'center', spacing: 6,
  });
  if (d.rank != null && d.of != null) {
    text(c, `RANK #${d.rank.toLocaleString()} OF ${d.of.toLocaleString()} STAKERS`, CARD_W / 2, 730, {
      size: 26, color: TX_MID, font: MONO, align: 'center', spacing: 2,
    });
  }

  const tiles = grid(PAD, 790, BOX_W, 170, 3, 1);
  statTile(c, tiles[0], { label: 'T-Shares', value: tsh(d.tShares), accent: d.league.color });
  statTile(c, tiles[1], { label: 'Of the network', value: pctOfNetwork(d.sharePct) });
  statTile(c, tiles[2], {
    label: 'HEX locked',
    value: hexAmt(d.principalHex),
    sub: d.principalUsd != null ? usdAmt(d.principalUsd) : undefined,
  });
}

function boardCard(c: CanvasRenderingContext2D, d: StakerShareData, logo: HTMLImageElement | null) {
  footerChrome(c, d, 'THE BOARD', logo);

  if (!d.board || d.rank == null) {
    text(c, MISSING, CARD_W / 2, 480, { size: 56, color: TX_DIM, align: 'center' });
    text(c, 'The full ranking has not loaded for this address.', CARD_W / 2, 540, {
      size: 26, color: TX_MID, align: 'center',
    });
    return;
  }

  text(c, `#${d.rank.toLocaleString()}`, CARD_W / 2, 320, {
    size: 120, weight: 900, color: brand(c, 300, 220, 780, 320), align: 'center',
  });
  text(c, `of ${d.of!.toLocaleString()} stakers on the board`, CARD_W / 2, 368, {
    size: 27, color: TX_MID, align: 'center',
  });

  const rows: { rank: number; label: string; t: number; you: boolean; gap: number }[] = [
    ...[...d.board.above].reverse().map((n, i) => ({
      rank: d.rank! - (d.board!.above.length - i), label: short(n.address), t: n.tShares, you: false, gap: n.tShares - d.tShares,
    })),
    { rank: d.rank, label: 'YOU', t: d.tShares, you: true, gap: 0 },
    ...d.board.below.map((n, i) => ({
      rank: d.rank! + i + 1, label: short(n.address), t: n.tShares, you: false, gap: n.tShares - d.tShares,
    })),
  ];
  const max = Math.max(...rows.map((r) => r.t), 1);
  const y0 = 420;
  const rowH = 74;
  rows.forEach((r, i) => {
    const y = y0 + i * rowH;
    if (r.you) {
      rr(c, PAD - 10, y - 12, BOX_W + 20, rowH - 8, 18);
      c.fillStyle = `${d.league.color}22`;
      c.fill();
      c.strokeStyle = d.league.color;
      c.lineWidth = 3;
      c.stroke();
    }
    text(c, `#${r.rank.toLocaleString()}`, PAD + 8, y + 32, {
      size: 24, color: r.you ? TX : TX_DIM, weight: r.you ? 800 : 500, font: MONO,
    });
    text(c, r.label, PAD + 148, y + 32, {
      size: 26, weight: r.you ? 900 : 500, color: r.you ? d.league.color : TX_MID, font: r.you ? undefined : MONO,
    });
    // The local bar — scaled to this slice so the gaps are visible.
    const barX = PAD + 360;
    const barW = BOX_W - 360 - 230;
    rr(c, barX, y + 10, barW, 16, 8);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fill();
    rr(c, barX, y + 10, Math.max(10, (r.t / max) * barW), 16, 8);
    c.fillStyle = r.you ? d.league.color : 'rgba(255,255,255,0.28)';
    c.fill();
    const right = r.you
      ? `${tsh(r.t)} T`
      : r.gap > 0 ? `+${tsh(r.gap)} T` : `${tsh(-r.gap)} T back`;
    text(c, right, CARD_W - PAD - 8, y + 32, {
      size: 24, weight: r.you ? 900 : 500, color: r.you ? TX : TX_DIM, align: 'right',
    });
  });
}

function climbCard(c: CanvasRenderingContext2D, d: StakerShareData, logo: HTMLImageElement | null) {
  footerChrome(c, d, 'THE CLIMB', logo);

  if (!d.next) {
    crest(c, CARD_W / 2, 400, 170, d.league.color);
    text(c, d.league.name.toUpperCase(), CARD_W / 2, 650, {
      size: 84, weight: 900, color: d.league.color, align: 'center', spacing: 5,
    });
    text(c, 'Top of the ladder. Nothing above.', CARD_W / 2, 706, { size: 28, color: TX_MID, align: 'center' });
    return;
  }

  // The dial: how far through the tier, needle included.
  const frac = Math.max(0, Math.min(1, d.progressPct / 100));
  gauge(c, CARD_W / 2, 460, 230, frac, 34);
  needle(c, CARD_W / 2, 460, 175, frac);
  text(c, `${d.progressPct.toFixed(0)}%`, CARD_W / 2, 420, { size: 72, weight: 900, align: 'center' });
  text(c, `of the way to ${d.next.name}`, CARD_W / 2, 500, { size: 27, color: TX_MID, align: 'center' });

  text(c, d.league.name.toUpperCase(), PAD + 20, 520, { size: 30, weight: 800, color: d.league.color, spacing: 2 });
  const nextW = measure(c, d.next.name.toUpperCase(), 30, 800);
  text(c, d.next.name.toUpperCase(), CARD_W - PAD - 20 - nextW, 520, {
    size: 30, weight: 800, color: d.next.color, spacing: 2,
  });

  const tiles = grid(PAD, 600, BOX_W, 360, 2, 2);
  statTile(c, tiles[0], {
    label: `T-Shares to ${d.next.name}`,
    value: d.toPromotion != null ? tsh(d.toPromotion) : MISSING,
    accent: d.next.color,
  });
  statTile(c, tiles[1], {
    label: 'One max-bonus stake of',
    value: d.promoCostHex != null ? `${hexAmt(d.promoCostHex)} HEX` : MISSING,
    sub: d.promoCostUsd != null ? usdAmt(d.promoCostUsd) : undefined,
  });
  statTile(c, tiles[2], { label: 'Holding now', value: `${tsh(d.tShares)} T`, accent: d.league.color });
  statTile(c, tiles[3], {
    label: 'Rank',
    value: d.rank != null ? `#${d.rank.toLocaleString()}` : MISSING,
    sub: d.of != null ? `of ${d.of.toLocaleString()}` : undefined,
  });
}

export function drawCard(
  c: CanvasRenderingContext2D, id: string, d: StakerShareData, logo: HTMLImageElement | null,
) {
  c.clearRect(0, 0, CARD_W, CARD_H);
  if (id === 'league') leagueCard(c, d, logo);
  else if (id === 'board') boardCard(c, d, logo);
  else if (id === 'climb') climbCard(c, d, logo);
  else {
    chrome(c, { logo, logoStyle: 'plain', title: 'HEX Staker Leagues', kicker: '', footerLeft: BRAND_URL });
    panel(c, PAD, 400, BOX_W, 200, PALETTES.midnight);
    text(c, 'Unknown card', CARD_W / 2, 510, { size: 40, color: TX, align: 'center' });
  }
}
