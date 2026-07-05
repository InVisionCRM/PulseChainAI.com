// Top token holders from Blockscout, normalised into bubble-map nodes.
//
// Verified against api.scan.pulsechain.com and eth.blockscout.com. The
// `/tokens/{token}/holders` endpoint returns 50 holders per page with a
// `next_page_params` cursor; each item carries the holder address, an
// is_contract flag, the raw balance, and the token's total_supply. We turn
// that into nodes whose size is each holder's % of supply, tagged with any
// known label/category (the LP pair, a locker, an exchange…) so the renderer
// can colour infra distinctly and the graph builder can keep it out of cluster
// maths. Results are cached for an hour — holder distributions move slowly and
// this is the cheap half of the bubble-map pipeline.

import { getKnownAddress, type AddressCategory } from '@/lib/gumshoe/address-labels';
import { fetchBlockscoutHolders } from '@/lib/blockscout';

export type ChainId = 'ethereum' | 'pulsechain';

const BLOCKSCOUT_BASE: Record<ChainId, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
};

export interface HolderNode {
  /** Lowercased holder address. */
  address: string;
  balanceRaw: string;
  /** Share of total supply, 0–100. Drives bubble size. */
  pctSupply: number;
  isContract: boolean;
  /** Known label (LP pair name, locker, exchange) or Blockscout's name, else null. */
  label: string | null;
  category: AddressCategory | null;
}

export interface HolderSet {
  chain: ChainId;
  token: string;
  totalSupplyRaw: string | null;
  decimals: number;
  symbol: string | null;
  /** Total distinct holders for the token (from Blockscout), not just top-N. */
  holdersCount: number | null;
  nodes: HolderNode[];
  fetchedAt: number;
}

const FETCH_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const cache = new Map<string, HolderSet>();

async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch the top `limit` holders of a token as bubble-map nodes. Cached 1h per
 * (chain, token, limit). Returns null when Blockscout has no holder data.
 */
export async function fetchTopHolders(
  chain: ChainId,
  token: string,
  limit = 100,
): Promise<HolderSet | null> {
  const tok = token.toLowerCase();
  const key = `${chain}:${tok}:${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit;

  const items: any[] = [];
  let totalSupplyRaw: string | null = null;
  let decimals = 18;
  let symbol: string | null = null;
  let holdersCount: number | null = null;

  if (chain === 'pulsechain') {
    // Failover across the canonical explorer and the scan.pulsechain.box mirror
    // (via the shared helper), which also fetches token meta separately — the
    // mirror's holder items don't embed a `token` object like the primary's do.
    const res = await fetchBlockscoutHolders(tok, limit);
    if (!res || res.items.length === 0) return null;
    items.push(...res.items);
    totalSupplyRaw = res.totalSupplyRaw;
    decimals = res.decimals;
    symbol = res.symbol;
    holdersCount = res.holdersCount;
  } else {
    const base = BLOCKSCOUT_BASE[chain];
    let url = `${base}/tokens/${tok}/holders`;
    const maxPages = Math.ceil(limit / 50);
    for (let page = 0; page < maxPages && items.length < limit; page++) {
      const data = await fetchJson(url);
      const pageItems: any[] = data?.items ?? [];
      if (pageItems.length === 0) break;
      items.push(...pageItems);
      const np = data?.next_page_params;
      if (!np) break;
      const qs = new URLSearchParams(
        Object.entries(np).map(([k, v]) => [k, String(v)]),
      ).toString();
      url = `${base}/tokens/${tok}/holders?${qs}`;
    }

    if (items.length === 0) return null;

    const tokenMeta = items[0]?.token ?? {};
    totalSupplyRaw = tokenMeta.total_supply ?? null;
    decimals = Number(tokenMeta.decimals ?? 18) || 18;
    symbol = tokenMeta.symbol ?? null;
    holdersCount = tokenMeta.holders != null ? Number(tokenMeta.holders) : null;
  }
  // Float is fine here — we only need ~15 sig-figs for a percentage, not the
  // exact wei. (Both numerator and denominator are wei-scale BigInts.)
  const totalSupply = totalSupplyRaw ? Number(totalSupplyRaw) : 0;

  const nodes: HolderNode[] = items
    .slice(0, limit)
    .map((it) => {
      const addr = String(it?.address?.hash ?? '').toLowerCase();
      const balanceRaw = String(it?.value ?? '0');
      const known = getKnownAddress(addr);
      const pctSupply =
        totalSupply > 0 ? (Number(balanceRaw) / totalSupply) * 100 : 0;
      return {
        address: addr,
        balanceRaw,
        pctSupply,
        isContract: !!it?.address?.is_contract,
        label: known?.label ?? it?.address?.name ?? null,
        category: known?.category ?? null,
      };
    })
    .filter((n) => n.address);

  const set: HolderSet = {
    chain,
    token: tok,
    totalSupplyRaw,
    decimals,
    symbol,
    holdersCount,
    nodes,
    fetchedAt: Date.now(),
  };
  cache.set(key, set);
  return set;
}
