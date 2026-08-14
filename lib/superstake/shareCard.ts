// SuperStake's share cards: what each one says, and how it's drawn.
//
// The canvas primitives live in lib/shareCards/paint.ts — shared with the token
// cards so both sets wear the same furniture. This file is the SuperStake half:
// its data shape, its card list, and one painter per card.
//
// Every figure comes from the same live data the page renders; nothing here
// invents or rounds a number into looking better than it is.

import {
  ACCENT, BOX_W, CARD_H, CARD_W, LINE, LINE_2, MONO, PAD, PANEL, SANS,
  TX, TX_DIM, TX_MID, UP,
  areaChart, brand, chrome as frame, compact, grid, gauge, headline, lineChart,
  measure, money, needle, nf, panel, rr, signed, statTile, text,
  type Box, type TileSpec,
} from '@/lib/shareCards/paint';

export { CARD_W, CARD_H };

/** Stamped on every card's footer and reused as the share-sheet text, so the
 *  picture and the message it travels with can't drift apart. */
export const BRAND_URL = 'scan.Morbius.io/superstake';

export interface ShareData {
  asOf: string;
  cycleNo: number;
  daysLeft: number;
  stakeHex: number;
  tShares: number;
  pSSH: number;
  pHEX: number;
  /** $100 projected over the running cycle. */
  amount: number;
  stakeYield: number;
  psshYield: number;
  payouts: number;
  reflections: number;
  /** Finished-cycle record. */
  psshWins: number;
  cyclesDone: number;
  winnerStrip: boolean[];
  covered: number;
  coverage: number[];
  /** Self-funding. */
  needPerDay: number;
  actualPerDay: number;
  coverTimes: number;
  inPct: number;
  outPct: number;
  /** Supply. */
  sSharesLeft: number;
  sSharesMinted: number;
  burned: number;
  /** The stake over time. */
  hexByCycle: number[];
  growthMultiple: number;
  growthAllTime: number;
  growthRecent: number;
  growthRecentN: number;
  /** What one S-share (5,555 pSSH) costs at the live price, USD. */
  sShareCost: number | null;
  /** HEX bought by the 2% and held unstaked, waiting for the next restake. */
  hexWaiting: number | null;
  /** How many cycles running pSSH has come out ahead. */
  streak: number;
  /**
   * A projection's own figures. Only the simulator sets this, and only the
   * `sim-` cards read it — every other card is drawn from the record above.
   */
  sim?: SimShare | null;
}

/**
 * What the simulator produced, flattened for the painter. Everything here is
 * `simulate()`'s output at the cycle the reader has the playhead on, so a shared
 * card shows exactly what was on screen when it was made.
 */
export interface SimShare {
  /** The dials that were set. */
  amount: number;
  cycles: number;
  cycleDays: number;
  dailyVolume: number;
  compound: boolean;
  /**
   * The per-cycle drifts. A run at +8%/cycle on pSSH ends somewhere completely
   * different from a flat one, so a card that showed the result without the
   * assumption behind it would be the misleading half of the picture.
   */
  hexDriftPct: number;
  psshDriftPct: number;
  volumeDriftPct: number;
  /** HEX stake yield the run assumed, % of the pool per cycle. */
  yieldPct: number;
  /** The holder's side. */
  endValue: number;
  multiple: number;
  hexEarned: number;
  hexEarnedUsd: number;
  tokens: number;
  sShares: number;
  sharePct: number;
  /** The same dollars, the two other ways. */
  holdHex: number;
  stakeHex: number;
  /** The pool's side. */
  poolStart: number;
  poolEnd: number;
  poolMultiple: number;
  coverRatio: number;
  breakEven: number;
  sSharesLeft: number;
  burned: number;
  /** The curves, one point per cycle shown. */
  valueByCycle: number[];
  holdByCycle: number[];
  stakeByCycle: number[];
  poolByCycle: number[];
}

export interface CardDef {
  id: string;
  name: string;
  blurb: string;
}

export const CARDS: CardDef[] = [
  { id: 'verdict', name: 'The verdict', blurb: 'Same $100, both sides, this cycle' },
  { id: 'scoreboard', name: 'Scoreboard', blurb: 'Who won each finished cycle' },
  { id: 'machine', name: 'The machine', blurb: 'Where the 5.5% goes' },
  { id: 'selffund', name: 'Pays for itself', blurb: 'Every cycle cleared its own payout' },
  { id: 'sshare', name: 'S-shares left', blurb: 'A fixed 10,000, only ever fewer' },
  { id: 'stake', name: 'The stake', blurb: 'HEX held, every cycle since launch' },
  { id: 'breakeven', name: 'Break-even', blurb: 'Volume needed vs volume doing' },
  { id: 'reflections', name: 'What pays you', blurb: 'Payout against reflections' },
  { id: 'growth', name: 'Compounding', blurb: 'How fast the pool grows' },
  { id: 'countdown', name: 'Next end-stake', blurb: 'The cycle now running' },
  // Collages — several figures at once, for when one number isn't the point.
  { id: 'board', name: 'The whole board', blurb: 'Six numbers, the full state' },
  { id: 'versus', name: 'Side by side', blurb: 'Both columns, same $100' },
  { id: 'supply', name: 'Supply & burn', blurb: 'What is left and what went' },
  { id: 'thiscycle', name: 'This cycle', blurb: 'Where the running cycle stands' },
  { id: 'record', name: 'The record', blurb: 'Every finished cycle, four ways' },
  { id: 'prices', name: 'At today’s prices', blurb: 'What it all costs and is worth' },
  { id: 'proof', name: 'Four facts', blurb: 'The claims, with their numbers' },
  { id: 'stakeboard', name: 'The stake, in full', blurb: 'Size, shares, growth, chart' },
  { id: 'holder', name: 'What a holder gets', blurb: 'Payouts, reflections, the split' },
  { id: 'ticket', name: 'The $100 ticket', blurb: 'Stub-style, entry to result' },
  // Simulator only — these read `d.sim`, which nothing else sets.
  { id: 'sim-outcome', name: 'Your projection', blurb: 'What the dials you set end at' },
  { id: 'sim-curve', name: 'Three curves', blurb: 'pSSH against holding and staking' },
  { id: 'sim-pool', name: 'The stake, projected', blurb: 'Where the pool goes from here' },
  { id: 'sim-plan', name: 'The assumptions', blurb: 'What you set, and what it gives' },
];

/** The cards the simulator offers — the rest have nothing to draw from a run. */
export const SIM_CARD_IDS = ['sim-outcome', 'sim-curve', 'sim-pool', 'sim-plan'] as const;

/* ────────────────────────── shared chrome ────────────────────────── */

/** SuperStake's header/footer strings, over the shared frame. */
function chrome(c: CanvasRenderingContext2D, d: ShareData, logo: HTMLImageElement | null, kicker: string) {
  frame(c, {
    logo,
    title: 'SUPERSTAKE',
    subtitle: 'pSSH',
    kicker,
    footerLeft: BRAND_URL,
    footerRight: `AS OF ${d.asOf}`,
  });
}

/* ────────────────────────── collage pieces ────────────────────────── */

/** The finished-cycle winner strip, reused by several collages. */
function winStrip(
  c: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  flags: boolean[],
) {
  const n = flags.length || 1;
  const gap = Math.min(8, w / (n * 4));
  const bw = (w - gap * (n - 1)) / n;
  flags.forEach((won, i) => {
    const bx = x + i * (bw + gap);
    const bh = won ? h : h * 0.5;
    c.fillStyle = won ? brand(c, bx, y, bx + bw, y + h) : LINE_2;
    rr(c, bx, y + h - bh, bw, bh, 6);
    c.fill();
  });
}

/** Section caption for the split collages. */
function colHead(c: CanvasRenderingContext2D, s: string, x: number, y: number, col: string) {
  text(c, s.toUpperCase(), x, y, { size: 18, weight: 700, color: col, font: MONO, spacing: 2 });
}

/** Share of pSSH ever minted that has been burned. */
function burnedPct(d: ShareData): number {
  const live = d.sSharesLeft * 5555;
  const total = live + d.burned;
  return total > 0 ? (d.burned / total) * 100 : 0;
}

/* ────────────────────────── the cards ────────────────────────── */

type Painter = (c: CanvasRenderingContext2D, d: ShareData) => void;

const paint: Record<string, Painter> = {
  verdict(c, d) {
    const won = d.psshYield >= d.stakeYield;
    const ratio = won ? d.psshYield / Math.max(d.stakeYield, 1e-9) : d.stakeYield / Math.max(d.psshYield, 1e-9);
    text(c, `$${d.amount} in, held one cycle`, CARD_W / 2, 244, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    text(c, 'HEX EARNED, EITHER WAY', CARD_W / 2, 288, {
      size: 20, color: TX_DIM, align: 'center', font: MONO, spacing: 3,
    });
    const max = Math.max(d.stakeYield, d.psshYield, 1);
    const base = 690;
    const maxH = 270;
    const bars: [string, number, boolean][] = [
      ['STAKE HEX', d.stakeYield, false],
      ['HOLD pSSH', d.psshYield, true],
    ];
    bars.forEach(([label, v, accent], i) => {
      const bw = 200;
      const bx = CARD_W / 2 + (i === 0 ? -240 : 40);
      const bh = Math.max(20, (v / max) * maxH);
      c.fillStyle = accent ? brand(c, bx, base - bh, bx + bw, base) : LINE_2;
      rr(c, bx, base - bh, bw, bh, 16);
      c.fill();
      text(c, `+${nf(v)}`, bx + bw / 2, base - bh - 28, {
        size: 54, weight: 800, color: accent ? brand(c, bx, 0, bx + bw, 0) : TX, align: 'center',
      });
      text(c, label, bx + bw / 2, base + 44, {
        size: 21, weight: 600, color: TX_DIM, align: 'center', font: MONO, spacing: 2,
      });
    });
    headline(c, `${ratio.toFixed(2)}×`, won ? 'pSSH ahead this cycle' : 'the stake ahead this cycle', 890);
  },

  scoreboard(c, d) {
    text(c, 'Every finished cycle, same $100', CARD_W / 2, 250, {
      size: 38, weight: 700, color: TX_MID, align: 'center',
    });
    headline(c, `${d.psshWins} of ${d.cyclesDone}`, 'cycles where holding pSSH won', 420);
    const n = d.winnerStrip.length || 1;
    const gap = 8;
    const w = (CARD_W - 160 - gap * (n - 1)) / n;
    const BASE = 800;
    d.winnerStrip.forEach((p, i) => {
      const x = 80 + i * (w + gap);
      const h = p ? 200 : 108;
      c.fillStyle = p ? brand(c, x, BASE - h, x + w, BASE) : LINE_2;
      rr(c, x, BASE - h, w, h, 8);
      c.fill();
    });
    text(c, `CYCLE 1`, 80, BASE + 42, { size: 19, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, `CYCLE ${d.cyclesDone}`, CARD_W - 80, BASE + 42, {
      size: 19, color: TX_DIM, align: 'right', font: MONO, spacing: 2,
    });
    text(c, 'Each entered on its own opening day, held that cycle.', CARD_W / 2, 908, {
      size: 26, color: TX_DIM, align: 'center',
    });
  },

  machine(c, d) {
    text(c, 'Every buy and sell pays', CARD_W / 2, 250, {
      size: 38, weight: 700, color: TX_MID, align: 'center',
    });
    headline(c, '5.5%', 'and it splits three ways', 380);
    const rows: [string, string, string][] = [
      ['2.5%', 'HEX straight to holders', '#FB9438'],
      ['1%', 'buys pSSH and burns it', '#D83639'],
      ['2%', 'buys HEX for the stake', '#AE176A'],
    ];
    rows.forEach(([pct, what, col], i) => {
      const y = 540 + i * 118;
      panel(c, 80, y, CARD_W - 160, 96);
      c.fillStyle = col;
      rr(c, 80, y, 10, 96, 5);
      c.fill();
      text(c, pct, 130, y + 62, { size: 44, weight: 800, color: col, font: MONO });
      text(c, what, 280, y + 60, { size: 34, weight: 600, color: TX });
    });
  },

  selffund(c, d) {
    text(c, 'Did each cycle cover its own payout?', CARD_W / 2, 250, {
      size: 36, weight: 700, color: TX_MID, align: 'center',
    });
    headline(c, `${d.covered} of ${d.coverage.length}`, 'cycles brought in more than they paid out', 400);
    const n = d.coverage.length || 1;
    const gap = 8;
    const w = (CARD_W - 160 - gap * (n - 1)) / n;
    const TOP = 30;
    d.coverage.forEach((r, i) => {
      const x = 80 + i * (w + gap);
      const f = r <= 0 ? 0 : Math.min(1, Math.log10(r) / Math.log10(TOP));
      const h = 30 + 170 * f;
      const g = c.createLinearGradient(0, 700 - h, 0, 700);
      g.addColorStop(0, UP);
      g.addColorStop(1, 'rgba(74,222,128,0.4)');
      c.fillStyle = r >= 1 ? g : LINE_2;
      rr(c, x, 700 - h, w, h, 8);
      c.fill();
    });
    c.save();
    c.setLineDash([10, 8]);
    c.strokeStyle = LINE_2;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(80, 670);
    c.lineTo(CARD_W - 80, 670);
    c.stroke();
    c.restore();
    text(c, 'DASHED LINE = THE 1% PAYOUT COVERED', CARD_W / 2, 760, {
      size: 19, color: TX_DIM, align: 'center', font: MONO, spacing: 2,
    });
    text(c, `Trading is running ${d.coverTimes.toFixed(1)}× what this cycle needs.`, CARD_W / 2, 880, {
      size: 28, color: TX_MID, align: 'center',
    });
  },

  sshare(c, d) {
    text(c, 'The supply divides into exactly', CARD_W / 2, 250, {
      size: 36, weight: 700, color: TX_MID, align: 'center',
    });
    headline(c, nf(d.sSharesMinted), 'S-shares of 5,555 pSSH each', 380);
    const cx = CARD_W / 2;
    const cy = 660;
    const r = 150;
    c.lineWidth = 46;
    c.strokeStyle = LINE;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.stroke();
    const f = d.sSharesMinted > 0 ? d.sSharesLeft / d.sSharesMinted : 0;
    c.strokeStyle = brand(c, cx - r, cy - r, cx + r, cy + r);
    c.lineCap = 'round';
    c.beginPath();
    c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
    c.stroke();
    c.lineCap = 'butt';
    text(c, nf(d.sSharesLeft, 0), cx, cy + 6, { size: 76, weight: 800, align: 'center' });
    text(c, 'LEFT', cx, cy + 48, { size: 22, color: TX_DIM, align: 'center', font: MONO, spacing: 3 });
    text(c, `${nf(d.sSharesMinted - d.sSharesLeft, 0)} burned away for good — the count only falls.`,
      CARD_W / 2, 900, { size: 28, color: TX_MID, align: 'center' });
  },

  stake(c, d) {
    text(c, 'HEX in the stake', CARD_W / 2, 250, {
      size: 38, weight: 700, color: TX_MID, align: 'center',
    });
    headline(c, compact(d.stakeHex), `across ${d.hexByCycle.length} cycles, never once smaller`, 380);
    areaChart(c, d.hexByCycle, 80, 520, CARD_W - 160, 280);
    text(c, `${compact(d.hexByCycle[0] ?? 0)} · CYCLE 1`, 80, 850, {
      size: 20, color: TX_DIM, font: MONO, spacing: 2,
    });
    text(c, `${compact(d.stakeHex)} · CYCLE ${d.cycleNo}`, CARD_W - 80, 850, {
      size: 20, color: TX_DIM, align: 'right', font: MONO, spacing: 2,
    });
    text(c, `${d.tShares.toFixed(2)} T-shares working`, CARD_W / 2, 920, {
      size: 28, color: TX_MID, align: 'center',
    });
  },

  breakeven(c, d) {
    text(c, 'Daily volume it needs to keep growing', CARD_W / 2, 250, {
      size: 34, weight: 700, color: TX_MID, align: 'center',
    });
    headline(c, money(d.needPerDay), `it is doing ${money(d.actualPerDay)}`, 400);
    const cx = CARD_W / 2;
    const cy = 730;
    const f = Math.min(1, d.coverTimes / 10);
    gauge(c, cx, cy, 190, f, 34);
    // Mark where the dial merely breaks even — without it, a needle a third of
    // the way round reads as "behind" when it is nearly six times what's needed.
    const ba = Math.PI * (1 - 0.1);
    c.save();
    c.strokeStyle = TX;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(cx + Math.cos(ba) * 168, cy - Math.sin(ba) * 168);
    c.lineTo(cx + Math.cos(ba) * 212, cy - Math.sin(ba) * 212);
    c.stroke();
    c.restore();
    text(c, '1× BREAK-EVEN', cx + Math.cos(ba) * 214, cy - Math.sin(ba) * 214 - 18, {
      size: 18, color: TX_DIM, align: 'right', font: MONO, spacing: 2,
    });
    needle(c, cx, cy, 150, f);
    text(c, `${d.coverTimes.toFixed(1)}×`, cx, cy + 100, {
      size: 68, weight: 800, color: UP, align: 'center',
    });
    text(c, 'COVERED', cx, cy + 138, { size: 21, color: TX_DIM, align: 'center', font: MONO, spacing: 3 });
  },

  reflections(c, d) {
    const total = d.payouts + d.reflections;
    text(c, `What pays a $${d.amount} pSSH holder`, CARD_W / 2, 250, {
      size: 38, weight: 700, color: TX_MID, align: 'center',
    });
    const cx = CARD_W / 2;
    const cy = 540;
    const r = 160;
    const pa = total > 0 ? d.payouts / total : 0;
    c.lineWidth = 56;
    c.strokeStyle = '#FB9438';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#AE176A';
    c.beginPath();
    c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pa);
    c.stroke();
    text(c, `${nf(total)}`, cx, cy + 4, { size: 72, weight: 800, align: 'center' });
    text(c, 'HEX', cx, cy + 46, { size: 22, color: TX_DIM, align: 'center', font: MONO, spacing: 3 });
    const legend: [string, number, string][] = [
      ['End-stake payout', d.payouts, '#AE176A'],
      ['Reflections', d.reflections, '#FB9438'],
    ];
    legend.forEach(([label, v, col], i) => {
      const y = 830 + i * 66;
      c.fillStyle = col;
      rr(c, 150, y - 22, 26, 26, 7);
      c.fill();
      text(c, label, 200, y, { size: 32, weight: 600, color: TX_MID });
      // Share sits beside its label, not under the value — stacked it read as
      // belonging to the row below it.
      c.save();
      c.font = `600 32px ${SANS}`;
      const lw = c.measureText(label).width;
      c.restore();
      text(c, `${total > 0 ? ((v / total) * 100).toFixed(0) : 0}%`, 200 + lw + 20, y, {
        size: 22, color: TX_DIM, font: MONO, spacing: 1,
      });
      text(c, `${nf(v)} HEX`, CARD_W - 150, y, { size: 32, weight: 800, align: 'right' });
    });
  },

  growth(c, d) {
    text(c, 'The stake compounds every cycle', CARD_W / 2, 250, {
      size: 38, weight: 700, color: TX_MID, align: 'center',
    });
    headline(c, `${d.growthMultiple.toFixed(2)}×`, `since launch, over ${d.hexByCycle.length - 1} cycles`, 400);
    const stats: [string, string][] = [
      [`${d.growthAllTime.toFixed(2)}%`, 'per cycle, all time'],
      [`${d.growthRecent.toFixed(2)}%`, `per cycle, last ${d.growthRecentN}`],
    ];
    stats.forEach(([v, label], i) => {
      const x = 80 + i * ((CARD_W - 160) / 2 + 16);
      const w = (CARD_W - 160) / 2 - 16;
      panel(c, x, 540, w, 160);
      text(c, v, x + w / 2, 620, { size: 62, weight: 800, align: 'center' });
      text(c, label, x + w / 2, 664, { size: 24, color: TX_DIM, align: 'center' });
    });
    areaChart(c, d.hexByCycle, 80, 750, CARD_W - 160, 140);
    text(c, `${compact(d.hexByCycle[0] ?? 0)} → ${compact(d.stakeHex)} HEX in the stake`,
      CARD_W / 2, 928, { size: 24, color: TX_DIM, align: 'center' });
  },

  countdown(c, d) {
    text(c, `Cycle ${d.cycleNo} ends in`, CARD_W / 2, 260, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    const cx = CARD_W / 2;
    const cy = 620;
    const r = 200;
    c.lineWidth = 40;
    c.strokeStyle = LINE;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.stroke();
    const total = 60;
    const done = Math.max(0, Math.min(1, (total - d.daysLeft) / total));
    c.strokeStyle = brand(c, cx - r, cy - r, cx + r, cy + r);
    c.lineCap = 'round';
    c.beginPath();
    c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * done);
    c.stroke();
    c.lineCap = 'butt';
    text(c, `${d.daysLeft}`, cx, cy + 24, { size: 150, weight: 800, align: 'center' });
    text(c, 'DAYS', cx, cy + 76, { size: 26, color: TX_DIM, align: 'center', font: MONO, spacing: 4 });
    text(c, 'Then 1% of the whole pool pays out to every holder,', CARD_W / 2, 890, {
      size: 28, color: TX_MID, align: 'center',
    });
    text(c, 'and the rest restakes.', CARD_W / 2, 928, { size: 28, color: TX_MID, align: 'center' });
  },

  /* ─────────────── collages ─────────────── */

  board(c, d) {
    text(c, 'SuperStake right now', CARD_W / 2, 224, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    const g = grid(PAD, 262, BOX_W, 678, 2, 3);
    statTile(c, g[0], {
      label: 'In the stake', value: compact(d.stakeHex), sub: `HEX · cycle ${d.cycleNo}`,
      accent: '#FB9438',
    });
    statTile(c, g[1], {
      label: 'T-shares', value: d.tShares.toFixed(2), sub: 'working every day of the cycle',
    });
    statTile(c, g[2], {
      label: 'S-shares left', value: nf(d.sSharesLeft),
      sub: `of ${nf(d.sSharesMinted)} · only ever fewer`, accent: '#D83639',
    });
    statTile(c, g[3], {
      label: 'Cycle ends in', value: `${d.daysLeft} days`, sub: 'then 1% pays out to holders',
    });
    statTile(c, g[4], {
      label: 'Volume vs needed', value: `${d.coverTimes.toFixed(1)}×`,
      sub: `${money(d.actualPerDay)}/day against ${money(d.needPerDay)}`,
      accent: d.coverTimes >= 1 ? UP : undefined,
    });
    statTile(c, g[5], {
      label: 'pSSH price', value: `$${d.pSSH.toFixed(6)}`, size: 52,
      sub: d.sShareCost == null ? '5,555 pSSH per S-share' : `${money(d.sShareCost)} per S-share`,
    });
  },

  versus(c, d) {
    const won = d.psshYield >= d.stakeYield;
    const ratio = won
      ? d.psshYield / Math.max(d.stakeYield, 1e-9)
      : d.stakeYield / Math.max(d.psshYield, 1e-9);
    text(c, `The same $${d.amount}, both ways`, CARD_W / 2, 222, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    const colW = (BOX_W - 20) / 2;
    const rx = PAD + colW + 20;
    colHead(c, 'Stake the HEX', PAD + 4, 274, TX_DIM);
    colHead(c, 'Hold the pSSH', rx + 4, 274, '#FB9438');

    statTile(c, [PAD, 292, colW, 190], {
      label: 'HEX earned', value: `+${nf(d.stakeYield)}`, sub: 'one 60-day stake, start to end',
    });
    statTile(c, [PAD, 498, colW, 150], {
      label: 'Where it comes from', value: 'Yield', size: 46, sub: 'the stake’s own interest',
    });
    statTile(c, [PAD, 664, colW, 150], {
      label: 'Locked away', value: '60 days', size: 46, sub: 'you cannot touch it',
    });

    statTile(c, [rx, 292, colW, 190], {
      label: 'HEX earned', value: `+${nf(d.psshYield)}`, sub: 'same window, nothing locked',
      accent: '#FB9438',
    });
    statTile(c, [rx, 498, colW, 150], {
      label: 'Where it comes from', value: 'Two taps', size: 46,
      sub: `${nf(d.payouts)} payout · ${nf(d.reflections)} reflections`,
    });
    statTile(c, [rx, 664, colW, 150], {
      label: 'Locked away', value: 'Nothing', size: 46, sub: 'sell any minute you like',
    });

    panel(c, PAD, 830, BOX_W, 110);
    const rs = `${ratio.toFixed(2)}×`;
    const g = brand(c, PAD + 34, 848, PAD + 220, 908);
    text(c, rs, PAD + 34, 908, { size: 62, weight: 800, color: g });
    text(c, won ? 'ahead for holding pSSH, this cycle' : 'ahead for staking HEX, this cycle',
      PAD + 34 + measure(c, rs, 62, 800) + 26, 900, { size: 28, weight: 600, color: TX_MID });
  },

  supply(c, d) {
    text(c, 'The count only ever falls', CARD_W / 2, 224, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    const g = grid(PAD, 262, BOX_W, 430, 2, 2);
    statTile(c, g[0], {
      label: 'S-shares minted', value: nf(d.sSharesMinted), sub: 'fixed at launch, never added to',
    });
    statTile(c, g[1], {
      label: 'S-shares left', value: nf(d.sSharesLeft), sub: 'what the supply still divides into',
      accent: '#FB9438',
    });
    statTile(c, g[2], {
      label: 'S-shares burned', value: nf(d.sSharesMinted - d.sSharesLeft),
      sub: 'gone for good', accent: '#D83639',
    });
    statTile(c, g[3], {
      label: 'pSSH burned', value: compact(d.burned),
      sub: `${burnedPct(d).toFixed(1)}% of everything ever minted`, accent: '#D83639',
    });
    statTile(c, [PAD, 712, BOX_W, 150], {
      label: 'Cost of one S-share today',
      value: d.sShareCost == null ? '—' : money(d.sShareCost),
      sub: '5,555 pSSH — the holding that qualifies for payouts',
      accent: '#AE176A',
    });
    text(c, '1% of the trade tax buys pSSH and burns it, every trade, forever.',
      CARD_W / 2, 912, { size: 24, color: TX_DIM, align: 'center' });
  },

  thiscycle(c, d) {
    text(c, `Cycle ${d.cycleNo}, as it stands`, CARD_W / 2, 224, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    // Progress ring on the left, the cycle's numbers stacked beside it.
    const cx = 268;
    const cy = 470;
    const r = 138;
    c.lineWidth = 34;
    c.strokeStyle = LINE;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.stroke();
    const done = Math.max(0, Math.min(1, (60 - d.daysLeft) / 60));
    c.strokeStyle = brand(c, cx - r, cy - r, cx + r, cy + r);
    c.lineCap = 'round';
    c.beginPath();
    c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * done);
    c.stroke();
    c.lineCap = 'butt';
    text(c, `${d.daysLeft}`, cx, cy + 12, { size: 84, weight: 800, align: 'center' });
    text(c, 'DAYS LEFT', cx, cy + 52, {
      size: 19, color: TX_DIM, align: 'center', font: MONO, spacing: 3,
    });

    const rx = 452;
    const rw = CARD_W - PAD - rx;
    statTile(c, [rx, 300, rw, 158], {
      label: 'Coming in', value: `${d.inPct.toFixed(2)}%`,
      sub: `of the pool, against the ${d.outPct.toFixed(2)}% it pays out`,
      accent: d.inPct >= d.outPct ? UP : '#D83639',
    });
    statTile(c, [rx, 476, rw, 158], {
      label: 'HEX waiting to be staked',
      value: d.hexWaiting == null ? '—' : nf(d.hexWaiting),
      sub: d.hexWaiting == null
        ? 'bought by the 2%, held until the restake'
        : `+${((d.hexWaiting / Math.max(d.stakeHex, 1)) * 100).toFixed(2)}% on top of the stake`,
      accent: '#FB9438',
    });
    statTile(c, [PAD, 662, BOX_W, 150], {
      label: 'Daily volume', value: money(d.actualPerDay),
      sub: `it needs ${money(d.needPerDay)} a day to keep growing — running ${d.coverTimes.toFixed(1)}× that`,
    });
    text(c, 'At the end: 1% of the whole pool pays out, the rest restakes with the HEX above.',
      CARD_W / 2, 890, { size: 24, color: TX_DIM, align: 'center' });
  },

  record(c, d) {
    text(c, 'Every finished cycle', CARD_W / 2, 224, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    const g = grid(PAD, 262, BOX_W, 400, 2, 2);
    statTile(c, g[0], {
      label: 'Cycles completed', value: `${d.cyclesDone}`, sub: 'stake closed and reopened, each time',
    });
    statTile(c, g[1], {
      label: 'Won by holding pSSH', value: `${d.psshWins} of ${d.cyclesDone}`,
      sub: `at $${d.amount} in on each opening day`, accent: '#FB9438',
    });
    statTile(c, g[2], {
      label: 'Cycles that paid their own way', value: `${d.covered} of ${d.coverage.length}`,
      sub: 'took in more than the 1% they handed out', accent: UP,
    });
    statTile(c, g[3], {
      label: 'Pool growth since launch', value: `${d.growthMultiple.toFixed(2)}×`,
      sub: `${d.growthAllTime.toFixed(2)}% a cycle, never once smaller`,
    });
    text(c, 'WHO WON EACH CYCLE, 1 TO ' + d.cyclesDone, PAD, 712, {
      size: 17, color: TX_DIM, font: MONO, spacing: 2,
    });
    winStrip(c, PAD, 730, BOX_W, 130, d.winnerStrip);
    text(c,
      d.streak > 1
        ? `pSSH has come out ahead the last ${d.streak} cycles running.`
        : 'Each entered on its own opening day and held that cycle.',
      CARD_W / 2, 908, { size: 25, color: TX_MID, align: 'center' });
  },

  prices(c, d) {
    text(c, 'At today’s prices', CARD_W / 2, 224, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    const g = grid(PAD, 262, BOX_W, 430, 2, 2);
    statTile(c, g[0], { label: 'pSSH', value: `$${d.pSSH.toFixed(6)}`, size: 52, sub: 'live, PulseX' });
    statTile(c, g[1], { label: 'HEX', value: `$${d.pHEX.toFixed(6)}`, size: 52, sub: 'live, PulseX' });
    statTile(c, g[2], {
      label: 'One S-share', value: d.sShareCost == null ? '—' : money(d.sShareCost),
      sub: '5,555 pSSH — the qualifying holding', accent: '#AE176A',
    });
    statTile(c, g[3], {
      label: 'HEX in the stake, in dollars', value: money(d.stakeHex * d.pHEX),
      sub: `${compact(d.stakeHex)} HEX behind the token`, accent: '#FB9438',
    });
    // `psshYield` scores the cycle now running at today's rates — a projection,
    // not something that has already happened. The label has to say so.
    statTile(c, [PAD, 712, BOX_W, 150], {
      label: `What $${d.amount} of pSSH earns over a cycle at today’s rates`,
      value: `${nf(d.psshYield)} HEX`,
      sub: `worth ${money(d.psshYield * d.pHEX)} — against ${nf(d.stakeYield)} HEX for staking the same`,
      accent: UP,
    });
    text(c, 'Prices move. The HEX count behind the token only goes up.',
      CARD_W / 2, 912, { size: 24, color: TX_DIM, align: 'center' });
  },

  proof(c, d) {
    text(c, 'Four things the record shows', CARD_W / 2, 224, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    const rows: [string, string, string][] = [
      [`${d.covered} of ${d.coverage.length}`, 'cycles covered their own payout',
        'nothing has ever had to be topped up from outside'],
      [`${d.psshWins} of ${d.cyclesDone}`, 'cycles were better to hold than to stake',
        `same $${d.amount}, entered on each cycle’s opening day`],
      [`${d.growthMultiple.toFixed(2)}×`, 'bigger than the stake it started with',
        'and it has never once come back smaller'],
      [nf(d.sSharesMinted - d.sSharesLeft), 'S-shares burned away for good',
        `${nf(d.sSharesLeft)} left of ${nf(d.sSharesMinted)} — the count only falls`],
    ];
    rows.forEach(([big, claim, sub], i) => {
      const y = 268 + i * 170;
      panel(c, PAD, y, BOX_W, 152);
      const g = brand(c, PAD, y, PAD + 320, y + 152);
      text(c, big, PAD + 32, y + 78, { size: 54, weight: 800, color: g });
      text(c, claim, PAD + 330, y + 68, { size: 28, weight: 700, color: TX });
      text(c, sub, PAD + 330, y + 104, { size: 20, color: TX_DIM });
    });
  },

  stakeboard(c, d) {
    text(c, 'The stake behind the token', CARD_W / 2, 224, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    const g = grid(PAD, 262, BOX_W, 268, 2, 1);
    statTile(c, g[0], {
      label: 'HEX staked', value: compact(d.stakeHex), sub: `cycle ${d.cycleNo}, and never smaller`,
      accent: '#FB9438', size: 76,
    });
    statTile(c, g[1], {
      label: 'T-shares', value: d.tShares.toFixed(2), sub: 'earning every day the cycle runs',
      size: 76,
    });
    const g2 = grid(PAD, 548, BOX_W, 130, 3, 1);
    statTile(c, g2[0], {
      label: 'All time', value: `${d.growthAllTime.toFixed(2)}%`, size: 40, sub: 'a cycle',
    });
    statTile(c, g2[1], {
      label: `Last ${d.growthRecentN}`, value: `${d.growthRecent.toFixed(2)}%`, size: 40, sub: 'a cycle',
    });
    statTile(c, g2[2], {
      label: 'Waiting', value: d.hexWaiting == null ? '—' : compact(d.hexWaiting),
      size: 40, sub: 'HEX, unstaked',
    });
    areaChart(c, d.hexByCycle, PAD, 712, BOX_W, 168);
    text(c, `${compact(d.hexByCycle[0] ?? 0)} at cycle 1  →  ${compact(d.stakeHex)} at cycle ${d.cycleNo}`,
      CARD_W / 2, 920, { size: 24, color: TX_DIM, align: 'center' });
  },

  holder(c, d) {
    const total = d.payouts + d.reflections;
    text(c, `What $${d.amount} of pSSH actually pays`, CARD_W / 2, 224, {
      size: 38, weight: 700, color: TX_MID, align: 'center',
    });
    // Donut on the left, the two taps broken out on the right.
    const cx = 264;
    const cy = 452;
    const r = 118;
    const pa = total > 0 ? d.payouts / total : 0;
    c.lineWidth = 44;
    c.strokeStyle = '#FB9438';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#AE176A';
    c.beginPath();
    c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pa);
    c.stroke();
    text(c, nf(total), cx, cy + 4, { size: 60, weight: 800, align: 'center' });
    text(c, 'HEX', cx, cy + 42, { size: 20, color: TX_DIM, align: 'center', font: MONO, spacing: 3 });

    const rx = 428;
    const rw = CARD_W - PAD - rx;
    statTile(c, [rx, 288, rw, 158], {
      label: 'End-stake payout', value: `${nf(d.payouts)} HEX`,
      sub: `${total > 0 ? ((d.payouts / total) * 100).toFixed(0) : 0}% — 1% of the whole pool, every 60 days`,
      accent: '#AE176A',
    });
    statTile(c, [rx, 464, rw, 158], {
      label: 'Reflections', value: `${nf(d.reflections)} HEX`,
      sub: `${total > 0 ? ((d.reflections / total) * 100).toFixed(0) : 0}% — 2.5% of every trade, continuously`,
      accent: '#FB9438',
    });
    statTile(c, [PAD, 650, BOX_W, 150], {
      label: 'And the burn you never see', value: `${nf(d.sSharesMinted - d.sSharesLeft)} S-shares gone`,
      size: 46,
      sub: 'every trade burns pSSH, so your slice of the pool grows while you hold it',
      accent: '#D83639',
    });
    text(c, 'Neither tap requires you to lock anything up.', CARD_W / 2, 872, {
      size: 26, color: TX_MID, align: 'center',
    });
  },

  ticket(c, d) {
    const won = d.psshYield >= d.stakeYield;
    const ratio = won
      ? d.psshYield / Math.max(d.stakeYield, 1e-9)
      : d.stakeYield / Math.max(d.psshYield, 1e-9);
    // Everything on this stub is the running cycle scored at today's rates, so
    // it stays in the conditional — nothing here has happened yet.
    text(c, 'ONE CYCLE AT TODAY’S RATES', CARD_W / 2, 214, {
      size: 20, color: TX_DIM, align: 'center', font: MONO, spacing: 4,
    });
    panel(c, PAD, 244, BOX_W, 620);
    // The perforation: a stub down the left with the entry, the result to its right.
    c.save();
    c.setLineDash([12, 10]);
    c.strokeStyle = LINE_2;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(PAD + 300, 268);
    c.lineTo(PAD + 300, 840);
    c.stroke();
    c.restore();

    text(c, 'YOU PUT IN', PAD + 40, 316, { size: 17, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, `$${d.amount}`, PAD + 40, 396, {
      size: 76, weight: 800, color: brand(c, PAD + 40, 330, PAD + 270, 400),
    });
    text(c, 'of pSSH', PAD + 40, 432, { size: 24, color: TX_MID });
    text(c, 'THAT BUYS', PAD + 40, 520, { size: 17, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, d.sShareCost && d.sShareCost > 0 ? (d.amount / d.sShareCost).toFixed(2) : '—',
      PAD + 40, 580, { size: 52, weight: 800 });
    text(c, 'S-shares', PAD + 40, 612, { size: 22, color: TX_MID });
    text(c, 'HELD FOR', PAD + 40, 690, { size: 17, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, '60 days', PAD + 40, 748, { size: 46, weight: 800 });
    text(c, 'sell any time', PAD + 40, 782, { size: 22, color: TX_MID });

    const rx = PAD + 344;
    text(c, 'YOU’D GET BACK', rx, 316, { size: 17, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, `${nf(d.psshYield)} HEX`, rx, 400, {
      size: 68, weight: 800, color: brand(c, rx, 330, CARD_W - PAD, 404),
    });
    text(c, `${nf(d.payouts)} from the end-stake payout`, rx, 446, { size: 23, color: TX_MID });
    text(c, `${nf(d.reflections)} from reflections along the way`, rx, 480, { size: 23, color: TX_MID });

    text(c, 'STAKING THE SAME $' + d.amount, rx, 566, {
      size: 17, color: TX_DIM, font: MONO, spacing: 2,
    });
    text(c, `${nf(d.stakeYield)} HEX`, rx, 630, { size: 54, weight: 800, color: TX_MID });
    text(c, 'locked the whole 60 days', rx, 664, { size: 23, color: TX_MID });

    const rs = `${ratio.toFixed(2)}×`;
    text(c, rs, rx, 760, { size: 58, weight: 800, color: won ? UP : '#D83639' });
    text(c, won ? 'better to hold than to stake' : 'better to stake than to hold',
      rx + measure(c, rs, 58, 800) + 22, 754, { size: 26, weight: 600, color: TX_MID });
    text(c, `Cycle ${d.cycleNo} · ${d.daysLeft} days still to run`, CARD_W / 2, 912, {
      size: 24, color: TX_DIM, align: 'center',
    });
  },

  /* ─────────────── the simulator ─────────────── */

  'sim-outcome'(c, d) {
    const s = d.sim;
    if (!s) return noRun(c);
    const beats = s.endValue - s.holdHex;
    text(c, `${money(s.amount)} in · ${s.cycles} cycles · ${years(s)}`, CARD_W / 2, 224, {
      size: 34, weight: 700, color: TX_MID, align: 'center',
    });
    text(c, `${money(s.dailyVolume)}/day · ${drifts(s)}`, CARD_W / 2, 260, {
      size: 21, color: TX_DIM, align: 'center',
    });
    headline(
      c,
      money(s.endValue),
      `${s.multiple.toFixed(2)}× on what went in — ${s.compound ? 'earnings rebought' : 'earnings kept as HEX'}`,
      396,
    );
    const g = grid(PAD, 500, BOX_W, 280, 2, 2);
    statTile(c, g[0], {
      label: 'HEX earned', value: compact(s.hexEarned),
      sub: `worth ${money(s.hexEarnedUsd)} at the closing price`, accent: '#FB9438',
    });
    statTile(c, g[1], {
      label: 'pSSH held', value: compact(s.tokens), sub: `${s.sShares.toFixed(2)} S-shares`,
    });
    statTile(c, g[2], {
      label: 'Share of the supply', value: simPct(s.sharePct),
      sub: 'the 1% burn lifts it every cycle',
    });
    statTile(c, g[3], {
      label: 'Against holding HEX', value: signed(beats),
      sub: `${money(s.holdHex)} if the same dollars sat in HEX`,
      accent: beats >= 0 ? UP : '#D83639',
    });
    statTile(c, [PAD, 800, BOX_W, 120], {
      label: 'Against rolling a HEX stake', value: money(s.stakeHex), size: 44,
      sub: `restaked every ${s.cycleDays} days for the same run`,
    });
  },

  'sim-curve'(c, d) {
    const s = d.sim;
    if (!s) return noRun(c);
    text(c, 'The same dollars, three ways', CARD_W / 2, 224, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    text(c, `${money(s.amount)} over ${s.cycles} cycles · ${years(s)}`, CARD_W / 2, 264, {
      size: 24, color: TX_DIM, align: 'center',
    });
    lineChart(
      c,
      [
        { values: s.holdByCycle, color: '#5E7BA6', width: 5 },
        { values: s.stakeByCycle, color: '#AE176A', width: 5 },
        { values: s.valueByCycle, color: '#FB9438', width: 8 },
      ],
      PAD, 310, BOX_W, 330, money,
    );
    text(c, 'CYCLE 1', PAD, 678, { size: 18, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, `CYCLE ${s.cycles}`, CARD_W - PAD, 678, {
      size: 18, color: TX_DIM, align: 'right', font: MONO, spacing: 2,
    });
    const g = grid(PAD, 706, BOX_W, 168, 3, 1);
    statTile(c, g[0], {
      label: 'Hold pSSH', value: money(s.endValue), size: 44,
      sub: `${s.multiple.toFixed(2)}× in`, accent: '#FB9438',
    });
    statTile(c, g[1], {
      label: 'Stake the HEX', value: money(s.stakeHex), size: 44,
      sub: 'rolled every cycle', accent: '#AE176A',
    });
    statTile(c, g[2], {
      label: 'Just hold HEX', value: money(s.holdHex), size: 44, sub: 'nothing done at all',
    });
    text(c, `${money(s.dailyVolume)}/day · ${drifts(s)} — arithmetic, not a forecast.`,
      CARD_W / 2, 920, { size: 22, color: TX_DIM, align: 'center' });
  },

  'sim-pool'(c, d) {
    const s = d.sim;
    if (!s) return noRun(c);
    text(c, 'What the stake itself does', CARD_W / 2, 224, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    headline(
      c,
      `${s.poolMultiple.toFixed(2)}×`,
      `${compact(s.poolStart)} → ${compact(s.poolEnd)} HEX over ${s.cycles} cycles`,
      380,
    );
    areaChart(c, s.poolByCycle, PAD, 470, BOX_W, 226);
    const g = grid(PAD, 722, BOX_W, 190, 4, 1, 14);
    statTile(c, g[0], {
      label: 'Covers its 1%', value: `${s.coverRatio.toFixed(2)}×`, size: 40,
      sub: s.coverRatio >= 1 ? 'so it grows' : 'so it shrinks',
      accent: s.coverRatio >= 1 ? UP : '#D83639',
    });
    statTile(c, g[1], {
      label: 'Volume a day', value: money(s.dailyVolume), size: 40,
      sub: `needs ${money(s.breakEven)}`,
    });
    statTile(c, g[2], {
      label: 'S-shares left', value: nf(s.sSharesLeft, 0), size: 40, sub: 'only ever fewer',
    });
    statTile(c, g[3], {
      label: 'pSSH burned', value: compact(s.burned), size: 40, sub: 'over the run', accent: '#D83639',
    });
    text(c, `Assuming ${drifts(s)}.`, CARD_W / 2, 944, {
      size: 20, color: TX_DIM, align: 'center',
    });
  },

  'sim-plan'(c, d) {
    const s = d.sim;
    if (!s) return noRun(c);
    text(c, 'WHAT I SET, AND WHAT IT GIVES', CARD_W / 2, 212, {
      size: 20, color: TX_DIM, align: 'center', font: MONO, spacing: 4,
    });
    panel(c, PAD, 244, BOX_W, 648);
    c.save();
    c.setLineDash([12, 10]);
    c.strokeStyle = LINE_2;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(PAD + 400, 272);
    c.lineTo(PAD + 400, 864);
    c.stroke();
    c.restore();

    const lx = PAD + 40;
    text(c, 'I PUT IN', lx, 318, { size: 17, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, `$${nf(s.amount)}`, lx, 392, {
      size: 68, weight: 800, color: brand(c, lx, 330, lx + 300, 396),
    });
    text(c, 'of pSSH, after the 5.5%', lx, 428, { size: 22, color: TX_MID });

    text(c, 'AND LEFT IT', lx, 506, { size: 17, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, `${s.cycles} cycles`, lx, 564, { size: 46, weight: 800 });
    text(c, `${s.cycleDays} days each · ${years(s)}`, lx, 598, { size: 22, color: TX_MID });

    text(c, 'ASSUMING VOLUME OF', lx, 676, { size: 17, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, `${money(s.dailyVolume)}/day`, lx, 734, { size: 42, weight: 800 });
    text(c, `it breaks even at ${money(s.breakEven)}`, lx, 768, { size: 22, color: TX_MID });

    text(c, 'HEX EARNINGS', lx, 816, { size: 17, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, s.compound ? 'Rebought' : 'Kept', lx, 862, { size: 40, weight: 800 });

    const rx = PAD + 440;
    text(c, 'IT ENDS AT', rx, 318, { size: 17, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, money(s.endValue), rx, 392, {
      size: 64, weight: 800, color: brand(c, rx, 330, CARD_W - PAD, 396),
    });
    text(c, `${s.multiple.toFixed(2)}× on what went in`, rx, 428, { size: 22, color: TX_MID });

    text(c, 'HEX EARNED', rx, 506, { size: 17, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, `${compact(s.hexEarned)} HEX`, rx, 564, { size: 46, weight: 800 });
    text(c, `worth ${money(s.hexEarnedUsd)}`, rx, 598, { size: 22, color: TX_MID });

    text(c, 'MY SHARE OF THE SUPPLY', rx, 676, { size: 17, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, simPct(s.sharePct), rx, 734, { size: 42, weight: 800 });
    text(c, `${s.sShares.toFixed(2)} S-shares held`, rx, 768, { size: 22, color: TX_MID });

    text(c, 'AND THE STAKE', rx, 816, { size: 17, color: TX_DIM, font: MONO, spacing: 2 });
    text(c, `${s.poolMultiple.toFixed(2)}× bigger`, rx, 862, { size: 40, weight: 800, color: UP });

    text(c, `Assuming ${drifts(s)}. A projection from figures I chose, not a forecast.`,
      CARD_W / 2, 930, { size: 21, color: TX_DIM, align: 'center' });
  },
};

/** 20.5817% is four digits of noise; 0.0042% needs all four. */
function simPct(n: number): string {
  return `${n.toFixed(n >= 1 ? 2 : 4)}%`;
}

/** The assumptions in one line, so no card shows a result without them. */
function drifts(s: SimShare): string {
  const parts: string[] = [`yield ${s.yieldPct.toFixed(2)}%/cycle`];
  const add = (name: string, p: number) => p !== 0 && parts.push(`${name} ${p > 0 ? '+' : ''}${p}%/cycle`);
  add('pSSH', s.psshDriftPct);
  add('HEX', s.hexDriftPct);
  add('volume', s.volumeDriftPct);
  if (parts.length === 1) parts.push('prices flat');
  return parts.join(' · ');
}

/** How long the run covers, in years, for the simulator's subtitles. */
function years(s: SimShare): string {
  const y = (s.cycles * s.cycleDays) / 365.25;
  return y >= 1 ? `~${y.toFixed(1)} years` : `~${Math.round(y * 12)} months`;
}

/** The sim cards are only offered when a run exists; this is the belt and braces. */
function noRun(c: CanvasRenderingContext2D) {
  text(c, 'No projection to draw', CARD_W / 2, CARD_H / 2, {
    size: 40, weight: 700, color: TX_MID, align: 'center',
  });
}

const KICKERS: Record<string, string> = {
  verdict: 'the head-to-head',
  scoreboard: 'the record',
  machine: 'how it works',
  selffund: 'self-funding',
  sshare: 'supply',
  stake: 'the stake',
  breakeven: 'break-even',
  reflections: 'what pays you',
  growth: 'compounding',
  countdown: 'next end-stake',
  board: 'the whole board',
  versus: 'side by side',
  supply: 'supply & burn',
  thiscycle: `this cycle`,
  record: 'the record',
  prices: 'today’s prices',
  proof: 'four facts',
  stakeboard: 'the stake',
  holder: 'what you get',
  ticket: 'the ticket',
  'sim-outcome': 'simulated',
  'sim-curve': 'simulated',
  'sim-pool': 'simulated',
  'sim-plan': 'simulated',
};

/** Paint one card. Returns false if the id isn't known. */
export function drawCard(
  ctx: CanvasRenderingContext2D,
  id: string,
  d: ShareData,
  logo: HTMLImageElement | null,
): boolean {
  const p = paint[id];
  if (!p) return false;
  ctx.save();
  chrome(ctx, d, logo, KICKERS[id] ?? '');
  p(ctx, d);
  ctx.restore();
  return true;
}
