// Daily pHEX/USD history, for showing what a stake has been worth over its life.
//
// One shared series serves every rescue page. That matters more than it looks:
// GeckoTerminal's free tier rate-limits hard — measured, a burst of paged
// requests starts returning 401 after the third one even with seconds between
// them — so a per-stake fetch would 401 the moment two people opened two
// rescues. Instead this is a single cached series, sliced per stake by the
// caller, refreshed hourly. Yesterday's candle never changes, so an hour-old
// history is exactly as correct as a fresh one.
//
// Depth: the free tier gives roughly a year and no more. Measured — a request
// for candles older than ~12 months returns 401 even on its own, cold, with no
// burst around it, so this is a plan cap rather than rate limiting. The loop
// therefore walks until a page comes back empty and takes what it gets, which
// in practice is ~365 daily closes.
//
// That means a stake older than the window has no honest "value at start", and
// it is reported as exactly that rather than clamped to the oldest price we
// happen to hold — which would put a number on screen that was never real.

const GT_BASE = 'https://api.geckoterminal.com/api/v2';

/** A real browser UA makes GeckoTerminal's free tier noticeably more reliable
 *  — the same trick the portfolio's OHLCV proxy already uses. */
const GT_HEADERS = {
  Accept: 'application/json;version=20230302',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

export const HEX_TOKEN = '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39';

/**
 * The deepest pHEX pool, resolved once and pinned.
 *
 * Verified live: HEX/WPLS at ~$1.05M reserve, the deepest of the token's
 * pools. Pinned rather than resolved per request because resolving costs an
 * extra rate-limited call for an answer that changes very rarely — and the
 * lookup below falls back to re-resolving if this pool ever stops answering.
 */
const PINNED_POOL = '0x19bb45a7270177e303dee6eaa6f5ad700812ba98';

/** Pages to attempt. ~181 daily candles a page; the free tier runs out around
 *  the second, and a failed page ends the walk cleanly. */
const MAX_PAGES = 4;
/** Cache for an hour: closed daily candles do not change. */
const REVALIDATE_S = 3600;

export interface PricePoint {
  /** Unix ms, midnight UTC of the candle's day. */
  t: number;
  /** Close, in USD. */
  usd: number;
}

async function gt(path: string): Promise<any | null> {
  try {
    const r = await fetch(`${GT_BASE}${path}`, {
      headers: GT_HEADERS,
      next: { revalidate: REVALIDATE_S },
      signal: AbortSignal.timeout(9_000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function resolvePool(): Promise<string | null> {
  const j = await gt(`/networks/pulsechain/tokens/${HEX_TOKEN}/pools?page=1`);
  const best = (j?.data ?? [])
    .slice()
    .sort((a: any, b: any) =>
      Number(b?.attributes?.reserve_in_usd ?? 0) - Number(a?.attributes?.reserve_in_usd ?? 0))[0];
  const id = String(best?.id ?? '');
  // Ids come back namespaced, e.g. "pulsechain_0xabc…".
  const addr = id.includes('_') ? id.split('_')[1] : id;
  return /^0x[a-f0-9]{40}$/i.test(addr) ? addr : null;
}

/**
 * Daily pHEX closes, oldest first.
 *
 * Returns an empty array rather than throwing when GeckoTerminal is
 * unreachable or rate-limiting: this drives a decorative panel, and the page
 * must render its real figures with or without a price history.
 */
export async function hexPriceHistory(): Promise<PricePoint[]> {
  let pool: string | null = PINNED_POOL;
  const out = new Map<number, number>();
  let before: number | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const q =
      `/networks/pulsechain/pools/${pool}/ohlcv/day?aggregate=1&limit=1000&token=${HEX_TOKEN}` +
      (before ? `&before_timestamp=${before}` : '');
    const j: any = await gt(q);
    const rows: number[][] = j?.data?.attributes?.ohlcv_list ?? [];

    if (rows.length === 0) {
      // First page empty means the pinned pool has stopped answering — resolve
      // the deepest pool once and retry. Any later empty page is simply the
      // start of the pool's history.
      if (page === 0 && pool === PINNED_POOL) {
        const fresh = await resolvePool();
        if (fresh && fresh !== pool) {
          pool = fresh;
          page--;
          continue;
        }
      }
      break;
    }

    let oldest = Infinity;
    for (const [ts, , , , close] of rows) {
      if (!Number.isFinite(ts) || !Number.isFinite(close) || close <= 0) continue;
      out.set(ts, close);
      if (ts < oldest) oldest = ts;
    }
    if (!Number.isFinite(oldest) || oldest === before) break;
    before = oldest;
  }

  return [...out.entries()]
    .map(([t, usd]) => ({ t: t * 1000, usd }))
    .sort((a, b) => a.t - b.t);
}

export interface ValueWindow {
  /** Series covering the stake's life, oldest first. */
  series: PricePoint[];
  /** Price the day the stake started — null when it predates our history. */
  atStart: PricePoint | null;
  high: PricePoint;
  low: PricePoint;
  now: PricePoint;
  /** True when the stake began before the oldest price we hold. */
  clipped: boolean;
}

/**
 * The price window for one stake: its start, its extremes since, and now.
 *
 * `atStart` is deliberately null rather than "the oldest price we have" when
 * the stake predates the series — pHEX did not exist before PulseChain, and a
 * stake opened on Ethereum in 2019 has no honest pHEX price for its start day.
 * The caller says so instead of drawing a number that was never real.
 */
export function windowFor(series: PricePoint[], startedAt: number | null): ValueWindow | null {
  if (series.length === 0) return null;
  const first = series[0];
  const clipped = startedAt != null && startedAt < first.t;

  // The candle for the stake's start day: the last one at or before it.
  let atStart: PricePoint | null = null;
  if (startedAt != null && !clipped) {
    for (const p of series) {
      if (p.t <= startedAt) atStart = p;
      else break;
    }
  }

  const from = atStart ? atStart.t : first.t;
  const span = series.filter((p) => p.t >= from);
  if (span.length === 0) return null;

  let high = span[0];
  let low = span[0];
  for (const p of span) {
    if (p.usd > high.usd) high = p;
    if (p.usd < low.usd) low = p;
  }

  return { series: span, atStart, high, low, now: span[span.length - 1], clipped };
}
