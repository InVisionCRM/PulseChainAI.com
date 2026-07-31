import { NextRequest, NextResponse } from 'next/server';
import { PULSEX_SUBGRAPHS, getTokenPairIds, gql, num, cleanUsd } from '@/lib/geicko/pulsex';
import { cached } from '@/lib/geicko/serverCache';

// One holder's trading record for one token, from PulseX swaps (v1 + v2):
// buy/sell counts and USD, biggest buy and sell, first/last buy, last sell,
// realized and unrealized PnL from an average-cost basis, and any liquidity
// the wallet has provided on the token's pairs.
//
// Attribution is `swap.from` — the transaction sender — verified filterable on
// both subgraphs. The trades tab uses `to` (the output recipient) because it
// aggregates anonymous flow, but for a *named* wallet `from` is strictly
// better: on multi-hop routes `to` is the next pair, and a wallet's own hops
// would go missing.
//
// Honest limits, stated in the payload rather than papered over:
//   • This is PulseX DEX activity only. Plain transfers, other venues and
//     bridged flow are invisible here, so a wallet can hold more than it ever
//     "bought". When that happens the basis only covers part of the balance
//     and the payload says so instead of inventing a cost for the rest.
//   • LP positions are reconstructed from the wallet's own mints and burns
//     (mint.to = wallet, burn.sender = wallet — the attribution lp-position
//     verified against the live subgraph). LP tokens received by transfer
//     won't appear.
// PulseChain only, free.

export const revalidate = 0;
export const maxDuration = 60;

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;
const CACHE_MS = 5 * 60_000;
/** Pairs to scan for LP history — the token's deepest pools. */
const LP_PAIRS = 10;

const SWAP_FIELDS =
  `{ timestamp amountUSD amount0In amount1In amount0Out amount1Out pair{ id token0{ id } } }`;

interface WalletSwap {
  timestamp: string;
  amountUSD: string;
  amount0In: string;
  amount1In: string;
  amount0Out: string;
  amount1Out: string;
  pair: { id: string; token0: { id: string } };
}

/** Every swap this wallet sent on these pairs, oldest first, paged. */
async function walletSwaps(url: string, pairIds: string[], wallet: string): Promise<WalletSwap[]> {
  const inList = pairIds.map((id) => `"${id}"`).join(',');
  const out: WalletSwap[] = [];
  let after = 0;
  for (let p = 0; p < 6; p++) {
    const d = await gql(
      url,
      `{ swaps(first:1000, orderBy:timestamp, orderDirection:asc,
           where:{pair_in:[${inList}], from:"${wallet}", timestamp_gt:${after}}) ${SWAP_FIELDS} }`,
    );
    const rows = (d?.swaps ?? []) as WalletSwap[];
    out.push(...rows);
    if (rows.length < 1000) break;
    after = num(rows[rows.length - 1].timestamp);
  }
  return out;
}

/** The wallet's LP adds/removes on one pair, plus the pair's current state. */
async function lpOnPair(url: string, pairId: string, wallet: string) {
  const d = await gql(
    url,
    `{ mints(first:1000, orderBy:timestamp, orderDirection:asc, where:{ pair:"${pairId}", to:"${wallet}" }){ timestamp liquidity amountUSD }
       burns(first:1000, orderBy:timestamp, orderDirection:asc, where:{ pair:"${pairId}", sender:"${wallet}" }){ timestamp liquidity amountUSD }
       pair(id:"${pairId}"){ totalSupply reserveUSD token0{ symbol } token1{ symbol } } }`,
  );
  const mints: any[] = d?.mints ?? [];
  const burns: any[] = d?.burns ?? [];
  if (!mints.length && !burns.length) return null;
  const p = d?.pair;
  let lpTokens = 0;
  for (const m of mints) lpTokens += num(m.liquidity);
  for (const b of burns) lpTokens -= num(b.liquidity);
  lpTokens = Math.max(0, lpTokens);
  const totalSupply = num(p?.totalSupply);
  const share = totalSupply > 0 ? lpTokens / totalSupply : 0;
  const last = [...mints, ...burns].reduce((s, e) => Math.max(s, num(e.timestamp)), 0);
  return {
    pair: pairId,
    label: p ? `${p.token0?.symbol ?? '?'}/${p.token1?.symbol ?? '?'}` : pairId.slice(0, 10),
    adds: mints.length,
    removes: burns.length,
    addedUsd: mints.reduce((s, m) => s + cleanUsd(m.amountUSD), 0),
    removedUsd: burns.reduce((s, b) => s + cleanUsd(b.amountUSD), 0),
    /** Share of the pool the reconstructed balance represents now. */
    sharePct: share * 100,
    valueUsd: share * num(p?.reserveUSD),
    active: lpTokens > 1e-12,
    lastEventTs: last,
  };
}

async function build(token: string, wallet: string, balance: number | null) {
  // The token's pairs on each graph (a pair lives in exactly one of v1/v2).
  const perGraph = await Promise.all(
    PULSEX_SUBGRAPHS.map(async (url) => {
      const pairIds = await cached(
        `hd:pairs:${url}:${token}`,
        10 * 60_000,
        () => getTokenPairIds(url, token),
        (v) => Array.isArray(v) && v.length > 0,
      );
      return { url, pairIds: pairIds ?? [] };
    }),
  );
  if (!perGraph.some((g) => g.pairIds.length)) {
    return { supported: true, hasData: false, reason: 'no-pairs-indexed' };
  }

  // Swaps + LP history + live price, all in parallel.
  const [swapsNested, lpNested, priceData] = await Promise.all([
    Promise.all(
      perGraph.map((g) => (g.pairIds.length ? walletSwaps(g.url, g.pairIds, wallet) : Promise.resolve([]))),
    ),
    Promise.all(
      perGraph.map((g) =>
        Promise.all(g.pairIds.slice(0, LP_PAIRS).map((id) => lpOnPair(g.url, id, wallet))),
      ),
    ),
    (async () => {
      for (const url of PULSEX_SUBGRAPHS) {
        const d = await gql(url, `{ token(id:"${token}"){ derivedUSD } }`);
        const p = num(d?.token?.derivedUSD);
        if (p > 0) return p;
      }
      return 0;
    })(),
  ]);

  const swaps = swapsNested.flat().sort((a, b) => num(a.timestamp) - num(b.timestamp));
  const lp = lpNested
    .flat()
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.valueUsd - a.valueUsd);

  // ── walk the trade history chronologically, carrying an average-cost basis ──
  let buyCount = 0, sellCount = 0, buyUsd = 0, sellUsd = 0;
  let buyTokens = 0, sellTokens = 0;
  let biggestBuy: { usd: number; ts: number } | null = null;
  let biggestSell: { usd: number; ts: number } | null = null;
  let firstBuyTs: number | null = null, lastBuyTs: number | null = null, lastSellTs: number | null = null;
  let qty = 0;        // tokens attributable to swaps
  let basisUsd = 0;   // cost of those tokens
  let realizedUsd = 0;
  // Sells beyond what swaps bought mean tokens arrived by transfer — the basis
  // only covers part of the story from then on.
  let basisComplete = true;

  for (const s of swaps) {
    const isTok0 = s.pair.token0.id.toLowerCase() === token;
    const tokOut = isTok0 ? num(s.amount0Out) : num(s.amount1Out);
    const tokIn = isTok0 ? num(s.amount0In) : num(s.amount1In);
    const usd = cleanUsd(s.amountUSD);
    const ts = num(s.timestamp);
    if (tokOut >= tokIn) {
      // wallet received the token — a buy
      const amount = tokOut - tokIn;
      if (amount <= 0 && usd <= 0) continue;
      buyCount++;
      buyUsd += usd;
      buyTokens += amount;
      if (!biggestBuy || usd > biggestBuy.usd) biggestBuy = { usd, ts };
      if (firstBuyTs == null) firstBuyTs = ts;
      lastBuyTs = ts;
      qty += amount;
      basisUsd += usd;
    } else {
      const amount = tokIn - tokOut;
      sellCount++;
      sellUsd += usd;
      sellTokens += amount;
      if (!biggestSell || usd > biggestSell.usd) biggestSell = { usd, ts };
      lastSellTs = ts;
      const avg = qty > 0 ? basisUsd / qty : 0;
      const covered = Math.min(amount, qty);
      if (covered < amount) basisComplete = false;
      realizedUsd += usd - avg * covered;
      basisUsd -= avg * covered;
      qty -= covered;
    }
  }

  // Unrealized: only priceable for the part of today's balance that swaps
  // actually bought. A balance larger than the swap-tracked quantity means
  // transfers we can't cost — priced at market but with zero known basis it
  // would fabricate a gain, so that slice is excluded and flagged.
  const priceNow = priceData;
  let unrealizedUsd: number | null = null;
  let unrealizedCoversTokens = 0;
  if (priceNow > 0 && qty > 0) {
    const covered = balance != null ? Math.min(qty, balance) : qty;
    unrealizedCoversTokens = covered;
    const avg = basisUsd / qty;
    unrealizedUsd = covered * (priceNow - avg);
  }
  if (balance != null && balance > qty * 1.001) basisComplete = false;

  return {
    supported: true,
    hasData: swaps.length > 0 || lp.length > 0,
    wallet,
    token,
    priceNow,
    trades: {
      swaps: swaps.length,
      buyCount, sellCount, buyUsd, sellUsd, buyTokens, sellTokens,
      biggestBuy, biggestSell,
      firstBuyTs, lastBuyTs, lastSellTs,
    },
    pnl: {
      realizedUsd,
      unrealizedUsd,
      unrealizedCoversTokens,
      netUsd: unrealizedUsd != null ? realizedUsd + unrealizedUsd : realizedUsd,
      /** False when the wallet moved tokens outside PulseX — figures are partial. */
      basisComplete,
      avgCostUsd: qty > 0 ? basisUsd / qty : null,
      swapTrackedTokens: qty,
    },
    lp: {
      isProvider: lp.some((x) => x.active),
      everProvided: lp.length > 0,
      positions: lp.slice(0, 6),
    },
    note: 'PulseX v1+v2 swaps sent by this wallet. Transfers, other venues and bridged flow are not visible here.',
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const network = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  const wallet = (sp.get('wallet') || '').toLowerCase();
  const balanceRaw = parseFloat(sp.get('balance') || '');
  const balance = Number.isFinite(balanceRaw) && balanceRaw >= 0 ? balanceRaw : null;

  if (network !== 'pulsechain') return NextResponse.json({ supported: false, chain: network });
  if (!ADDR_RX.test(token) || !ADDR_RX.test(wallet)) {
    return NextResponse.json({ error: 'token and wallet required' }, { status: 400 });
  }

  try {
    // Balance is deliberately not part of the key — it only affects the
    // unrealized slice, and a stale 5-minute figure there is fine.
    const payload = await cached(
      `holder-detail:${token}:${wallet}`,
      CACHE_MS,
      () => build(token, wallet, balance),
      (v: any) => v?.supported === true,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build holder detail' },
      { status: 500 },
    );
  }
}
