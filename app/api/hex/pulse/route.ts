import { NextRequest, NextResponse } from 'next/server';
import type { HexNet as Net } from '@/lib/hex/subgraph';
import { query } from '@/lib/hex/lockedStakes';
import { currentHexDay } from '@/lib/hex/hexDay';

export const revalidate = 0;
export const maxDuration = 60;

// The staking pulse: everything that happened to HEX staking in the last 24
// hours, 7 days, and 30 days, aggregated from the subgraph's event stream in
// one pass. All three windows come from a single 30-day fetch — the events are
// pulled once with timestamps and summed into each window they fall in, so the
// numbers can never disagree with each other.
//
// Volumes are small (roughly 60–150 events per entity per day on PulseChain),
// so the whole 30-day stream is a handful of pages per entity. Price is NOT
// served here — the client reads the app's existing OHLCV route for that, and
// a missing price never blocks the chain-side figures.

const HEARTS = 1e8;
const TSH = 1e12;
const PAGE = 1000;

const WINDOWS = [
  { key: '24h', seconds: 86_400 },
  { key: '7d', seconds: 7 * 86_400 },
  { key: '30d', seconds: 30 * 86_400 },
] as const;
export type WindowKey = (typeof WINDOWS)[number]['key'];

interface StartEvent {
  stakerAddr: string; stakedHearts: string; stakeShares: string; stakedDays: string; timestamp: string; isAutoStake: boolean;
}
interface EndEvent {
  stakerAddr: string; stakedHearts: string; stakedShares: string; payout: string; penalty: string;
  servedDays: string; daysLate: string; daysEarly: string; prevUnlocked: boolean; timestamp: string;
}
interface GaEvent {
  stakerAddr: string; stakedHearts: string; stakedShares: string; payout: string; penalty: string; timestamp: string;
}

/** Walk an entity's last `since` seconds by timestamp cursor, ascending. */
async function sweep<T extends { timestamp: string }>(
  net: Net, entity: string, fields: string, fromTs: number,
): Promise<T[]> {
  const out: T[] = [];
  let cursor = fromTs - 1;
  for (let i = 0; i < 40; i++) {
    const d = await query<Record<string, T[]>>(
      net,
      `{ ${entity}(where:{ timestamp_gt: "${cursor}" }, orderBy: timestamp, orderDirection: asc, first: ${PAGE}){ ${fields} } }`,
    );
    const page = d[entity] ?? [];
    out.push(...page);
    if (page.length < PAGE) break;
    // A full page sharing one second would stall a plain cursor; nudging by the
    // newest timestamp is safe here because events per second are single-digit.
    cursor = Number(page[page.length - 1].timestamp);
  }
  return out;
}

export interface WindowStats {
  window: WindowKey;
  starts: {
    count: number; hex: number; tShares: number; stakers: number;
    avgDays: number; medianDays: number; autoStakes: number;
    biggestHex: number; biggestDays: number;
  };
  ends: {
    count: number; principalHex: number; tShares: number; stakers: number;
    payoutHex: number; penaltyHex: number;
    fullTerm: number; early: number; late: number;
  };
  goodAccounted: { count: number; hex: number; payoutHex: number; penaltyHex: number };
  /** Chain-state movement across the window, from globalInfo snapshots. */
  delta: {
    lockedHex: number | null; tShares: number | null;
    shareRatePct: number | null; supplyHex: number | null;
  } | null;
  /** Inflation the chain minted to stakers across the window's daily payouts. */
  mintedHex: number;
  /** starts minus ends, in HEX — the flow needle. */
  netHex: number;
  netStakes: number;
}

export interface PulseResponse {
  network: Net;
  currentDay: number;
  asOf: number;
  windows: Record<WindowKey, WindowStats>;
  /** Last 30 days, one point per day: [dayStartTs, startsCount, startsHex, endsCount, endsHex]. */
  daily: [number, number, number, number, number][];
  now: {
    lockedHex: number; tShares: number; shareRate: number; supplyHex: number;
    latestStakeId: number; stakePenaltyTotalHex: number;
  } | null;
  note: string;
}

interface Snapshot {
  lockedHex: number; tShares: number; shareRate: number; supplyHex: number;
  latestStakeId: number; stakePenaltyTotalHex: number;
}

async function snapshotAt(net: Net, ts: number): Promise<Snapshot | null> {
  const d = await query<{ globalInfos: Record<string, string>[] }>(
    net,
    `{ globalInfos(where:{ timestamp_lte: "${ts}" }, orderBy: timestamp, orderDirection: desc, first: 1){
        lockedHeartsTotal stakeSharesTotal shareRate totalSupply latestStakeId stakePenaltyTotal } }`,
  );
  const g = d.globalInfos?.[0];
  if (!g) return null;
  return {
    lockedHex: Number(g.lockedHeartsTotal) / HEARTS,
    tShares: Number(g.stakeSharesTotal) / TSH,
    shareRate: Number(g.shareRate) / 10, // contract stores it ×10
    supplyHex: Number(g.totalSupply) / HEARTS,
    latestStakeId: Number(g.latestStakeId),
    stakePenaltyTotalHex: Number(g.stakePenaltyTotal) / HEARTS,
  };
}

const round = (n: number, dp = 2) => Number(n.toFixed(dp));

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;
  const now = Math.floor(Date.now() / 1000);
  const from30 = now - WINDOWS[2].seconds;

  try {
    const [starts, ends, gas, snapNow, ...pastSnaps] = await Promise.all([
      sweep<StartEvent>(net, 'stakeStarts', 'stakerAddr stakedHearts stakeShares stakedDays timestamp isAutoStake', from30),
      sweep<EndEvent>(net, 'stakeEnds', 'stakerAddr stakedHearts stakedShares payout penalty servedDays daysLate daysEarly prevUnlocked timestamp', from30),
      sweep<GaEvent>(net, 'stakeGoodAccountings', 'stakerAddr stakedHearts stakedShares payout penalty timestamp', from30),
      snapshotAt(net, now),
      ...WINDOWS.map((w) => snapshotAt(net, now - w.seconds)),
    ]);

    // Daily inflation payouts — one row per HEX day, minted to all stakers.
    const dailyPayouts = await query<{ dailyDataUpdates: { timestamp: string; payout: string }[] }>(
      net,
      `{ dailyDataUpdates(where:{ timestamp_gte: "${from30}" }, orderBy: timestamp, orderDirection: asc, first: 60){ timestamp payout } }`,
    );

    const windows = {} as Record<WindowKey, WindowStats>;
    WINDOWS.forEach((w, wi) => {
      const cut = now - w.seconds;
      const s = starts.filter((e) => Number(e.timestamp) >= cut);
      const e = ends.filter((ev) => Number(ev.timestamp) >= cut);
      const g = gas.filter((ev) => Number(ev.timestamp) >= cut);

      const sHex = s.reduce((t, ev) => t + Number(ev.stakedHearts), 0) / HEARTS;
      const eHex = e.reduce((t, ev) => t + Number(ev.stakedHearts), 0) / HEARTS;
      const days = s.map((ev) => Number(ev.stakedDays)).sort((a, b) => a - b);
      const biggest = s.reduce<StartEvent | null>(
        (best, ev) => (!best || Number(ev.stakedHearts) > Number(best.stakedHearts) ? ev : best), null,
      );
      const past = pastSnaps[wi];

      windows[w.key] = {
        window: w.key,
        starts: {
          count: s.length,
          hex: round(sHex),
          tShares: round(s.reduce((t, ev) => t + Number(ev.stakeShares), 0) / TSH, 3),
          stakers: new Set(s.map((ev) => ev.stakerAddr)).size,
          avgDays: s.length ? Math.round(days.reduce((a, b) => a + b, 0) / s.length) : 0,
          medianDays: s.length ? days[Math.floor(days.length / 2)] : 0,
          autoStakes: s.filter((ev) => ev.isAutoStake).length,
          biggestHex: biggest ? round(Number(biggest.stakedHearts) / HEARTS) : 0,
          biggestDays: biggest ? Number(biggest.stakedDays) : 0,
        },
        ends: {
          count: e.length,
          principalHex: round(eHex),
          tShares: round(e.reduce((t, ev) => t + Number(ev.stakedShares), 0) / TSH, 3),
          stakers: new Set(e.map((ev) => ev.stakerAddr)).size,
          payoutHex: round(e.reduce((t, ev) => t + Number(ev.payout), 0) / HEARTS),
          penaltyHex: round(e.reduce((t, ev) => t + Number(ev.penalty), 0) / HEARTS),
          fullTerm: e.filter((ev) => Number(ev.daysEarly) === 0).length,
          early: e.filter((ev) => Number(ev.daysEarly) > 0).length,
          late: e.filter((ev) => Number(ev.daysLate) > 0).length,
        },
        goodAccounted: {
          count: g.length,
          hex: round(g.reduce((t, ev) => t + Number(ev.stakedHearts), 0) / HEARTS),
          payoutHex: round(g.reduce((t, ev) => t + Number(ev.payout), 0) / HEARTS),
          penaltyHex: round(g.reduce((t, ev) => t + Number(ev.penalty), 0) / HEARTS),
        },
        delta: snapNow && past
          ? {
              lockedHex: round(snapNow.lockedHex - past.lockedHex),
              tShares: round(snapNow.tShares - past.tShares, 3),
              shareRatePct: past.shareRate > 0 ? round(((snapNow.shareRate - past.shareRate) / past.shareRate) * 100, 4) : null,
              supplyHex: round(snapNow.supplyHex - past.supplyHex),
            }
          : null,
        mintedHex: round(
          dailyPayouts.dailyDataUpdates
            .filter((d) => Number(d.timestamp) >= cut)
            .reduce((t, d) => t + Number(d.payout), 0) / HEARTS,
        ),
        netHex: round(sHex - eHex),
        netStakes: s.length - e.length,
      };
    });

    // The 30-day daily strip, bucketed on UTC day boundaries.
    const dayOf = (ts: number) => Math.floor(ts / 86_400) * 86_400;
    const byDay = new Map<number, [number, number, number, number]>();
    for (let d = dayOf(from30 + 86_400); d <= dayOf(now); d += 86_400) byDay.set(d, [0, 0, 0, 0]);
    for (const ev of starts) {
      const b = byDay.get(dayOf(Number(ev.timestamp)));
      if (b) { b[0] += 1; b[1] += Number(ev.stakedHearts) / HEARTS; }
    }
    for (const ev of ends) {
      const b = byDay.get(dayOf(Number(ev.timestamp)));
      if (b) { b[2] += 1; b[3] += Number(ev.stakedHearts) / HEARTS; }
    }

    const body: PulseResponse = {
      network: net,
      currentDay: currentHexDay(),
      asOf: now,
      windows,
      daily: [...byDay.entries()].map(([d, [sc, sh, ec, eh]]) => [d, sc, round(sh), ec, round(eh)]),
      now: snapNow,
      note:
        'Aggregated from every stake start, end and good-accounting on the subgraph over the last 30 days, ' +
        'plus the chain’s own globalInfo snapshots at each window boundary.',
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read the staking pulse' },
      { status: 500 },
    );
  }
}
