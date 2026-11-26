// GET /api/superstake/wallet?address=0x…
//
// One wallet's SuperStake: the pSSH it holds, the HEX it has been paid, and
// every payout it received. Read off chain and the HEX subgraph, 2026-11-26.
//
// How a holder gets paid (from the verified sources of pSSH 0xb5c4…292e and its
// TokenDividendTracker 0xa869…4f54):
//   • HEX for holders is sent to the tracker, which credits each holder by
//     their pSSH balance.
//   • A wallet under `minimumTokenBalanceForDividends` (5,555 pSSH) is dropped
//     from the tracker's list and earns nothing; an excluded one is skipped.
//   • There is no manual claim — `withdrawDividend()` always reverts. Waiting
//     HEX is paid when the wallet's own pSSH moves (every transfer calls
//     setBalance → processAccount), or when the payout loop reaches it. That
//     loop only runs on a taxed pSSH sell (`process(gasForProcessing)`), at
//     most once an hour per wallet (`claimWait`).
//   • `getAccount().iterationsUntilProcessed` is how many list entries the loop
//     walks before this wallet.
//
// The payout record is the HEX subgraph's transfers from the tracker to the
// wallet, pinned to the subgraph's block. It is checked against the tracker's
// own `withdrawnDividendOf`: verified on 0x54b5…25bc, 177 transfers summing to
// 229,640.35658264 HEX, exactly the contract's figure. A difference is only
// accepted when payouts landed after the subgraph's block; anything else is
// refused rather than shown.

import { NextRequest, NextResponse } from 'next/server';
import { keccak256 } from '@ethersproject/keccak256';
import { toUtf8Bytes } from '@ethersproject/strings';
import { ethCall } from '@/lib/portfolio/evmRpc';
import { hexSubgraphQuery } from '@/lib/hex/subgraph';
import { dayFromTs } from '@/lib/superstake/rebuildCycles';
import { cached } from '@/lib/geicko/serverCache';

export const maxDuration = 30;

const PSSH = '0xb5c4ecef450fd36d0eba1420f6a19dbfbee5292e';
/** pSSH's TokenDividendTracker — pays holders their HEX. */
const TRACKER = '0xa8694419aff65c3e58e361d950ba6f522fb74f54';
/** Where burned pSSH is parked; it stays in totalSupply. */
const DEAD = '0x000000000000000000000000000000000000dead';
const PSSH_UNIT = 1e9;
const HEARTS_PER_HEX = 1e8;
/** The subgraph's page cap. */
const PAGE = 1000;
const CACHE_TTL_MS = 60_000;
const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;

export interface SuperStakeWalletPayload {
  address: string;
  /** pSSH held. */
  balance: number;
  /** pSSH in circulation: total supply minus what is parked at 0x…dEaD. */
  circulating: number;
  /** pSSH a wallet must hold to be paid. */
  minForRewards: number;
  /** In the tracker's payout list: holds the minimum and isn't excluded. */
  inPayoutList: boolean;
  /** Excluded from payouts by the tracker (pools, the contracts themselves). */
  excluded: boolean;
  /** Flagged by pSSH's own bot check. */
  bot: boolean;
  /** Trades without the 5.5% toll. */
  feeExempt: boolean;
  rewards: {
    /** All HEX ever credited: paid plus waiting. */
    earned: number;
    /** HEX already sent to the wallet. */
    paid: number;
    /** Credited, not yet sent. */
    waiting: number;
    /** Last payout, unix seconds; null if never paid. */
    lastPaidTs: number | null;
    /** Earliest the payout loop may pay it again, unix seconds. */
    nextEligibleTs: number | null;
    /** Entries the payout loop walks before this wallet; null when not in the list. */
    holdersAhead: number | null;
    /** Wallets in the payout list. */
    listSize: number;
  };
  payouts: {
    /** HEX received per HEX day (1-based, as dayToISO), oldest first. */
    days: { day: number; hex: number; count: number }[];
    total: number;
    count: number;
    /** The block and time the record runs to. */
    block: number;
    blockTs: number;
    /** HEX the contract has paid since that block (0 when the record is current). */
    paidSince: number;
  };
}

const sel = (sig: string) => keccak256(toUtf8Bytes(sig)).slice(0, 10);
const arg = (addr: string) => addr.slice(2).toLowerCase().padStart(64, '0');
const words = (hex: string) => (hex.slice(2).match(/.{64}/g) ?? []).map((w) => BigInt(`0x${w}`));
const TWO_255 = BigInt(2) ** BigInt(255);
const TWO_256 = BigInt(2) ** BigInt(256);
const signed = (v: bigint) => (v >= TWO_255 ? v - TWO_256 : v);
const NO_HEARTS = BigInt(0);

/** eth_call through the pool; a call that can't be read fails the whole lookup. */
async function read(to: string, sig: string, args = ''): Promise<bigint[]> {
  const r = await ethCall('pulsechain', to, sel(sig) + args);
  if (r == null) throw new Error(`No PulseChain node answered ${sig} on ${to}`);
  return words(r);
}

interface RawTransfer {
  value: string;
  timestamp: string;
  numeralIndex: string;
}

/** Every HEX transfer from the tracker to `who`, pinned to one subgraph block. */
async function payoutRecord(who: string) {
  const meta = await hexSubgraphQuery<{ _meta: { block: { number: number; timestamp: number } } }>(
    'pulsechain',
    '{ _meta { block { number timestamp } } }',
  );
  const block = meta._meta.block.number;
  const rows: RawTransfer[] = [];
  let cursor = '0';
  for (;;) {
    const d = await hexSubgraphQuery<{ rows: RawTransfer[] }>(
      'pulsechain',
      `{ rows: transfers(block:{ number:${block} }, first:${PAGE}, orderBy:numeralIndex, orderDirection:asc,
           where:{ from:"${TRACKER}", to:"${who}", numeralIndex_gt:"${cursor}" }){ value timestamp numeralIndex } }`,
    );
    rows.push(...d.rows);
    if (d.rows.length < PAGE) break;
    cursor = d.rows[d.rows.length - 1].numeralIndex;
  }
  return { block, blockTs: meta._meta.block.timestamp, rows };
}

async function build(who: string): Promise<SuperStakeWalletPayload> {
  const [
    [bal], [total], [dead], [bot], [feeExempt],
    account, [withdrawn], [excluded], [minBal], [listSize],
    record,
  ] = await Promise.all([
    read(PSSH, 'balanceOf(address)', arg(who)),
    read(PSSH, 'totalSupply()'),
    read(PSSH, 'balanceOf(address)', arg(DEAD)),
    read(PSSH, 'checkBot(address)', arg(who)),
    read(PSSH, 'isExcludedFromFee(address)', arg(who)),
    read(TRACKER, 'getAccount(address)', arg(who)),
    read(TRACKER, 'withdrawnDividendOf(address)', arg(who)),
    read(TRACKER, 'excludedFromDividends(address)', arg(who)),
    read(TRACKER, 'minimumTokenBalanceForDividends()'),
    read(TRACKER, 'getNumberOfTokenHolders()'),
    payoutRecord(who),
  ]);
  // getAccount → account, index, iterationsUntilProcessed, withdrawable,
  // totalDividends, lastClaimTime, nextClaimTime, secondsUntilAutoClaimAvailable
  if (account.length !== 8) throw new Error(`getAccount returned ${account.length} words, expected 8`);
  const [, index, iterations, withdrawable, accumulated, lastClaim, nextClaim] = account;
  const inList = signed(index) >= BigInt(0);

  // The record has to add up to what the tracker says it has paid.
  const byDay = new Map<number, { hearts: bigint; count: number }>();
  let recordHearts = NO_HEARTS;
  for (const r of record.rows) {
    const v = BigInt(r.value);
    recordHearts += v;
    const day = dayFromTs(Number(r.timestamp));
    const e = byDay.get(day) ?? { hearts: NO_HEARTS, count: 0 };
    e.hearts += v;
    e.count += 1;
    byDay.set(day, e);
  }
  const paidSince = withdrawn - recordHearts;
  const lastPaidTs = Number(lastClaim);
  const explained =
    paidSince === NO_HEARTS || (paidSince > NO_HEARTS && lastPaidTs > record.blockTs);
  if (!explained) {
    throw new Error(
      `payout record does not add up: ${recordHearts} hearts to block ${record.block}, contract has paid ${withdrawn}`,
    );
  }

  const toHex = (h: bigint) => Number(h) / HEARTS_PER_HEX;
  return {
    address: who,
    balance: Number(bal) / PSSH_UNIT,
    circulating: Number(total - dead) / PSSH_UNIT,
    minForRewards: Number(minBal) / PSSH_UNIT,
    inPayoutList: inList,
    excluded: excluded !== NO_HEARTS,
    bot: bot !== NO_HEARTS,
    feeExempt: feeExempt !== NO_HEARTS,
    rewards: {
      earned: toHex(accumulated),
      paid: toHex(withdrawn),
      waiting: toHex(withdrawable),
      lastPaidTs: lastPaidTs > 0 ? lastPaidTs : null,
      nextEligibleTs: nextClaim > NO_HEARTS ? Number(nextClaim) : null,
      holdersAhead: inList ? Number(signed(iterations)) : null,
      listSize: Number(listSize),
    },
    payouts: {
      days: [...byDay.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([day, e]) => ({ day, hex: toHex(e.hearts), count: e.count })),
      total: toHex(recordHearts),
      count: record.rows.length,
      block: record.block,
      blockTs: record.blockTs,
      paidSince: toHex(paidSince),
    },
  };
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get('address') || '').trim();
  if (!ADDR_RX.test(raw)) {
    return NextResponse.json({ error: 'Enter a full 0x address (40 hex characters).' }, { status: 400 });
  }
  const who = raw.toLowerCase();
  try {
    const payload = await cached(`superstake-wallet:${who}`, CACHE_TTL_MS, () => build(who));
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=30' } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read this wallet' },
      { status: 503 },
    );
  }
}
