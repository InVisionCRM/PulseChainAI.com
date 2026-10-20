// HEX arriving at the SuperStake stake contract, by day and by cycle.
//
// Everything the stake ever holds arrives as a HEX Transfer into the contract
// (0xdC48…Aa0E), so "how much was added each day" is a sum over those
// transfers. They come from four places, traced on chain 2026-10-19:
//   • the pSSH contract     — the 2% buy-tax. Each pSSH trade's toll is swapped
//                             to HEX inside the token contract, which sends
//                             2/4.5 of it here and 2.5/4.5 to holders.
//   • the dividend tracker  — reflections. The stake contract holds pSSH of
//                             its own (11,123 at the time of writing), so it
//                             is paid like any other holder.
//   • anyone else           — HEX sent in directly, including the 650,000 HEX
//                             that seeded cycle 1.
//   • the zero address      — HEX minting an ended stake back (principal +
//                             interest). That is the stake returning, not HEX
//                             being added, so no "added" figure counts it.
// What leaves is the 1% to holders (sent to the tracker) and the restake
// itself — HEX burns the principal on stakeStart, a transfer to zero.
//
// The tax arrives in batches, when the token contract swaps what it has
// collected, so a day's figure is when HEX landed here rather than when the
// trades that paid for it happened. Plenty of days show nothing at all.
//
// Source is the HEX subgraph's `transfers`. Every query is pinned to one block
// so the windows can't disagree about what has happened, and nothing is
// served until the record is checked against the chain: what came in minus
// what went out must equal balanceOf(stake contract) at that same block, to
// the heart. Verified at block 27,840,358 — 123,151.25580053 HEX both ways,
// and the replay lands on exactly 0 after each of the 19 restakes. A record
// that fails the check is missing transfers and would understate what was
// added, so it is refused rather than shown.
//
// Days are this repo's 1-based HEX days (`dayFromTs`, matching `dayToISO`),
// taken from each transfer's timestamp. The subgraph's own `hexDay` field is
// 0-based — one day behind on all 8,497 rows checked — so it is not read.

import { NextResponse } from 'next/server';
import { hexSubgraphQuery } from '@/lib/hex/subgraph';
import { ethCallAt } from '@/lib/portfolio/evmRpc';
import { dayFromTs } from '@/lib/superstake/rebuildCycles';

/** The contract that holds the stake — same address the cycles route reads. */
const SUPERSTAKE_STAKER = '0xdc48205df8af83c97de572241bb92db45402aa0e';
const HEX_PLS = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
/** Sends the HEX the 2% buy-tax bought. */
const PSSH = '0xb5c4ecef450fd36d0eba1420f6a19dbfbee5292e';
/** pSSH's TokenDividendTracker (deployed by the pSSH contract) — pays reflections. */
const DIVIDEND_TRACKER = '0xa8694419aff65c3e58e361d950ba6f522fb74f54';
const ZERO = '0x0000000000000000000000000000000000000000';
/** `balanceOf(address)`, left-padded to 32 bytes. */
const BALANCE_OF = `0x70a08231000000000000000000000000${SUPERSTAKE_STAKER.slice(2)}`;
const HEARTS_PER_HEX = 1e8;
/** The repo targets ES2017, which has no `0n` literal. */
const NO_HEARTS = BigInt(0);

/** The subgraph's page cap. */
const PAGE = 1000;
/**
 * Swept in parallel windows: one query after another took 13.9s for the whole
 * record, nineteen 60-day windows at once took 2.6s. A window busier than a
 * page just takes a second one.
 */
const WINDOW_DAYS = 60;
const CONCURRENCY = 8;
/** How many of the most recent adds are returned one by one. */
const LATEST_N = 12;

export const maxDuration = 60;
const CACHE_TTL_MS = 5 * 60_000;

export type InflowSource = 'tax' | 'direct' | 'refl';

export interface InflowsPayload {
  /** The block every figure is pinned to, and its timestamp. */
  block: number;
  blockTs: number;
  /** One entry per HEX day from `d0` through the pinned block's day, zero-filled. HEX. */
  days: {
    d0: number;
    tax: number[];
    direct: number[];
    refl: number[];
    /** How many separate transfers added HEX that day. */
    n: number[];
    /** The largest single transfer that day. */
    max: number[];
  };
  /**
   * HEX added between restakes. Entry 0 is everything before the first
   * restake — what cycle 1 opened with. Entry i ≥ 1 is what arrived during
   * cycle i and was staked into cycle i+1, or for the last entry what is
   * waiting now. `opened` is the HEX restaked to open cycle i, so these can be
   * lined up against the cycle record.
   */
  cycles: { i: number; opened: number | null; tax: number; direct: number; refl: number; n: number }[];
  /** The most recent adds, newest first. */
  latest: { ts: number; hex: number; source: InflowSource; tx: string }[];
  totals: { tax: number; direct: number; refl: number; n: number };
  /** HEX in the contract and not yet staked — equal to balanceOf at `block`. */
  waiting: number;
  source: 'hex-subgraph';
  fetchedAt: number;
}

interface RawTransfer {
  from: string;
  to: string;
  value: string;
  timestamp: string;
  numeralIndex: string;
  transactionHash: string;
}

let cache: { value: InflowsPayload; at: number } | null = null;
let inflight: Promise<InflowsPayload> | null = null;

/** Map with a concurrency cap, preserving input order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const k = cursor++;
      if (k >= items.length) return;
      out[k] = await fn(items[k]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Every transfer matching `where`, as of `block`. Paged on numeralIndex — the
 * subgraph's running transfer counter, which orders transfers inside one
 * transaction as well as across them — so pages never overlap or skip.
 */
async function sweep(block: number, where: string): Promise<RawTransfer[]> {
  const rows: RawTransfer[] = [];
  let cursor = '-1';
  for (;;) {
    const d = await hexSubgraphQuery<{ rows: RawTransfer[] }>(
      'pulsechain',
      `{ rows: transfers(block:{ number:${block} }, first:${PAGE}, orderBy:numeralIndex, orderDirection:asc,
           where:{ ${where}, numeralIndex_gt:"${cursor}" }){ from to value timestamp numeralIndex transactionHash } }`,
    );
    rows.push(...d.rows);
    if (d.rows.length < PAGE) return rows;
    cursor = d.rows[d.rows.length - 1].numeralIndex;
  }
}

const byIndex = (a: RawTransfer, b: RawTransfer) => {
  const x = BigInt(a.numeralIndex);
  const y = BigInt(b.numeralIndex);
  return x < y ? -1 : x > y ? 1 : 0;
};

/** Which kind of add a transfer is, or null for the stake minting itself back. */
function sourceOf(from: string): InflowSource | null {
  if (from === ZERO) return null;
  if (from === PSSH) return 'tax';
  if (from === DIVIDEND_TRACKER) return 'refl';
  return 'direct';
}

const toHex = (hearts: bigint) => Number(hearts) / HEARTS_PER_HEX;

async function build(): Promise<InflowsPayload> {
  // --- 1. Pin a block, and find where the record starts --------------------
  const head = await hexSubgraphQuery<{
    _meta: { block: { number: number; timestamp: number | null } };
    first: { timestamp: string }[];
  }>(
    'pulsechain',
    `{ _meta { block { number timestamp } }
       first: transfers(first:1, orderBy:numeralIndex, orderDirection:asc, where:{ to:"${SUPERSTAKE_STAKER}" }){ timestamp } }`,
  );
  const block = head._meta.block.number;
  const blockTs = head._meta.block.timestamp;
  if (!blockTs) throw new Error('HEX subgraph did not report its block timestamp');
  if (!head.first.length) throw new Error('HEX subgraph has no transfers into the stake contract');
  const startTs = Number(head.first[0].timestamp);

  // --- 2. Everything in, in windows, and everything out ---------------------
  const span = WINDOW_DAYS * 86_400;
  const windows: [number, number][] = [];
  for (let a = startTs; a <= blockTs; a += span) windows.push([a, a + span]);

  const [inWindows, outgoing] = await Promise.all([
    mapLimit(windows, CONCURRENCY, ([a, b]) =>
      sweep(block, `to:"${SUPERSTAKE_STAKER}", timestamp_gte:${a}, timestamp_lt:${b}`),
    ),
    sweep(block, `from:"${SUPERSTAKE_STAKER}"`),
  ]);
  const incoming = inWindows.flat().sort(byIndex);
  outgoing.sort(byIndex);

  // --- 3. The record has to add up to what the chain holds ------------------
  let balance = NO_HEARTS;
  for (const t of incoming) balance += BigInt(t.value);
  for (const t of outgoing) balance -= BigInt(t.value);
  const onChain = await ethCallAt('pulsechain', HEX_PLS, BALANCE_OF, block);
  if (onChain == null) {
    throw new Error(`could not read the stake contract's HEX balance at block ${block} to verify the record`);
  }
  if (BigInt(onChain) !== balance) {
    throw new Error(
      `transfer record incomplete at block ${block}: it replays to ${balance} hearts, the chain holds ${BigInt(onChain)}`,
    );
  }

  // --- 4. By day and by cycle -----------------------------------------------
  const d0 = dayFromTs(startTs);
  const len = dayFromTs(blockTs) - d0 + 1;
  const sums = {
    tax: new Array<bigint>(len).fill(NO_HEARTS),
    direct: new Array<bigint>(len).fill(NO_HEARTS),
    refl: new Array<bigint>(len).fill(NO_HEARTS),
  };
  const n = new Array<number>(len).fill(0);
  const max = new Array<bigint>(len).fill(NO_HEARTS);

  // stakeStart burns the principal, so each transfer to zero is one restake.
  const restakes = outgoing.filter((t) => t.to === ZERO);
  const cycleSums = Array.from({ length: restakes.length + 1 }, () => ({
    tax: NO_HEARTS, direct: NO_HEARTS, refl: NO_HEARTS, n: 0,
  }));

  let k = 0; // restakes already behind the transfer being read
  for (const t of incoming) {
    while (k < restakes.length && byIndex(restakes[k], t) < 0) k++;
    const source = sourceOf(t.from);
    if (!source) continue;
    const v = BigInt(t.value);
    const at = dayFromTs(Number(t.timestamp)) - d0;
    sums[source][at] += v;
    n[at] += 1;
    if (v > max[at]) max[at] = v;
    cycleSums[k][source] += v;
    cycleSums[k].n += 1;
  }

  const adds = incoming.filter((t) => sourceOf(t.from) !== null);
  const latest = adds
    .slice(-LATEST_N)
    .reverse()
    .map((t) => ({
      ts: Number(t.timestamp),
      hex: toHex(BigInt(t.value)),
      source: sourceOf(t.from) as InflowSource,
      tx: t.transactionHash,
    }));

  const totals = { tax: NO_HEARTS, direct: NO_HEARTS, refl: NO_HEARTS, n: 0 };
  for (const c of cycleSums) {
    totals.tax += c.tax;
    totals.direct += c.direct;
    totals.refl += c.refl;
    totals.n += c.n;
  }

  return {
    block,
    blockTs,
    days: {
      d0,
      tax: sums.tax.map(toHex),
      direct: sums.direct.map(toHex),
      refl: sums.refl.map(toHex),
      n,
      max: max.map(toHex),
    },
    cycles: cycleSums.map((c, i) => ({
      i,
      opened: i === 0 ? null : toHex(BigInt(restakes[i - 1].value)),
      tax: toHex(c.tax),
      direct: toHex(c.direct),
      refl: toHex(c.refl),
      n: c.n,
    })),
    latest,
    totals: { tax: toHex(totals.tax), direct: toHex(totals.direct), refl: toHex(totals.refl), n: totals.n },
    waiting: toHex(balance),
    source: 'hex-subgraph',
    fetchedAt: Date.now(),
  };
}

const HEADERS = { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=600' };

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.value, { headers: HEADERS });
  }

  // Concurrent callers share one sweep rather than each starting their own.
  if (!inflight) {
    inflight = build().finally(() => {
      inflight = null;
    });
  }

  try {
    const value = await inflight;
    cache = { value, at: Date.now() };
    return NextResponse.json(value, { headers: HEADERS });
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'failed';
    console.error('[superstake/inflows]', reason);
    // An older record that passed the check is still right as of its own
    // block, which it carries — better than nothing, and never wrong.
    if (cache) return NextResponse.json(cache.value, { headers: HEADERS });
    return NextResponse.json({ error: reason }, { status: 503 });
  }
}
