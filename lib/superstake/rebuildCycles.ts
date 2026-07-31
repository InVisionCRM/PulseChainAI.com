// Rebuilding the SuperStake cycle record, incrementally.
//
// This was inline in app/api/superstake/cycles/route.ts and re-swept three
// years of settled subgraph history on every cold start: 15.1s, four paginated
// sweeps, 1,051 days of series of which 1,039 could never change again. It now
// reads the settled days out of Postgres and asks the subgraphs only for what
// has happened since — typically a handful of days.
//
// The derivation below is unchanged from that route, deliberately and to the
// line. The store holds observations only, so cycles, T-shares, yields and
// payouts are still computed here on every request from the same formulas as
// before. A projection built on a stale *derivation* would be the worst
// outcome of a cache, so there are none stored.
//
// Everything degrades toward the old behaviour: no database, an unreachable
// database, or a failed write all fall through to the full sweep. The route
// cannot become less correct than it was, only slower.

import { hexSubgraphQuery } from '@/lib/hex/subgraph';
import { heartsToHex, sharesToTShares } from '@/lib/hex/hexDay';
import { HEX_LAUNCH_TS, type SuperStakeCycle } from '@/lib/superstake/model';
import {
  ensureSuperstakeSchema, findDrift, readDays, readStakes, readSweptToDay,
  writeDays, writeStakes, writeSweptToDay,
  type DayRow, type SqlClient, type StakeRow,
} from '@/lib/db/superstakeHistory';

/** The contract that actually holds the SuperStake HEX stake. */
const SUPERSTAKE_STAKER = '0xdc48205df8af83c97de572241bb92db45402aa0e';
const HEX_PLS = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
const PSSH = '0xb5c4ecef450fd36d0eba1420f6a19dbfbee5292e';

const PULSEX_SUBGRAPHS = [
  'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsexv2',
  'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex',
];

/** Holders are paid 1% of the pool each time a cycle closes. */
const HOLDER_PAYOUT_RATE = 0.01;

/**
 * How far back from today a day has to be before we call it settled and write
 * it down. Two days, because none of the three sources is final on sight:
 * `tokenDayDatas` for today is still accumulating volume, HEX emits day N's
 * payout at the *start* of day N+1, and a subgraph that is lagging will answer
 * for a day it has not finished indexing.
 */
export const FREEZE_LAG_DAYS = 2;

/**
 * How many already-stored days to re-fetch and compare on every refresh. The
 * cost is a few extra rows on a query we were making anyway; the return is
 * that a day written from a lagging subgraph gets caught and corrected instead
 * of sitting wrong under every projection for good.
 */
export const DRIFT_RECHECK_DAYS = 3;

export interface CyclesPayload {
  cycles: SuperStakeCycle[];
  series: { d0: number; P: number[]; SR: number[]; PH: number[]; VV: number[]; PV: number[] };
  /** Every T-share staked on the network, latest day — the denominator HEX itself uses. */
  globalTShares: number | null;
  source: 'subgraph';
  fetchedAt: number;
  /** Days at the tail with no price/volume data yet — the client should treat them as partial. */
  warnings: string[];
  /** What this rebuild had to do. Diagnostic; nothing renders off it. */
  store: {
    /** 'db' when settled days came out of Postgres, 'full-sweep' when they didn't. */
    mode: 'db' | 'full-sweep';
    /** First day asked of the subgraphs. Close to today on a warm store. */
    sweptFrom: number;
    daysFromDb: number;
    daysFromSubgraph: number;
    daysWritten: number;
    /** Stored readings that no longer match the subgraph. Should be empty. */
    drift: { day: number; field: string; stored: number | null; fresh: number | null }[];
  };
}

const dayFromTs = (ts: number) => Math.floor((ts - HEX_LAUNCH_TS) / 86_400) + 1;
const tsFromDay = (day: number) => HEX_LAUNCH_TS + (day - 1) * 86_400;

async function pulsexQuery<T>(query: string): Promise<T | null> {
  for (const url of PULSEX_SUBGRAPHS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.errors || !json?.data) continue;
      return json.data as T;
    } catch {
      /* next mirror */
    }
  }
  return null;
}

/** tokenDayDatas is capped at 1000 rows per query, so page by ascending date. */
async function fetchTokenDays(token: string, sinceTs: number) {
  const out: { date: number; priceUSD: number; volUSD: number }[] = [];
  let cursor = sinceTs - 1;
  for (let page = 0; page < 6; page++) {
    const data = await pulsexQuery<{ rows: { date: number; priceUSD: string; dailyVolumeUSD: string }[] }>(
      `{ rows: tokenDayDatas(first:1000, orderBy:date, orderDirection:asc,
           where:{ token:"${token}", date_gt:${cursor} }){ date priceUSD dailyVolumeUSD } }`,
    );
    const rows = data?.rows ?? [];
    if (!rows.length) break;
    for (const r of rows) {
      out.push({
        date: Number(r.date),
        priceUSD: parseFloat(r.priceUSD) || 0,
        volUSD: parseFloat(r.dailyVolumeUSD) || 0,
      });
    }
    cursor = Number(rows[rows.length - 1].date);
    if (rows.length < 1000) break;
  }
  return out;
}

/**
 * Share rate per HEX day, from shareRateChanges. The subgraph stores it raw
 * (463511); HEX quotes it a decimal place down (46351.1), which is the scale
 * the stake maths expects — verified against the published snapshot.
 */
async function fetchShareRates(fromDay: number) {
  const byDay = new Map<number, number>();
  let cursor = tsFromDay(fromDay) - 1;
  for (let page = 0; page < 8; page++) {
    const d = await hexSubgraphQuery<{ rows: { shareRate: string; timestamp: string }[] }>(
      'pulsechain',
      `{ rows: shareRateChanges(first:1000, orderBy:timestamp, orderDirection:asc, where:{ timestamp_gt:${cursor} }){ shareRate timestamp } }`,
    ).catch(() => null);
    const rows = d?.rows ?? [];
    if (!rows.length) break;
    for (const r of rows) byDay.set(dayFromTs(Number(r.timestamp)), Number(r.shareRate) / 10);
    cursor = Number(rows[rows.length - 1].timestamp);
    if (rows.length < 1000) break;
  }
  return byDay;
}

/** dailyDataUpdates is also capped, so page by ascending endDay. */
async function fetchHexDailies(fromDay: number) {
  const byDay = new Map<number, { payout: number; shares: number }>();
  let cursor = fromDay - 1;
  for (let page = 0; page < 6; page++) {
    const d = await hexSubgraphQuery<{ rows: { endDay: string; payout: string; shares: string }[] }>(
      'pulsechain',
      `{ rows: dailyDataUpdates(first:1000, orderBy:endDay, orderDirection:asc, where:{ endDay_gt:${cursor} }){ endDay payout shares } }`,
    ).catch(() => null);
    const rows = d?.rows ?? [];
    if (!rows.length) break;
    for (const r of rows) {
      // `endDay` is the day the update was *recorded*: HEX emits day N's payout
      // at the start of day N+1, so endDay N+1 describes day N. Attributing it
      // to endDay shifts the whole series a day late — invisible on flat days,
      // but badly wrong across a payout jump. Verified: shifting back one day
      // reproduces the published series exactly (0.000% diff over 1040 days).
      const day = Number(r.endDay) - 1;
      // payout is in hearts, shares in raw share units — the ratio is HEX per T-share.
      const payout = heartsToHex(r.payout);
      const shares = sharesToTShares(r.shares);
      if (shares > 0) byDay.set(day, { payout, shares });
    }
    cursor = Number(rows[rows.length - 1].endDay);
    if (rows.length < 1000) break;
  }
  return byDay;
}

/** Every stake the SuperStake contract has opened. One query, always fresh. */
async function fetchStakes(): Promise<StakeRow[] | null> {
  const stakes = await hexSubgraphQuery<{
    stakeStarts: { stakeId: string; stakedHearts: string; stakeShares: string; stakedDays: string; startDay: string; timestamp: string }[];
    stakeEnds: { stakeId: string; payout: string; stakedHearts: string; timestamp: string }[];
  }>(
    'pulsechain',
    `{
       stakeStarts(where:{ stakerAddr:"${SUPERSTAKE_STAKER}" }, orderBy:startDay, orderDirection:asc, first:500){
         stakeId stakedHearts stakeShares stakedDays startDay timestamp
       }
       stakeEnds(where:{ stakerAddr:"${SUPERSTAKE_STAKER}" }, first:500){
         stakeId payout stakedHearts timestamp
       }
     }`,
  ).catch(() => null);
  if (!stakes?.stakeStarts?.length) return null;
  const endsById = new Map(stakes.stakeEnds.map((e) => [e.stakeId, e]));
  return stakes.stakeStarts.map((s) => {
    const end = endsById.get(s.stakeId);
    return {
      stakeId: Number(s.stakeId),
      startDay: Number(s.startDay),
      stakedDays: Number(s.stakedDays),
      stakedHex: heartsToHex(s.stakedHearts),
      tShares: sharesToTShares(s.stakeShares),
      startedTs: Number(s.timestamp),
      ended: !!end,
      // StakeEnd.payout is the INTEREST only, not principal + interest —
      // verified against stake 944998, whose payout of 1,215,877,344,551 hearts
      // is 12,158 HEX on a 4,511,144 HEX principal. Subtracting stakedHearts
      // from it drove every finished cycle's yield negative, and the clamp
      // turned that into 0.
      endPayoutHex: end ? Math.max(0, heartsToHex(end.payout)) : null,
    };
  });
}

/** Fold the four sweeps into one observation per day. */
function toDayRows(
  hexDaily: Map<number, { payout: number; shares: number }>,
  shareRates: Map<number, number>,
  hexDays: { date: number; priceUSD: number; volUSD: number }[],
  psshDays: { date: number; priceUSD: number; volUSD: number }[],
): DayRow[] {
  const rows = new Map<number, DayRow>();
  const at = (day: number): DayRow => {
    let r = rows.get(day);
    if (!r) {
      r = { day, payoutPerTshare: null, shareRate: null, pHex: null, pSsh: null, volSsh: null, globalTshares: null };
      rows.set(day, r);
    }
    return r;
  };
  for (const [day, hd] of hexDaily) {
    const r = at(day);
    // `hexDaily` only ever holds days with shares > 0, so this ratio is safe.
    r.payoutPerTshare = hd.payout / hd.shares;
    r.globalTshares = hd.shares;
  }
  for (const [day, sr] of shareRates) at(day).shareRate = sr;
  for (const d of hexDays) at(dayFromTs(d.date)).pHex = d.priceUSD;
  for (const d of psshDays) {
    const r = at(dayFromTs(d.date));
    r.pSsh = d.priceUSD;
    r.volSsh = d.volUSD;
  }
  return [...rows.values()].sort((a, b) => a.day - b.day);
}

export interface RebuildOptions {
  /** Neon client, or null to run exactly as the route did before. */
  db?: SqlClient | null;
  /** Overridable so a test can pin the freeze boundary. */
  now?: number;
  /**
   * Ignore the cursor and re-read every day from the subgraphs, overwriting
   * what is stored. The routine drift check only covers the last
   * `DRIFT_RECHECK_DAYS`, so without this a day that went bad outside that
   * window would stay bad indefinitely — this is the way back. Costs a full
   * sweep, so it is never the default.
   */
  force?: boolean;
}

export async function rebuildCycles(opts: RebuildOptions = {}): Promise<CyclesPayload | null> {
  const now = opts.now ?? Date.now();
  const currentDay = dayFromTs(Math.floor(now / 1000));

  // --- 1. The stakes. One query, cheap, and always current — this is what
  //        tells us a new cycle has opened. -----------------------------------
  let stakes = await fetchStakes();
  let db = opts.db ?? null;
  let stored: DayRow[] = [];
  let sweptTo: number | null = null;

  // A dead database must never take the route down with it.
  if (db) {
    try {
      await ensureSuperstakeSchema(db);
      sweptTo = await readSweptToDay(db);
      if (!stakes) {
        // HEX subgraph down. If we have the stakes on file we can still serve.
        const fromDb = await readStakes(db);
        if (fromDb.length) stakes = fromDb;
      }
    } catch (e) {
      console.error('[superstake/cycles] store unavailable, falling back to a full sweep:', e);
      db = null;
      sweptTo = null;
    }
  }

  if (!stakes?.length) return null;

  const firstDay = Math.min(...stakes.map((s) => s.startDay));
  const freezeTo = currentDay - FREEZE_LAG_DAYS;

  if (db) {
    try {
      stored = await readDays(db, firstDay);
    } catch (e) {
      console.error('[superstake/cycles] could not read stored days:', e);
      db = null;
      stored = [];
      sweptTo = null;
    }
  }

  // --- 2. Ask the subgraphs only for what we haven't settled -----------------
  // Re-reading the last few stored days is what makes the drift check possible.
  const sweptFrom = sweptTo != null && !opts.force
    ? Math.max(firstDay, sweptTo + 1 - DRIFT_RECHECK_DAYS)
    : firstDay;

  const [hexDaily, shareRates, hexDays, psshDays] = await Promise.all([
    fetchHexDailies(sweptFrom),
    fetchShareRates(sweptFrom),
    fetchTokenDays(HEX_PLS, tsFromDay(sweptFrom)),
    fetchTokenDays(PSSH, tsFromDay(sweptFrom)),
  ]);
  const fresh = toDayRows(hexDaily, shareRates, hexDays, psshDays);

  // --- 3. Settle what can be settled ----------------------------------------
  const drift = db ? findDrift(stored, fresh) : [];
  let daysWritten = 0;
  if (db) {
    if (drift.length) {
      console.warn(
        `[superstake/cycles] ${drift.length} stored reading(s) disagree with the subgraph; taking the fresh values.`,
        drift.slice(0, 8),
      );
    }
    const settled = fresh.filter((d) => d.day <= freezeTo);
    try {
      if (settled.length) {
        daysWritten = await writeDays(db, settled);
        await writeSweptToDay(db, freezeTo);
      }
      await writeStakes(db, stakes);
    } catch (e) {
      // A failed write costs us the speed-up next time, nothing else — the
      // payload below is built from data we already hold in memory.
      console.error('[superstake/cycles] could not persist settled days:', e);
      daysWritten = 0;
    }
  }

  // --- 4. Merge. Fresh wins on any overlap, since it is the newer reading. ---
  const merged = new Map<number, DayRow>();
  for (const d of stored) merged.set(d.day, d);
  for (const d of fresh) {
    const prev = merged.get(d.day);
    merged.set(d.day, prev ? {
      day: d.day,
      // A silent column in the fresh sweep must not erase a stored reading —
      // same rule the upsert applies, so memory and Postgres agree.
      payoutPerTshare: d.payoutPerTshare ?? prev.payoutPerTshare,
      shareRate: d.shareRate ?? prev.shareRate,
      pHex: d.pHex ?? prev.pHex,
      pSsh: d.pSsh ?? prev.pSsh,
      volSsh: d.volSsh ?? prev.volSsh,
      globalTshares: d.globalTshares ?? prev.globalTshares,
    } : d);
  }

  // --- 5. Densify. Identical to the original: carry the last known value
  //        forward across gaps so a missing day never reads as a zero price. --
  const lastDay = Math.max(firstDay, ...[...merged.keys()].filter(Number.isFinite));

  const P: number[] = [];
  const SR: number[] = [];
  const PH: number[] = [];
  const VV: number[] = [];
  const PV: number[] = [];
  let lastP = 0, lastSR = 0, lastPH = 0, lastPV = 0;
  for (let day = firstDay; day <= lastDay; day++) {
    const d = merged.get(day);
    if (d?.payoutPerTshare != null) lastP = d.payoutPerTshare;
    if (d?.shareRate) lastSR = d.shareRate;
    if (d?.pHex) lastPH = d.pHex;
    if (d?.pSsh) lastPV = d.pSsh;
    P.push(lastP);
    SR.push(lastSR);
    PH.push(lastPH);
    PV.push(lastPV);
    VV.push(d?.volSsh ?? 0);
  }

  // --- 6. Cycles. Unchanged. ------------------------------------------------
  const cycles: SuperStakeCycle[] = stakes
    .slice()
    .sort((a, b) => a.startDay - b.startDay)
    .map((s, idx) => {
      const d0 = s.startDay;
      const d1 = d0 + s.stakedDays;
      const hex = s.stakedHex;
      const tsh = s.tShares;
      const done = s.ended || d1 <= currentDay;
      // Native yield: the realised payout when the stake has ended, otherwise
      // the series' payout-per-T-share accrued so far.
      let nY = 0;
      if (s.ended && s.endPayoutHex != null) {
        nY = Math.max(0, s.endPayoutHex);
      } else {
        for (let d = d0; d <= Math.min(d1, lastDay); d++) nY += tsh * (P[d - firstDay] ?? 0);
      }
      const idxAt = (d: number) => Math.min(Math.max(d - firstDay, 0), P.length - 1);
      let vol = 0;
      for (let d = d0; d < Math.min(d1, lastDay + 1); d++) vol += VV[idxAt(d)] ?? 0;
      const pH0 = PH[idxAt(d0)] ?? 0;
      let pHsum = 0, pHn = 0;
      for (let d = d0; d < Math.min(d1, lastDay + 1); d++) { const v = PH[idxAt(d)]; if (v > 0) { pHsum += v; pHn++; } }
      return {
        i: idx + 1,
        id: s.stakeId,
        d0,
        d1,
        ts: s.startedTs,
        hex,
        tsh,
        own: 0,
        nY,
        pay: HOLDER_PAYOUT_RATE * (hex + nY),
        vol,
        refl: 0.025 * vol,
        pH0,
        pHavg: pHn ? pHsum / pHn : pH0,
        pS0: PV[idxAt(d0)] ?? 0,
        hexU: 0,
        psshU: 0,
        done,
      };
    });

  const warnings: string[] = [];
  const anyPayout = [...merged.values()].some((d) => d.payoutPerTshare != null);
  const anyPssh = [...merged.values()].some((d) => d.pSsh != null || d.volSsh != null);
  if (!anyPayout) warnings.push('HEX daily data unavailable — payout series is flat.');
  if (!anyPssh) warnings.push('pSSH day data unavailable — volume/reflections are zero.');
  if (drift.length) {
    warnings.push(`${drift.length} stored day reading(s) were corrected against the subgraph.`);
  }

  // The network's T-share total on the most recent day we have one for.
  const latest = [...merged.values()]
    .filter((d) => (d.globalTshares ?? 0) > 0)
    .sort((a, b) => b.day - a.day)[0];

  return {
    cycles,
    series: { d0: firstDay, P, SR, PH, VV, PV },
    globalTShares: latest?.globalTshares ?? null,
    source: 'subgraph',
    fetchedAt: now,
    warnings,
    store: {
      mode: db ? 'db' : 'full-sweep',
      sweptFrom,
      daysFromDb: stored.length,
      daysFromSubgraph: fresh.length,
      daysWritten,
      drift: drift.map((d) => ({ day: d.day, field: String(d.field), stored: d.stored, fresh: d.fresh })),
    },
  };
}
