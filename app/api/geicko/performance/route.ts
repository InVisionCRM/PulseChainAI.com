import { NextRequest, NextResponse } from 'next/server';

// Long-horizon price performance for a token. DexScreener only exposes 5m–24h
// changes, so for 7d/30d/1y, all-time high/low, and "since launch" we build a
// daily price series and compute everything server-side (then cache).
//
// PulseChain tokens (the common case) use the PulseX subgraph's `tokenDayDatas`,
// which carry daily USD prices back to each token's first trading day — real
// launch-to-now history. Other chains fall back to GeckoTerminal's free OHLCV,
// which only serves ~6 months, so those metrics are labelled as data-limited.

export const revalidate = 0;
export const maxDuration = 60;

const DAY = 86_400;
// WPLS (wrapped PLS) on PulseChain — the denominator for the "vs WPLS" view.
const WPLS = '0xa1077a294dde1b09bb078844df40758a5d0f9a27';

const PULSEX_SUBGRAPHS = [
  'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex',
  'https://graph.pulsechain.com/subgraphs/name/Codeakk/PulseX',
];
const GT = 'https://api.geckoterminal.com/api/v2';
const GT_NET: Record<string, string> = {
  ethereum: 'eth', bsc: 'bsc', base: 'base', arbitrum: 'arbitrum',
  polygon: 'polygon_pos', avalanche: 'avax', optimism: 'optimism', solana: 'solana',
};

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

interface Point { t: number; p: number } // unix day, priceUSD

async function jsonPost(url: string, body: unknown): Promise<any | null> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    const j = await r.json();
    return j.errors?.length ? null : j.data;
  } catch {
    return null;
  }
}

async function getJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Full daily USD price series for a PulseChain token, from the PulseX subgraph. */
async function pulsexDaily(token: string): Promise<Point[]> {
  const t = token.toLowerCase();
  for (const url of PULSEX_SUBGRAPHS) {
    const points: Point[] = [];
    let after = 0;
    let ok = false;
    for (let page = 0; page < 5; page++) {
      const data = await jsonPost(url, {
        query: `{ tokenDayDatas(first:1000, orderBy: date, orderDirection: asc, where:{ token:"${t}", date_gt:${after} }){ date priceUSD } }`,
      });
      const rows = data?.tokenDayDatas as { date: string; priceUSD: string }[] | undefined;
      if (!rows) break;
      ok = true;
      for (const r of rows) {
        const p = num(r.priceUSD);
        if (p > 0) points.push({ t: num(r.date), p });
      }
      if (rows.length < 1000) break;
      after = num(rows[rows.length - 1].date);
    }
    if (ok && points.length) return points.sort((a, b) => a.t - b.t);
  }
  return [];
}

/** ~6 months of daily closes for a non-PulseChain token, from GeckoTerminal. */
async function geckoDaily(net: string, token: string, pool: string): Promise<Point[]> {
  let p = pool;
  if (!p) {
    const j = await getJson(`${GT}/networks/${net}/tokens/${token}/pools?page=1`);
    const pools = (j?.data ?? []) as any[];
    if (pools.length) {
      let best = pools[0];
      for (const q of pools) if (num(q.attributes?.reserve_in_usd) > num(best.attributes?.reserve_in_usd)) best = q;
      p = String(best.id).split('_').pop() ?? '';
    }
  }
  if (!p) return [];
  const j = await getJson(`${GT}/networks/${net}/pools/${p}/ohlcv/day?aggregate=1&limit=1000&currency=usd`);
  const list = (j?.data?.attributes?.ohlcv_list ?? []) as number[][];
  return list.map((c) => ({ t: c[0], p: c[4] })).filter((x) => x.p > 0).sort((a, b) => a.t - b.t);
}

/** % change vs the price at/just before `nowTs - days`. Null if history too short. */
function changeOver(series: Point[], nowTs: number, days: number, current: number): number | null {
  const target = nowTs - days * DAY;
  if (series[0].t > target) return null;
  let ref: Point | null = null;
  for (const c of series) {
    if (c.t <= target) ref = c;
    else break;
  }
  return ref && ref.p > 0 ? (current / ref.p - 1) * 100 : null;
}

function sparkline(series: Point[], n = 72): number[] {
  const v = series.map((c) => c.p);
  if (v.length <= n) return v;
  const step = v.length / n;
  return Array.from({ length: n }, (_, i) => v[Math.min(v.length - 1, Math.floor(i * step))]);
}

/** Compute one performance "view" (USD or a ratio series) from a daily series. */
function computeView(raw: Point[], coverage: 'full' | 'partial', live: number) {
  // Subgraph/DEX derived prices can spike to near-zero (or huge) on illiquid
  // days — a $31-volume day priced 8 orders of magnitude off wrecks ATL/ATH.
  // Drop points more than 1000× from the median (keeps all real volatility).
  const prices = raw.map((s) => s.p).sort((a, b) => a - b);
  const med = prices[Math.floor(prices.length / 2)] || 0;
  const series = med > 0 ? raw.filter((s) => s.p >= med / 1000 && s.p <= med * 1000) : raw;
  if (series.length < 2) return null;

  const nowTs = Math.floor(Date.now() / 1000);
  const first = series[0];
  const current = live > 0 ? live : series[series.length - 1].p;

  let ath = first.p, athTs = first.t, atl = first.p, atlTs = first.t;
  for (const c of series) {
    if (c.p > ath) { ath = c.p; athTs = c.t; }
    if (c.p < atl) { atl = c.p; atlTs = c.t; }
  }
  if (current > ath) { ath = current; athTs = nowTs; }
  if (current < atl) { atl = current; atlTs = nowTs; }

  return {
    coverage,
    current,
    changes: {
      d7: changeOver(series, nowTs, 7, current),
      d30: changeOver(series, nowTs, 30, current),
      d365: changeOver(series, nowTs, 365, current),
    },
    ath: { price: ath, date: athTs, fromPct: ath > 0 ? (current / ath - 1) * 100 : null },
    atl: { price: atl, date: atlTs, fromPct: atl > 0 ? (current / atl - 1) * 100 : null },
    launch: { price: first.p, date: first.t, pct: first.p > 0 ? (current / first.p - 1) * 100 : null },
    spark: sparkline(series),
    dataDays: Math.round((series[series.length - 1].t - first.t) / DAY),
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  const pool = (sp.get('pool') || '').toLowerCase();
  const livePrice = num(sp.get('price'));

  if (!token && !pool) return NextResponse.json({ error: 'token or pool required' }, { status: 400 });

  try {
    const isPls = chain === 'pulsechain';
    // Preferred source for PulseChain is the PulseX subgraph (launch-to-now, "full"
    // coverage). But it only indexes tokens with a PulseX pair — tokens that trade
    // on 9mm/9inch/other DEXes, or very new tokens, aren't in it. In that case fall
    // back to GeckoTerminal, which aggregates every PulseChain DEX (~6mo, "partial").
    let usdSeries: Point[] = isPls && token ? await pulsexDaily(token) : [];
    let coverage: 'full' | 'partial' = usdSeries.length >= 2 ? 'full' : 'partial';
    if (usdSeries.length < 2) {
      // GT_NET has no 'pulsechain' entry, so `|| chain` resolves it to 'pulsechain'.
      usdSeries = await geckoDaily(GT_NET[chain] || chain, token, pool);
      coverage = 'partial';
    }

    const usd = computeView(usdSeries, coverage, livePrice);
    if (!usd) return NextResponse.json({ error: 'no price history' }, { status: 404 });

    // "vs WPLS": the token priced in WPLS (token USD ÷ WPLS USD), aligned by day.
    // Only meaningful on PulseChain, and not for WPLS itself.
    let wpls: ReturnType<typeof computeView> = null;
    if (isPls && token && token !== WPLS) {
      const wplsSeries = await pulsexDaily(WPLS);
      const wmap = new Map(wplsSeries.map((s) => [s.t, s.p]));
      const ratio = usdSeries
        .filter((s) => (wmap.get(s.t) ?? 0) > 0)
        .map((s) => ({ t: s.t, p: s.p / (wmap.get(s.t) as number) }));
      wpls = ratio.length >= 2 ? computeView(ratio, coverage, 0) : null;
    }

    return NextResponse.json(
      { chain, views: { usd, wpls } },
      { headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load performance' },
      { status: 500 },
    );
  }
}
