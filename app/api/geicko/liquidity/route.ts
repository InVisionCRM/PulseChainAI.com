import { NextRequest, NextResponse } from 'next/server';
import { PULSEX_SUBGRAPHS, gql, getTokenPairIds, pageEvents, cleanUsd, num, type LiqEvent } from '@/lib/geicko/pulsex';

// Liquidity add/remove activity for a token, from the PulseX subgraph. Each add
// is a `mint` and each remove is a `burn`, both carrying an `amountUSD`. A token
// trades across many pairs, so we gather its pairs, drop glitch ones, and
// aggregate mints/burns across the rest into a daily net-flow series plus a
// recent-events feed.
//
// Both mints and burns are paged back to the SAME cutoff (a fixed recent window)
// so adds and removes cover the same span — otherwise a per-side row cap makes
// the net-flow meaningless (e.g. a year of adds vs two weeks of removes).
// PulseChain only, free.

export const revalidate = 0;
export const maxDuration = 60;

const DAY = 86_400;
const DEFAULT_DAYS = 90;
const FEED_SIZE = 40;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  const days = Math.min(365, Math.max(7, num(sp.get('days')) || DEFAULT_DAYS));

  if (chain !== 'pulsechain') return NextResponse.json({ chain, supported: false });
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const nowTs = Math.floor(Date.now() / 1000);
  const cutoff = nowTs - days * DAY;

  try {
    // Query every PulseX subgraph (v1 + v2) and merge — a token's liquidity is
    // split across both versions.
    const perGraph = await Promise.all(
      PULSEX_SUBGRAPHS.map(async (url) => {
        const pairIds = await getTokenPairIds(url, token);
        if (!pairIds || !pairIds.length) return { pairCount: 0, mints: [] as LiqEvent[], burns: [] as LiqEvent[] };
        const [mints, burns] = await Promise.all([
          pageEvents(url, 'mints', pairIds, cutoff),
          pageEvents(url, 'burns', pairIds, cutoff),
        ]);
        return { pairCount: pairIds.length, mints, burns };
      }),
    );

    {
      const mints = perGraph.flatMap((g) => g.mints);
      const burns = perGraph.flatMap((g) => g.burns);
      const pairCount = perGraph.reduce((s, g) => s + g.pairCount, 0);
      if (!pairCount) return NextResponse.json({ chain, supported: true, empty: true, days });

      // Daily aggregation (net = adds - removes) + running totals.
      const byDay = new Map<number, { added: number; removed: number }>();
      let added = 0, removed = 0, addCount = 0, removeCount = 0;
      const bump = (ts: number, usd: number, side: 'added' | 'removed') => {
        const d = Math.floor(ts / DAY) * DAY;
        const cur = byDay.get(d) ?? { added: 0, removed: 0 };
        cur[side] += usd;
        byDay.set(d, cur);
      };
      for (const m of mints) {
        const usd = cleanUsd(m.amountUSD);
        if (usd > 0) { added += usd; addCount++; bump(num(m.timestamp), usd, 'added'); }
      }
      for (const b of burns) {
        const usd = cleanUsd(b.amountUSD);
        if (usd > 0) { removed += usd; removeCount++; bump(num(b.timestamp), usd, 'removed'); }
      }

      const daily = [...byDay.entries()]
        .map(([t, v]) => ({ t, added: v.added, removed: v.removed, net: v.added - v.removed }))
        .sort((a, b) => a.t - b.t);

      if (!daily.length) return NextResponse.json({ chain, supported: true, empty: true, days });

      const label = (e: LiqEvent) => `${e.pair?.token0?.symbol ?? '?'}/${e.pair?.token1?.symbol ?? '?'}`;
      const toEvt = (e: LiqEvent, type: 'add' | 'remove') => ({
        type, ts: num(e.timestamp), usd: cleanUsd(e.amountUSD),
        pair: label(e), wallet: e.to, tx: e.transaction?.id ?? '',
      });
      const events = [
        ...mints.map((m) => toEvt(m, 'add')),
        ...burns.map((b) => toEvt(b, 'remove')),
      ]
        .filter((e) => e.usd > 0)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, FEED_SIZE);

      return NextResponse.json(
        {
          chain,
          supported: true,
          days,
          pairCount,
          totals: { added, removed, net: added - removed, addCount, removeCount },
          daily,
          events,
        },
        { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800' } },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load liquidity' },
      { status: 500 },
    );
  }
}
