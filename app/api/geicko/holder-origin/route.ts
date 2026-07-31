import { NextRequest, NextResponse } from 'next/server';
import { blockscoutJson } from '@/lib/blockscout';
import { PULSEX_SUBGRAPHS, getTokenPairIds, gql, num } from '@/lib/geicko/pulsex';
import { getKnownAddress } from '@/lib/gumshoe/address-labels';
import { cached } from '@/lib/geicko/serverCache';

// Where a holder's transferred tokens actually came from.
//
// The holder-detail panel can say "these tokens arrived by transfer" but not
// from whom, or whether anyone in the chain ever bought them on-market. This
// walks it back: the wallet's inbound token transfers (Blockscout), grouped by
// sender; for each sender, did THEY buy on PulseX (subgraph swaps, from =
// sender)? If not, recurse into the sender's own inbound transfers — depth-
// and budget-capped — until the trail ends at a buy, the mint, a labelled
// address, or runs out of budget.
//
// Attribution is honest about being a heuristic. Tokens are fungible: when a
// sender both bought and received, the trace reports both ("bought 60% of what
// it sent on") rather than pretending to know which particular tokens moved.
// Whatever cannot be traced is reported as untraced — never silently dropped,
// and never folded into the holder's PnL.
//
// Budget: one Blockscout page walk per traced node (≤3 pages), ≤5 root
// senders, ≤3 per deeper node, depth ≤3, ≤12 nodes total. Everything past the
// caps is disclosed in `limits`. PulseChain only, free.

export const revalidate = 0;
export const maxDuration = 90;

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;
const CACHE_MS = 10 * 60_000;

const MAX_ROOT_SENDERS = 5;
const MAX_CHILD_SENDERS = 3;
const MAX_DEPTH = 3;
const MAX_NODES = 12;
/** Explorer pages walked per node. The root needs full coverage of the
 *  holder's own inbound history; a deeper hop only needs its dominant
 *  senders, and halving its page cost is what buys the walk another hop
 *  inside the same wall clock. */
const MAX_TRANSFER_PAGES = 2;
const MAX_TRANSFER_PAGES_DEEP = 1;
/** Hard wall-clock stop. Whatever hasn't resolved by then reports as capped —
 *  a slower upstream must degrade the trace's depth, never hang the request. */
const DEADLINE_MS = 45_000;

const ZERO = '0x0000000000000000000000000000000000000000';
const DEAD = '0x000000000000000000000000000000000000dead';

// Swap routers/aggregators deliver bought tokens from their own address, so
// they show up as transfer senders — but those transfers ARE the wallet's own
// buys, already in its swap record (swap.from = the wallet). Treating them as
// mystery inbound would double-count every aggregator buy. Known ones are
// static; unknown contracts get one cheap "does it execute swaps?" probe.
const STATIC_ROUTERS = new Set<string>([
  '0x165c3410fc91ef562c50559f7d2289febed552d9', // PulseX router v2
  '0x98bf93ebf5c380c0e6ae8e192a7e2ae08edacc02', // PulseX router v1
  '0xda9aba4eacf54e0273f56dffee6b8f1e20b23bba', // aggregator (verified swap sender)
]);

/**
 * Does this address execute swaps (i.e. is it a router/aggregator)?
 *
 * Both subgraphs are asked at once rather than in sequence, and the verdict is
 * memoised for an hour: whether an address is a router does not change, and
 * the same handful of aggregators shows up as a sender on nearly every wallet.
 * Sequential-and-uncached, this was one of the things eating the trace's
 * wall-clock budget before it could reach a second hop.
 */
async function isSwapRouter(pairsByGraph: { url: string; pairIds: string[] }[], addr: string): Promise<boolean> {
  if (STATIC_ROUTERS.has(addr)) return true;
  return cached(
    `origin:isRouter:${addr}`,
    60 * 60_000,
    async () => {
      const hits = await Promise.all(
        pairsByGraph.map(async (g) => {
          const d = await gql(g.url, `{ swaps(first:1, where:{sender:"${addr}"}){ id } }`);
          return (d?.swaps ?? []).length > 0;
        }),
      );
      return hits.some(Boolean);
    },
  );
}

interface Inbound {
  sender: string;
  senderIsContract: boolean;
  tokens: number;
  transfers: number;
  firstTs: number | null;
  lastTs: number | null;
}

/**
 * The wallet's inbound transfers of this token, grouped by sender, from
 * Blockscout. `truncated` is true when more pages existed than the budget
 * allows — the caller says so instead of presenting a partial sum as the total.
 */
async function inboundBySender(
  token: string,
  wallet: string,
  excludePairs: Set<string>,
  maxPages: number = MAX_TRANSFER_PAGES,
): Promise<{ senders: Inbound[]; totalTokens: number; truncated: boolean } | null> {
  const bySender = new Map<string, Inbound>();
  let totalTokens = 0;
  let truncated = false;
  let params = '';
  let sawAny = false;

  for (let page = 0; page < maxPages; page++) {
    const d = await blockscoutJson(
      `/addresses/${wallet}/token-transfers?token=${token}&filter=to${params}`,
      { timeoutMs: 8_000 },
    );
    if (!d) return sawAny ? { senders: [...bySender.values()], totalTokens, truncated: true } : null;
    sawAny = true;
    for (const it of d.items ?? []) {
      const from = (it?.from?.hash ?? '').toLowerCase();
      const to = (it?.to?.hash ?? '').toLowerCase();
      if (to !== wallet || !ADDR_RX.test(from)) continue;
      // A wallet sending to itself is not an origin. Left in, it became its
      // own upstream node — cycle detection then marked that phantom hop
      // "untraceable", which reads exactly like the trail going cold.
      if (from === wallet) continue;
      // Transfers from the token's own pairs are the wallet's swap receipts —
      // already counted as buys in holder-detail, not "transfers in".
      if (excludePairs.has(from)) continue;
      const decimals = num(it?.total?.decimals ?? 18) || 18;
      const tokens = num(it?.total?.value) / Math.pow(10, decimals);
      if (!(tokens > 0)) continue;
      const ts = it?.timestamp ? Math.floor(Date.parse(it.timestamp) / 1000) : null;
      const cur = bySender.get(from) ?? {
        sender: from,
        senderIsContract: !!it?.from?.is_contract,
        tokens: 0,
        transfers: 0,
        firstTs: null,
        lastTs: null,
      };
      cur.tokens += tokens;
      cur.transfers += 1;
      if (ts != null) {
        cur.firstTs = cur.firstTs == null ? ts : Math.min(cur.firstTs, ts);
        cur.lastTs = cur.lastTs == null ? ts : Math.max(cur.lastTs, ts);
      }
      bySender.set(from, cur);
      totalTokens += tokens;
    }
    const next = d.next_page_params;
    if (!next) break;
    if (page === maxPages - 1) {
      truncated = true;
      break;
    }
    params = '&' + new URLSearchParams(
      Object.fromEntries(Object.entries(next).map(([k, v]) => [k, String(v)])),
    ).toString();
  }

  return { senders: [...bySender.values()].sort((a, b) => b.tokens - a.tokens), totalTokens, truncated };
}

interface BuyRecord {
  boughtTokens: number;
  boughtUsd: number;
  firstBuyTs: number | null;
  avgPriceUsd: number | null;
}

/**
 * Did this wallet buy the token on PulseX, and at what average price?
 *
 * Both subgraphs in parallel, memoised per wallet — a hub address that fed
 * several of the holders being traced was otherwise re-queried from scratch
 * every time it appeared.
 */
async function buysFor(pairsByGraph: { url: string; pairIds: string[] }[], token: string, wallet: string): Promise<BuyRecord> {
  return cached(`origin:buys:${token}:${wallet}`, CACHE_MS, async () => {
    let boughtTokens = 0, boughtUsd = 0;
    let firstBuyTs: number | null = null;
    const perGraph = await Promise.all(
      pairsByGraph.map(async (g) => {
        if (!g.pairIds.length) return [];
        const inList = g.pairIds.map((id) => `"${id}"`).join(',');
        const d = await gql(
          g.url,
          `{ swaps(first:1000, orderBy:timestamp, orderDirection:asc, where:{pair_in:[${inList}], from:"${wallet}"})
             { timestamp amountUSD amount0In amount1In amount0Out amount1Out pair{ token0{ id } } } }`,
        );
        return (d?.swaps ?? []) as any[];
      }),
    );
    for (const s of perGraph.flat()) {
      const isTok0 = (s.pair?.token0?.id ?? '').toLowerCase() === token;
      const out = isTok0 ? num(s.amount0Out) : num(s.amount1Out);
      const inn = isTok0 ? num(s.amount0In) : num(s.amount1In);
      if (out > inn) {
        boughtTokens += out - inn;
        boughtUsd += num(s.amountUSD);
        const ts = num(s.timestamp);
        if (firstBuyTs == null || ts < firstBuyTs) firstBuyTs = ts;
      }
    }
    return {
      boughtTokens,
      boughtUsd,
      firstBuyTs,
      avgPriceUsd: boughtTokens > 0 ? boughtUsd / boughtTokens : null,
    };
  });
}

/** One resolved hop in a trace. */
interface TraceNode {
  address: string;
  short: string;
  label: string | null;
  isContract: boolean;
  /** Tokens this hop passed toward the holder. */
  tokens: number;
  transfers: number;
  firstTs: number | null;
  lastTs: number | null;
  /** How the trail ends at this hop, when it does. */
  origin:
    | { kind: 'bought'; boughtTokens: number; boughtUsd: number; firstBuyTs: number | null; avgPriceUsd: number | null; coversSent: number }
    | { kind: 'minted' }
    | { kind: 'router' }
    | { kind: 'known'; category: string | null }
    | { kind: 'depth-capped' }
    | { kind: 'budget-capped' }
    | { kind: 'time-capped' }
    | { kind: 'untraceable' }
    | null;
  /** Where THIS hop's tokens came from, when we kept walking. */
  upstream: TraceNode[] | null;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

interface TraceCtx {
  nodes: number;
  deadline: number;
  /** Wallets already on the current path or resolved — A→B→A must terminate. */
  visited: Set<string>;
}

async function trace(
  token: string,
  wallet: string,
  pairsByGraph: { url: string; pairIds: string[] }[],
  pairSet: Set<string>,
  depth: number,
  ctx: TraceCtx,
): Promise<{ nodes: TraceNode[]; totalTokens: number; truncated: boolean } | null> {
  const inbound = await inboundBySender(
    token, wallet, pairSet,
    depth === 0 ? MAX_TRANSFER_PAGES : MAX_TRANSFER_PAGES_DEEP,
  );
  if (!inbound) return null;

  const cap = depth === 0 ? MAX_ROOT_SENDERS : MAX_CHILD_SENDERS;
  const take = inbound.senders.slice(0, cap);

  // Each sender resolves independently, so they run in parallel — the trace's
  // wall-clock is the deepest chain, not the sum of every sibling.
  const nodes = await Promise.all(take.map(async (s): Promise<TraceNode> => {
    const known = getKnownAddress(s.sender);
    const node: TraceNode = {
      address: s.sender,
      short: short(s.sender),
      label: known?.label ?? null,
      isContract: s.senderIsContract,
      tokens: s.tokens,
      transfers: s.transfers,
      firstTs: s.firstTs,
      lastTs: s.lastTs,
      origin: null,
      upstream: null,
    };

    if (s.sender === ZERO || s.sender === DEAD) {
      node.origin = { kind: 'minted' };
      return node;
    }
    // A labelled address (CEX, bridge, router, locker…) is a terminal: what
    // happens on the far side of it isn't traceable on this chain.
    if (known) {
      node.origin = known.category === 'router' ? { kind: 'router' } : { kind: 'known', category: known.category ?? null };
      return node;
    }
    // Router/aggregator deliveries are the wallet's own buys wearing a
    // transfer's clothes — classify, don't chase.
    if (s.senderIsContract && (await isSwapRouter(pairsByGraph, s.sender))) {
      node.origin = { kind: 'router' };
      return node;
    }
    // Two wallets passing tokens back and forth would recurse forever.
    if (ctx.visited.has(s.sender)) {
      node.origin = { kind: 'untraceable' };
      return node;
    }
    // Two different ceilings that used to report as one. The node budget means
    // "this wallet has more branches than we walk"; the deadline means "the
    // upstream was slow today". Only the first is about the data.
    if (Date.now() > ctx.deadline) {
      node.origin = { kind: 'time-capped' };
      return node;
    }
    if (ctx.nodes <= 0) {
      node.origin = { kind: 'budget-capped' };
      return node;
    }
    ctx.nodes -= 1;
    ctx.visited.add(s.sender);

    // Did this sender buy on PulseX?
    const buys = await buysFor(pairsByGraph, token, s.sender);
    if (buys.boughtTokens > 0) {
      node.origin = {
        kind: 'bought',
        boughtTokens: buys.boughtTokens,
        boughtUsd: buys.boughtUsd,
        firstBuyTs: buys.firstBuyTs,
        avgPriceUsd: buys.avgPriceUsd,
        // How much of what this sender passed on its own buys can cover.
        coversSent: s.tokens > 0 ? Math.min(1, buys.boughtTokens / s.tokens) : 0,
      };
      // Bought less than it sent on → the rest came from somewhere; keep
      // walking if depth allows, so a mixed wallet shows both sources.
      if (buys.boughtTokens >= s.tokens * 0.95 || depth + 1 >= MAX_DEPTH) return node;
    } else if (depth + 1 >= MAX_DEPTH) {
      node.origin = { kind: 'depth-capped' };
      return node;
    }

    const up = await trace(token, s.sender, pairsByGraph, pairSet, depth + 1, ctx);
    if (up && up.nodes.length) {
      node.upstream = up.nodes;
    } else if (!node.origin) {
      node.origin = { kind: 'untraceable' };
    }
    return node;
  }));

  return { nodes, totalTokens: inbound.totalTokens, truncated: inbound.truncated };
}

/** Tokens whose trail ends at an on-market buy, summed through the tree. */
function tracedToBuy(nodes: TraceNode[]): number {
  let sum = 0;
  for (const n of nodes) {
    if (n.origin?.kind === 'bought') {
      sum += n.tokens * n.origin.coversSent;
      if (n.upstream) sum += Math.min(n.tokens * (1 - n.origin.coversSent), tracedToBuy(n.upstream));
    } else if (n.upstream) {
      sum += Math.min(n.tokens, tracedToBuy(n.upstream));
    }
  }
  return sum;
}

async function build(token: string, wallet: string) {
  const pairsByGraph = await Promise.all(
    PULSEX_SUBGRAPHS.map(async (url) => ({
      url,
      pairIds:
        (await cached(`hd:pairs:${url}:${token}`, 10 * 60_000, () => getTokenPairIds(url, token),
          (v) => Array.isArray(v) && v.length > 0)) ?? [],
    })),
  );
  const pairSet = new Set(pairsByGraph.flatMap((g) => g.pairIds));

  const ctx: TraceCtx = { nodes: MAX_NODES, deadline: Date.now() + DEADLINE_MS, visited: new Set([wallet]) };
  const result = await trace(token, wallet, pairsByGraph, pairSet, 0, ctx);
  if (!result) {
    return { supported: true, hasData: false, reason: 'blockscout-unavailable' };
  }
  if (!result.nodes.length) {
    return {
      supported: true,
      hasData: true,
      wallet,
      token,
      inboundTokens: 0,
      traces: [],
      coveragePct: null,
      limits: { truncated: result.truncated },
      note: 'No inbound transfers found beyond the wallet’s own swaps.',
    };
  }

  const toBuys = tracedToBuy(result.nodes);
  // Router deliveries at the root are the wallet's own aggregator buys —
  // already in its swap record, so they come out of the "transferred" total.
  const routerTokens = result.nodes
    .filter((n) => n.origin?.kind === 'router')
    .reduce((sum, n) => sum + n.tokens, 0);
  const transferred = Math.max(0, result.totalTokens - routerTokens);
  return {
    supported: true,
    hasData: true,
    wallet,
    token,
    /** Tokens that arrived by genuine transfer (swap + router deliveries excluded). */
    inboundTokens: transferred,
    /** Tokens delivered by routers/aggregators — the wallet's own buys. */
    routerDeliveredTokens: routerTokens,
    /** Share of the genuine transfers whose trail ends at an on-market buy. */
    coveragePct: transferred > 0 ? Math.min(100, (toBuys / transferred) * 100) : null,
    traces: result.nodes,
    limits: {
      truncated: result.truncated,
      nodesUsed: MAX_NODES - ctx.nodes,
      maxDepth: MAX_DEPTH,
      /** True when the wall clock, not the data, ended the walk. */
      timedOut: Date.now() > ctx.deadline,
    },
    note:
      'A heuristic walk of inbound transfers. Tokens are fungible, so when a sender both bought and received, both sources are shown — nothing here is folded into PnL.',
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const network = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  const wallet = (sp.get('wallet') || '').toLowerCase();
  if (network !== 'pulsechain') return NextResponse.json({ supported: false, chain: network });
  if (!ADDR_RX.test(token) || !ADDR_RX.test(wallet)) {
    return NextResponse.json({ error: 'token and wallet required' }, { status: 400 });
  }
  try {
    const payload = await cached(
      `holder-origin:${token}:${wallet}`,
      CACHE_MS,
      () => build(token, wallet),
      (v: any) => v?.supported === true && v?.hasData !== false,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=1200' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to trace holder origin' },
      { status: 500 },
    );
  }
}
