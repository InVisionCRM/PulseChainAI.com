// GET /api/geicko/token-leagues?token=0x..[&holder=0x..]
//
// Populations for the "Token Leagues" ranks: how many holders sit in each
// creature tier (by share of supply), and how much supply each tier holds
// collectively. Blockscout returns holders sorted by balance descending, so we
// page through the top holders and bucket them into tiers. The full tail can be
// hundreds of thousands of wallets, so we scan a bounded budget: tiers we reach
// the bottom of are exact, the rest are reported as floors ("N+").
//
// The bucketing is the expensive part, so it's snapshotted into Postgres once
// per UTC day (opportunistically, on view — no cron). Token metadata and the
// optional per-wallet "your rank" lookup are always computed live (both cheap).
// Degrades to live-every-call when no database is configured.

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';
import { blockscoutJson, fetchBlockscoutHolders } from '@/lib/blockscout';
import { ethCall } from '@/lib/portfolio/evmRpc';

export const maxDuration = 60;

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;

// Tier thresholds as a fraction of total supply, largest first. Must stay in
// lockstep with the LEAGUES ladder in GeickoTokenLeaguesPanel (matched by index).
const BANDS = [0.1, 0.01, 0.001, 0.0001, 0.00001, 0.000001, 0.0000001];
const CRAB = BANDS[BANDS.length - 1];

// Scan budget for the cold (uncached) build: the top N holders by balance. The
// tail can be hundreds of thousands, so this caps how far down we count exactly
// — enough to nail the big tiers and floor the rest. Cached daily, runs rarely.
const MAX_HOLDERS = 1500;

const utcDate = (d: Date) => d.toISOString().slice(0, 10);
const asDateStr = (v: unknown) =>
  v instanceof Date ? utcDate(v) : String(v).slice(0, 10);

const bandOf = (frac: number): number => {
  for (let i = 0; i < BANDS.length; i++) if (frac >= BANDS[i]) return i;
  return -1; // below the smallest tier — not in any league
};

interface BandRow {
  index: number;
  pct: number;
  count: number;
  exact: boolean;
  supplyHeldPct: number;
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS league_snapshots (
      token_address text NOT NULL,
      snapshot_date date NOT NULL,
      scanned integer NOT NULL,
      complete boolean NOT NULL,
      bands jsonb NOT NULL,
      PRIMARY KEY (token_address, snapshot_date)
    )`;
}

/**
 * Page through the top holders and bucket them into tiers. Returns per-tier
 * counts + collective supply share, plus whether the scan reached the bottom of
 * each tier (exact) or stopped inside it (floor).
 */
async function scanBands(token: string, supplyRaw: bigint) {
  const counts = new Array(BANDS.length).fill(0);
  const held = new Array(BANDS.length).fill(0);
  const supplyNum = Number(supplyRaw);

  let scanned = 0;
  let complete = false; // scan exhausted the holders or ran off the bottom tier
  let lastFrac = 1;

  const holders = await fetchBlockscoutHolders(token, MAX_HOLDERS);
  const items = holders?.items ?? [];

  for (const it of items) {
    const raw = (it as any)?.value;
    if (raw == null) continue;
    const frac = supplyNum > 0 ? Number(raw) / supplyNum : 0;
    scanned++;
    lastFrac = frac;
    if (frac < CRAB) {
      // Holders are descending — the first sub-crab means the tail is all
      // sub-crab, so every league tier is fully counted.
      complete = true;
      break;
    }
    const b = bandOf(frac);
    if (b >= 0) {
      counts[b]++;
      held[b] += frac;
    }
  }

  // If we consumed every fetched holder without hitting the page cap, the scan
  // is also complete (we saw the whole holder list).
  if (!complete && items.length < MAX_HOLDERS) complete = true;

  const bands: BandRow[] = BANDS.map((pct, i) => ({
    index: i,
    pct,
    count: counts[i],
    // A tier is exact once the scan crossed below its lower bound.
    exact: complete || pct > lastFrac,
    supplyHeldPct: held[i] * 100,
  }));

  return { bands, scanned, complete };
}

/** Optional "your rank" lookup: a single wallet's balance → tier index. */
async function lookupHolder(token: string, holder: string, supplyRaw: bigint, decimals: number) {
  const data = '0x70a08231' + holder.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const hex = await ethCall('pulsechain', token, data);
  if (!hex) return null;
  let raw: bigint;
  try {
    raw = BigInt(hex);
  } catch {
    return null;
  }
  const supplyNum = Number(supplyRaw);
  const frac = supplyNum > 0 ? Number(raw) / supplyNum : 0;
  return {
    balance: Number(raw) / Math.pow(10, decimals),
    pct: frac * 100,
    bandIndex: bandOf(frac),
  };
}

export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get('token') || '').toLowerCase();
  const holder = (req.nextUrl.searchParams.get('holder') || '').toLowerCase();
  if (!ADDRESS_RX.test(token)) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  const meta = await blockscoutJson(`/tokens/${token}`, { revalidateSeconds: 120 });
  const supplyRaw = (() => {
    try {
      return BigInt(meta?.total_supply ?? '0');
    } catch {
      return 0n;
    }
  })();
  const decimals = Number(meta?.decimals ?? 18) || 18;
  const symbol = meta?.symbol ?? null;
  const totalHolders =
    meta?.holders != null
      ? Number(meta.holders)
      : meta?.holders_count != null
        ? Number(meta.holders_count)
        : null;
  const supply = supplyRaw > 0n ? Number(supplyRaw) / Math.pow(10, decimals) : 0;

  if (supplyRaw <= 0n) {
    return NextResponse.json({ error: 'token has no supply' }, { status: 404 });
  }

  // Bucketing: cached daily snapshot, computed on first view of the day.
  let bands: BandRow[] | null = null;
  let scanned = 0;
  let complete = false;
  let persisted = false;
  const today = utcDate(new Date());

  if (sql) {
    try {
      await ensureTable();
      const rows = await sql`
        SELECT bands, scanned, complete
        FROM league_snapshots
        WHERE token_address = ${token} AND snapshot_date = ${today}
        LIMIT 1`;
      if (rows.length > 0) {
        bands = rows[0].bands as BandRow[];
        scanned = Number(rows[0].scanned);
        complete = Boolean(rows[0].complete);
        persisted = true;
      }
    } catch (e) {
      console.error('league snapshot read failed:', e);
    }
  }

  if (!bands) {
    const res = await scanBands(token, supplyRaw);
    bands = res.bands;
    scanned = res.scanned;
    complete = res.complete;
    if (sql) {
      try {
        await sql`
          INSERT INTO league_snapshots (token_address, snapshot_date, scanned, complete, bands)
          VALUES (${token}, ${today}, ${scanned}, ${complete}, ${JSON.stringify(bands)})
          ON CONFLICT (token_address, snapshot_date)
          DO UPDATE SET scanned = EXCLUDED.scanned, complete = EXCLUDED.complete, bands = EXCLUDED.bands`;
        persisted = true;
      } catch (e) {
        console.error('league snapshot write failed:', e);
      }
    }
  }

  const you = ADDRESS_RX.test(holder)
    ? await lookupHolder(token, holder, supplyRaw, decimals)
    : null;

  return NextResponse.json(
    {
      token,
      symbol,
      decimals,
      supply,
      totalHolders,
      scanned,
      complete,
      bands,
      you: you ? { address: holder, ...you } : null,
      snapshotDate: today,
      persisted,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=120' } },
  );
}
