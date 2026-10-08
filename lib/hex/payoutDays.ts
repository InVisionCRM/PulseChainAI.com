// What each HEX day paid its stakers, and where the penalty part came from.
//
// A day's payout (dailyData.dayPayoutTotal) is two things added together in
// HEX.sol _dailyRoundCalc: the day's inflation, and g._stakePenaltyTotal — the
// stakers' half of every penalty collected since the previous day was closed
// (_splitPenaltyProceeds mints the other half to the Origin Address). This
// module splits that penalty half by where it came from:
//
//   ees    stakeEnd before the committed term was served (servedDays < stakedDays)
//   late   a matured stake unlocked past its 14-day grace, by stakeEnd or by
//          someone else's stakeGoodAccounting
//   ours   stakeGoodAccounting sent by the rescue keeper
//
// Day boundaries are the contract's own. Every path that collects a penalty
// calls _dailyDataUpdateAuto first, which emits DailyDataUpdate when it closes
// days. So the penalties logged after one DailyDataUpdate and before the next
// all land in the next one's beginDay — the order HEX books them in, read
// straight from the log order rather than from timestamps.
//
// Every day is checked before it is returned: the stakers' halves summed from
// the events must equal, to the heart, the contract's stakePenaltyTotal read on
// the block before the day was closed (globalInfo()[3], archive read). A day
// that does not match throws. Verified on days 2497 and 2498 (2026-10-06).

import { keccak256 } from '@ethersproject/keccak256';
import { toUtf8Bytes } from '@ethersproject/strings';
import { ethCallAt, ethGetLogs, type RpcLog } from '@/lib/portfolio/evmRpc';
import { HEX_ADDRESS } from './hexDay';
import { fetchPayoutData, subgraphStrict } from './roadToZero';
import { STAKE_GOOD_ACCOUNTING_TOPIC } from './rescueSync';
import { KEEPER_ADDRESS } from './rescueFeed';

/** keccak256("StakeEnd(uint256,uint256,address,uint40)") */
const STAKE_END_TOPIC = '0x72d9c5a7ab13846e08d9c838f9e866a1bb4a66a2fd3ba3c9e7da3cf9e394dfd7';
/** keccak256("DailyDataUpdate(uint256,address)") */
const DAILY_DATA_UPDATE_TOPIC = '0xb8d6eb541ded1720cc657b719f57abcb1fe4711cb7ead82751b135f5d94bc944';
const GLOBAL_INFO = keccak256(toUtf8Bytes('globalInfo()')).slice(0, 10);

/** eth_getLogs span every pool node accepts (g4mm4 caps at 10,000 blocks). */
const LOG_SPAN = 10_000;
const LOG_WORKERS = 8;
const CHECK_WORKERS = 4;

const U16 = 0xffffn;
const U72 = (1n << 72n) - 1n;

/** One closed HEX day. Amounts are hearts (1e-8 HEX) as decimal strings. */
export interface PayoutDay {
  day: number;
  /** Block holding the DailyDataUpdate that closed this day. */
  closeBlock: number;
  /** dayStakeSharesTotal: every T-share is 1e12 of these. */
  shares: string;
  /** dayPayoutTotal = inflation + ees + late + ours. */
  payout: string;
  inflation: string;
  /** Stakers' halves only; the Origin Address got the same again. */
  ees: string;
  late: string;
  ours: string;
  eesCount: number;
  lateCount: number;
  oursCount: number;
}

/** A penalty-bearing event, before it is sorted into a bucket. */
interface Penalty {
  kind: 'end' | 'ga';
  stakeId: string;
  stakerAddr: string;
  servedDays: number;
  /** Capped as _stakePerformance caps it: never more than principal + payout. */
  capped: bigint;
  byKeeper: boolean;
}

interface Segment {
  day: number;
  closeBlock: number;
  penalties: Penalty[];
}

const word = (data: string, i: number) => BigInt('0x' + data.slice(2 + i * 64, 2 + (i + 1) * 64));
/** The stakers' half of a capped penalty: _splitPenaltyProceeds keeps the odd heart. */
const stakersHalf = (capped: bigint) => capped - capped / 2n;
const order = (a: RpcLog, b: RpcLog) =>
  Number.parseInt(a.blockNumber, 16) - Number.parseInt(b.blockNumber, 16) ||
  Number.parseInt(a.logIndex, 16) - Number.parseInt(b.logIndex, 16);

async function hexLogs(fromBlock: number, toBlock: number): Promise<RpcLog[]> {
  const spans: [number, number][] = [];
  for (let f = fromBlock; f <= toBlock; f += LOG_SPAN) spans.push([f, Math.min(toBlock, f + LOG_SPAN - 1)]);
  const logs: RpcLog[] = [];
  const worker = async () => {
    for (let s = spans.shift(); s; s = spans.shift()) {
      const got = await ethGetLogs('pulsechain', {
        address: HEX_ADDRESS,
        fromBlock: s[0],
        toBlock: s[1],
        topics: [[STAKE_END_TOPIC, STAKE_GOOD_ACCOUNTING_TOPIC, DAILY_DATA_UPDATE_TOPIC]],
      });
      if (!got) throw new Error(`No node returned HEX logs for blocks ${s[0]}–${s[1]}`);
      logs.push(...got);
    }
  };
  await Promise.all(Array.from({ length: LOG_WORKERS }, worker));
  return logs.sort(order);
}

/** The penalty an event carries, or null when it splits nothing. */
function penaltyOf(l: RpcLog, keeperTopic: string): Penalty | null {
  const d0 = word(l.data, 0);
  const d1 = word(l.data, 1);
  const stakedHearts = (d0 >> 40n) & U72;
  const payout = (d0 >> 184n) & U72;
  const penalty = d1 & U72;
  if (penalty === 0n) return null;
  const capped = penalty > stakedHearts + payout ? stakedHearts + payout : penalty;
  const stakeId = BigInt(l.topics[2]).toString();
  const stakerAddr = `0x${l.topics[1].slice(-40)}`.toLowerCase();
  if (l.topics[0] === STAKE_GOOD_ACCOUNTING_TOPIC) {
    return { kind: 'ga', stakeId, stakerAddr, servedDays: 0, capped, byKeeper: l.topics[3].toLowerCase() === keeperTopic };
  }
  // stakeEnd on a stake already good-accounted splits nothing: its penalty
  // was split when it was unlocked (HEX.sol stakeEnd, `!prevUnlocked`).
  if (((d1 >> 88n) & 0xffn) !== 0n) return null;
  return { kind: 'end', stakeId, stakerAddr, servedDays: Number((d1 >> 72n) & U16), capped, byKeeper: false };
}

/**
 * Splits the logs into closed days. `afterDay` is the last day already known;
 * the walk starts at the DailyDataUpdate that closed it, which must be in the
 * logs. Days closed with nothing collected get an empty segment.
 */
function segments(logs: RpcLog[], afterDay: number): Segment[] {
  const keeperTopic = `0x${'0'.repeat(24)}${KEEPER_ADDRESS.slice(2)}`;
  const out: Segment[] = [];
  let open: Penalty[] | null = null;
  let nextDay = -1;
  for (const l of logs) {
    if (l.topics[0] !== DAILY_DATA_UPDATE_TOPIC) {
      if (open) {
        const p = penaltyOf(l, keeperTopic);
        if (p) open.push(p);
      }
      continue;
    }
    const d0 = word(l.data, 0);
    const begin = Number((d0 >> 40n) & U16);
    const end = Number((d0 >> 56n) & U16);
    if (!open) {
      if (begin <= afterDay && afterDay < end) {
        for (let day = afterDay + 1; day < end; day++) out.push({ day, closeBlock: Number.parseInt(l.blockNumber, 16), penalties: [] });
        open = [];
        nextDay = end;
      }
      continue;
    }
    if (begin !== nextDay) throw new Error(`DailyDataUpdate at block ${Number.parseInt(l.blockNumber, 16)} begins on day ${begin}, expected ${nextDay}`);
    const closeBlock = Number.parseInt(l.blockNumber, 16);
    // The penalty total goes to the first day the update closes; the rest
    // were days nobody touched, which earned inflation only.
    out.push({ day: begin, closeBlock, penalties: open });
    for (let day = begin + 1; day < end; day++) out.push({ day, closeBlock, penalties: [] });
    open = [];
    nextDay = end;
  }
  if (!open) throw new Error(`No DailyDataUpdate closing day ${afterDay} in the scanned blocks`);
  return out;
}

/**
 * Committed term of every ended stake that took a penalty, from the subgraph,
 * checked against the event's own staker. Not against the principal: the
 * subgraph rounds some integers past 2^53 (stake 778428: chain
 * 11651393113170701 hearts in both its StakeStart and StakeEnd events,
 * subgraph …700), while stakedDays and addresses come through exact.
 */
async function stakedDaysOf(penalties: Penalty[]): Promise<Map<string, number>> {
  const want = new Map(penalties.filter((p) => p.kind === 'end').map((p) => [p.stakeId, p.stakerAddr]));
  const ids = [...want.keys()];
  const out = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 500) {
    const list = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
    const d = await subgraphStrict<{ stakeStarts: { stakeId: string; stakedDays: string; stakerAddr: string }[] }>(
      `{ stakeStarts(first: 1000, where:{ stakeId_in:[${list}] }){ stakeId stakedDays stakerAddr } }`,
    );
    for (const s of d.stakeStarts) {
      const id = String(s.stakeId);
      if (s.stakerAddr.toLowerCase() !== want.get(id)) throw new Error(`Subgraph staker for stake ${id} differs from its StakeEnd event`);
      out.set(id, Number(s.stakedDays));
    }
  }
  const missing = ids.filter((id) => !out.has(id));
  if (missing.length) throw new Error(`Subgraph has no stakeStart for ${missing.length} ended stakes (first: ${missing[0]})`);
  return out;
}

/** The contract's stakePenaltyTotal at the end of a block. */
async function penaltyPoolAt(block: number): Promise<bigint> {
  const r = await ethCallAt('pulsechain', HEX_ADDRESS, GLOBAL_INFO, block);
  if (!r) throw new Error(`No archive node answered globalInfo() at block ${block}`);
  return word(r, 3);
}

/**
 * Every day closed after `afterDay`, reading logs from `fromBlock` (the block
 * whose DailyDataUpdate closed `afterDay`) to `toBlock`. Days whose close is
 * past `toBlock` are left for the next call. Throws on any day that does not
 * reconcile with the contract.
 */
export async function readPayoutDays(afterDay: number, fromBlock: number, toBlock: number): Promise<PayoutDay[]> {
  const segs = segments(await hexLogs(fromBlock, toBlock), afterDay);
  if (!segs.length) return [];
  const [terms, data] = await Promise.all([stakedDaysOf(segs.flatMap((s) => s.penalties)), fetchPayoutData()]);

  const days: PayoutDay[] = segs.map((s) => {
    const sum = { ees: 0n, late: 0n, ours: 0n };
    const count = { ees: 0, late: 0, ours: 0 };
    for (const p of s.penalties) {
      const bucket = p.kind === 'ga' ? (p.byKeeper ? 'ours' : 'late') : p.servedDays < terms.get(p.stakeId)! ? 'ees' : 'late';
      sum[bucket] += stakersHalf(p.capped);
      count[bucket] += 1;
    }
    if (s.day >= data.dayPayout.length) throw new Error(`Day ${s.day} is closed in the logs but not in dailyData`);
    const payout = data.dayPayout[s.day];
    const penalties = sum.ees + sum.late + sum.ours;
    return {
      day: s.day,
      closeBlock: s.closeBlock,
      shares: data.dayShares[s.day].toString(),
      payout: payout.toString(),
      inflation: (payout - penalties).toString(),
      ees: sum.ees.toString(),
      late: sum.late.toString(),
      ours: sum.ours.toString(),
      eesCount: count.ees,
      lateCount: count.late,
      oursCount: count.ours,
    };
  });

  // The check: what the events say went to stakers is what the contract
  // added to the day. Days closed by a multi-day update share its close block
  // and only the first carries the pool, so check each close block once.
  const firstAtBlock = days.filter((d, i) => i === 0 || days[i - 1].closeBlock !== d.closeBlock);
  const queue = [...firstAtBlock];
  const worker = async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      const pool = await penaltyPoolAt(d.closeBlock - 1);
      const events = BigInt(d.ees) + BigInt(d.late) + BigInt(d.ours);
      if (pool !== events) {
        throw new Error(`Day ${d.day}: events give ${events} hearts to stakers, the contract's stakePenaltyTotal was ${pool}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CHECK_WORKERS }, worker));
  return days;
}
