// Bubble-map edges + clusters for a set of top holders.
//
// Two relationship signals, both drawn from the SAME per-holder transfer scan
// (Blockscout `token-transfers?token=…`, verified shape from.hash / to.hash /
// total.value), so the stronger signal costs no extra requests:
//
//   1. Direct transfer — the token moved directly between two addresses that
//      are BOTH in the top-N set. Strong but rare among big holders (whales
//      seldom send each other the token), so on its own most tokens show zero
//      clusters.
//   2. Shared funder — two top holders both RECEIVED the token from the same
//      source address. Wallets seeded by a common funder are the classic
//      linked-wallet ("same entity") signal, and this is what actually makes
//      clusters appear on established tokens. We only trust a funder that seeded
//      between MIN and MAX distinct top holders: 1 is no relationship, and a
//      high-degree funder is a distributor/CEX/pair, not a person.
//
// Infrastructure (the LP pair, routers, factories, lockers, burn, wrapped
// native) is excluded from edges and clusters — as edge endpoints AND as
// funders — because those addresses transfer with huge numbers of wallets and
// would otherwise hub the whole graph into one meaningless blob. They still
// render as labelled bubbles. Clusters are the connected components over the
// surviving edges.

import type { ChainId, HolderNode } from '@/lib/portfolio/holders';
import type { AddressCategory } from '@/lib/gumshoe/address-labels';

const BLOCKSCOUT_BASE: Record<ChainId, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
  robinhood: 'https://robinhoodchain.blockscout.com/api/v2',
};

// Categories that interact with too many wallets to imply any relationship.
const INFRA: ReadonlySet<AddressCategory> = new Set<AddressCategory>([
  'router',
  'factory',
  'locker',
  'burn',
  'wrapped',
]);

export interface HolderEdge {
  /** Lower of the two addresses (edges are undirected, deduped). */
  from: string;
  to: string;
  /** Transfers observed between the pair within the scan window. */
  count: number;
}

export interface HolderGraph {
  edges: HolderEdge[];
  /** Connected components of size ≥ 2 over the edges. */
  clusters: string[][];
  /** Holders whose transfers actually got scanned (may be < eligible if budget hit). */
  scannedHolders: number;
  /** Target number of eligible (non-contract, non-infra) holders. */
  eligibleHolders: number;
  /** True when the wall-clock budget cut the scan short — clusters are from a subset. */
  partial: boolean;
  fetchedAt: number;
}

const FETCH_TIMEOUT_MS = 8_000;
const PAGES_PER_HOLDER = 1; // recent transfers only (v1); UI notes the window
const CONCURRENCY = 12;
// A shared funder links holders only when it seeded ≥ MIN and ≤ MAX of them.
// Above MAX it's a distributor / CEX / pair (would hub unrelated wallets); MAX 4
// keeps clusters tight and avoids fake mega-blobs (validated against HEX/LBRTY).
const MIN_FUNDER_DEGREE = 2;
const MAX_FUNDER_DEGREE = 4;
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
// Hard wall-clock cap on the whole edge scan. Mega-tokens (e.g. PLSX) have
// extremely active top holders whose transfer queries are slow, and 150 of them
// can run for minutes. Past this budget we stop scanning and return whatever
// clusters we found — bounded latency beats a hang. Cached 1h by the route.
const BUDGET_MS = 28_000;

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

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (t: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
}

export async function buildHolderGraph(
  chain: ChainId,
  token: string,
  holders: HolderNode[],
  opts?: { budgetMs?: number; concurrency?: number },
): Promise<HolderGraph> {
  const base = BLOCKSCOUT_BASE[chain];
  const tok = token.toLowerCase();
  // Callers that cache aggressively (e.g. the HEX stake map, always the slow
  // mega-token) can raise the budget/concurrency for fuller coverage.
  const budgetMs = opts?.budgetMs ?? BUDGET_MS;
  const concurrency = opts?.concurrency ?? CONCURRENCY;

  // Addresses we draw edges among. Exclude (a) labelled infra and (b) ALL
  // contracts: transfers to/from the LP pair, routers, CEX or any contract are
  // buys/sells/custody, not wallet-to-wallet relationships, and a high-degree
  // contract (the pair) would otherwise hub every holder into one fake cluster.
  // Contracts still render as bubbles via the holders list — just not clustered.
  const eligible = holders.filter(
    (h) => !h.isContract && !(h.category && INFRA.has(h.category)),
  );
  const inSet = new Set(eligible.map((h) => h.address));

  // Addresses that must never count as a "funder": the token itself, the zero
  // address (mints), and any infra/contract holder (pair, router, CEX, …).
  const excludedFunders = new Set<string>([ZERO_ADDR, tok]);
  for (const h of holders) {
    if (h.isContract || (h.category && INFRA.has(h.category))) excludedFunders.add(h.address);
  }

  const pairCounts = new Map<string, HolderEdge>();
  // funder address → the set of top holders it sent the token to.
  const funderToHolders = new Map<string, Set<string>>();
  const start = Date.now();
  let completed = 0;
  let budgetHit = false;

  await mapLimit(eligible, concurrency, async (h) => {
    // Once the budget is spent, remaining holders return immediately (cheap
    // no-op) so the scan drains fast and we respond with partial results.
    if (Date.now() - start > budgetMs) { budgetHit = true; return; }
    let url = `${base}/addresses/${h.address}/token-transfers?token=${tok}&type=ERC-20`;
    for (let p = 0; p < PAGES_PER_HOLDER; p++) {
      const data = await fetchJson(url);
      const items: any[] = data?.items ?? [];
      for (const it of items) {
        const from = String(it?.from?.hash ?? '').toLowerCase();
        const to = String(it?.to?.hash ?? '').toLowerCase();
        if (!from || !to || from === to) continue;
        // Signal 2: this holder received the token from `from` — record the
        // funder so wallets sharing a source can be linked after the scan.
        if (to === h.address && !excludedFunders.has(from)) {
          let s = funderToHolders.get(from);
          if (!s) { s = new Set(); funderToHolders.set(from, s); }
          s.add(h.address);
        }
        // Signal 1 (direct edge): both ends must be eligible top holders.
        if (!inSet.has(from) || !inSet.has(to)) continue;
        const a = from < to ? from : to;
        const b = from < to ? to : from;
        const key = `${a}|${b}`;
        const e = pairCounts.get(key);
        if (e) e.count += 1;
        else pairCounts.set(key, { from: a, to: b, count: 1 });
      }
      const np = data?.next_page_params;
      if (!np) break;
      const qs = new URLSearchParams(
        Object.entries(np).map(([k, v]) => [k, String(v)]),
      ).toString();
      url = `${base}/addresses/${h.address}/token-transfers?token=${tok}&type=ERC-20&${qs}`;
    }
    completed += 1;
  });

  // Shared-funder edges: for each funder that seeded 2..MAX top holders, link
  // its recipients together (star from the first) so they cluster. Reuses the
  // transfers already scanned — no extra requests.
  for (const recips of funderToHolders.values()) {
    if (recips.size < MIN_FUNDER_DEGREE || recips.size > MAX_FUNDER_DEGREE) continue;
    const arr = [...recips];
    for (let k = 1; k < arr.length; k++) {
      const from = arr[0] < arr[k] ? arr[0] : arr[k];
      const to = arr[0] < arr[k] ? arr[k] : arr[0];
      const key = `${from}|${to}`;
      if (!pairCounts.has(key)) pairCounts.set(key, { from, to, count: 1 });
    }
  }

  const edges = [...pairCounts.values()];

  // Union-find over edges → connected components.
  const parent = new Map<string, string>();
  for (const a of inSet) parent.set(a, a);
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  for (const e of edges) {
    const ra = find(e.from);
    const rb = find(e.to);
    if (ra !== rb) parent.set(ra, rb);
  }

  const groups = new Map<string, string[]>();
  for (const a of inSet) {
    const r = find(a);
    const g = groups.get(r);
    if (g) g.push(a);
    else groups.set(r, [a]);
  }
  const clusters = [...groups.values()]
    .filter((g) => g.length >= 2)
    .sort((a, b) => b.length - a.length);

  return {
    edges,
    clusters,
    scannedHolders: completed,
    eligibleHolders: eligible.length,
    partial: budgetHit,
    fetchedAt: Date.now(),
  };
}
