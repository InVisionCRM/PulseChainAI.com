import { NextRequest, NextResponse } from 'next/server';
import { PULSEX_SUBGRAPHS, gql, cleanUsd, num } from '@/lib/geicko/pulsex';
import { cached } from '@/lib/geicko/serverCache';

// All-time volume history for a token, from the PulseX subgraph (PulseChain
// only — the subgraph doesn't index other chains). Merges v1 + v2 by day and
// returns a daily series since launch plus per-pair volume, so the Volume tab
// can render the headline number, cumulative curve, heatmap, bars and tiles.

export const revalidate = 0;
export const maxDuration = 30;

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;

interface Day {
  date: number; // unix seconds (UTC midnight)
  volumeUsd: number;
  txns: number;
  liquidityUsd: number;
  priceUsd: number;
}

interface PairVol {
  label: string;
  volumeUsd: number;
}

async function dayDatas(url: string, token: string): Promise<any[]> {
  // The subgraph returns at most 1000 rows per query. A token trading for more
  // than ~2.7 years has >1000 daily entries, so a single `first:1000, asc` call
  // returns only the OLDEST 1000 days and silently drops the most recent ones —
  // making an active token's last months look empty. Paginate by a date cursor
  // so we get the complete history (launch → today). The 20-page cap is a safety
  // backstop (~55 years of days), never reached in practice.
  const out: any[] = [];
  let lastDate = 0;
  for (let page = 0; page < 20; page++) {
    const d = await gql(
      url,
      `{ tokenDayDatas(first:1000, orderBy:date, orderDirection:asc, where:{ token:"${token}", date_gt:${lastDate} }){ date dailyVolumeUSD dailyTxns totalLiquidityUSD priceUSD } }`,
    );
    const rows = Array.isArray(d?.tokenDayDatas) ? d.tokenDayDatas : [];
    out.push(...rows);
    if (rows.length < 1000) break;
    lastDate = Number(rows[rows.length - 1].date);
    if (!Number.isFinite(lastDate) || lastDate <= 0) break;
  }
  return out;
}

async function pairVols(url: string, token: string): Promise<any[]> {
  const d = await gql(
    url,
    `{ a: pairs(first:200, where:{ token0:"${token}" }){ token0{ symbol } token1{ symbol } untrackedVolumeUSD } b: pairs(first:200, where:{ token1:"${token}" }){ token0{ symbol } token1{ symbol } untrackedVolumeUSD } }`,
  );
  return [...(d?.a ?? []), ...(d?.b ?? [])];
}

async function build(token: string) {
  const dayRes = await Promise.all(PULSEX_SUBGRAPHS.map((u) => dayDatas(u, token)));
  const pairRes = await Promise.all(PULSEX_SUBGRAPHS.map((u) => pairVols(u, token)));

  // Merge day data across v1+v2 by UTC date.
  const byDate = new Map<number, Day>();
  for (const rows of dayRes) {
    for (const r of rows) {
      const date = Number(r.date);
      if (!Number.isFinite(date)) continue;
      const vol = cleanUsd(r.dailyVolumeUSD);
      const liq = cleanUsd(r.totalLiquidityUSD);
      const price = num(r.priceUSD);
      const prev = byDate.get(date);
      if (prev) {
        prev.volumeUsd += vol;
        prev.txns += Number(r.dailyTxns) || 0;
        prev.liquidityUsd += liq;
        if (price > 0) prev.priceUsd = price; // last non-zero
      } else {
        byDate.set(date, { date, volumeUsd: vol, txns: Number(r.dailyTxns) || 0, liquidityUsd: liq, priceUsd: price });
      }
    }
  }
  const daily = [...byDate.values()].sort((a, b) => a.date - b.date);

  // Per-pair volume, keyed by the *other* token's symbol, merged v1+v2.
  const t = token.toLowerCase();
  const pairMap = new Map<string, number>();
  for (const rows of pairRes) {
    for (const p of rows) {
      const s0 = p.token0?.symbol ?? '?';
      const s1 = p.token1?.symbol ?? '?';
      const label = `${s0} / ${s1}`;
      pairMap.set(label, (pairMap.get(label) ?? 0) + cleanUsd(p.untrackedVolumeUSD));
    }
  }
  const byPair: PairVol[] = [...pairMap.entries()]
    .map(([label, volumeUsd]) => ({ label, volumeUsd }))
    .filter((p) => p.volumeUsd > 0)
    .sort((a, b) => b.volumeUsd - a.volumeUsd)
    .slice(0, 8);

  const totalVol = daily.reduce((s, d) => s + d.volumeUsd, 0);
  const totalTxns = daily.reduce((s, d) => s + d.txns, 0);
  const currentLiquidity = daily.length ? daily[daily.length - 1].liquidityUsd : 0;
  const best = daily.reduce<Day | null>((m, d) => (!m || d.volumeUsd > m.volumeUsd ? d : m), null);

  return {
    supported: true,
    daily,
    byPair,
    allTime: {
      volumeUsd: totalVol,
      txns: totalTxns,
      days: daily.length,
      firstDate: daily.length ? daily[0].date : null,
      currentLiquidity,
      bestDay: best ? { date: best.date, volumeUsd: best.volumeUsd } : null,
    },
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const network = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  if (network !== 'pulsechain') {
    return NextResponse.json({ supported: false, chain: network });
  }
  if (!ADDR_RX.test(token)) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  try {
    const payload = await cached(
      `volume:${token}`,
      300_000, // 5 min
      () => build(token),
      (v) => v.daily.length > 0,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=1800' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load volume' },
      { status: 500 },
    );
  }
}
