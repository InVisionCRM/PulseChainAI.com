// What a wallet actually did after each stake-end — pure classification, no I/O.
//
// The Whale Radar used to infer "sold" from the absence of a re-stake, which is
// wrong: not re-staking can just mean holding the liquid HEX, or moving it
// somewhere that isn't a sale. Here we classify each past stake-end from real
// on-chain signals — a re-stake (staking subgraph) and HEX outflows split into
// DEX sells vs plain transfers ("moves") — into one of:
//   • restaked — a new stake started within RESTAKE_WINDOW_SEC of the end
//   • sold     — HEX swapped out on a DEX pair within the window (with amount)
//   • moved    — HEX transferred out (not to a DEX) — moved, not proven sold
//   • held     — none of the above, and we have activity data covering the period
//   • unknown  — none of the above, but we lack activity data that far back
//
// A single sale can't be double-counted: each end's window is capped at the next
// end. Re-stake takes precedence, then a DEX sale, then a move.

export const RESTAKE_WINDOW_SEC = 14 * 86_400; // new stake within 14d = re-staked
export const SELL_WINDOW_SEC = 30 * 86_400; // outflow within 30d of the end counts

export interface StakeRecord {
  stakeId: string;
  timestamp: number; // unix seconds
  principalHex: number;
  tx?: string;
}

/** A HEX outflow from the wallet, classified at the source as a DEX sale or a
 *  plain transfer ("move"). `usd` is best-effort (0 when unknown). */
export interface OutflowRecord {
  timestamp: number; // unix seconds
  hex: number;
  usd: number;
  tx: string;
  kind: 'sell' | 'move';
}

export type EndOutcome = 'restaked' | 'sold' | 'moved' | 'held' | 'unknown';

export interface EndBehavior {
  endStakeId: string;
  endTimestamp: number;
  endHex: number;
  endTx?: string;
  outcome: EndOutcome;
  // Re-stake signal
  restaked: boolean;
  restakeStakeId?: string;
  restakeTimestamp?: number;
  restakeHex?: number;
  restakeTx?: string;
  daysAfter?: number;
  // DEX sale signal
  soldHex: number;
  soldUsd: number;
  sellCount: number;
  firstSellTx?: string;
  daysToSell?: number;
  // Plain-transfer ("moved out") signal
  movedHex: number;
  moveCount: number;
  firstMoveTx?: string;
  daysToMove?: number;
}

/**
 * Classify each stake-end, most recent first. `oldestActivityTs` is the oldest
 * timestamp our activity data covers (null = none): ends older than it that show
 * no sale/move are `unknown` rather than `held`, so we never claim "held" (or
 * "sold"/"moved") without the data to back it.
 */
export function classifyEnds(
  ends: StakeRecord[],
  starts: StakeRecord[],
  outflows: OutflowRecord[],
  oldestActivityTs: number | null,
): EndBehavior[] {
  const sortedStarts = [...starts].sort((a, b) => a.timestamp - b.timestamp);
  const sortedEnds = [...ends].sort((a, b) => a.timestamp - b.timestamp);
  const sortedOut = [...outflows].sort((a, b) => a.timestamp - b.timestamp);

  const rows = sortedEnds.map((e, i) => {
    const nextEndTs = sortedEnds[i + 1]?.timestamp ?? Infinity;

    const restake = sortedStarts.find(
      (s) => s.timestamp > e.timestamp && s.timestamp <= e.timestamp + RESTAKE_WINDOW_SEC,
    );

    const cutoff = Math.min(e.timestamp + SELL_WINDOW_SEC, nextEndTs);
    const win = sortedOut.filter((o) => o.timestamp > e.timestamp && o.timestamp <= cutoff);
    const sells = win.filter((o) => o.kind === 'sell');
    const moves = win.filter((o) => o.kind === 'move');
    const soldHex = sells.reduce((a, s) => a + s.hex, 0);
    const soldUsd = sells.reduce((a, s) => a + s.usd, 0);
    const movedHex = moves.reduce((a, s) => a + s.hex, 0);

    const restaked = !!restake;
    const sold = soldHex > 0;
    const moved = movedHex > 0;
    const covered = oldestActivityTs != null && oldestActivityTs <= e.timestamp;
    const outcome: EndOutcome = restaked ? 'restaked' : sold ? 'sold' : moved ? 'moved' : covered ? 'held' : 'unknown';

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
      sellCount: sells.length,
      firstSellTx: sells[0]?.tx,
      daysToSell: sells.length ? Math.round((sells[0].timestamp - e.timestamp) / 86_400) : undefined,
      movedHex,
      moveCount: moves.length,
      firstMoveTx: moves[0]?.tx,
      daysToMove: moves.length ? Math.round((moves[0].timestamp - e.timestamp) / 86_400) : undefined,
    };
  });

  return rows.reverse(); // most recent end first
}

export interface BehaviorSummary {
  total: number;
  restaked: number;
  sold: number;
  moved: number;
  held: number;
  unknown: number;
  soldHex: number;
  soldUsd: number;
  movedHex: number;
}

export function behaviorSummary(ends: EndBehavior[]): BehaviorSummary {
  const s: BehaviorSummary = { total: ends.length, restaked: 0, sold: 0, moved: 0, held: 0, unknown: 0, soldHex: 0, soldUsd: 0, movedHex: 0 };
  for (const e of ends) {
    s[e.outcome] += 1;
    s.soldHex += e.soldHex;
    s.soldUsd += e.soldUsd;
    s.movedHex += e.movedHex;
  }
  return s;
}
