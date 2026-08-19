// Finding — and stopping — HEX stakes that are bleeding out.
//
// A HEX stake that has served its full term stops earning, but it does not stop
// LOSING. Fourteen days after the end day the late-end penalty starts, and it
// takes the whole stake at a rate of 1/700th per day: gross * daysPastGrace/700.
// Stakers who forget, lose their keys, or simply die leave stakes bleeding for
// years. Measured on PulseChain, of the stakes that matured in the last ~400
// days, 17.8% are still sitting there unended, and they burn ~21k HEX a day.
//
// The rescue is possible because of one asymmetry in the contract:
//
//   stakeGoodAccounting(address stakerAddr, uint256 stakeIndex, uint40 stakeId)
//   stakeEnd(uint256 stakeIndex, uint40 stakeId)
//
// `stakeGoodAccounting` takes the staker's ADDRESS and has no caller check —
// anybody may call it for anybody. `stakeEnd` reads `stakeLists[msg.sender]` and
// does `_mint(msg.sender, stakeReturn)`, so only the owner can end a stake, and
// the proceeds go to whoever calls it. That is why this file can rescue a
// stranger's stake but can never finish it for them: good-accounting FREEZES the
// payout and penalty as of today, and the staker still collects, whenever they
// like, by ending it themselves.
//
// Good-accounting is therefore purely a gift. It moves no money to the caller —
// the function emits an event, folds the penalty into the global pool and
// updates the stake — so a key that can only call this can only ever do people
// a favour with its own gas.
//
// `findRescueCandidates` defaults to a 500,000 HEX principal floor. Gas cost
// is driven by a stake's TERM, not its size (see below), so rescuing a 1,100
// HEX stake costs the same as rescuing a 3,000,000 HEX one — the floor exists
// to spend that fixed cost where it recovers the most, and to keep the number
// of transactions a single run signs from growing unbounded as the backlog is
// worked through. It is a default, not a rule: pass a lower `minPrincipalHex`
// to widen the sweep once the largest stakes are handled.
//
// Two facts shape the mechanics, both verified against the deployed contract:
//
//   • `stakeIndex` is NOT stable and is not in the subgraph. `_stakeRemove` is
//     swap-and-pop, so ending any stake in a wallet moves that wallet's last
//     stake into the freed slot. The index has to be resolved on chain
//     immediately before the call and can never be cached. The contract does
//     guard it — `require(stakeIdParam == stRef.stakeId)` — so a stale index
//     reverts rather than good-accounting the wrong stake.
//
//   • Gas scales with the stake's TERM, not its size, because the payout is
//     summed across the stake's daily data. Measured: ~2,900-3,300 gas per day
//     staked — 449k gas for a 135-day stake, 6.75M for a 2,400-day one. Batches
//     must be sized by gas, not by count.

import { ethCall } from '@/lib/portfolio/evmRpc';
import { hexSubgraphQuery, type HexNet } from './subgraph';
import { HEX_ADDRESS, LATE_PENALTY_GRACE_DAYS, LATE_PENALTY_SCALE_DAYS, currentHexDay, heartsToHex } from './hexDay';
import type { ChainId } from '@/services';

/** Selectors, computed from the signatures in the verified HEX ABI. */
export const SEL = {
  stakeCount: '0x33060d90', // stakeCount(address)
  stakeLists: '0x2607443b', // stakeLists(address,uint256)
  stakeGoodAccounting: '0x65cf71b2', // stakeGoodAccounting(address,uint256,uint40)
} as const;

const pad = (hex: string) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');
const word = (hex: string, i: number) => hex.replace(/^0x/, '').slice(i * 64, i * 64 + 64);
const num = (hex: string, i: number) => Number(BigInt('0x' + word(hex, i)));

/** HEX lives at the same address on both chains (PulseChain forked the state). */
const chainOf = (net: HexNet): ChainId => (net === 'ethereum' ? 'ethereum' : 'pulsechain');

export interface RescueCandidate {
  stakeId: string;
  stakerAddr: string;
  principalHex: number;
  endDay: number;
  stakedDays: number;
  /** Days past the 14-day grace — 0 while still inside it. */
  daysBleeding: number;
  /** Share of gross (0-1) the late penalty has already taken. */
  penaltyFraction: number;
}

/**
 * Stakes that have matured and are still bleeding, newest-matured first.
 *
 * The subgraph is used only to NARROW the field: it can say which stakes have
 * no end and no good-accounting event, which is enough to build a candidate
 * list cheaply. It is never trusted as the final word — `resolveStake` re-reads
 * the chain before a single unit of gas is spent, because a stake ended two
 * minutes ago is still "live" to an indexer running a few blocks behind.
 *
 * `minDaysPastGrace` defaults to 1 rather than 0 on purpose. Good-accounting a
 * stake the day it matures is harmless, but ~76% of stakers end their own stakes
 * and would never have needed us; waiting until the grace period has actually
 * lapsed skips all of them and costs the stragglers 1/700th — about 0.14% — of
 * their gross. That is six times less gas for the same practical outcome.
 */
export async function findRescueCandidates(
  net: HexNet,
  opts: { minDaysPastGrace?: number; maxAgeDays?: number; limit?: number; minPrincipalHex?: number } = {},
): Promise<RescueCandidate[]> {
  const { minDaysPastGrace = 1, maxAgeDays = 3000, limit = 500, minPrincipalHex = 500_000 } = opts;
  const today = currentHexDay();
  const newestEnd = today - LATE_PENALTY_GRACE_DAYS - minDaysPastGrace;
  const oldestEnd = today - maxAgeDays;
  // Hearts are HEX's smallest unit, 1e8 to a HEX — the inverse of heartsToHex.
  const minHearts = Math.round(minPrincipalHex * 1e8);

  interface RawStart { stakeId: string; stakerAddr: string; stakedHearts: string; stakedDays: string; endDay: string }
  const starts: RawStart[] = [];
  for (let skip = 0; skip < 5000 && starts.length < limit * 4; skip += 1000) {
    const d = await hexSubgraphQuery<{ stakeStarts: RawStart[] }>(
      net,
      `{ stakeStarts(first: 1000, skip: ${skip}, orderBy: endDay, orderDirection: desc,
          where: { endDay_lt: ${newestEnd}, endDay_gt: ${oldestEnd}, stakedHearts_gte: "${minHearts}" })
        { stakeId stakerAddr stakedHearts stakedDays endDay } }`,
    );
    const batch = d.stakeStarts ?? [];
    starts.push(...batch);
    if (batch.length < 1000) break;
  }
  if (starts.length === 0) return [];

  // Drop anything already ended or already good-accounted.
  const settled = new Set<string>();
  const ids = starts.map((s) => String(s.stakeId));
  for (const field of ['stakeEnds', 'stakeGoodAccountings'] as const) {
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
      try {
        const d = await hexSubgraphQuery<Record<string, { stakeId: string }[]>>(
          net,
          `{ ${field}(first: 1000, where: { stakeId_in: [${chunk}] }) { stakeId } }`,
        );
        for (const e of d[field] ?? []) settled.add(String(e.stakeId));
      } catch {
        // A failed chunk must not silently shrink the settled set, or we would
        // spend gas on stakes that are already done. Give up on the whole run
        // instead — the next run will retry.
        throw new Error(`rescue: could not confirm ${field}; aborting rather than risk wasted calls`);
      }
    }
  }

  return starts
    .filter((s) => !settled.has(String(s.stakeId)))
    .map((s) => {
      const endDay = Number(s.endDay);
      const daysBleeding = Math.max(0, today - endDay - LATE_PENALTY_GRACE_DAYS);
      return {
        stakeId: String(s.stakeId),
        stakerAddr: s.stakerAddr.toLowerCase(),
        principalHex: heartsToHex(s.stakedHearts),
        endDay,
        stakedDays: Number(s.stakedDays),
        daysBleeding,
        penaltyFraction: Math.min(1, daysBleeding / LATE_PENALTY_SCALE_DAYS),
      };
    })
    .slice(0, limit);
}

export interface ResolvedStake {
  /** Current index in the staker's stake list. Valid only right now. */
  index: number;
  stakedDays: number;
  lockedDay: number;
  /** 0 means still locked — the only state good-accounting accepts. */
  unlockedDay: number;
}

/**
 * Find a stake's CURRENT index by reading the staker's list on chain.
 *
 * Returns null when the stake is gone (ended) or already unlocked
 * (good-accounted) — both mean there is nothing to do and no gas to spend.
 */
export async function resolveStake(
  net: HexNet,
  stakerAddr: string,
  stakeId: string,
): Promise<ResolvedStake | null> {
  const chain = chainOf(net);
  const countHex = await ethCall(chain, HEX_ADDRESS, SEL.stakeCount + pad(stakerAddr));
  if (!countHex) return null;
  const count = Number(BigInt(countHex));
  const want = BigInt(stakeId);

  for (let i = 0; i < count; i++) {
    const raw = await ethCall(chain, HEX_ADDRESS, SEL.stakeLists + pad(stakerAddr) + pad(i.toString(16)));
    if (!raw) continue;
    // stakeId, stakedHearts, stakeShares, lockedDay, stakedDays, unlockedDay, isAutoStake
    if (BigInt('0x' + word(raw, 0)) !== want) continue;
    const unlockedDay = num(raw, 5);
    if (unlockedDay !== 0) return null; // already good-accounted or ended
    return { index: i, lockedDay: num(raw, 3), stakedDays: num(raw, 4), unlockedDay };
  }
  return null;
}

/**
 * Messages left in the transaction's calldata.
 *
 * Solidity's ABI decoder ignores trailing bytes after a call's arguments, so a
 * note can ride along on the transaction and show up in the explorer's input
 * data. Verified against the deployed contract: appending 56 bytes to a real
 * `stakeGoodAccounting` call changed the gas estimate from 574,489 to 575,572 —
 * about 19 gas a byte, or a hundred-thousandth of a cent.
 *
 * Kept friendly rather than smug. Whoever reads this forgot about a stake, or
 * lost a key, or died; the joke is on the situation, never on them.
 */
export const RESCUE_MESSAGES = [
  'you left your stake in the oven. we turned it off. -- Morbius',
  'found this one bleeding out back. patched it up. -- Morbius',
  'your stake has been rescued. it is still yours. come get it. -- Morbius',
  'beep boop. saved your HEX from itself. no charge. -- Morbius',
  'this stake stopped losing money at this block. you are welcome. -- Morbius',
  'someone had to press the button. it was us. -- Morbius',
  'good accounting: the least romantic rescue there is. -- Morbius',
] as const;

/** Deterministic per stake, so a retry of the same stake carries the same note. */
export function messageForStake(stakeId: string): string {
  let h = 0;
  for (const ch of stakeId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return RESCUE_MESSAGES[h % RESCUE_MESSAGES.length];
}

/** Calldata for `stakeGoodAccounting`, with the note appended. */
export function goodAccountingCalldata(
  stakerAddr: string,
  index: number,
  stakeId: string,
  message?: string,
): string {
  const args = pad(stakerAddr) + pad(index.toString(16)) + pad(BigInt(stakeId).toString(16));
  const note = message ? Buffer.from(message, 'utf8').toString('hex') : '';
  return SEL.stakeGoodAccounting + args + note;
}

/** Rough gas from the stake's term — see the header note on why term drives it. */
export const estimateGasForTerm = (stakedDays: number) => Math.round(stakedDays * 3300) + 60_000;
