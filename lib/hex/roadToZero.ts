// The Road to Zero: how many matured HEX stakes are still bleeding, how many
// have bled out entirely, and how much HEX the late penalty has already taken
// from them — interest included.
//
// Every figure is computed the way HEX.sol computes it, from the contract's own
// data, so the snapshot cron and the one-time history rebuild cannot disagree:
//
//   payout   _calcPayoutRewards: for each day of the term,
//            dayPayoutTotal × stakeShares / dayStakeSharesTotal (floored per
//            day), plus the Big Pay Day slice and adoption bonus for terms that
//            span day 352. Daily data comes from dailyDataRange() rather than
//            the subgraph, which is missing days 0, 1255 and 1256.
//   penalty  _calcLatePenalty: (principal + payout) × daysPastGrace / 700,
//            capped at principal + payout (the cappedPenalty actually taken).
//
// Verified 2026-10-05: the payout matched the StakeGoodAccounting event's
// recorded payout to the heart on 400 of 400 keeper rescues, including all 18
// whose terms span Big Pay Day.
//
// Day convention: HEX days from the contract. The subgraph's startDay/endDay
// run one day ahead of the contract's lockedDay (verified on stake 894348:
// contract lockedDay 1830, subgraph startDay 1831), so lockedDay = startDay - 1.

import { keccak256 } from '@ethersproject/keccak256';
import { toUtf8Bytes } from '@ethersproject/strings';
import { ethCall } from '@/lib/portfolio/evmRpc';
import { HEX_ADDRESS, HEX_LAUNCH_TS, LATE_PENALTY_GRACE_DAYS, LATE_PENALTY_SCALE_DAYS, currentHexDay } from '@/lib/hex/hexDay';
import { hexSubgraphQuery } from '@/lib/hex/subgraph';
import { readRescueCandidates } from '@/lib/db/hexLockedStakes';
import { defaultMinPrincipalHex, defaultMaxPrincipalHex } from '@/lib/hex/rescue';

// HEX.sol constants (verified source on PulseChain's explorer).
const BIG_PAY_DAY = 352; // CLAIM_PHASE_END_DAY (1 + 350) + 1
const HEARTS_PER_SATOSHI = 10_000n; // HEARTS_PER_HEX / SATOSHIS_PER_BTC * HEX_PER_BTC
const CLAIMABLE_BTC_ADDR_COUNT = 27_997_742n;
const CLAIMABLE_SATOSHIS_TOTAL = 910_087_996_911_001n;
const HEART_UINT_SIZE = 72n;

const sel = (sig: string) => keccak256(toUtf8Bytes(sig)).slice(0, 10);
const word = (hex: string, i: number) => BigInt('0x' + hex.slice(2 + i * 64, 2 + (i + 1) * 64));
const pad = (n: number) => n.toString(16).padStart(64, '0');

/** One stake, in the contract's terms. */
export interface RoadStake {
  stakeId: string;
  lockedDay: number;
  stakedDays: number;
  stakedHearts: bigint;
  stakeShares: bigint;
}

/** What the payout formula needs from the contract. */
export interface PayoutData {
  /** dayPayoutTotal and dayStakeSharesTotal for days 0 .. dailyDataCount-1. */
  dayPayout: bigint[];
  dayShares: bigint[];
  unclaimedSatoshis: bigint;
  claimedSatoshis: bigint;
  claimedBtcAddrCount: bigint;
}

/** Every day's payout data plus the claim stats, straight from the contract. */
export async function fetchPayoutData(): Promise<PayoutData> {
  const g = await ethCall('pulsechain', HEX_ADDRESS, sel('globalInfo()'));
  if (!g) throw new Error('globalInfo() unreadable');
  const dailyDataCount = Number(word(g, 4));
  const r = await ethCall('pulsechain', HEX_ADDRESS, sel('dailyDataRange(uint256,uint256)') + pad(0) + pad(dailyDataCount));
  if (!r) throw new Error('dailyDataRange() unreadable');
  const len = Number(word(r, 1));
  if (len !== dailyDataCount) throw new Error(`dailyDataRange returned ${len} days, expected ${dailyDataCount}`);
  const mask = (1n << HEART_UINT_SIZE) - 1n;
  const dayPayout: bigint[] = [];
  const dayShares: bigint[] = [];
  for (let i = 0; i < len; i++) {
    const v = word(r, 2 + i);
    dayPayout.push(v & mask);
    dayShares.push((v >> HEART_UINT_SIZE) & mask);
  }
  return { dayPayout, dayShares, unclaimedSatoshis: word(g, 7), claimedSatoshis: word(g, 8), claimedBtcAddrCount: word(g, 9) };
}

/** Principal + interest in hearts — HEX's rawStakeReturn for a served stake. */
export function stakeReturnHearts(s: RoadStake, d: PayoutData): bigint {
  const end = s.lockedDay + s.stakedDays;
  if (end > d.dayPayout.length) throw new Error(`stake ${s.stakeId} ends on day ${end}, past the contract's daily data`);
  let payout = 0n;
  for (let day = s.lockedDay; day < end; day++) payout += (d.dayPayout[day] * s.stakeShares) / d.dayShares[day];
  if (s.lockedDay <= BIG_PAY_DAY && end > BIG_PAY_DAY) {
    const slice = (d.unclaimedSatoshis * HEARTS_PER_SATOSHI * s.stakeShares) / d.dayShares[BIG_PAY_DAY];
    payout += slice + (slice * d.claimedBtcAddrCount) / CLAIMABLE_BTC_ADDR_COUNT + (slice * d.claimedSatoshis) / CLAIMABLE_SATOSHIS_TOTAL;
  }
  return s.stakedHearts + payout;
}

/** Days of late penalty a stake has accrued if unlocked on `day` (0 in grace). */
export function daysPastGrace(s: RoadStake, day: number): number {
  return Math.max(0, day - (s.lockedDay + s.stakedDays + LATE_PENALTY_GRACE_DAYS));
}

/** The penalty HEX would take if the stake were unlocked on `day`, capped. */
export function latePenaltyHearts(s: RoadStake, gross: bigint, day: number): bigint {
  const late = BigInt(daysPastGrace(s, day));
  const penalty = (gross * late) / BigInt(LATE_PENALTY_SCALE_DAYS);
  return penalty > gross ? gross : penalty;
}

export interface RoadState {
  /** HEX day the state is for. */
  day: number;
  /** Bleeding or bled out, and not yet ended or good-accounted. */
  remaining: number;
  /** Of those, still losing HEX every day. */
  bleeding: number;
  /** Of those, past 700 days of penalty — nothing left to save. */
  drained: number;
  /** Their principal, HEX. */
  principalHex: number;
  /** Penalty already accrued on them, interest included, HEX. */
  penaltyHex: number;
}

const toHex = (h: bigint) => Number(h / 10_000n) / 10_000; // hearts → HEX, 4 dp, no float overflow

/**
 * The state on `day` of a set of stakes that are all unresolved then (the
 * caller filters out ones already ended or good-accounted). `grossOf` caches
 * stakeReturnHearts per stake.
 */
export function roadState(stakes: RoadStake[], day: number, grossOf: (s: RoadStake) => bigint): RoadState {
  let remaining = 0, bleeding = 0, drained = 0;
  let principal = 0n, penalty = 0n;
  for (const s of stakes) {
    const late = daysPastGrace(s, day);
    if (late === 0) continue;
    remaining += 1;
    if (late >= LATE_PENALTY_SCALE_DAYS) drained += 1; else bleeding += 1;
    principal += s.stakedHearts;
    penalty += latePenaltyHearts(s, grossOf(s), day);
  }
  return { day, remaining, bleeding, drained, principalHex: toHex(principal), penaltyHex: toHex(penalty) };
}

/* ───────────────────────────── data loaders ───────────────────────────── */

/** A subgraph read that retries, then FAILS. Never skips: a missing end or
 *  good-accounting record would count a stake as unresolved forever. */
export async function subgraphStrict<T>(query: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await hexSubgraphQuery<T>('pulsechain', query);
    } catch (e) {
      if (attempt >= 6) throw e;
      await new Promise((r) => setTimeout(r, 2_000 * (attempt + 1)));
    }
  }
}

export const hexDayOf = (unixSec: number) => Math.floor((unixSec - HEX_LAUNCH_TS) / 86_400);

/** Earliest day each stake was ended or good-accounted. Absent = neither. */
export async function resolutionDays(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  // 500 ids per query: a stake has at most one end and one good-accounting,
  // so both result sets stay under the 1000 cap.
  for (let i = 0; i < ids.length; i += 500) {
    const list = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
    const d = await subgraphStrict<{ stakeEnds: { stakeId: string; timestamp: string }[]; stakeGoodAccountings: { stakeId: string; timestamp: string }[] }>(
      `{ stakeEnds(where:{ stakeId_in:[${list}] }, first: 1000){ stakeId timestamp } stakeGoodAccountings(where:{ stakeId_in:[${list}] }, first: 1000){ stakeId timestamp } }`,
    );
    for (const r of [...d.stakeEnds, ...d.stakeGoodAccountings]) {
      const day = hexDayOf(Number(r.timestamp));
      const prev = out.get(r.stakeId);
      if (prev == null || day < prev) out.set(r.stakeId, day);
    }
  }
  return out;
}

interface RawStart { stakeId: string; startDay: string; stakedDays: string; stakedHearts: string; stakeShares: string }

export const START_FIELDS = 'stakeId startDay stakedDays stakedHearts stakeShares';

/** A subgraph stakeStart in the contract's terms (lockedDay = startDay - 1). */
export const toRoadStake = (r: RawStart): RoadStake => ({
  stakeId: r.stakeId,
  lockedDay: Number(r.startDay) - 1,
  stakedDays: Number(r.stakedDays),
  stakedHearts: BigInt(r.stakedHearts),
  stakeShares: BigInt(r.stakeShares),
});

/** The terms of each stake id. Throws if any id is missing from the subgraph. */
export async function stakesByIds(ids: string[]): Promise<RoadStake[]> {
  const out: RoadStake[] = [];
  for (let i = 0; i < ids.length; i += 1000) {
    const list = ids.slice(i, i + 1000).map((id) => `"${id}"`).join(',');
    const d = await subgraphStrict<{ stakeStarts: RawStart[] }>(`{ stakeStarts(where:{ stakeId_in:[${list}] }, first: 1000){ ${START_FIELDS} } }`);
    out.push(...d.stakeStarts.map(toRoadStake));
  }
  if (out.length !== ids.length) throw new Error(`subgraph returned ${out.length} of ${ids.length} stakes`);
  return out;
}

/** Ceiling on how many stakes one live read handles; past it, fail loudly. */
const LIVE_LIMIT = 50_000;

export interface LiveRoad extends RoadState { minHex: number; maxHex: number }

/**
 * The road as it stands now, for the keeper's principal range. Candidates come
 * from the locked-stake mirror (complete, fast) — but it syncs once a day, so
 * each is re-checked against the subgraph for an end or good-accounting.
 */
export async function liveRoad(): Promise<LiveRoad> {
  const today = currentHexDay();
  const minHex = defaultMinPrincipalHex();
  const maxHex = defaultMaxPrincipalHex();
  // Bleeding today: lockedDay + stakedDays + 14 < today, and the mirror's
  // end_day is the subgraph's endDay = lockedDay + stakedDays + 1.
  const rows = await readRescueCandidates('pulsechain', {
    maturedBefore: today - LATE_PENALTY_GRACE_DAYS + 1,
    minHearts: String(BigInt(Math.round(minHex)) * 100_000_000n),
    maxHearts: String(BigInt(Math.round(maxHex)) * 100_000_000n),
    limit: LIVE_LIMIT,
  });
  if (rows === null) throw new Error('locked-stake mirror not ready');
  if (rows.length >= LIVE_LIMIT) throw new Error(`more than ${LIVE_LIMIT} candidates; raise LIVE_LIMIT`);
  const resolved = await resolutionDays(rows.map((r) => r.stakeId));
  const open = rows.filter((r) => !resolved.has(r.stakeId)).map((r) => r.stakeId);
  const [stakes, data] = await Promise.all([stakesByIds(open), fetchPayoutData()]);
  return { ...roadState(stakes, today, (s) => stakeReturnHearts(s, data)), minHex, maxHex };
}

