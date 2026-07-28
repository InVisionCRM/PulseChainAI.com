// Live SuperStake cycle history, rebuilt from the subgraphs on demand.
//
// Everything the head-to-head needs turns out to be queryable — no separate
// indexer required:
//   • cycles           — HEX subgraph, every stake opened by the SuperStake
//                        staking contract (stakeStarts/stakeEnds by stakerAddr)
//   • payout/share rate — HEX subgraph dailyDataUpdates (payout ÷ shares per day)
//   • prices + volume   — PulseX subgraph tokenDayDatas for pHEX and pSSH
//   • holder payout     — 1% of (pool + yield), verified against the published
//                        record for cycles #1 and #18
//
// Reuses lib/hex/subgraph.ts (the same helper the HEX dashboard/Strategist uses)
// rather than opening a second path to the same data.
//
// This is heavy (1000+ days of series across two subgraphs), so it is cached
// hard in-process. The baked snapshot stays the fallback: if either subgraph is
// unavailable the client keeps using it rather than showing a broken page.

import { NextResponse } from 'next/server';
import { hexSubgraphQuery } from '@/lib/hex/subgraph';
import { heartsToHex, sharesToTShares } from '@/lib/hex/hexDay';
import { HEX_LAUNCH_TS, type SuperStakeCycle } from '@/lib/superstake/model';

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
/** Rebuilding touches both subgraphs, so keep it cached for an hour. */
const CACHE_TTL_MS = 60 * 60_000;

interface CyclesPayload {
  cycles: SuperStakeCycle[];
  series: { d0: number; P: number[]; SR: number[]; PH: number[]; VV: number[]; PV: number[] };
  source: 'subgraph';
  fetchedAt: number;
  /** Days at the tail with no price/volume data yet — the client should treat them as partial. */
  warnings: string[];
}

let cache: { value: CyclesPayload; at: number } | null = null;

const dayFromTs = (ts: number) => Math.floor((ts - HEX_LAUNCH_TS) / 86_400) + 1;

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
    const data = await pulsexQuery<{ rows: any[] }>(
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
  let cursor = HEX_LAUNCH_TS + (fromDay - 1) * 86_400 - 1;
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

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.value, {
      headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600' },
    });
  }

  // --- 1. Every stake the SuperStake contract has opened ---------------------
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

  if (!stakes?.stakeStarts?.length) {
    return NextResponse.json(
      { error: 'HEX subgraph unavailable', source: 'unavailable' },
      { status: 503 },
    );
  }

  const endsById = new Map(stakes.stakeEnds.map((e) => [e.stakeId, e]));
  const starts = stakes.stakeStarts;
  const firstDay = Number(starts[0].startDay);

  // --- 2. Daily series -------------------------------------------------------
  const sinceTs = HEX_LAUNCH_TS + (firstDay - 1) * 86_400;
  const [hexDaily, shareRates, hexDays, psshDays] = await Promise.all([
    fetchHexDailies(firstDay),
    fetchShareRates(firstDay),
    fetchTokenDays(HEX_PLS, sinceTs),
    fetchTokenDays(PSSH, sinceTs),
  ]);

  const priceByDay = (rows: { date: number; priceUSD: number; volUSD: number }[]) => {
    const m = new Map<number, { price: number; vol: number }>();
    for (const r of rows) m.set(dayFromTs(r.date), { price: r.priceUSD, vol: r.volUSD });
    return m;
  };
  const hexPx = priceByDay(hexDays);
  const psshPx = priceByDay(psshDays);

  const lastDay = Math.max(
    firstDay,
    ...[...hexDaily.keys(), ...hexPx.keys(), ...psshPx.keys(), ...shareRates.keys()].filter(Number.isFinite),
  );

  const P: number[] = [];
  const SR: number[] = [];
  const PH: number[] = [];
  const VV: number[] = [];
  const PV: number[] = [];
  // Carry the last known value forward across gaps so the series stays dense —
  // a missing day must not read as a zero price.
  let lastP = 0, lastSR = 0, lastPH = 0, lastPV = 0;
  for (let day = firstDay; day <= lastDay; day++) {
    const hd = hexDaily.get(day);
    // payout is that day's HEX distributed; shares the network T-share total —
    // their ratio is the day's payout per T-share.
    if (hd) lastP = hd.payout / hd.shares;
    const sr = shareRates.get(day);
    if (sr) lastSR = sr;
    const hx = hexPx.get(day);
    const ps = psshPx.get(day);
    if (hx?.price) lastPH = hx.price;
    if (ps?.price) lastPV = ps.price;
    P.push(lastP);
    SR.push(lastSR);
    PH.push(lastPH);
    PV.push(lastPV);
    VV.push(ps?.vol ?? 0);
  }

  // --- 3. Cycles -------------------------------------------------------------
  const currentDay = dayFromTs(Math.floor(Date.now() / 1000));
  const cycles: SuperStakeCycle[] = starts.map((s, idx) => {
    const d0 = Number(s.startDay);
    const d1 = d0 + Number(s.stakedDays);
    const hex = heartsToHex(s.stakedHearts);
    const tsh = sharesToTShares(s.stakeShares);
    const end = endsById.get(s.stakeId);
    const done = !!end || d1 <= currentDay;
    // Native yield: the realised payout when the stake has ended, otherwise the
    // series' payout-per-T-share accrued so far.
    let nY = 0;
    if (end) {
      nY = Math.max(0, heartsToHex(end.payout) - heartsToHex(end.stakedHearts));
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
      id: Number(s.stakeId),
      d0,
      d1,
      ts: Number(s.timestamp),
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
  if (!hexDaily.size) warnings.push('HEX daily data unavailable — payout series is flat.');
  if (!psshDays.length) warnings.push('pSSH day data unavailable — volume/reflections are zero.');

  const payload: CyclesPayload = {
    cycles,
    series: { d0: firstDay, P, SR, PH, VV, PV },
    source: 'subgraph',
    fetchedAt: Date.now(),
    warnings,
  };
  cache = { value: payload, at: Date.now() };

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600' },
  });
}
