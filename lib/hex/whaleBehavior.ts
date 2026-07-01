// What a wallet actually did after each stake-end — pure classification, no I/O.
//
// The Whale Radar's sell/re-stake rating used to infer "sold" from the absence
// of a re-stake, which is wrong: not re-staking can just mean the wallet is
// holding the liquid HEX. Here we classify each past stake-end from real on-chain
// signals into one of:
//   • restaked — a new stake started within RESTAKE_WINDOW_SEC of the end
//   • sold     — the wallet swapped HEX out (HEX_OUT) within the sell window
//   • held     — neither, and we have activity data covering that period
//   • unknown  — neither, but we lack swap data that far back (don't guess)
//
// Re-staking and selling are independent (a wallet can do both — partial
// re-stake, partial sell), so both are surfaced; `outcome` is the headline.

export const RESTAKE_WINDOW_SEC = 14 * 86_400; // new stake within 14d = re-staked
export const SELL_WINDOW_SEC = 30 * 86_400; // HEX sold within 30d of the end = sold

export interface StakeRecord {
  stakeId: string;
  timestamp: number; // unix seconds
  principalHex: number;
  tx?: string;
}

export interface SellRecord {
  timestamp: number; // unix seconds
  hex: number;
  usd: number;
  tx: string;
}

export type EndOutcome = 'restaked' | 'sold' | 'held' | 'unknown';

export interface EndBehavior {
  endStakeId: string;
  endTimestamp: number;
  endHex: number;
  endTx?: string;
  /** Headline classification for this end. */
  outcome: EndOutcome;
  // Re-stake signal
  restaked: boolean;
  restakeStakeId?: string;
  restakeTimestamp?: number;
  restakeHex?: number;
  restakeTx?: string;
  daysAfter?: number;
  // Sell signal (HEX swapped out within the window after the end)
  soldHex: number;
  soldUsd: number;
  sellCount: number;
  firstSellTx?: string;
  daysToSell?: number;
}

/**
 * Classify each stake-end, most recent first. `oldestActivityTs` is the oldest
 * timestamp our swap data covers (null = no swap data): ends older than it that
 * show no sale are `unknown` rather than `held`, so we never claim "held" (or
 * "sold") without the data to back it. Each end's sell window is capped at the
 * next end so a single sale isn't attributed to two ends.
 */
export function classifyEnds(
  ends: StakeRecord[],
  starts: StakeRecord[],
  sells: SellRecord[],
  oldestActivityTs: number | null,
): EndBehavior[] {
  const sortedStarts = [...starts].sort((a, b) => a.timestamp - b.timestamp);
  const sortedEnds = [...ends].sort((a, b) => a.timestamp - b.timestamp);
  const sortedSells = [...sells].sort((a, b) => a.timestamp - b.timestamp);

  const rows = sortedEnds.map((e, i) => {
    const nextEndTs = sortedEnds[i + 1]?.timestamp ?? Infinity;

    const restake = sortedStarts.find(
      (s) => s.timestamp > e.timestamp && s.timestamp <= e.timestamp + RESTAKE_WINDOW_SEC,
    );

    const sellCutoff = Math.min(e.timestamp + SELL_WINDOW_SEC, nextEndTs);
    const windowSells = sortedSells.filter((s) => s.timestamp > e.timestamp && s.timestamp <= sellCutoff);
    const soldHex = windowSells.reduce((a, s) => a + s.hex, 0);
    const soldUsd = windowSells.reduce((a, s) => a + s.usd, 0);

    const restaked = !!restake;
    const sold = soldHex > 0;
    const covered = oldestActivityTs != null && oldestActivityTs <= e.timestamp;
    const outcome: EndOutcome = restaked ? 'restaked' : sold ? 'sold' : covered ? 'held' : 'unknown';

    return {
      endStakeId: e.stakeId,
      endTimestamp: e.timestamp,
      endHex: e.principalHex,
      endTx: e.tx,
      outcome,
      restaked,
      restakeStakeId: restake?.stakeId,
      restakeTimestamp: restake?.timestamp,
      restakeHex: restake?.principalHex,
      restakeTx: restake?.tx,
      daysAfter: restake ? Math.round((restake.timestamp - e.timestamp) / 86_400) : undefined,
      soldHex,
      soldUsd,
      sellCount: windowSells.length,
      firstSellTx: windowSells[0]?.tx,
      daysToSell: windowSells.length ? Math.round((windowSells[0].timestamp - e.timestamp) / 86_400) : undefined,
    };
  });

  return rows.reverse(); // most recent end first
}

export interface BehaviorSummary {
  total: number;
  restaked: number;
  sold: number;
  held: number;
  unknown: number;
  soldHex: number;
  soldUsd: number;
}

export function behaviorSummary(ends: EndBehavior[]): BehaviorSummary {
  const s: BehaviorSummary = { total: ends.length, restaked: 0, sold: 0, held: 0, unknown: 0, soldHex: 0, soldUsd: 0 };
  for (const e of ends) {
    s[e.outcome] += 1;
    s.soldHex += e.soldHex;
    s.soldUsd += e.soldUsd;
  }
  return s;
}
