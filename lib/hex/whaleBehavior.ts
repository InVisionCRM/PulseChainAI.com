// What a wallet actually did after each stake-end — pure classification, no I/O.
//
// The Whale Radar used to infer "sold" from the absence of a re-stake, which is
// wrong: not re-staking can just mean holding the liquid HEX, or moving it
// somewhere that isn't a sale. Here we classify each past stake-end from real
// on-chain signals — a re-stake (staking subgraph) and HEX outflows, each read
// from its transaction receipt — into one of:
//   • restaked — a new stake started within RESTAKE_WINDOW_SEC of the end, or
//                the HEX went into a stake through a contract (an HSI)
//   • sold     — HEX left in a transaction that swapped it (with amount)
//   • moved    — HEX transferred out with no swap — moved, not proven sold
//   • held     — none of the above, and we have activity data covering the period
//   • unknown  — none of the above, but we lack activity data that far back
//
// A single sale can't be double-counted: each end's window is capped at the next
// end. Ends with no HEX leaving between them are one BATCH and share a window —
// a wallet ending three stakes in two minutes and then selling sold from all
// three, not from the last alone. Re-stake takes precedence, then a sale, then
// a move.

export const RESTAKE_WINDOW_SEC = 14 * 86_400; // new stake within 14d = re-staked
export const SELL_WINDOW_SEC = 30 * 86_400; // outflow within 30d of the end counts
/** Ends further apart than this are never one batch, whatever happened between
 *  them — every back-to-back case measured was 0–2 minutes apart, and an end
 *  weeks earlier did not cause a later stake's sale. */
export const BATCH_GAP_SEC = 86_400;

export interface StakeRecord {
  stakeId: string;
  timestamp: number; // unix seconds
  principalHex: number;
  tx?: string;
}

/**
 * A HEX outflow from the wallet, classified from its transaction receipt:
 *   sell    — the transaction swapped (a V2 or V3 Swap event), whoever the HEX
 *             was handed to. Aggregators (Piteas, Internet Money, Switch) take
 *             the HEX into their own contract first, so "sent to a HEX pair"
 *             missed 9.58M of 18.16M HEX sold by collected-rescue wallets.
 *   restake — the transaction started a HEX stake (StakeStart from the HEX
 *             contract): staked through a contract such as an HSI.
 *   move    — neither: a plain transfer.
 * `usd` is best-effort (0 when unknown).
 */
export interface OutflowRecord {
  timestamp: number; // unix seconds
  hex: number;
  usd: number;
  tx: string;
  kind: 'sell' | 'move' | 'restake';
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
  const outBetween = (from: number, to: number) => sortedOut.some((o) => o.timestamp > from && o.timestamp <= to);

  // Batches: consecutive ends with no outflow between them.
  const batchOf: number[] = [];
  sortedEnds.forEach((e, i) => {
    const prev = sortedEnds[i - 1];
    const apart = i > 0 && (e.timestamp - prev.timestamp > BATCH_GAP_SEC || outBetween(prev.timestamp, e.timestamp));
    batchOf[i] = i === 0 ? 0 : apart ? batchOf[i - 1] + 1 : batchOf[i - 1];
  });

  const rows = sortedEnds.map((e, i) => {
    const members = sortedEnds.filter((_, k) => batchOf[k] === batchOf[i]);
    const last = members[members.length - 1];
    const nextBatchStart = sortedEnds.find((_, k) => batchOf[k] === batchOf[i] + 1)?.timestamp ?? Infinity;
    // This end's share of what the batch did, by the HEX each end returned.
    const batchHex = members.reduce((a, m) => a + m.principalHex, 0);
    const share = batchHex > 0 ? e.principalHex / batchHex : 1 / members.length;

    const restakeStart = sortedStarts.find(
      (s) => s.timestamp > e.timestamp && s.timestamp <= e.timestamp + RESTAKE_WINDOW_SEC,
    );

    const cutoff = Math.min(last.timestamp + SELL_WINDOW_SEC, nextBatchStart);
    const win = sortedOut.filter((o) => o.timestamp > last.timestamp && o.timestamp <= cutoff);
    const sells = win.filter((o) => o.kind === 'sell');
    const moves = win.filter((o) => o.kind === 'move');
    const stakedIn = win.filter((o) => o.kind === 'restake');
    const soldHex = sells.reduce((a, o) => a + o.hex, 0) * share;
    const soldUsd = sells.reduce((a, o) => a + o.usd, 0) * share;
    const movedHex = moves.reduce((a, o) => a + o.hex, 0) * share;

    const restaked = !!restakeStart || stakedIn.length > 0;
    const sold = soldHex > 0;
    const moved = movedHex > 0;
    const covered = oldestActivityTs != null && oldestActivityTs <= e.timestamp;
    const outcome: EndOutcome = restaked ? 'restaked' : sold ? 'sold' : moved ? 'moved' : covered ? 'held' : 'unknown';
    // A stake started by this wallet wins over one started through a contract:
    // it carries a stake id, the contract route only a transaction.
    const restakeTs = restakeStart?.timestamp ?? stakedIn[0]?.timestamp;

    return {
      endStakeId: e.stakeId,
      endTimestamp: e.timestamp,
      endHex: e.principalHex,
      endTx: e.tx,
      outcome,
      restaked,
      restakeStakeId: restakeStart?.stakeId,
      restakeTimestamp: restakeTs,
      restakeHex: restakeStart?.principalHex ?? (stakedIn.length ? stakedIn.reduce((a, o) => a + o.hex, 0) * share : undefined),
      restakeTx: restakeStart?.tx ?? stakedIn[0]?.tx,
      daysAfter: restakeTs != null ? Math.round((restakeTs - e.timestamp) / 86_400) : undefined,
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
