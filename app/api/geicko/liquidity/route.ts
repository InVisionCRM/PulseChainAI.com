import { NextRequest, NextResponse } from 'next/server';

// Liquidity add/remove activity for a token, from the PulseX subgraph (a
// Uniswap-v2 fork). Each liquidity add is a `mint` and each remove is a `burn`,
// both carrying an `amountUSD`. A token trades across many pairs (WPLS, DAI,
// stables, plus junk/scam pairs), so we gather its pairs, drop the glitch ones,
// and aggregate mints/burns across the rest into a daily net-flow series plus a
// recent-events feed. PulseChain only — this is PulseX-specific and free.

export const revalidate = 0;
export const maxDuration = 60;

const DAY = 86_400;

const PULSEX_SUBGRAPHS = [
  'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex',
  'https://graph.pulsechain.com/subgraphs/name/Codeakk/PulseX',
];

// Subgraph-derived reserves/USD amounts can be wildly off on illiquid or
// mispriced pairs. Drop pairs claiming an impossible reserve, and clamp any
// single event's USD to a sane band so one glitch day can't dominate a total.
const MAX_PAIR_RESERVE = 1e10;
const MAX_EVENT_USD = 1e9;
const PAIR_LIMIT = 40; // pairs to aggregate across (ranked by reserve)
const EVENT_PAGE = 1000; // most-recent mints/burns per side
const FEED_SIZE = 40; // recent events returned to the client

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};
const cleanUsd = (v: unknown) => {
  const n = num(v);
  return n > 0 && n < MAX_EVENT_USD ? n : 0;
};

interface RawEvent {
  timestamp: string;
  amountUSD: string;
  to: string;
  transaction: { id: string };
  pair: { token0: { symbol: string }; token1: { symbol: string } };
}

async function gql(url: string, query: string): Promise<any | null> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.errors?.length ? null : j.data;
  } catch {
    return null;
  }
}

/** All pairs a token belongs to (either side), ranked by reserve, glitches dropped. */
function pickPairs(rows: { id: string; reserveUSD: string }[]): string[] {
  return rows
    .map((p) => ({ id: p.id, r: num(p.reserveUSD) }))
    .filter((p) => p.r <= MAX_PAIR_RESERVE)
    .sort((a, b) => b.r - a.r)
    .slice(0, PAIR_LIMIT)
    .map((p) => p.id);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();

  if (chain !== 'pulsechain') return NextResponse.json({ chain, supported: false });
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  try {
    for (const url of PULSEX_SUBGRAPHS) {
      // 1) Find the token's pairs (it can be token0 or token1 of each).
      const pd = await gql(
        url,
        `{ a: pairs(first:${PAIR_LIMIT}, orderBy:reserveUSD, orderDirection:desc, where:{token0:"${token}"}){ id reserveUSD }
           b: pairs(first:${PAIR_LIMIT}, orderBy:reserveUSD, orderDirection:desc, where:{token1:"${token}"}){ id reserveUSD } }`,
      );
      if (!pd) continue; // try next subgraph
      const pairIds = pickPairs([...(pd.a ?? []), ...(pd.b ?? [])]);
      if (!pairIds.length) return NextResponse.json({ chain, supported: true, empty: true });

      const inList = pairIds.map((id) => `"${id}"`).join(',');
      const evFields = `{ timestamp amountUSD to transaction{ id } pair{ token0{ symbol } token1{ symbol } } }`;

      // 2) Most-recent adds (mints) and removes (burns) across those pairs.
      const ed = await gql(
        url,
        `{ mints(first:${EVENT_PAGE}, orderBy:timestamp, orderDirection:desc, where:{pair_in:[${inList}]}) ${evFields}
           burns(first:${EVENT_PAGE}, orderBy:timestamp, orderDirection:desc, where:{pair_in:[${inList}]}) ${evFields} }`,
      );
      if (!ed) continue;

      const mints = (ed.mints ?? []) as RawEvent[];
      const burns = (ed.burns ?? []) as RawEvent[];

      // 3) Daily aggregation (net = adds - removes) + running totals.
      const byDay = new Map<number, { added: number; removed: number }>();
      let added = 0, removed = 0, addCount = 0, removeCount = 0;
      let minTs = Infinity, maxTs = 0;
      const bump = (ts: number, usd: number, side: 'added' | 'removed') => {
        const d = Math.floor(ts / DAY) * DAY;
        const cur = byDay.get(d) ?? { added: 0, removed: 0 };
        cur[side] += usd;
        byDay.set(d, cur);
        if (ts < minTs) minTs = ts;
        if (ts > maxTs) maxTs = ts;
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

      // 4) Recent events feed (adds + removes merged, newest first).
      const label = (e: RawEvent) => `${e.pair?.token0?.symbol ?? '?'}/${e.pair?.token1?.symbol ?? '?'}`;
      const toEvt = (e: RawEvent, type: 'add' | 'remove') => ({
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

      if (!daily.length) return NextResponse.json({ chain, supported: true, empty: true });

      return NextResponse.json(
        {
          chain,
          supported: true,
          pairCount: pairIds.length,
          window: { fromTs: minTs === Infinity ? 0 : minTs, toTs: maxTs, days: Math.round((maxTs - minTs) / DAY) },
          totals: { added, removed, net: added - removed, addCount, removeCount },
          daily,
          events,
        },
        { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800' } },
      );
    }
    return NextResponse.json({ error: 'subgraph unavailable' }, { status: 502 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load liquidity' },
      { status: 500 },
    );
  }
}
