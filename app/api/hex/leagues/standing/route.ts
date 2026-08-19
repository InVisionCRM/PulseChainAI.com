import { NextRequest, NextResponse } from 'next/server';
import { fetchOnChainStakes, type OnChainStake } from '@/lib/hex/onchainStakes';
import { currentHexDay } from '@/lib/hex/hexDay';
import type { HexNet as Net } from '@/lib/hex/subgraph';
import { dbAvailable, getSyncState, readRankAround, type StakerRank } from '@/lib/db/hexLockedStakes';

export const revalidate = 0;
export const maxDuration = 30;

// One address's exact league position, read straight from the HEX contract's
// stakeLists rather than the subgraph. This is the authoritative answer: the
// subgraph can lag or miss an event, the contract cannot. It is also cheap —
// stakeCount + one read per stake — so it stays fast enough to run on demand.
//
// Only stakes with `unlockedDay === 0` count. Ending or good-accounting a stake
// removes its shares from the network's live total, so a stake that has been
// unlocked no longer contributes anything to a league standing.

export interface StandingStake {
  stakeId: string;
  tShares: number;
  principalHex: number;
  startDay: number;
  endDay: number;
  stakedDays: number;
}

export interface StandingResponse {
  network: Net;
  address: string;
  currentDay: number;
  /** Live, locked T-Shares — the number the ladder ranks on. */
  tShares: number;
  /** Locked HEX principal behind them. */
  principalHex: number;
  stakes: StandingStake[];
  /** Stakes on the address that are already unlocked, so contribute nothing. */
  unlockedStakes: number;
  /**
   * Exact position on the full staker ranking with the nearest rivals, from
   * the stake mirror. Absent while the mirror is still filling — the on-chain
   * standing above never waits on it.
   */
  board?: StakerRank;
}

const toStake = (s: OnChainStake): StandingStake => ({
  stakeId: s.stakeId,
  tShares: s.tShares,
  principalHex: s.principalHex,
  startDay: s.lockedDay,
  endDay: s.endDay,
  stakedDays: s.stakedDays,
});

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;
  const address = (req.nextUrl.searchParams.get('address') ?? '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Enter a valid 0x… wallet address' }, { status: 400 });
  }
  try {
    const all = await fetchOnChainStakes(net, address);
    const locked = all.filter((s) => s.unlockedDay === 0);
    const tShares = locked.reduce((t, s) => t + s.tShares, 0);

    // Best-effort: the exact rank needs the mirror, the standing does not — so
    // a mirror that is still filling (or erroring) only costs the board slice.
    let board: StakerRank | undefined;
    // A zero-share address has no place on the board — "rank #121,007 of
    // 121,006" is the kind of figure that erodes trust in the real ones.
    if (dbAvailable() && tShares > 0) {
      board = await getSyncState(net)
        .then((st) => (st?.ready ? readRankAround(net, address, tShares) : null))
        .then((r) => r ?? undefined)
        .catch(() => undefined);
    }

    const body: StandingResponse = {
      network: net,
      address,
      currentDay: currentHexDay(),
      tShares,
      principalHex: locked.reduce((h, s) => h + s.principalHex, 0),
      stakes: locked.map(toStake).sort((a, b) => b.tShares - a.tShares),
      unlockedStakes: all.length - locked.length,
      ...(board ? { board } : {}),
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read stakes on-chain' },
      { status: 502 },
    );
  }
}
