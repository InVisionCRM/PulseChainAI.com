// Per-cycle pSSH burn, read off chain.
//
// pSSH is never burned by reducing totalSupply — that still reads the full
// 55,550,000. Burned tokens are sent to 0x…dEaD and parked there, which is why
// the snapshot's `supply` plus its `burned` add back to exactly 55,550,000. So
// "how much had been burned by cycle N" is just the dead address's pSSH
// balance at the block that cycle opened.
//
// That makes the whole series 18 historical `balanceOf` reads rather than a
// three-year sweep of Transfer logs. Verified against the baked snapshot: the
// dead balance at cycle 18's opening block is 2,870,214, the same figure the
// snapshot records as `burned`.
//
// Two upstreams, both free:
//   • Blockscout getblocknobytime — cycle timestamp -> block number
//   • an archive RPC              — balanceOf(dead) at that block
//
// Most of the public PulseChain pool prunes state and answers "historical
// state is not available"; g4mm4 serves it. The pool below is tried in order
// and the first node that returns state wins, so this doesn't hard-depend on
// one host.

import { NextResponse } from 'next/server';
import snapshot from '@/lib/superstake/snapshot.json';

const PSSH = '0xb5c4ecef450fd36d0eba1420f6a19dbfbee5292e';
/** Where burned pSSH is parked. */
const DEAD_TOPIC = '000000000000000000000000000000000000000000000000000000000000dead';
/** balanceOf(address) */
const BALANCE_OF = '0x70a08231';
/** pSSH carries 9 decimals, not 18. */
const PSSH_DECIMALS = 1e9;
/** Fixed at mint; supply + burned always adds back to this. */
const TOTAL_SUPPLY = 55_550_000;

const BLOCKSCOUT = 'https://api.scan.pulsechain.com/api';

/** Archive-capable first — pruned nodes answer everything else but not old state. */
const ARCHIVE_RPCS = [
  'https://rpc-pulsechain.g4mm4.io',
  'https://rpc.pulsechainrpc.com',
  'https://rpc.gigatheminter.com',
  'https://rpc.degenprotocol.io',
];

// Historical burns never change, so this only really refreshes to pick up the
// cycle now running. A cold build is ~36 upstream calls.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const maxDuration = 60;

export interface CycleBurn {
  /** Cycle number. */
  i: number;
  /** Total pSSH burned as of that cycle's opening block. */
  burnedAtOpen: number;
  /** Burned during the cycle — the step up to the next one. Null for the last. */
  burnedInCycle: number | null;
  /** Circulating pSSH at that point. */
  supply: number;
  /**
   * What the burn did to a holding that never moved: supply shrinks, so a fixed
   * balance owns a larger slice. Null for the last cycle, which has no next
   * boundary to measure against yet.
   */
  growthPct: number | null;
}

let cache: { at: number; value: CycleBurn[] } | null = null;

/** Map with a concurrency cap, preserving input order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const k = cursor++;
      if (k >= items.length) return;
      out[k] = await fn(items[k], k);
    }
  });
  await Promise.all(workers);
  return out;
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let k = 0; k < tries; k++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 400 * (k + 1)));
    }
  }
  throw last;
}

async function blockAtTimestamp(ts: number): Promise<number | null> {
  const url = `${BLOCKSCOUT}?module=block&action=getblocknobytime&timestamp=${ts}&closest=before`;
  const json = await withRetry(async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`blockscout ${res.status}`);
    return (await res.json()) as { result?: { blockNumber?: string } };
  });
  const n = Number(json?.result?.blockNumber);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * balanceOf(dead) at a past block, from the first node that still has the state.
 *
 * Two passes over the pool, not one: a single sweep drops a boundary now and
 * then on a transient upstream blip, and one missing balance silently removes
 * a cycle from the series and blanks the step of the cycle before it.
 */
async function deadBalanceAt(block: number): Promise<number | null> {
  for (let round = 0; round < 3; round++) {
    for (const rpc of ARCHIVE_RPCS) {
      try {
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to: PSSH, data: `${BALANCE_OF}${DEAD_TOPIC}` }, `0x${block.toString(16)}`],
          }),
        });
        if (!res.ok) continue;
        const json = (await res.json()) as { result?: string; error?: unknown };
        // Pruned nodes return an error here rather than a wrong number, so a
        // miss is safe to skip past.
        if (!json?.result || json.result === '0x') continue;
        return Number(BigInt(json.result)) / PSSH_DECIMALS;
      } catch {
        /* try the next node */
      }
    }
    if (round === 0) await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ cycles: cache.value, source: 'cache' });
  }

  const cycles = (snapshot as { cycles: { i: number; ts: number }[] }).cycles ?? [];
  if (cycles.length === 0) {
    return NextResponse.json({ cycles: [], error: 'no cycles' }, { status: 503 });
  }

  try {
    // Throttled, not Promise.all. Firing all eighteen archive reads at once
    // gets roughly one refused per run, and a single missing balance drops a
    // cycle from the series and blanks the step of the one before it — a hole
    // that reads as "no burn that cycle" rather than as a failure. Small
    // batches cost a few seconds on a cold build and the result is cached for
    // half a day.
    const blocks = await mapLimit(cycles, 6, (c) => blockAtTimestamp(c.ts).catch(() => null));
    // One at a time. The archive node refuses a share of the reads under any
    // parallelism — at six-wide roughly one boundary per run, at three-wide
    // two — and each refusal punches a hole that reads as "no burn that cycle"
    // rather than as a failure.
    const balances = await mapLimit(blocks, 1, (b) =>
      b == null ? Promise.resolve(null) : deadBalanceAt(b),
    );

    const out: CycleBurn[] = [];
    for (let k = 0; k < cycles.length; k++) {
      const bal = balances[k];
      if (bal == null) continue;
      const next = balances[k + 1] ?? null;
      const supply = TOTAL_SUPPLY - bal;
      const nextSupply = next == null ? null : TOTAL_SUPPLY - next;
      out.push({
        i: cycles[k].i,
        burnedAtOpen: bal,
        burnedInCycle: next == null ? null : next - bal,
        supply,
        // A fixed balance was supply/x of the float before and supply/y after;
        // the gain in ownership is the ratio of the two floats.
        growthPct:
          nextSupply == null || nextSupply <= 0 ? null : (supply / nextSupply - 1) * 100,
      });
    }

    // All or nothing. A series with a boundary missing draws a chart with a
    // cycle silently absent and its neighbour's step blank, which reads as a
    // quiet cycle rather than a failed read — worse than no chart. Refuse to
    // cache or serve it, and let the panel stay empty instead.
    if (out.length !== cycles.length) {
      const got = new Set(out.map((c) => c.i));
      return NextResponse.json(
        {
          cycles: [],
          error: `incomplete: ${cycles.length - out.length} of ${cycles.length} boundaries unread`,
          missing: cycles.map((c) => c.i).filter((i) => !got.has(i)),
        },
        { status: 503 },
      );
    }

    cache = { at: Date.now(), value: out };
    return NextResponse.json({ cycles: out, source: 'chain' });
  } catch (e) {
    return NextResponse.json(
      { cycles: [], error: e instanceof Error ? e.message : 'failed' },
      { status: 503 },
    );
  }
}
