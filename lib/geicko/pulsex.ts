// Shared PulseX-subgraph helpers for the Geicko liquidity features.
// The PulseX subgraph is a Uniswap-v2 fork: liquidity adds are `mint` entities
// and removes are `burn` entities, each carrying an `amountUSD`.

// PulseX v1 and v2 are indexed by SEPARATE subgraphs, and a given pair lives in
// exactly one of them. GeckoTerminal (which the Liquidity tab lists pairs from)
// surfaces pools from both versions, so we must query BOTH and merge — using
// only one silently drops half the liquidity (the top pools are usually v2).
export const PULSEX_SUBGRAPHS = [
  'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex',    // v1
  'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsexv2',  // v2
];

// Subgraph-derived reserves/USD can be wildly off on illiquid or mispriced
// pairs. Drop pairs claiming an impossible reserve; clamp any single event's USD.
export const MAX_PAIR_RESERVE = 1e10;
export const MAX_EVENT_USD = 1e9;

export const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};
export const cleanUsd = (v: unknown) => {
  const n = num(v);
  return n > 0 && n < MAX_EVENT_USD ? n : 0;
};

export async function gql(url: string, query: string): Promise<any | null> {
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

/** The pairs a token belongs to (either side), ranked by reserve, glitches dropped. */
export async function getTokenPairIds(url: string, token: string, limit = 40): Promise<string[] | null> {
  const d = await gql(
    url,
    `{ a: pairs(first:${limit}, orderBy:reserveUSD, orderDirection:desc, where:{token0:"${token}"}){ id reserveUSD }
       b: pairs(first:${limit}, orderBy:reserveUSD, orderDirection:desc, where:{token1:"${token}"}){ id reserveUSD } }`,
  );
  if (!d) return null;
  return [...(d.a ?? []), ...(d.b ?? [])]
    .map((p: any) => ({ id: p.id as string, r: num(p.reserveUSD) }))
    .filter((p) => p.r <= MAX_PAIR_RESERVE)
    .sort((a, b) => b.r - a.r)
    .slice(0, limit)
    .map((p) => p.id);
}

export interface LiqEvent {
  timestamp: string;
  amountUSD: string;
  to: string;
  transaction: { id: string };
  pair: { token0: { symbol: string }; token1: { symbol: string } };
}

export const EVENT_FIELDS = `{ timestamp amountUSD to transaction{ id } pair{ token0{ symbol } token1{ symbol } } }`;

/**
 * Page `mints` or `burns` for a set of pairs newest-first, collecting everything
 * back to `cutoff`. Paging both sides to the same cutoff is what keeps the
 * net-flow honest — otherwise a fixed row cap makes adds and removes cover
 * different time spans. Stops at `maxPages` (returns the most-recent slice).
 */
export async function pageEvents(
  url: string,
  kind: 'mints' | 'burns',
  pairIds: string[],
  cutoff: number,
  maxPages = 12,
): Promise<LiqEvent[]> {
  const inList = pairIds.map((id) => `"${id}"`).join(',');
  const out: LiqEvent[] = [];
  let before = 9_999_999_999;
  for (let p = 0; p < maxPages; p++) {
    const d = await gql(
      url,
      `{ ${kind}(first:1000, orderBy:timestamp, orderDirection:desc, where:{pair_in:[${inList}], timestamp_lt:${before}}) ${EVENT_FIELDS} }`,
    );
    const rows = (d?.[kind] ?? []) as LiqEvent[];
    for (const r of rows) if (num(r.timestamp) >= cutoff) out.push(r);
    if (rows.length < 1000) break;
    const last = num(rows[rows.length - 1].timestamp);
    if (last < cutoff) break;
    before = last;
  }
  return out;
}

export interface SwapRow {
  timestamp: string;
  amountUSD: string;
  amount0In: string;
  amount1In: string;
  amount0Out: string;
  amount1Out: string;
  pair: { token0: { id: string }; token1: { id: string } };
}

const SWAP_FIELDS = `{ timestamp amountUSD amount0In amount1In amount0Out amount1Out pair{ token0{ id } token1{ id } } }`;

/** Page `swaps` for a set of pairs newest-first back to `cutoff`. */
export async function pageSwaps(
  url: string,
  pairIds: string[],
  cutoff: number,
  maxPages = 8,
): Promise<SwapRow[]> {
  const inList = pairIds.map((id) => `"${id}"`).join(',');
  const out: SwapRow[] = [];
  let before = 9_999_999_999;
  for (let p = 0; p < maxPages; p++) {
    const d = await gql(
      url,
      `{ swaps(first:1000, orderBy:timestamp, orderDirection:desc, where:{pair_in:[${inList}], timestamp_lt:${before}}) ${SWAP_FIELDS} }`,
    );
    const rows = (d?.swaps ?? []) as SwapRow[];
    for (const r of rows) if (num(r.timestamp) >= cutoff) out.push(r);
    if (rows.length < 1000) break;
    const last = num(rows[rows.length - 1].timestamp);
    if (last < cutoff) break;
    before = last;
  }
  return out;
}
