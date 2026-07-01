import { NextRequest, NextResponse } from 'next/server';
import { currentHexDay, HEX_ADDRESS } from '@/lib/hex/hexDay';
import { buildHolderGraph } from '@/lib/portfolio/holderGraph';
import type { HolderNode, ChainId } from '@/lib/portfolio/holders';
import { getKnownAddress } from '@/lib/gumshoe/address-labels';
import { hexSubgraphQuery, type HexNet as Net } from '@/lib/hex/subgraph';

export const revalidate = 0;
export const maxDuration = 60;

const FIELDS = 'stakeId stakerAddr stakedHearts stakeShares stakedDays startDay endDay';
// How many staker addresses we cluster (one HEX-transfer scan each). HEX is the
// slowest token to scan, so we cluster fewer stakers but give the scan a bigger
// budget below — enough to actually FINISH within the 60s route limit and
// surface clusters, instead of timing out at ~48 and finding nothing. The full
// bubble set still renders; only clustering is capped here.
const CLUSTER_LIMIT = 80;
const LIMITS = new Set([50, 250, 500, 1000]);

interface RawStart {
  stakeId: string; stakerAddr: string; stakedHearts: string; stakeShares: string;
  stakedDays: string; startDay: string; endDay: string;
}

const gql = hexSubgraphQuery;

async function endedIds(net: Net, starts: RawStart[]): Promise<Set<string>> {
  const ended = new Set<string>();
  const ids = starts.map((s) => s.stakeId);
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
    try {
      const d = await gql<{ stakeEnds: { stakeId: string }[] }>(
        net,
        `{ stakeEnds(where:{ stakeId_in: [${chunk}] }, first: 1000){ stakeId } }`,
      );
      for (const e of d.stakeEnds ?? []) ended.add(String(e.stakeId));
    } catch {
      /* best-effort */
    }
  }
  return ended;
}

const h2h = (h: string) => Number(h) / 1e8;
const s2t = (s: string) => Number(s) / 1e12;

export interface StakeInfo {
  stakeId: string;
  principalHex: number;
  tShares: number;
  startDay: number;
  endDay: number;
  daysToEnd: number;
  progressPct: number;
}
export interface StakeBubble {
  address: string;
  totalHex: number;
  tShares: number;
  stakeCount: number;
  label: string | null;
  isContract: boolean;
  category: string | null;
  stakes: StakeInfo[];
}

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;
  const reqLimit = Number(req.nextUrl.searchParams.get('limit') ?? 250);
  const limit = LIMITS.has(reqLimit) ? reqLimit : 250;
  const currentDay = currentHexDay();

  try {
    // The 1,000 biggest stakes, minus any already ended → active set.
    const all = await gql<{ stakeStarts: RawStart[] }>(
      net,
      `{ stakeStarts(orderBy: stakedHearts, orderDirection: desc, first: 1000){ ${FIELDS} } }`,
    ).then((d) => d.stakeStarts ?? []);
    const ended = await endedIds(net, all);
    const active = all
      .filter((s) => !ended.has(String(s.stakeId)))
      .sort((a, b) => Number(b.stakedHearts) - Number(a.stakedHearts))
      .slice(0, limit);

    // Bundle every stake under the same address into one bubble.
    const byAddr = new Map<string, StakeBubble>();
    for (const s of active) {
      const addr = s.stakerAddr.toLowerCase();
      const known = getKnownAddress(addr);
      const b = byAddr.get(addr) ?? {
        address: addr,
        totalHex: 0,
        tShares: 0,
        stakeCount: 0,
        label: known?.label ?? null,
        isContract: false,
        category: known?.category ?? null,
        stakes: [],
      };
      const startDay = Number(s.startDay);
      const endDay = Number(s.endDay);
      const stakedDays = Number(s.stakedDays);
      b.totalHex += h2h(s.stakedHearts);
      b.tShares += s2t(s.stakeShares);
      b.stakeCount += 1;
      b.stakes.push({
        stakeId: s.stakeId,
        principalHex: h2h(s.stakedHearts),
        tShares: s2t(s.stakeShares),
        startDay,
        endDay,
        daysToEnd: Math.max(0, endDay - currentDay),
        progressPct: stakedDays > 0 ? Math.max(0, Math.min(100, ((currentDay - startDay) / stakedDays) * 100)) : 0,
      });
      byAddr.set(addr, b);
    }
    const bubbles = [...byAddr.values()].sort((a, b) => b.totalHex - a.totalHex);
    bubbles.forEach((b) => b.stakes.sort((a, c) => c.principalHex - a.principalHex));

    // Clusters: staker wallets that are likely the same person — linked either by
    // direct HEX transfers between them or by a shared HEX funding source (same
    // signal as the holder bubble map). Bounded to the top CLUSTER_LIMIT stakers.
    const maxHex = Math.max(1, ...bubbles.map((b) => b.totalHex));
    const clusterNodes: HolderNode[] = bubbles.slice(0, CLUSTER_LIMIT).map((b) => ({
      address: b.address,
      balanceRaw: String(Math.round(b.totalHex)),
      pctSupply: (b.totalHex / maxHex) * 100,
      isContract: b.isContract,
      label: b.label,
      category: (b.category as HolderNode['category']) ?? null,
    }));

    let edges: { from: string; to: string; count: number }[] = [];
    let clusters: string[][] = [];
    try {
      // Bigger budget + concurrency than the default: this route caches for 10
      // min, so a slower-but-complete scan is worth it to actually find clusters.
      const g = await buildHolderGraph(net as ChainId, HEX_ADDRESS, clusterNodes, {
        budgetMs: 45_000,
        concurrency: 16,
      });
      edges = g.edges ?? [];
      clusters = g.clusters ?? [];
    } catch {
      /* clustering is best-effort — bubbles still render without it */
    }

    return NextResponse.json(
      { network: net, limit, currentDay, bubbles, edges, clusters, clusterLimit: CLUSTER_LIMIT },
      { headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=1800' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build stake bubbles' },
      { status: 500 },
    );
  }
}
