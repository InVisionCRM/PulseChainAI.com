// Fetching the chain's LOCKED HEX stakes out of the staking subgraph.
//
// Shared by the two macro views that both need "the biggest stakes still
// locked" — the staker leagues and the unlock schedule. The pagination here is
// fiddly enough (skip caps, share cursors, dead-stake filtering) that having
// two copies of it would be two places to get it subtly wrong.
//
// WHAT COUNTS AS LOCKED
// A stake's shares leave the network's total the moment it is ended OR
// good-accounted, so both are filtered out. This is not a rounding detail:
// among stakes whose end day is still in the future, 10.6% by count and 19.4%
// by HEX have already been ended or good-accounted early. Counting them would
// overstate every figure downstream.
//
// WHY IT IS A SAMPLE
// There is no per-staker or per-day aggregate in the subgraph, so every figure
// has to be summed from individual stakes — and there are hundreds of thousands
// of locked stakes, far more than one request can page through. We therefore
// take the largest N by shares, which is where essentially all of the value
// sits: 25,000 stakes cover ~94% of the chain's live T-Shares and ~91% of its
// locked HEX. Callers surface that coverage rather than implying completeness.

import { hexSubgraphQuery, type HexNet as Net } from './subgraph';

export interface LockedStake {
  stakeId: string;
  stakerAddr: string;
  stakeShares: string;
  stakedHearts: string;
  endDay: string;
}

export const STAKE_FIELDS = 'stakeId stakerAddr stakeShares stakedHearts endDay';

const PAGE = 1000;
/** graph-node refuses `skip` above 5000, so a batch is five pages. */
const PAGES_PER_BATCH = 5;
export const STAKES_PER_BATCH = PAGE * PAGES_PER_BATCH;
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
 * total, so every query retries before it is allowed to fail.
 */
async function query<T>(net: Net, q: string, tries = 3): Promise<T> {
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

/** The `batches * 5,000` largest stakes on the chain by shares, biggest first. */
export async function largestStakes(net: Net, batches: number): Promise<LockedStake[]> {
  const seen = new Map<string, LockedStake>();
  let cursor: string | null = null;
  for (let b = 0; b < batches; b++) {
    // `_lte` (not `_lt`) so stakes tied on the boundary value aren't skipped;
    // the map de-duplicates the boundary rows that come back twice.
    const where = cursor ? `, where:{ stakeShares_lte: "${cursor}" }` : '';
    const pages = await Promise.all(
      Array.from({ length: PAGES_PER_BATCH }, (_, i) =>
        query<{ stakeStarts: LockedStake[] }>(
          net,
          `{ stakeStarts(orderBy: stakeShares, orderDirection: desc, first: ${PAGE}, skip: ${i * PAGE}${where}){ ${STAKE_FIELDS} } }`,
        ).then((d) => d.stakeStarts ?? []),
      ),
    );
    const flat = pages.flat();
    const fresh = flat.filter((s) => !seen.has(String(s.stakeId)));
    for (const s of flat) seen.set(String(s.stakeId), s);
    // Exhausted the chain, or the batch brought nothing new — stop paging.
    if (flat.length < STAKES_PER_BATCH || fresh.length === 0) break;
    cursor = flat.reduce((min, s) => (BigInt(s.stakeShares) < BigInt(min) ? s.stakeShares : min), flat[0].stakeShares);
  }
  return [...seen.values()].sort((a, b) => (BigInt(b.stakeShares) > BigInt(a.stakeShares) ? 1 : -1));
}

/**
 * Every stake below `belowShares` belonging to one of `addresses` — the tail
 * that the size-ranked sample cuts off. Used to make a ranked staker's total
 * its real total.
 */
export async function remainingStakesFor(
  net: Net,
  addresses: string[],
  belowShares: string,
  groupSize = 100,
): Promise<LockedStake[]> {
  const groups: string[][] = [];
  for (let i = 0; i < addresses.length; i += groupSize) groups.push(addresses.slice(i, i + groupSize));
  const sweep = async (group: string[]): Promise<LockedStake[]> => {
    const list = group.map((a) => `"${a}"`).join(',');
    const out: LockedStake[] = [];
    let cursor = belowShares;
    // Cursor-paged rather than skip-paged: a large group can hold well over
    // 5000 small stakes, which is exactly where `skip` gives out.
    for (let page = 0; page < 6; page++) {
      const d = await query<{ stakeStarts: LockedStake[] }>(
        net,
        `{ stakeStarts(where:{ stakerAddr_in: [${list}], stakeShares_lt: "${cursor}" }, orderBy: stakeShares, orderDirection: desc, first: ${PAGE}){ ${STAKE_FIELDS} } }`,
      );
      const rows = d.stakeStarts ?? [];
      out.push(...rows);
      if (rows.length < PAGE) break;
      cursor = rows[rows.length - 1].stakeShares;
    }
    return out;
  };
  return (await pooled(groups, 3, sweep)).flat();
}

/**
 * stakeIds whose shares no longer count toward the network total — ended OR
 * good-accounted. Both lookups ride the same request per chunk.
 */
export async function inactiveStakeIds(net: Net, ids: string[]): Promise<Set<string>> {
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
  const out = new Set<string>();
  for (const r of results) {
    for (const e of r.ends ?? []) out.add(String(e.stakeId));
    for (const g of r.accounted ?? []) out.add(String(g.stakeId));
  }
  return out;
}

export interface LockedSample {
  /** Stakes still locked — ended and good-accounted ones removed. */
  live: LockedStake[];
  /** How many stakes were examined to find them. */
  sampled: number;
  /** Shares of the smallest stake looked at — the sample's floor. */
  cutoffShares: string;
}

/** The largest locked stakes on the chain, with dead ones already removed. */
export async function fetchLockedStakes(net: Net, batches: number): Promise<LockedSample> {
  const sample = await largestStakes(net, batches);
  if (!sample.length) throw new Error('No stakes returned by the HEX subgraph');
  const dead = await inactiveStakeIds(net, sample.map((s) => String(s.stakeId)));
  return {
    live: sample.filter((s) => !dead.has(String(s.stakeId))),
    sampled: sample.length,
    cutoffShares: sample[sample.length - 1].stakeShares,
  };
}

export interface NetworkTotals {
  /** Live T-Shares across the whole chain. */
  tShares: number;
  /** HEX locked in stakes across the whole chain. */
  hexLocked: number;
}

/** The chain's own locked totals, straight from the subgraph's globalInfo. */
export async function networkTotals(net: Net): Promise<NetworkTotals> {
  const d = await query<{ globalInfos: { stakeSharesTotal: string; lockedHeartsTotal: string }[] }>(
    net,
    '{ globalInfos(first: 1, orderBy: timestamp, orderDirection: desc){ stakeSharesTotal lockedHeartsTotal } }',
  );
  const g = d.globalInfos?.[0];
  return {
    tShares: Number(g?.stakeSharesTotal ?? 0) / 1e12,
    hexLocked: Number(g?.lockedHeartsTotal ?? 0) / 1e8,
  };
}
