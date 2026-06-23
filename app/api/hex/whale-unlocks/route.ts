import { NextRequest, NextResponse } from 'next/server';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import { hexStakingService } from '@/services/hexStakingService';
import { heartsToHex, sharesToTShares, currentHexDay } from '@/lib/hex/hexDay';
import {
  WHALE_MIN_HEX, UNLOCK_WINDOW_DAYS, restakePropensity, buildWhaleStake, summarize,
  type WhaleStake, type WhaleRadarData,
} from '@/lib/hex/whaleRadar';

export const revalidate = 0;

// Cap how many whales we resolve histories for, to bound subgraph work.
const MAX_WHALES = 40;

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as
    | 'ethereum'
    | 'pulsechain';
  const svc = net === 'ethereum' ? hexStakingService : pulsechainHexStakingService;

  try {
    const active = await svc.getAllActiveStakes();
    const currentDay = currentHexDay();
    const minHearts = WHALE_MIN_HEX * 1e8;

    // Big stakes ending within the window. getAllActiveStakes is ordered by
    // size desc, so we keep ≥WHALE_MIN_HEX with an end day inside the next 30.
    const ending = (active as Record<string, unknown>[])
      .filter((s) => {
        const hearts = num(s.stakedHearts);
        const endDay = num(s.endDay);
        return hearts >= minHearts && endDay >= currentDay && endDay - currentDay <= UNLOCK_WINDOW_DAYS;
      })
      .sort((a, b) => num(b.stakedHearts) - num(a.stakedHearts))
      .slice(0, MAX_WHALES);

    // Behavioral signal per unique whale (re-stake history).
    const addrs = [...new Set(ending.map((s) => String(s.stakerAddr).toLowerCase()))];
    const histByAddr = new Map<string, { rate: number | null; count: number }>();
    await Promise.all(
      addrs.map(async (addr) => {
        try {
          const h = (await svc.getStakerHistory(addr)) as unknown as {
            stakes?: { timestamp?: unknown }[];
            stakeEnds?: { timestamp?: unknown }[];
          };
          const starts = (h.stakes ?? []).map((s) => num(s.timestamp)).filter((t) => t > 0);
          const ends = (h.stakeEnds ?? []).map((e) => num(e.timestamp)).filter((t) => t > 0);
          histByAddr.set(addr, restakePropensity(starts, ends));
        } catch {
          histByAddr.set(addr, { rate: null, count: 0 });
        }
      }),
    );

    const stakes: WhaleStake[] = ending.map((s) =>
      buildWhaleStake(
        {
          stakeId: String(s.stakeId ?? ''),
          stakerAddr: String(s.stakerAddr ?? ''),
          principalHex: heartsToHex(s.stakedHearts as string),
          tShares: sharesToTShares(s.stakeShares as string),
          startDay: num(s.startDay),
          endDay: num(s.endDay),
        },
        currentDay,
        histByAddr.get(String(s.stakerAddr).toLowerCase()) ?? { rate: null, count: 0 },
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
