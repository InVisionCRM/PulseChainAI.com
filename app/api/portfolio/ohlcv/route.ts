import { NextRequest, NextResponse } from 'next/server';

// Native OHLCV candles for the portfolio chart, proxied from GeckoTerminal's
// free API (no key, ~30 calls/min). Two steps: resolve the token's deepest
// pool, then pull that pool's candles priced for OUR token.
//
// Inversion gotcha: GeckoTerminal defaults to the pool's BASE token, so a
// "USDC / WPLS" pool would otherwise return ~$1 (USDC) instead of the WPLS
// price. Passing token={address} prices the candles in our token regardless
// of which side it sits on.
//
// On any miss we return { candles: [] } so the client can swap in the
// DexScreener embed fallback.

type ChainId = 'ethereum' | 'pulsechain';

// GeckoTerminal network slugs differ from our ChainId.
const GT_NETWORK: Record<ChainId, string> = {
  ethereum: 'eth',
  pulsechain: 'pulsechain',
};

const GT_BASE = 'https://api.geckoterminal.com/api/v2';
// A real browser User-Agent makes GeckoTerminal's free tier noticeably more
// reliable (same trick as the prices proxy) — fewer edge rejections, which is
// what made the chart flap to the DexScreener embed on transient blips.
const GT_HEADERS = {
  Accept: 'application/json;version=20230302',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};
const FETCH_TIMEOUT_MS = 9_000;
const ADDRESS_RX = /^0x[a-f0-9]{40}$/i;

// Native gas tokens (PLS/ETH) carry a zero-address sentinel and have no pool
// of their own — chart the wrapped equivalent (WPLS/WETH), which is 1:1.
const WRAPPED_NATIVE: Record<ChainId, string> = {
  ethereum: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  pulsechain: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
};
const NATIVE_SENTINELS = new Set([
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

// Our timeframe id → GeckoTerminal {resolution, aggregate}. GeckoTerminal
// only exposes minute/hour/day, each with a fixed set of valid aggregates
// (minute: 1/5/15, hour: 1/4/12, day: 1).
const TF_MAP: Record<string, { res: 'minute' | 'hour' | 'day'; agg: number }> = {
  '5m': { res: 'minute', agg: 5 },
  '15m': { res: 'minute', agg: 15 },
  '1h': { res: 'hour', agg: 1 },
  '4h': { res: 'hour', agg: 4 },
  '1d': { res: 'day', agg: 1 },
};

interface Candle { time: number; open: number; high: number; low: number; close: number; }
interface VolumePoint { time: number; value: number; }

// Retries transient failures (429 / 5xx / network / timeout) with a short
// backoff, so a single rate-limit blip doesn't surface as "no candles" — which
// the chart used to treat as "this token has no native data, swap to the
// DexScreener embed."
async function gtFetch(
  url: string,
  revalidate: number,
  retries = 2,
): Promise<any | null> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        headers: GT_HEADERS,
        signal: controller.signal,
        next: { revalidate },
      });
      if (r.ok) return await r.json();
      const retryable = r.status === 429 || r.status >= 500;
      if (!retryable || attempt >= retries) return null;
    } catch {
      if (attempt >= retries) return null;
    } finally {
      clearTimeout(t);
    }
    await new Promise((res) => setTimeout(res, 300 * (attempt + 1)));
  }
}

// Deepest pool for a token (GeckoTerminal sorts by liquidity desc). Returns
// the pool contract address, or null if the token isn't indexed.
async function resolvePool(network: string, address: string): Promise<string | null> {
  const d = await gtFetch(
    `${GT_BASE}/networks/${network}/tokens/${address}/pools?page=1`,
    300, // pools rarely change — cache 5 min
  );
  const pool = d?.data?.[0]?.attributes?.address;
  return typeof pool === 'string' && ADDRESS_RX.test(pool) ? pool : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get('chain') as ChainId | null;
  const address = (searchParams.get('address') || '').toLowerCase();
  const timeframe = searchParams.get('timeframe') || '15m';
  const poolParam = (searchParams.get('pool') || '').toLowerCase();
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 240, 10), 1000);

  if (!chain || !GT_NETWORK[chain]) {
    return NextResponse.json({ candles: [], error: 'bad-chain' }, { status: 400 });
  }
  if (!ADDRESS_RX.test(address)) {
    return NextResponse.json({ candles: [], error: 'bad-address' }, { status: 400 });
  }
  const tf = TF_MAP[timeframe];
  if (!tf) {
    return NextResponse.json({ candles: [], error: 'bad-timeframe' }, { status: 400 });
  }

  const network = GT_NETWORK[chain];
  // Native sentinel → wrapped token for both pool lookup and pricing.
  const chartAddress = NATIVE_SENTINELS.has(address) ? WRAPPED_NATIVE[chain] : address;
  // A caller-supplied pool (e.g. the DexScreener pair) skips the resolution
  // call; otherwise we look up the token's deepest pool.
  const pool = ADDRESS_RX.test(poolParam) ? poolParam : await resolvePool(network, chartAddress);
  if (!pool) {
    return NextResponse.json(
      { candles: [], volume: [], pool: null, error: 'no-pool' },
      { headers: { 'Cache-Control': 'public, max-age=120' } },
    );
  }

  // token={address} → candles priced in our token (the inversion fix).
  const ohlcvUrl =
    `${GT_BASE}/networks/${network}/pools/${pool}/ohlcv/${tf.res}` +
    `?aggregate=${tf.agg}&limit=${limit}&currency=usd&token=${chartAddress}`;
  const d = await gtFetch(ohlcvUrl, 30);
  const list: unknown = d?.data?.attributes?.ohlcv_list;

  if (!Array.isArray(list) || list.length === 0) {
    return NextResponse.json(
      { candles: [], volume: [], pool, error: 'no-data' },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  }

  // Rows are [ts(sec), open, high, low, close, volume], newest first.
  // lightweight-charts needs strictly-ascending, unique times.
  const candles: Candle[] = [];
  const volume: VolumePoint[] = [];
  let prevTime = -1;
  for (let i = list.length - 1; i >= 0; i--) {
    const row = list[i] as unknown[];
    const time = Number(row?.[0]);
    if (!Number.isFinite(time) || time <= prevTime) continue;
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    if (![open, high, low, close].every(Number.isFinite)) continue;
    prevTime = time;
    const vol = Number(row[5]);
    candles.push({ time, open, high, low, close });
    volume.push({ time, value: Number.isFinite(vol) ? vol : 0 });
  }

  return NextResponse.json(
    { candles, volume, pool, timeframe },
    {
      // Short edge cache keeps us comfortably under GeckoTerminal's rate limit
      // even with many concurrent viewers.
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    },
  );
}
