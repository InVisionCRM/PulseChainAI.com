// Subgraph reads that feed the locked-stake mirror.
//
// Only the sync uses these. The macro views read the mirror in Postgres, never
// the subgraph directly — there is no per-day or per-staker aggregate here, so
// answering their questions live would mean summing hundreds of thousands of
// individual stakes on every request.
//
// ENDED vs GOOD-ACCOUNTED — the distinction everything downstream rests on:
//
//   ended          — principal withdrawn. Gone from stakeSharesTotal AND from
//                    lockedHeartsTotal. Not locked by any measure.
//   good-accounted — shares removed from stakeSharesTotal, payout and penalty
//                    frozen, but the principal stays in the contract (and in
//                    lockedHeartsTotal) until someone actually ends it.
//
// So a good-accounted stake holds no shares but still holds HEX that is due.
// It is excluded from T-Share rankings and INCLUDED in the unlock schedule.
// Measured on PulseChain, that is 17,275 stakes holding 40.3B HEX — 6.5% of
// the chain's locked supply, and all of it already overdue.

import { hexSubgraphQuery, type HexNet as Net } from './subgraph';

export interface LockedStake {
  stakeId: string;
  stakerAddr: string;
  stakeShares: string;
  stakedHearts: string;
  endDay: string;
  /** HEX day the stake was opened. With endDay it gives the full term. */
  startDay: string;
  /** Term the staker committed to, in days. */
  stakedDays: string;
  /** Unix seconds the stakeStart was mined — the only wall-clock we get. */
  timestamp: string;
  /** Opened by a contract's auto-stake rather than by hand. */
  isAutoStake: boolean;
  /** Shares already released back to the network; the HEX is still locked. */
  goodAccounted?: boolean;
}

// stakeTShares is deliberately NOT requested: it is stakeShares scaled by 1e12,
// so storing it as well would be a second copy of one fact that can drift.
export const STAKE_FIELDS =
  'stakeId stakerAddr stakeShares stakedHearts endDay startDay stakedDays timestamp isAutoStake';

const PAGE = 1000;
const ID_CHUNK = 500;
const CHUNK_CONCURRENCY = 8;

/** Run `work` over `items` with a fixed number in flight. */
export async function pooled<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
  }
  return out;
}

/**
 * The public subgraph 502s under load often enough to matter when a single
 * request fans out to dozens of queries. One dropped page silently shrinks a
 * total, so every query retries before it is allowed to fail. Shared with the
 * stake-mirror sync, which fans out far wider still.
 */
export async function query<T>(net: Net, q: string, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await hexSubgraphQuery<T>(net, q);
    } catch (err) {
      last = err;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new Error('HEX subgraph query failed');
}

export interface UnlockStatus {
  /** Withdrawn — neither shares nor HEX remain. */
  ended: Set<string>;
  /** Shares released, HEX still locked and still due. */
  goodAccounted: Set<string>;
}

/**
 * Which of these stakes have ended and which have been good-accounted, kept
 * apart because they mean different things (see the header). Both lookups ride
 * the same request per chunk.
 */
export async function unlockStatus(net: Net, ids: string[]): Promise<UnlockStatus> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK));
  const lookup = (chunk: string[]) => {
    const list = chunk.map((id) => `"${id}"`).join(',');
    return query<{ ends: { stakeId: string }[]; accounted: { stakeId: string }[] }>(
      net,
      `{
        ends: stakeEnds(where:{ stakeId_in: [${list}] }, first: ${PAGE}){ stakeId }
        accounted: stakeGoodAccountings(where:{ stakeId_in: [${list}] }, first: ${PAGE}){ stakeId }
      }`,
    );
  };
  const results = await pooled(chunks, CHUNK_CONCURRENCY, lookup);
  const ended = new Set<string>();
  const goodAccounted = new Set<string>();
  for (const r of results) {
    for (const e of r.ends ?? []) ended.add(String(e.stakeId));
    for (const g of r.accounted ?? []) goodAccounted.add(String(g.stakeId));
  }
  // Ending is terminal and can follow a good-accounting, so an ended stake is
  // never also treated as merely good-accounted.
  for (const id of ended) goodAccounted.delete(id);
  return { ended, goodAccounted };
}

export interface NetworkTotals {
  /** Live T-Shares across the whole chain. */
  tShares: number;
  /** HEX locked in stakes across the whole chain. */
  hexLocked: number;
  /** Highest stakeId opened on chain — the denominator for fill progress. */
  latestStakeId: number;
}

/** The chain's own locked totals, straight from the subgraph's globalInfo. */
export async function networkTotals(net: Net): Promise<NetworkTotals> {
  const d = await query<{
    globalInfos: { stakeSharesTotal: string; lockedHeartsTotal: string; latestStakeId: string }[];
  }>(
    net,
    '{ globalInfos(first: 1, orderBy: timestamp, orderDirection: desc){ stakeSharesTotal lockedHeartsTotal latestStakeId } }',
  );
  const g = d.globalInfos?.[0];
  return {
    tShares: Number(g?.stakeSharesTotal ?? 0) / 1e12,
    hexLocked: Number(g?.lockedHeartsTotal ?? 0) / 1e8,
    latestStakeId: Number(g?.latestStakeId ?? 0),
  };
}
