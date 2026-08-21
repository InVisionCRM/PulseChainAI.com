// When a stake began, and for how long it was meant to run.
//
// The third of the small subgraph lookups beside goodAccounting.ts and
// stakeEnds.ts, and the one that gives a rescue a beginning: the rescue feed
// is built from the keeper's transactions, which know when we froze a stake
// but nothing about when its owner opened it.

import { hexSubgraphQuery, type HexNet } from './subgraph';
import { heartsToHex } from './hexDay';

export interface StakeStartRecord {
  stakeId: string;
  stakerAddr: string;
  principalHex: number;
  /** HEX day the stake was opened. */
  startDay: number;
  /** Committed term, in days. */
  stakedDays: number;
  /** Unix ms the stake was opened. */
  timestamp: number;
}

interface RawStart {
  stakeId: string; stakerAddr: string; stakedHearts: string;
  startDay: string; stakedDays: string; timestamp: string;
}

const START_FIELDS = 'stakeId stakerAddr stakedHearts startDay stakedDays timestamp';

const toRecord = (s: RawStart): StakeStartRecord => ({
  stakeId: String(s.stakeId),
  stakerAddr: s.stakerAddr.toLowerCase(),
  principalHex: heartsToHex(s.stakedHearts),
  startDay: Number(s.startDay) || 0,
  stakedDays: Number(s.stakedDays) || 0,
  timestamp: Number(s.timestamp) * 1000,
});

/** Start records for a set of stakeIds, keyed by stakeId. Best-effort per
 *  chunk, matching the sibling lookups. */
export async function fetchStakeStarts(
  net: HexNet,
  stakeIds: (string | number)[],
): Promise<Map<string, StakeStartRecord>> {
  const out = new Map<string, StakeStartRecord>();
  const ids = [...new Set(stakeIds.map(String))];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
    try {
      const d = await hexSubgraphQuery<{ stakeStarts: RawStart[] }>(
        net,
        `{ stakeStarts(where:{ stakeId_in: [${chunk}] }, first: 1000){ ${START_FIELDS} } }`,
      );
      for (const s of d.stakeStarts ?? []) out.set(String(s.stakeId), toRecord(s));
    } catch {
      /* best-effort: skip this chunk */
    }
  }
  return out;
}
