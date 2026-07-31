// "Diamond hands", made measurable.
//
// The phrase has no standard calculation — every glossary that defines it
// (CoinMarketCap, CoinTracker, Ledger, DEXTools) describes a mindset, not a
// metric, and the one real methodology in this space, Nansen's Smart Money, is
// paid and doesn't cover PulseChain. So this is our definition, and it is
// deliberately built from things that can be proved on chain rather than a
// weighted score nobody can audit.
//
// Every source agrees on one thing: diamond hands means *holding through a
// crash*. That is the whole idea here. Two wallets can both be up 100% and
// only one of them sat through a −70% drawdown to get there, and the grade
// says which. Holding a token that only ever went up proves nothing, so the
// deepest drawdown since the wallet's first buy is what separates the tiers —
// not tenure alone, and not profit.
//
// Grades are thresholds, not a black box: each one states the rule it passed,
// so a holder can check the claim rather than trust a number.

export interface PricePoint {
  /** unix seconds, UTC midnight */
  date: number;
  priceUsd: number;
}

export interface WalletRecord {
  firstBuyTs: number | null;
  lastSellTs: number | null;
  buyCount: number;
  sellCount: number;
  buyTokens: number;
  sellTokens: number;
  /** False when tokens also moved by transfer, so retention is only part of the story. */
  basisComplete: boolean;
  /** What the wallet holds today. Guards against shaming on a partial record. */
  balanceTokens?: number | null;
}

export type DiamondTier = 'diamond' | 'steel' | 'held' | 'trimmed' | 'exited' | 'unknown';

export interface DiamondGrade {
  tier: DiamondTier;
  label: string;
  /** The rule this wallet actually passed, in plain words. */
  because: string;
  /** Days since the first on-market buy. */
  daysHeld: number | null;
  /** Share of what it bought that it still holds, 0–1. Null when unknowable. */
  retention: number | null;
  /** Deepest peak-to-trough fall since the first buy, as a positive percent. */
  drawdownPct: number | null;
  /** True when transfers mean the swap record covers only part of the position. */
  provisional: boolean;
}

const DAY = 86_400;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Percent for a drawdown, without ever printing "100%".
 *
 * PP fell 99.83% from its peak — real, and rounding it to "100% drawdown"
 * reads as "the price went to zero", which is a different and false claim.
 * Anything at 99 or above keeps a decimal so the number stays true.
 */
export const fmtDrawdown = (pct: number): string =>
  pct >= 99 ? pct.toFixed(1) : pct.toFixed(0);

/**
 * Deepest peak-to-trough decline on or after `sinceTs`, as a positive percent.
 *
 * Measured from a running peak rather than from the first price: a wallet that
 * bought the bottom and rode a rally still counts as having survived whatever
 * fall came after the top. Returns null when the series doesn't reach back far
 * enough to say anything, which is the honest answer for a wallet that bought
 * before indexing began.
 */
export function worstDrawdownSince(daily: PricePoint[], sinceTs: number): number | null {
  const window = daily.filter((d) => d.date >= sinceTs - DAY && d.priceUsd > 0);
  if (window.length < 2) return null;
  let peak = 0;
  let worst = 0;
  for (const d of window) {
    if (d.priceUsd > peak) peak = d.priceUsd;
    if (peak > 0) {
      const fall = (peak - d.priceUsd) / peak;
      if (fall > worst) worst = fall;
    }
  }
  return worst * 100;
}

/**
 * Grade one wallet.
 *
 * Order matters: the strictest rule that fits wins, so a wallet is never
 * described more generously than the evidence allows.
 */
export function gradeHolder(w: WalletRecord, daily: PricePoint[]): DiamondGrade {
  const now = Date.now() / 1000;
  const daysHeld = w.firstBuyTs ? Math.floor((now - w.firstBuyTs) / DAY) : null;
  const drawdownPct = w.firstBuyTs ? worstDrawdownSince(daily, w.firstBuyTs) : null;

  // Two ways to measure what a wallet kept, and the honest answer is whichever
  // is worse. The swap record says what it sold on PulseX; the balance says
  // what it still has. They disagree exactly when tokens left by transfer —
  // and a wallet that never *sold* but moved its whole bag out is not a
  // diamond hand, it just sold somewhere we can't see. You cannot have kept
  // more than you are holding, so the balance caps the claim.
  const bySwaps = w.buyTokens > 0 ? clamp01(1 - w.sellTokens / w.buyTokens) : null;
  const byBalance =
    w.buyTokens > 0 && w.balanceTokens != null ? clamp01(w.balanceTokens / w.buyTokens) : null;
  const retention =
    bySwaps == null ? null : byBalance == null ? bySwaps : Math.min(bySwaps, byBalance);
  const provisional = !w.basisComplete;

  const base = { daysHeld, retention, drawdownPct, provisional };

  if (!w.firstBuyTs || w.buyCount === 0) {
    return {
      ...base,
      tier: 'unknown',
      label: 'No buy on record',
      because: 'This wallet never bought on PulseX — everything arrived by transfer, so there is no entry to hold from.',
      };
  }

  const dd = drawdownPct ?? 0;
  const held = daysHeld ?? 0;

  const kept = retention ?? 0;

  // The top tier also has to survive the balance check above: never selling is
  // only diamond hands if the tokens are still there.
  if (w.sellCount === 0 && kept >= 0.9 && held >= 180 && dd >= 50) {
    return {
      ...base,
      tier: 'diamond',
      label: 'Diamond',
      because: `Never sold a single token in ${held} days, through a ${fmtDrawdown(dd)}% drawdown.`,
    };
  }
  if (kept >= 0.8 && held >= 90 && dd >= 30) {
    return {
      ...base,
      tier: 'steel',
      label: 'Steel',
      because: `Still holds ${(kept * 100).toFixed(0)}% of what it bought after ${held} days and a ${fmtDrawdown(dd)}% drawdown.`,
    };
  }
  if (kept >= 0.5) {
    return {
      ...base,
      tier: 'held',
      label: 'Held',
      because: `Kept ${(kept * 100).toFixed(0)}% of what it bought${dd >= 20 ? ` through a ${fmtDrawdown(dd)}% drawdown` : ''}.`,
    };
  }
  // Below here the grade is unflattering, so the record has to be good enough
  // to carry it. With transfers in the mix, "sold everything it bought" can be
  // literally true of a wallet still sitting on millions of tokens it received
  // — the swap record simply doesn't cover where those came from. Shaming on a
  // partial record is worse than declining to grade.
  const stillHolding = byBalance != null && byBalance > 0.05;
  if (provisional && stillHolding) {
    return {
      ...base,
      tier: 'unknown',
      label: 'Not scorable',
      // Retention is deliberately dropped here: both numbers behind it are
      // real and they contradict each other, so quoting either as "kept X%"
      // next to a wallet that plainly still holds a bag would be the lie.
      retention: null,
      because: `What this wallet holds doesn't line up with its PulseX record — tokens moved by transfer as well, so the swaps can't account for the position and no grade is claimed.`,
    };
  }

  // How the position left decides what can honestly be said about it. When the
  // balance is far below what the sells account for, the tokens walked out by
  // transfer — and "sold everything across 0 sells" would be a plain false
  // sentence about a wallet that never sold here at all.
  const drainedByTransfer = byBalance != null && bySwaps != null && bySwaps - byBalance >= 0.2;

  if (kept >= 0.1) {
    return {
      ...base,
      tier: 'trimmed',
      label: 'Trimmed',
      because: drainedByTransfer
        ? `Only ${(kept * 100).toFixed(0)}% of what it bought is still in the wallet, and not because it sold here — the rest left by transfer.`
        : `Sold most of what it bought — ${(kept * 100).toFixed(0)}% left after ${w.sellCount} sells.`,
    };
  }
  return {
    ...base,
    tier: 'exited',
    label: 'Exited',
    because: drainedByTransfer
      ? `The whole position is gone from this wallet, moved out by transfer rather than sold on PulseX — to another wallet, or a venue this can't see.`
      : `Sold effectively everything it bought across ${w.sellCount} sells.`,
  };
}

/** Glyph + colour per tier. The gem is the reward; everything else cools off. */
export const TIER_STYLE: Record<DiamondTier, { glyph: string; cls: string }> = {
  diamond: { glyph: '◆', cls: 'text-cyan-300' },
  steel: { glyph: '◆', cls: 'text-sky-400/70' },
  held: { glyph: '●', cls: 'text-emerald-400/70' },
  trimmed: { glyph: '◐', cls: 'text-amber-400/70' },
  exited: { glyph: '○', cls: 'text-[var(--text-faint)]' },
  unknown: { glyph: '·', cls: 'text-[var(--text-faint)]' },
};
