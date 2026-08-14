// Share cards for a token page: what each card claims, and how it's painted.
//
// Two categories. SHORT TERM is what the token is doing right now — price,
// momentum, buying against selling, who moved in the last day. ALL TIME is the
// record — every trade since launch, where it trades, whether the first buyers
// are still here, and how the supply is spread.
//
// Data comes from what the page already loads plus five endpoints fetched on
// demand (volume, forensics, token-leagues, holder-deltas, pressure). Four of
// those are PulseChain-only by construction — the PulseX subgraph doesn't index
// other chains — so cards that need them are simply not offered elsewhere
// rather than drawn empty. Any figure that hasn't arrived is drawn as "—" or
// the card says what's missing; nothing is invented to fill a gap.

import {
  ACCENT, BOX_W, CARD_H, CARD_W, DOWN, LINE, LINE_2, MONO, PAD, TX, TX_DIM, TX_MID, UP,
  areaChart, bars, brand, chrome as frame, compact, fitText, grid, headline, measure,
  MISSING, money, nf, nothingToDraw, panel, price as fmtPrice, rr, ring, signedPct, statTile, text,
  type Box,
} from '@/lib/shareCards/paint';

export { CARD_W, CARD_H };

/** Footer stamp, and the text a share sheet carries alongside the image. */
export const BRAND_URL = 'scan.Morbius.io';

export type ChainKey = 'pulsechain' | 'ethereum' | 'robinhood';

/** The lazily-fetched endpoints a card can depend on. */
export type SourceKey = 'volume' | 'forensics' | 'leagues' | 'deltas' | 'pressure';

/**
 * Which chains each source actually answers for. The routes themselves return
 * `supported:false` off PulseChain (the subgraph and the log-scan are
 * PulseChain-only, and token-leagues reads the PulseChain explorer), so this
 * table decides which cards are offered rather than discovering it per fetch.
 */
export const SOURCE_CHAINS: Record<SourceKey, ChainKey[]> = {
  volume: ['pulsechain'],
  forensics: ['pulsechain'],
  leagues: ['pulsechain'],
  deltas: ['pulsechain'],
  pressure: ['pulsechain'],
};

export function sourceSupported(source: SourceKey, chain: ChainKey): boolean {
  return SOURCE_CHAINS[source].includes(chain);
}

/* ─────────────────────────── the data ─────────────────────────── */

export interface Window { buys: number; sells: number }

/** All-time trading, from /api/geicko/volume. */
export interface VolumeSource {
  daily: { date: number; volumeUsd: number; txns: number; liquidityUsd: number }[];
  byPair: { label: string; volumeUsd: number }[];
  /** Totals across EVERY pool, so a truncated list can't imply completeness. */
  pairTotals: { count: number; volumeUsd: number; shownVolumeUsd: number } | null;
  allTime: {
    volumeUsd: number;
    txns: number;
    days: number;
    firstDate: number | null;
    currentLiquidity: number | null;
    bestDay: { date: number; volumeUsd: number } | null;
  } | null;
}

/** Launch-window buyers, from /api/geicko/forensics. */
export interface ForensicsSource {
  pairedWith: string | null;
  pairCreatedAt: number | null;
  initialLiquidityUsd: number | null;
  windowHours: number;
  buyers: { wallet: string; usd: number; sniper: boolean; stillHolds: boolean | null }[];
}

/** Tier populations, from /api/geicko/token-leagues. */
export interface LeaguesSource {
  bands: { index: number; pct: number; count: number; exact: boolean; supplyHeldPct: number }[];
  totalHolders: number | null;
  complete: boolean;
  scanned: number;
}

/** 24h position changes, from /api/geicko/holder-deltas — already netted. */
export interface DeltasSource {
  added: number;
  trimmed: number;
  addedTokens: number;
  trimmedTokens: number;
  biggestAdd: { address: string; tokens: number } | null;
  biggestExit: { address: string; tokens: number } | null;
}

/** Buy/sell in dollars, from /api/geicko/pressure. */
export interface PressureSource {
  h24: { buyUsd: number; sellUsd: number; buyCount: number; sellCount: number } | null;
  hourly: { buy: number; sell: number }[];
}

export interface TokenShareData {
  address: string;
  chain: ChainKey;
  chainLabel: string;
  symbol: string;
  name: string | null;
  asOf: string;

  /* Market — DexScreener/GeckoTerminal pair data, every chain. */
  priceUsd: number | null;
  change: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  volume: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  txns: { h24: Window | null };
  liquidityUsd: number | null;
  pairCount: number | null;
  marketCap: number | null;
  fdv: number | null;
  /** The pool with the most liquidity, not merely the first one listed. */
  topPair: { label: string; dexName: string; liquidityUsd: number | null } | null;

  /* Supply, holders, ownership — the explorer, every chain. */
  totalSupply: number | null;
  burnedTokens: number | null;
  burnedPct: number | null;
  holders: number | null;
  supplyHeld: { top10: number; top20: number; top50: number } | null;
  contractHeldPct: number | null;
  creationDate: string | null;
  ageDays: number | null;
  renounced: boolean | null;
  devHoldingPct: number | null;

  /* Fetched when a card that needs them is picked. */
  volumeAll?: VolumeSource | null;
  forensics?: ForensicsSource | null;
  leagues?: LeaguesSource | null;
  deltas?: DeltasSource | null;
  pressure?: PressureSource | null;
}

export interface TokenCardDef {
  id: string;
  name: string;
  blurb: string;
  group: 'short' | 'alltime';
  /** Card is only offered when this source answers for the chain. */
  needs?: SourceKey;
  /** Card draws either way, but is richer when this source is available. */
  wants?: SourceKey;
  /** Right-hand label on the card itself. */
  kicker: string;
}

export const TOKEN_CARDS: TokenCardDef[] = [
  // ── Short term ────────────────────────────────────────────────────────────
  { id: 'ticker', group: 'short', kicker: 'right now',
    name: 'The ticker', blurb: 'Price, change, size — the one you post' },
  { id: 'momentum', group: 'short', kicker: 'momentum',
    name: 'Momentum', blurb: '5m to 24h, and whether it is speeding up' },
  { id: 'pressure', group: 'short', kicker: 'pressure', wants: 'pressure',
    name: 'Buying vs selling', blurb: 'Which side is doing the volume' },
  { id: 'positions', group: 'short', kicker: '24h positions', needs: 'deltas',
    name: 'Who moved', blurb: 'Wallets that added against wallets that trimmed' },
  { id: 'scorecard', group: 'short', kicker: 'the scorecard',
    name: 'The scorecard', blurb: 'Six checks: ownership, dev, burn, concentration' },

  // ── All time ──────────────────────────────────────────────────────────────
  { id: 'lifetime', group: 'alltime', kicker: 'lifetime volume', needs: 'volume',
    name: 'Every trade since launch', blurb: 'Cumulative volume, swaps, best day' },
  { id: 'bypair', group: 'alltime', kicker: 'where it trades', needs: 'volume',
    name: 'Where it trades', blurb: 'Volume split across every pool' },
  { id: 'diamond', group: 'alltime', kicker: 'first buyers', needs: 'forensics',
    name: 'Diamond holders', blurb: 'How many day-one buyers are still here' },
  { id: 'leagues', group: 'alltime', kicker: 'the ladder', needs: 'leagues',
    name: 'Holder leagues', blurb: 'Whales down to crabs, with populations' },
  { id: 'concentration', group: 'alltime', kicker: 'concentration',
    name: 'Concentration', blurb: 'What the top 10, 20 and 50 hold' },
  { id: 'agesupply', group: 'alltime', kicker: 'age & supply',
    name: 'Age & supply', blurb: 'How old, how many, how much burned' },
];

/** The cards worth offering for a chain — the rest have no data to draw. */
export function cardsForChain(chain: ChainKey): TokenCardDef[] {
  return TOKEN_CARDS.filter((k) => !k.needs || sourceSupported(k.needs, chain));
}

/* ─────────────────────────── helpers ─────────────────────────── */

const dash = MISSING;
const pctText = (n: number | null | undefined, dp = 1) =>
  n == null || !Number.isFinite(n) ? dash : `${n.toFixed(dp)}%`;
const moneyOr = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? dash : money(n);
const countOr = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? dash : nf(n);
const tone = (n: number | null | undefined) => (n == null ? TX : n >= 0 ? UP : DOWN);
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const day = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

/** A left/right split bar — buys against sells, adds against trims. */
function splitBar(
  c: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  left: number, right: number,
  leftColor = UP, rightColor = DOWN,
) {
  const total = left + right;
  const lw = total > 0 ? (left / total) * w : w / 2;
  c.save();
  rr(c, x, y, w, h, h / 2);
  c.clip();
  c.fillStyle = total > 0 ? rightColor : LINE_2;
  c.fillRect(x, y, w, h);
  c.fillStyle = total > 0 ? leftColor : LINE_2;
  c.fillRect(x, y, lw, h);
  c.restore();
}

/** Running total of a series, for the cumulative-volume curve. */
function cumulative(vals: number[]): number[] {
  let run = 0;
  return vals.map((v) => (run += v));
}

/* ─────────────────────────── the cards ─────────────────────────── */

type Painter = (c: CanvasRenderingContext2D, d: TokenShareData) => void;

const paint: Record<string, Painter> = {
  ticker(c, d) {
    text(c, d.name ?? d.symbol, CARD_W / 2, 226, {
      size: fitText(c, d.name ?? d.symbol, BOX_W, 38, 700), weight: 700,
      color: TX_MID, align: 'center',
    });
    const p = d.priceUsd == null ? dash : fmtPrice(d.priceUsd);
    text(c, p, CARD_W / 2, 372, {
      size: fitText(c, p, BOX_W - 40, 118, 800), weight: 800,
      color: brand(c, 180, 280, CARD_W - 180, 372), align: 'center',
    });
    const ch = d.change.h24;
    text(c, ch == null ? 'no 24h change reported' : `${signedPct(ch)} · 24H`, CARD_W / 2, 434, {
      size: 38, weight: 800, color: tone(ch), align: 'center',
    });

    const g = grid(PAD, 486, BOX_W, 330, 2, 2);
    statTile(c, g[0], {
      label: 'Market cap', value: moneyOr(d.marketCap ?? d.fdv),
      sub: d.marketCap == null && d.fdv != null ? 'fully diluted' : 'circulating',
      accent: ACCENT.amber,
    });
    statTile(c, g[1], { label: '24h volume', value: moneyOr(d.volume.h24), sub: 'across every pool' });
    statTile(c, g[2], {
      label: 'Liquidity', value: moneyOr(d.liquidityUsd),
      sub: d.pairCount ? `across ${nf(d.pairCount)} pools holding it` : 'pooled',
    });
    statTile(c, g[3], {
      label: 'Holders', value: countOr(d.holders), sub: 'addresses with a balance',
      accent: ACCENT.magenta,
    });

    const deepest = d.topPair ? `Deepest pool: ${d.topPair.label} on ${d.topPair.dexName}` : null;
    text(c, deepest ?? `${d.chainLabel}`, CARD_W / 2, 880, {
      size: 26, color: TX_DIM, align: 'center',
    });
  },

  momentum(c, d) {
    text(c, 'How it has moved', CARD_W / 2, 226, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    const wins: [string, number | null, number | null][] = [
      ['5m', d.change.m5, d.volume.m5],
      ['1h', d.change.h1, d.volume.h1],
      ['6h', d.change.h6, d.volume.h6],
      ['24h', d.change.h24, d.volume.h24],
    ];
    const g = grid(PAD, 268, BOX_W, 260, 4, 1, 14);
    wins.forEach(([label, chg, vol], i) => {
      statTile(c, g[i], {
        label, value: chg == null ? dash : signedPct(chg), size: 42,
        sub: vol == null ? 'no volume' : money(vol), accent: chg == null ? undefined : tone(chg),
      });
    });

    // Cumulative windows can't be compared directly (5m sits inside 24h), so
    // this is the per-hour RATE in each — which is what "speeding up" means.
    const rate1 = d.volume.h1;
    const rate6 = d.volume.h6 == null ? null : d.volume.h6 / 6;
    const rate24 = d.volume.h24 == null ? null : d.volume.h24 / 24;
    text(c, 'VOLUME PER HOUR, EACH WINDOW', CARD_W / 2, 578, {
      size: 19, color: TX_DIM, align: 'center', font: MONO, spacing: 3,
    });
    const g2 = grid(PAD, 600, BOX_W, 190, 3, 1, 16);
    statTile(c, g2[0], { label: 'Last hour', value: moneyOr(rate1), size: 44, sub: 'an hour' });
    statTile(c, g2[1], { label: 'Over 6 hours', value: moneyOr(rate6), size: 44, sub: 'an hour, average' });
    statTile(c, g2[2], { label: 'Over 24 hours', value: moneyOr(rate24), size: 44, sub: 'an hour, average' });

    if (rate1 === 0 && rate24 != null) {
      text(c, 'Nothing traded in the last hour.', CARD_W / 2, 884, {
        size: 30, weight: 600, color: TX_MID, align: 'center',
      });
    } else if (rate1 != null && rate24 != null && rate24 > 0) {
      const x = rate1 / rate24;
      const hot = x >= 1;
      text(c, `${x.toFixed(1)}×`, CARD_W / 2 - 10, 892, {
        size: 76, weight: 800, color: hot ? UP : TX_MID, align: 'right',
      });
      text(c, hot ? 'its 24h average, right now' : 'its 24h average — cooling off',
        CARD_W / 2 + 10, 884, { size: 28, weight: 600, color: TX_MID });
    } else {
      text(c, 'Not enough volume reported to compare windows.', CARD_W / 2, 880, {
        size: 26, color: TX_DIM, align: 'center',
      });
    }
  },

  pressure(c, d) {
    const p = d.pressure?.h24 ?? null;
    const usd = p && (p.buyUsd > 0 || p.sellUsd > 0);
    const counts = p ? { buys: p.buyCount, sells: p.sellCount } : d.txns.h24;
    if (!usd && !counts) return nothingToDraw(c, 'No trades reported in the last 24 hours');

    text(c, 'Buying against selling, 24h', CARD_W / 2, 226, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });

    const left = usd ? p!.buyUsd : (counts?.buys ?? 0);
    const rightV = usd ? p!.sellUsd : (counts?.sells ?? 0);
    const ratio = rightV > 0 ? left / rightV : left > 0 ? Infinity : 0;
    const buying = left >= rightV;
    const ratioText = !Number.isFinite(ratio)
      ? 'all buys'
      : `${(buying ? ratio : rightV / Math.max(left, 1e-9)).toFixed(2)}×`;
    headline(
      c, ratioText,
      buying ? 'more buying than selling' : 'more selling than buying',
      372,
    );

    splitBar(c, PAD, 460, BOX_W, 64, left, rightV);
    text(c, usd ? money(left) : `${nf(left)} buys`, PAD, 566, { size: 34, weight: 800, color: UP });
    text(c, usd ? money(rightV) : `${nf(rightV)} sells`, CARD_W - PAD, 566, {
      size: 34, weight: 800, color: DOWN, align: 'right',
    });
    if (counts) {
      text(c, `${nf(counts.buys)} buys`, PAD, 600, { size: 24, color: TX_MID });
      text(c, `${nf(counts.sells)} sells`, CARD_W - PAD, 600, {
        size: 24, color: TX_MID, align: 'right',
      });
    }

    const hourly = d.pressure?.hourly ?? [];
    if (hourly.length > 1) {
      text(c, 'HOUR BY HOUR — BUYS ABOVE, SELLS BELOW', PAD, 674, {
        size: 17, color: TX_DIM, font: MONO, spacing: 2,
      });
      const top = 700;
      const half = 100;
      const max = Math.max(...hourly.flatMap((h) => [h.buy, h.sell]), 1);
      const gap = 3;
      const bw = (BOX_W - gap * (hourly.length - 1)) / hourly.length;
      hourly.forEach((h, i) => {
        const x = PAD + i * (bw + gap);
        const bh = Math.max(2, (h.buy / max) * half);
        c.fillStyle = UP;
        rr(c, x, top + half - bh, bw, bh, 3);
        c.fill();
        const sh = Math.max(2, (h.sell / max) * half);
        c.fillStyle = DOWN;
        rr(c, x, top + half + 4, bw, sh, 3);
        c.fill();
      });
    }

    text(c,
      usd
        ? 'Swaps on this token’s pools over the last 24 hours.'
        : 'Trade counts — the dollar split is not reported on this chain.',
      CARD_W / 2, 940, { size: 22, color: TX_DIM, align: 'center' });
  },

  positions(c, d) {
    const t = d.deltas;
    if (!t || (t.added === 0 && t.trimmed === 0)) {
      return nothingToDraw(c, 'No positions changed in the last 24 hours');
    }
    text(c, 'Positions moved in the last 24 hours', CARD_W / 2, 226, {
      size: 38, weight: 700, color: TX_MID, align: 'center',
    });
    headline(c, nf(t.added), `wallets added, against ${nf(t.trimmed)} that trimmed`, 372);

    splitBar(c, PAD, 460, BOX_W, 64, t.added, t.trimmed);
    text(c, `${nf(t.added)} added`, PAD, 566, { size: 30, weight: 800, color: UP });
    text(c, `${nf(t.trimmed)} trimmed`, CARD_W - PAD, 566, {
      size: 30, weight: 800, color: DOWN, align: 'right',
    });

    const g = grid(PAD, 606, BOX_W, 180, 2, 1, 16);
    statTile(c, g[0], {
      label: 'Biggest add',
      value: t.biggestAdd ? compact(t.biggestAdd.tokens) : dash, size: 46,
      sub: t.biggestAdd ? `${d.symbol} · ${shortAddr(t.biggestAdd.address)}` : 'none',
      accent: UP,
    });
    statTile(c, g[1], {
      label: 'Biggest exit',
      value: t.biggestExit ? compact(t.biggestExit.tokens) : dash, size: 46,
      sub: t.biggestExit ? `${d.symbol} · ${shortAddr(t.biggestExit.address)}` : 'none',
      accent: DOWN,
    });
    statTile(c, [PAD, 796, BOX_W, 142], {
      label: 'Net across every wallet that moved',
      value: `${t.addedTokens - t.trimmedTokens >= 0 ? '+' : '−'}${compact(Math.abs(t.addedTokens - t.trimmedTokens))}`,
      size: 44,
      sub: `${compact(t.addedTokens)} in · ${compact(t.trimmedTokens)} out`,
      accent: t.addedTokens >= t.trimmedTokens ? UP : DOWN,
    });
    text(c, 'Position change, not buys — a transfer in may be a wallet consolidating. Pools and burn addresses excluded.',
      CARD_W / 2, 954, { size: 19, color: TX_DIM, align: 'center' });
  },

  scorecard(c, d) {
    text(c, `${d.symbol} at a glance`, CARD_W / 2, 226, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    const g = grid(PAD, 264, BOX_W, 630, 2, 3);
    statTile(c, g[0], {
      label: 'Ownership',
      value: d.renounced == null ? dash : d.renounced ? 'Renounced' : 'Owned', size: 46,
      sub: d.renounced == null ? 'not reported' : d.renounced ? 'no owner can change it' : 'an owner key still exists',
      accent: d.renounced == null ? undefined : d.renounced ? UP : ACCENT.amber,
    });
    statTile(c, g[1], {
      label: 'Dev wallet holds', value: pctText(d.devHoldingPct, 2),
      sub: d.devHoldingPct == null ? 'unknown or sold out' : 'of total supply',
      accent: d.devHoldingPct != null && d.devHoldingPct >= 5 ? ACCENT.red : undefined,
    });
    statTile(c, g[2], {
      label: 'Burned', value: pctText(d.burnedPct),
      sub: d.burnedTokens == null ? 'of supply' : `${compact(d.burnedTokens)} ${d.symbol} gone`,
      accent: ACCENT.red,
    });
    statTile(c, g[3], {
      label: 'Top 10 hold', value: pctText(d.supplyHeld?.top10 ?? null),
      sub: 'excl. pools, routers, burns',
    });
    statTile(c, g[4], {
      label: 'Contracts & LPs', value: pctText(d.contractHeldPct),
      sub: 'of supply sits in contracts',
    });
    statTile(c, g[5], {
      label: 'Holders', value: countOr(d.holders),
      sub: d.ageDays == null ? 'addresses' : `over ${nf(d.ageDays)} days`,
      accent: ACCENT.magenta,
    });
    text(c, 'Figures as reported by the chain — not a rating, and not advice.',
      CARD_W / 2, 936, { size: 21, color: TX_DIM, align: 'center' });
  },

  lifetime(c, d) {
    const v = d.volumeAll;
    const a = v?.allTime;
    if (!v || !a || !v.daily.length) return nothingToDraw(c, 'No trading history indexed for this token');

    text(c, 'Every trade since launch', CARD_W / 2, 226, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    headline(c, money(a.volumeUsd), `${nf(a.txns)} swaps over ${nf(a.days)} days`, 366);

    areaChart(c, cumulative(v.daily.map((x) => x.volumeUsd)), PAD, 460, BOX_W, 250);
    text(c, a.firstDate ? day(a.firstDate) : 'launch', PAD, 742, {
      size: 19, color: TX_DIM, font: MONO, spacing: 2,
    });
    text(c, 'TODAY', CARD_W - PAD, 742, {
      size: 19, color: TX_DIM, align: 'right', font: MONO, spacing: 2,
    });

    const g = grid(PAD, 768, BOX_W, 150, 3, 1, 16);
    statTile(c, g[0], {
      label: 'Best day', value: a.bestDay ? money(a.bestDay.volumeUsd) : dash, size: 38,
      sub: a.bestDay ? day(a.bestDay.date) : 'no day stands out', accent: ACCENT.amber,
    });
    statTile(c, g[1], {
      label: 'Average day', value: a.days > 0 ? money(a.volumeUsd / a.days) : dash, size: 38,
      sub: 'across its whole life',
    });
    statTile(c, g[2], {
      label: 'Liquidity now', value: moneyOr(a.currentLiquidity ?? d.liquidityUsd), size: 38,
      sub: 'pooled today',
    });
  },

  bypair(c, d) {
    const rows = (d.volumeAll?.byPair ?? []).filter((p) => p.volumeUsd > 0);
    if (!rows.length) return nothingToDraw(c, 'No pool-level volume indexed for this token');

    const totals = d.volumeAll?.pairTotals ?? null;
    // `rows` is the biggest N pools, not all of them — the route truncates and
    // reports the real totals separately. Using the visible sum as the
    // denominator would overstate every share on the card.
    const total = totals?.volumeUsd ?? rows.reduce((s, p) => s + p.volumeUsd, 0);
    const poolCount = totals?.count ?? rows.length;
    const shown = rows.slice(0, 8);
    text(c, 'Where it actually trades', CARD_W / 2, 226, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });

    // How few pools carry most of it — the number the bars alone don't give.
    // Only claimable when the pools we can see already cover 90% of the total.
    let run = 0;
    let need = 0;
    let reached = false;
    for (const p of rows) {
      run += p.volumeUsd;
      need++;
      if (run / total >= 0.9) { reached = true; break; }
    }
    if (poolCount === 1) {
      headline(c, '1 pool', 'is where all of it trades', 356);
    } else if (reached) {
      headline(c, `${need} of ${poolCount}`, 'pools carry 90% of all volume', 356);
    } else {
      headline(c, nf(poolCount), 'pools have traded it', 356);
    }

    const top = 444;
    const rowH = 52;
    const max = shown[0].volumeUsd || 1;
    shown.forEach((p, i) => {
      const y = top + i * rowH;
      const bw = Math.max(6, (p.volumeUsd / max) * (BOX_W - 300));
      c.fillStyle = brand(c, PAD, 0, PAD + BOX_W - 300, 0);
      rr(c, PAD, y, bw, 30, 8);
      c.fill();
      text(c, p.label, PAD + 12, y + 22, { size: 19, weight: 700, color: TX });
      text(c, money(p.volumeUsd), CARD_W - PAD, y + 22, {
        size: 21, weight: 700, color: TX_MID, align: 'right',
      });
      text(c, `${((p.volumeUsd / total) * 100).toFixed(1)}%`, CARD_W - PAD - 150, y + 22, {
        size: 19, color: TX_DIM, align: 'right', font: MONO, spacing: 1,
      });
    });

    text(c,
      poolCount > shown.length
        ? `The ${shown.length} biggest of ${nf(poolCount)} pools · ${money(total)} all-time across all of them`
        : `${money(total)} all-time across every pool`,
      CARD_W / 2, 900, { size: 24, color: TX_DIM, align: 'center' });
  },

  diamond(c, d) {
    const f = d.forensics;
    const known = (f?.buyers ?? []).filter((b) => b.stillHolds !== null);
    if (!f || !known.length) return nothingToDraw(c, 'The launch window could not be reconstructed');

    const holding = known.filter((b) => b.stillHolds).length;
    text(c, `The first buyers, ${f.windowHours}h after the pool opened`, CARD_W / 2, 226, {
      size: 34, weight: 700, color: TX_MID, align: 'center',
    });
    headline(c, `${holding} of ${known.length}`, 'are still holding today', 366);

    // One dot per buyer: lit = still holds, dim = gone.
    const cols = 10;
    const rows = Math.ceil(known.length / cols);
    const dot = 40;
    const gap = 14;
    const gw = cols * dot + (cols - 1) * gap;
    const x0 = (CARD_W - gw) / 2;
    const y0 = 452;
    known.forEach((b, i) => {
      const x = x0 + (i % cols) * (dot + gap);
      const y = y0 + Math.floor(i / cols) * (dot + gap);
      c.fillStyle = b.stillHolds ? UP : 'rgba(248,113,113,0.32)';
      c.beginPath();
      c.arc(x + dot / 2, y + dot / 2, dot / 2, 0, Math.PI * 2);
      c.fill();
      if (b.sniper) {
        c.strokeStyle = ACCENT.amber;
        c.lineWidth = 3;
        c.stroke();
      }
    });
    const gridBottom = y0 + rows * (dot + gap);

    const snipers = known.filter((b) => b.sniper).length;
    const g = grid(PAD, Math.max(gridBottom + 16, 700), BOX_W, 150, 3, 1, 16);
    statTile(c, g[0], {
      label: 'Opened against', value: f.pairedWith ?? dash, size: 38,
      sub: f.pairCreatedAt ? day(f.pairCreatedAt) : 'first pool',
    });
    statTile(c, g[1], {
      label: 'Liquidity at launch', value: moneyOr(f.initialLiquidityUsd), size: 38,
      sub: 'the first mint', accent: ACCENT.amber,
    });
    statTile(c, g[2], {
      label: 'Same-block buys', value: snipers > 0 ? nf(snipers) : 'None', size: 38,
      sub: snipers === 0
        ? 'nobody bought in the opening block'
        : snipers === 1 ? 'wallet bought in the opening block' : 'wallets bought in the opening block',
      accent: snipers > 0 ? ACCENT.red : undefined,
    });
    text(c,
      snipers > 0
        ? 'Balances are current. A ringed dot bought in the pool’s opening block.'
        : 'Balances are current — a lit dot still holds some of what it bought.',
      CARD_W / 2, 940, { size: 20, color: TX_DIM, align: 'center' });
  },

  leagues(c, d) {
    const l = d.leagues;
    if (!l?.bands?.length) return nothingToDraw(c, 'Holder tiers have not been counted yet');

    // Matches the ladder in GeickoTokenLeaguesPanel, by index.
    const LADDER: [string, string, string][] = [
      ['🌊', 'Tsunami', '10%'],
      ['🐋', 'Whale', '1%'],
      ['🦈', 'Shark', '0.1%'],
      ['🐬', 'Dolphin', '0.01%'],
      ['🦑', 'Squid', '0.001%'],
      ['🐢', 'Turtle', '0.0001%'],
      ['🦀', 'Crab', '0.00001%'],
    ];
    text(c, `Who holds ${d.symbol}`, CARD_W / 2, 224, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    text(c, l.totalHolders ? `${nf(l.totalHolders)} holders, by size of stack` : 'holders by size of stack',
      CARD_W / 2, 264, { size: 26, color: TX_DIM, align: 'center' });

    const byIndex = new Map(l.bands.map((b) => [b.index, b]));
    const counts = l.bands.map((b) => b.count);
    const maxLog = Math.log10(Math.max(1, ...counts) + 1) || 1;
    const top = 306;
    const rowH = 84;
    LADDER.forEach(([beast, name, label], i) => {
      const y = top + i * rowH;
      const b = byIndex.get(i);
      panel(c, PAD, y, BOX_W, 72);
      text(c, beast, PAD + 26, y + 50, { size: 38 });
      text(c, name, PAD + 90, y + 36, { size: 27, weight: 800, color: TX });
      text(c, `${label} of supply and up`, PAD + 90, y + 60, { size: 18, color: TX_DIM });
      // Log-scaled bar so a tier of 1 stays visible beside a tier of 40,000.
      const w = b && b.count > 0
        ? Math.max(8, (Math.log10(b.count + 1) / maxLog) * 300)
        : 0;
      if (w > 0) {
        c.fillStyle = brand(c, PAD + 380, 0, PAD + 680, 0);
        rr(c, PAD + 380, y + 30, w, 14, 7);
        c.fill();
      }
      const count = b ? `${nf(b.count)}${b.exact ? '' : '+'}` : dash;
      text(c, count, CARD_W - PAD - 22, y + 36, {
        size: 28, weight: 800, color: TX, align: 'right',
      });
      text(c, b ? `${b.supplyHeldPct.toFixed(1)}% of supply` : '', CARD_W - PAD - 22, y + 60, {
        size: 17, color: TX_DIM, align: 'right',
      });
    });
    text(c,
      l.complete
        ? `Every holder counted.`
        : `Top ${nf(l.scanned)} holders counted — smaller tiers are floors, marked +.`,
      CARD_W / 2, 934, { size: 20, color: TX_DIM, align: 'center' });
  },

  concentration(c, d) {
    const s = d.supplyHeld;
    if (!s) return nothingToDraw(c, 'Holder distribution has not loaded');

    text(c, 'How concentrated it is', CARD_W / 2, 226, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });

    const cx = CARD_W / 2;
    const cy = 452;
    const r = 142;
    const next40 = Math.max(0, s.top50 - s.top10);
    const rest = Math.max(0, 100 - s.top50);
    // Three arcs on one ring: top 10, the next 40, everyone else.
    const segs: [number, string][] = [
      [s.top10, ACCENT.red],
      [next40, ACCENT.amber],
      [rest, 'rgba(226,231,245,0.28)'],
    ];
    let start = -Math.PI / 2;
    c.save();
    c.lineWidth = 52;
    segs.forEach(([pct, col]) => {
      const a = (pct / 100) * Math.PI * 2;
      if (a <= 0) return;
      c.strokeStyle = col;
      c.beginPath();
      c.arc(cx, cy, r, start, start + a);
      c.stroke();
      start += a;
    });
    c.restore();
    text(c, `${s.top10.toFixed(1)}%`, cx, cy + 6, { size: 68, weight: 800, align: 'center' });
    text(c, 'TOP 10', cx, cy + 46, { size: 21, color: TX_DIM, align: 'center', font: MONO, spacing: 3 });

    const g = grid(PAD, 654, BOX_W, 160, 3, 1, 16);
    statTile(c, g[0], { label: 'Top 10', value: pctText(s.top10), size: 40, sub: 'of supply', accent: ACCENT.red });
    statTile(c, g[1], { label: 'Top 20', value: pctText(s.top20), size: 40, sub: 'of supply' });
    statTile(c, g[2], { label: 'Top 50', value: pctText(s.top50), size: 40, sub: 'of supply', accent: ACCENT.amber });
    text(c, `${rest.toFixed(1)}%`, CARD_W / 2 - 10, 884, {
      size: 56, weight: 800, color: TX, align: 'right',
    });
    text(c,
      d.holders
        ? `is spread across the other ${nf(Math.max(0, d.holders - 50))} holders`
        : 'is spread across everyone else',
      CARD_W / 2 + 10, 880, { size: 26, weight: 600, color: TX_MID });
    text(c, 'Excludes LP pools, routers and burn addresses.', CARD_W / 2, 938, {
      size: 19, color: TX_DIM, align: 'center',
    });
  },

  agesupply(c, d) {
    text(c, `${d.symbol} — age and supply`, CARD_W / 2, 226, {
      size: 40, weight: 700, color: TX_MID, align: 'center',
    });
    headline(
      c,
      d.ageDays == null ? dash : `${nf(d.ageDays)} days`,
      d.creationDate ? `on chain since ${d.creationDate}` : 'since the contract was created',
      366,
    );
    const circulating =
      d.totalSupply != null && d.burnedTokens != null
        ? Math.max(0, d.totalSupply - d.burnedTokens)
        : d.totalSupply;
    const g = grid(PAD, 450, BOX_W, 300, 2, 2);
    statTile(c, g[0], {
      label: 'Total supply', value: d.totalSupply == null ? dash : compact(d.totalSupply),
      sub: d.symbol,
    });
    statTile(c, g[1], {
      label: 'Burned', value: d.burnedTokens == null ? dash : compact(d.burnedTokens),
      sub: pctText(d.burnedPct) + ' of supply', accent: ACCENT.red,
    });
    statTile(c, g[2], {
      label: 'Circulating', value: circulating == null ? dash : compact(circulating),
      sub: 'supply less what was burned', accent: ACCENT.amber,
    });
    statTile(c, g[3], {
      label: 'Holders', value: countOr(d.holders), sub: 'addresses with a balance',
      accent: ACCENT.magenta,
    });
    statTile(c, [PAD, 772, BOX_W, 140], {
      label: 'Market cap against fully diluted',
      value: d.marketCap != null && d.fdv != null && d.fdv > 0
        ? `${((d.marketCap / d.fdv) * 100).toFixed(0)}%`
        : dash,
      size: 46,
      sub: d.marketCap != null && d.fdv != null
        ? `${money(d.marketCap)} of ${money(d.fdv)} fully diluted`
        : 'not enough price data',
    });
  },
};

/** Paint one card. Returns false if the id isn't known. */
export function drawTokenCard(
  ctx: CanvasRenderingContext2D,
  id: string,
  d: TokenShareData,
  logo: HTMLImageElement | null,
): boolean {
  const p = paint[id];
  if (!p) return false;
  const def = TOKEN_CARDS.find((k) => k.id === id);
  ctx.save();
  frame(ctx, {
    logo,
    roundLogo: true,
    title: d.symbol,
    subtitle: d.chainLabel,
    kicker: def?.kicker ?? '',
    footerLeft: BRAND_URL,
    footerRight: `AS OF ${d.asOf}`,
  });
  p(ctx, d);
  ctx.restore();
  return true;
}
