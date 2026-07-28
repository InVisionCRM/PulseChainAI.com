// Share-card painter. Draws straight to a canvas rather than rasterising DOM,
// so the output is byte-identical everywhere and needs no extra dependency —
// html2canvas and friends would each be a new package for something the 2D
// context already does exactly.
//
// Every figure comes from the same live data the page renders; nothing here
// invents or rounds a number into looking better than it is.

export const CARD_W = 1080;
export const CARD_H = 1080;

const INK = '#06182E';
const PANEL = '#0C2340';
const LINE = 'rgba(255,255,255,0.12)';
const LINE_2 = 'rgba(255,255,255,0.26)';
const TX = '#ffffff';
const TX_MID = 'rgba(226,231,245,0.72)';
const TX_DIM = 'rgba(226,231,245,0.45)';
const UP = '#4ade80';
const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

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
];

/* ────────────────────────── canvas helpers ────────────────────────── */

const nf = (n: number, dp = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : nf(n);
const money = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : `$${n.toFixed(2)}`;

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

function brand(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#7E089D');
  g.addColorStop(0.3, '#AE176A');
  g.addColorStop(0.58, '#D83639');
  g.addColorStop(0.8, '#E96635');
  g.addColorStop(1, '#FB9438');
  return g;
}

interface T {
  size?: number;
  weight?: number | string;
  color?: string | CanvasGradient;
  align?: CanvasTextAlign;
  font?: string;
  spacing?: number;
}
function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, o: T = {}) {
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

/** Semicircular dial used by a couple of the cards. */
function gauge(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  frac: number,
  width = 26,
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

function needle(c: CanvasRenderingContext2D, cx: number, cy: number, len: number, frac: number) {
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

function areaChart(
  c: CanvasRenderingContext2D,
  vals: number[],
  x: number,
  y: number,
  w: number,
  h: number,
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

/* ────────────────────────── shared chrome ────────────────────────── */

function chrome(c: CanvasRenderingContext2D, d: ShareData, logo: HTMLImageElement | null, kicker: string) {
  c.fillStyle = INK;
  c.fillRect(0, 0, CARD_W, CARD_H);
  // brand bloom, top-right
  const bloom = c.createRadialGradient(CARD_W * 0.92, -60, 0, CARD_W * 0.92, -60, 720);
  bloom.addColorStop(0, 'rgba(174,23,106,0.42)');
  bloom.addColorStop(0.55, 'rgba(126,8,157,0.14)');
  bloom.addColorStop(1, 'rgba(6,24,46,0)');
  c.fillStyle = bloom;
  c.fillRect(0, 0, CARD_W, CARD_H);

  if (logo) c.drawImage(logo, 64, 56, 60, 60);
  text(c, 'SUPERSTAKE', 140, 88, { size: 27, weight: 800, spacing: 5 });
  text(c, 'pSSH', 140, 118, { size: 20, weight: 500, color: TX_DIM, font: MONO, spacing: 3 });
  text(c, kicker.toUpperCase(), CARD_W - 64, 96, {
    size: 19, weight: 500, color: TX_DIM, align: 'right', font: MONO, spacing: 3,
  });

  c.fillStyle = LINE;
  c.fillRect(64, 150, CARD_W - 128, 2);

  // footer
  c.fillStyle = LINE;
  c.fillRect(64, CARD_H - 116, CARD_W - 128, 2);
  text(c, 'morbius.io/superstake', 64, CARD_H - 62, { size: 24, weight: 700, color: TX_MID });
  text(c, `AS OF ${d.asOf.toUpperCase()}`, CARD_W - 64, CARD_H - 62, {
    size: 18, weight: 500, color: TX_DIM, align: 'right', font: MONO, spacing: 2,
  });
}

/** Big centred headline + supporting line, the shape most cards share. */
function headline(c: CanvasRenderingContext2D, big: string, sub: string, y: number, grad = true) {
  const g = grad ? brand(c, 180, y - 90, CARD_W - 180, y) : TX;
  text(c, big, CARD_W / 2, y, { size: 128, weight: 800, color: g, align: 'center' });
  text(c, sub, CARD_W / 2, y + 56, { size: 28, weight: 500, color: TX_MID, align: 'center' });
}

function panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = PANEL;
  rr(c, x, y, w, h, 28);
  c.fill();
  c.strokeStyle = LINE;
  c.lineWidth = 2;
  c.stroke();
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
};

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
