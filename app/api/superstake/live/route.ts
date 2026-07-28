// Live "today" figures for the SuperStake pages: current pHEX / pSSH prices and
// average daily pSSH volume over a few trailing windows.
//
// The reference page called the PulseX subgraph straight from the browser; doing
// it here instead means one cached result is shared by every visitor and there's
// no CORS/rate-limit exposure. Everything is best-effort — the pages fall back to
// the snapshot's own figures when this is unavailable, so a bad day upstream
// degrades the "as of" line rather than breaking the tools.

import { NextResponse } from 'next/server';
import { ethCall } from '@/lib/portfolio/evmRpc';

// Verified live: `Codeakk/PulseX` no longer exists, and the current schema uses
// `plsPrice` / `derivedUSD` / `dailyVolumeUSD` — not the `ethPrice` / `derivedETH`
// fields the original page queried (those now return schema errors).
const PULSEX_SUBGRAPHS = [
  'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsexv2',
  'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex',
];

const HEX_PLS = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
const PSSH = '0xb5c4ecef450fd36d0eba1420f6a19dbfbee5292e';
/** The contract that holds the stake — same address the cycles route reads. */
const SUPERSTAKE_STAKER = '0xdc48205df8af83c97de572241bb92db45402aa0e';
/** `balanceOf(address)`, left-padded to 32 bytes. */
const BALANCE_OF = `0x70a08231000000000000000000000000${SUPERSTAKE_STAKER.slice(2)}`;
const HEX_DECIMALS = 1e8;

// Two mirrors at a 9s timeout each is 18s worst case, which would blow through
// Vercel's short default before the fallback ever gets to answer.
export const maxDuration = 30;

const WINDOWS = [30, 60, 90, 180, 365];
const CACHE_TTL_MS = 5 * 60_000;

interface LivePayload {
  pHEX: number | null;
  pSSH: number | null;
  /** Average daily pSSH volume (USD) per trailing window, keyed by day count. */
  wins: Record<string, number>;
  /**
   * HEX sitting liquid in the staking contract — what the 2% has bought so far
   * this cycle, waiting to be added to the stake at the next end-stake. Read
   * straight off chain, so it is independent of the subgraph above and stays
   * populated even when that is down.
   */
  poolHexWaiting: number | null;
  source: 'pulsex-subgraph' | 'unavailable';
  fetchedAt: number;
}

let cache: { value: LivePayload; at: number } | null = null;

const QUERY = `{
  hex: token(id:"${HEX_PLS}"){ derivedUSD }
  pssh: token(id:"${PSSH}"){ derivedUSD }
  vol: tokenDayDatas(first:366, orderBy:date, orderDirection:desc, where:{token:"${PSSH}"}){
    date dailyVolumeUSD
  }
}`;

async function queryFirstThatAnswers(): Promise<any | null> {
  for (const url of PULSEX_SUBGRAPHS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY }),
        signal: AbortSignal.timeout(9_000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.errors || !json?.data?.pssh) continue;
      return json.data;
    } catch {
      // try the next mirror
    }
  }
  return null;
}

/**
 * HEX the contract is holding but has not staked yet. Null rather than 0 when
 * every RPC fails — a blank is honest, a zero would read as "nothing waiting".
 */
async function readWaitingHex(): Promise<number | null> {
  const hex = await ethCall('pulsechain', HEX_PLS, BALANCE_OF);
  if (!hex) return null;
  try {
    return Number(BigInt(hex)) / HEX_DECIMALS;
  } catch {
    return null;
  }
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.value, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' },
    });
  }

  // Independent sources, so run them together rather than paying for both in series.
  const [data, waitingHex] = await Promise.all([
    queryFirstThatAnswers(),
    readWaitingHex(),
  ]);
  let payload: LivePayload;

  if (!data) {
    payload = {
      pHEX: null, pSSH: null, wins: {},
      poolHexWaiting: waitingHex,
      source: 'unavailable', fetchedAt: Date.now(),
    };
  } else {
    const pHEX = parseFloat(data.hex?.derivedUSD ?? '0');
    const pSSH = parseFloat(data.pssh?.derivedUSD ?? '0');
    // Drop the first row: today is still in progress and would understate the average.
    const rows: any[] = (data.vol ?? []).slice(1);
    const now = Date.now() / 1000;
    const wins: Record<string, number> = {};
    for (const w of WINDOWS) {
      let sum = 0;
      for (const r of rows) {
        if (Number(r.date) >= now - (w + 1) * 86_400) sum += parseFloat(r.dailyVolumeUSD) || 0;
      }
      wins[String(w)] = sum / w;
    }
    payload = {
      pHEX: pHEX > 0 ? pHEX : null,
      pSSH: pSSH > 0 ? pSSH : null,
      wins,
      poolHexWaiting: waitingHex,
      source: 'pulsex-subgraph',
      fetchedAt: Date.now(),
    };
  }

  cache = { value: payload, at: Date.now() };
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' },
  });
}
