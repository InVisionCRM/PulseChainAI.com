import { NextRequest, NextResponse } from 'next/server';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import { hexStakingService } from '@/services/hexStakingService';
import { heartsToHex, sharesToTShares, currentHexDay } from '@/lib/hex/hexDay';
import { hexSubgraphQuery, type HexNet as Net } from '@/lib/hex/subgraph';
import {
  WHALE_MIN_HEX, UNLOCK_WINDOW_DAYS, restakePropensity, buildWhaleStake, summarize,
  type WhaleStake, type WhaleRadarData,
} from '@/lib/hex/whaleRadar';

export const revalidate = 0;
// The Ethereum path queries the decentralized gateway and resolves up to
// MAX_WHALES per-wallet histories — well past the default function cap.
export const maxDuration = 60;

// Cap how many whales we resolve histories for, to bound subgraph work.
const MAX_WHALES = 40;

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

interface RawStake {
  stakeId: string; stakerAddr: string; stakedHearts: string; stakeShares: string;
  stakedDays: string; startDay: string; endDay: string;
}
const STAKE_FIELDS = 'stakeId stakerAddr stakedHearts stakeShares stakedDays startDay endDay';

const gql = hexSubgraphQuery;

/** Drop stakes that have already been (early-)ended. */
async function excludeEnded(net: Net, starts: RawStake[]): Promise<RawStake[]> {
  if (!starts.length) return starts;
  try {
    const ids = starts.map((s) => `"${s.stakeId}"`).join(',');
    const d = await gql<{ stakeEnds: { stakeId: string }[] }>(net, `{ stakeEnds(where:{ stakeId_in: [${ids}] }, first: 1000){ stakeId } }`);
    const ended = new Set((d.stakeEnds ?? []).map((e) => String(e.stakeId)));
    return starts.filter((s) => !ended.has(String(s.stakeId)));
  } catch {
    return starts; // best-effort: if the exclusion query fails, keep them
  }
}

/** Active stakes ≥ minHearts ending within the window, straight from the subgraph. */
async function endingFromGraph(net: Net, currentDay: number, minHearts: number): Promise<RawStake[]> {
  const within = (s: RawStake) => {
    const e = num(s.endDay);
    return num(s.stakedHearts) >= minHearts && e >= currentDay && e - currentDay <= UNLOCK_WINDOW_DAYS;
  };
  const minStr = minHearts.toLocaleString('fullwide', { useGrouping: false });

  // Attempt 1: server-side filter on end day + size (cheap, precise).
  try {
    const d = await gql<{ stakeStarts: RawStake[] }>(
      net,
      `{ stakeStarts(where:{ endDay_gte: ${currentDay}, endDay_lte: ${currentDay + UNLOCK_WINDOW_DAYS}, stakedHearts_gte: "${minStr}" }, orderBy: stakedHearts, orderDirection: desc, first: 300){ ${STAKE_FIELDS} } }`,
    );
    if (d.stakeStarts?.length) return excludeEnded(net, d.stakeStarts.filter(within));
  } catch {
    /* fall through */
  }
  // Attempt 2: biggest stakes, filter the window in JS (covers schema quirks).
  try {
    const d = await gql<{ stakeStarts: RawStake[] }>(
      net,
      `{ stakeStarts(orderBy: stakedHearts, orderDirection: desc, first: 1000){ ${STAKE_FIELDS} } }`,
    );
    return excludeEnded(net, (d.stakeStarts ?? []).filter(within));
  } catch {
    return [];
  }
}

/** A wallet's stake start/end timestamps, for the re-stake propensity signal. */
async function stakerHistoryFromGraph(net: Net, addr: string): Promise<{ rate: number | null; count: number }> {
  try {
    const d = await gql<{ stakeStarts: { timestamp: string }[]; stakeEnds: { timestamp: string }[] }>(
      net,
      `{ stakeStarts(where:{ stakerAddr: "${addr}" }, first: 1000){ timestamp } stakeEnds(where:{ stakerAddr: "${addr}" }, first: 1000){ timestamp } }`,
    );
    const starts = (d.stakeStarts ?? []).map((s) => num(s.timestamp)).filter((t) => t > 0);
    const ends = (d.stakeEnds ?? []).map((e) => num(e.timestamp)).filter((t) => t > 0);
    return restakePropensity(starts, ends);
  } catch {
    return { rate: null, count: 0 };
  }
}

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;
  const svc = net === 'ethereum' ? hexStakingService : pulsechainHexStakingService;
  const currentDay = currentHexDay();
  const minHearts = WHALE_MIN_HEX * 1e8;

  try {
    // Fast path: the DB-backed cache (ordered by size). If it's empty/unsynced,
    // fall back to the subgraph so the Radar still populates.
    let ending: RawStake[] = [];
    let usedGraph = false;
    try {
      const active = (await svc.getAllActiveStakes()) as Record<string, unknown>[];
      ending = active
        .filter((s) => {
          const e = num(s.endDay);
          return num(s.stakedHearts) >= minHearts && e >= currentDay && e - currentDay <= UNLOCK_WINDOW_DAYS;
        })
        .map((s) => ({
          stakeId: String(s.stakeId ?? ''), stakerAddr: String(s.stakerAddr ?? ''),
          stakedHearts: String(s.stakedHearts ?? '0'), stakeShares: String(s.stakeShares ?? '0'),
          stakedDays: String(s.stakedDays ?? '0'), startDay: String(s.startDay ?? '0'), endDay: String(s.endDay ?? '0'),
        }));
    } catch {
      ending = [];
    }
    if (ending.length === 0) {
      usedGraph = true;
      ending = await endingFromGraph(net, currentDay, minHearts);
    }

    ending = ending.sort((a, b) => num(b.stakedHearts) - num(a.stakedHearts)).slice(0, MAX_WHALES);

    // Behavioral signal per unique whale (re-stake history).
    const addrs = [...new Set(ending.map((s) => s.stakerAddr.toLowerCase()))];
    const histByAddr = new Map<string, { rate: number | null; count: number }>();
    await Promise.all(
      addrs.map(async (addr) => {
        if (usedGraph) {
          histByAddr.set(addr, await stakerHistoryFromGraph(net, addr));
          return;
        }
        try {
          const h = (await svc.getStakerHistory(addr)) as unknown as {
            stakes?: { timestamp?: unknown }[]; stakeEnds?: { timestamp?: unknown }[];
          };
          const starts = (h.stakes ?? []).map((s) => num(s.timestamp)).filter((t) => t > 0);
          const ends = (h.stakeEnds ?? []).map((e) => num(e.timestamp)).filter((t) => t > 0);
          histByAddr.set(addr, restakePropensity(starts, ends));
        } catch {
          histByAddr.set(addr, await stakerHistoryFromGraph(net, addr));
        }
      }),
    );

    const stakes: WhaleStake[] = ending.map((s) =>
      buildWhaleStake(
        {
          stakeId: s.stakeId,
          stakerAddr: s.stakerAddr,
          principalHex: heartsToHex(s.stakedHearts),
          tShares: sharesToTShares(s.stakeShares),
          startDay: num(s.startDay),
          endDay: num(s.endDay),
        },
        currentDay,
        histByAddr.get(s.stakerAddr.toLowerCase()) ?? { rate: null, count: 0 },
      ),
    );

    const data: WhaleRadarData = { network: net, currentDay, stakes, ...summarize(stakes) };
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load whale unlocks' },
      { status: 500 },
    );
  }
}
