// "Has this stake been ended yet, and on what terms?"
//
// The companion to goodAccounting.ts. That module answers what a rescue FROZE;
// this one answers what happened next — whether the owner ever came back to
// collect, when, and what they actually received.
//
// The pairing is what makes a rescue verifiable. Good-accounting locks the
// payout and penalty as of the day it runs and the stake stops both earning and
// bleeding, so the payout recorded at good-accounting should be exactly the
// payout recorded at the end, however many months later. `prevUnlocked` on the
// end confirms the stake really was unlocked before it was ended rather than
// simply run to term.

import { hexSubgraphQuery, type HexNet } from './subgraph';
import { heartsToHex } from './hexDay';

export interface StakeEndRecord {
  stakeId: string;
  stakerAddr: string;
  principalHex: number;
  /** Interest actually paid out at the end. */
  payoutHex: number;
  penaltyHex: number;
  servedDays: number;
  daysLate: number;
  daysEarly: number;
  /** The stake was good-accounted before it was ended. */
  prevUnlocked: boolean;
  /** Unix ms the end was mined. */
  timestamp: number;
  /** The stakeEnd transaction. */
  tx: string;
}

interface RawEnd {
  stakeId: string; stakerAddr: string; stakedHearts: string; payout: string;
  penalty: string; servedDays: string; daysLate: string; daysEarly: string;
  prevUnlocked: boolean; timestamp: string; transactionHash: string;
}

const END_FIELDS =
  'stakeId stakerAddr stakedHearts payout penalty servedDays daysLate daysEarly prevUnlocked timestamp transactionHash';

const toRecord = (e: RawEnd): StakeEndRecord => ({
  stakeId: String(e.stakeId),
  stakerAddr: e.stakerAddr.toLowerCase(),
  principalHex: heartsToHex(e.stakedHearts),
  payoutHex: heartsToHex(e.payout),
  penaltyHex: heartsToHex(e.penalty),
  servedDays: Number(e.servedDays) || 0,
  daysLate: Number(e.daysLate) || 0,
  daysEarly: Number(e.daysEarly) || 0,
  prevUnlocked: !!e.prevUnlocked,
  timestamp: Number(e.timestamp) * 1000,
  tx: String(e.transactionHash),
});

/**
 * End records for a set of stakeIds, keyed by stakeId. A stake with no entry
 * has not been ended — it is still sitting there waiting to be collected.
 *
 * All or nothing, unlike fetchGoodAccountings: the caller reads a missing
 * entry as "not ended", so a skipped chunk would report up to 500 collected
 * stakes as still frozen. Any failed chunk throws instead.
 */
export async function fetchStakeEnds(
  net: HexNet,
  stakeIds: (string | number)[],
): Promise<Map<string, StakeEndRecord>> {
  const out = new Map<string, StakeEndRecord>();
  const ids = [...new Set(stakeIds.map(String))];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
    const d = await hexSubgraphQuery<{ stakeEnds: RawEnd[] }>(
      net,
      `{ stakeEnds(where:{ stakeId_in: [${chunk}] }, first: 1000){ ${END_FIELDS} } }`,
    );
    for (const e of d.stakeEnds ?? []) out.set(String(e.stakeId), toRecord(e));
  }
  return out;
}
