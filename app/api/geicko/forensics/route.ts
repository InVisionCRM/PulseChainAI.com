import { NextRequest, NextResponse } from 'next/server';
import { PULSEX_SUBGRAPHS, gql, num, cleanUsd } from '@/lib/geicko/pulsex';

// Token forensics: who created this token, who funded them, what else they
// deployed, whether they've been selling — plus the token's FIRST BUYERS,
// including same-block-as-liquidity snipers and who still holds.
//
// Sources: Blockscout (creator, deployments, funding, balances, transfers) and
// the PulseX v1/v2 subgraphs (earliest pair, first mint, earliest swaps). The
// subgraph times out on unbounded single-pair scans, so all event queries are
// bounded to a window after pair creation. All free; PulseChain only.

export const revalidate = 0;
export const maxDuration = 60;

const BS = 'https://api.scan.pulsechain.com/api/v2';
const ZERO = '0x0000000000000000000000000000000000000000';
const DEAD_SUFFIX = /dead$/i;

const TX_PAGES = 2;          // creator tx pages to scan (deployments + funding)
const BUY_WINDOW_S = 72 * 3600; // how long after pair creation counts as "first buyers"
const SWAP_PAGES = 3;        // ascending swap pages (1000 each) within the window
const MAX_BUYERS = 30;       // unique first buyers reported
const BALANCE_CHECKS = 30;   // wallets we check current balances for
const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 9_000;
// Overall soft budget. Busy tokens (PLSX etc.) otherwise blew past the 60s route
// limit and 504'd — which the UI showed as "not available". Past this we return
// whatever we have (e.g. buyers without current-balance checks) rather than die.
const DEADLINE_MS = 48_000;

const cache = new Map<string, { at: number; value: unknown }>();

async function bs(path: string): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(`${BS}${path}`, { headers: { accept: 'application/json' }, signal: ctrl.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

/** Earliest pair for the token across v1+v2, both token sides. */
async function earliestPair(token: string) {
  const q = `{ a: pairs(first:1, orderBy:timestamp, orderDirection:asc, where:{token0:"${token}"}){ id timestamp token0{ id } token1{ id symbol } }
               b: pairs(first:1, orderBy:timestamp, orderDirection:asc, where:{token1:"${token}"}){ id timestamp token0{ id symbol } token1{ id } } }`;
  const found: { url: string; id: string; ts: number; otherSymbol: string; tokenIsToken0: boolean }[] = [];
  for (const url of PULSEX_SUBGRAPHS) {
    const d = await gql(url, q);
    for (const p of [...(d?.a ?? []), ...(d?.b ?? [])]) {
      const isTok0 = p.token0.id.toLowerCase() === token;
      found.push({
        url,
        id: p.id,
        ts: num(p.timestamp),
        otherSymbol: isTok0 ? p.token1.symbol : p.token0.symbol,
        tokenIsToken0: isTok0,
      });
    }
  }
  if (!found.length) return null;
  return found.sort((a, b) => a.ts - b.ts)[0];
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  if (chain !== 'pulsechain') return NextResponse.json({ chain, supported: false });
  if (!/^0x[a-f0-9]{40}$/.test(token)) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.value, { headers: { 'Cache-Control': 'public, max-age=300' } });
  }

  const startedAt = Date.now();
  const timeLeft = () => DEADLINE_MS - (Date.now() - startedAt);

  try {
    // ── Token + creator identity + launch pair (all independent) ────────────
    const [addrInfo, tokenInfo, pair] = await Promise.all([
      bs(`/addresses/${token}`),
      bs(`/tokens/${token}`),
      earliestPair(token),
    ]);
    let creator = (addrInfo?.creator_address_hash ?? '').toLowerCase() || null;
    const creationTx = addrInfo?.creation_tx_hash ?? null;
    const decimals = num(tokenInfo?.decimals) || 18;
    const totalSupply = num(tokenInfo?.total_supply) / 10 ** decimals;
    const symbol = tokenInfo?.symbol ?? '';
    const toTokens = (raw: unknown) => num(raw) / 10 ** decimals;
    const pairAddresses = new Set<string>(pair ? [pair.id.toLowerCase()] : []);

    // Factory-deployed tokens (pump.tires and other pump.fun clones) report the
    // FACTORY as the creator, not the user. When the token was created by a call
    // TO a contract (creation-tx `to` === recorded creator), the real creator is
    // the EOA that sent that transaction. Direct deploys have a null `to`, so
    // this only rewrites the factory case.
    let viaFactory: { address: string; method: string | null } | null = null;
    if (creationTx) {
      const ctx = await bs(`/transactions/${creationTx}`);
      const txFrom = (ctx?.from?.hash ?? '').toLowerCase();
      const txTo = (ctx?.to?.hash ?? '').toLowerCase();
      if (txFrom && txTo && creator && txTo === creator && txFrom !== creator) {
        viaFactory = { address: creator, method: ctx?.method ?? null };
        creator = txFrom;
      }
    }

    // The two heavy halves — first-buyers (subgraph) and creator behavior
    // (Blockscout) — are independent, so run them concurrently.
    const computeFirstBuyers = async (): Promise<any> => {
      if (!pair) return null;
      const t0 = pair.ts;
      const t1 = t0 + BUY_WINDOW_S;
      const md = await gql(
        pair.url,
        `{ mints(first:1, orderBy:timestamp, orderDirection:asc, where:{pair_in:["${pair.id}"], timestamp_gte:${t0}, timestamp_lt:${t1}}){ timestamp transaction{ block } amountUSD } }`,
      );
      const firstMint = md?.mints?.[0] ?? null;
      const launchBlock = num(firstMint?.transaction?.block) || null;

      // Ascending swaps within the window, paged by timestamp cursor.
      const buyersMap = new Map<string, { wallet: string; ts: number; block: number; usd: number; tokenAmount: number; sniper: boolean }>();
      let cursor = t0;
      let scanned = 0;
      for (let p = 0; p < SWAP_PAGES && buyersMap.size < MAX_BUYERS * 2; p++) {
        const d = await gql(
          pair.url,
          `{ swaps(first:1000, orderBy:timestamp, orderDirection:asc, where:{pair_in:["${pair.id}"], timestamp_gte:${cursor}, timestamp_lt:${t1}}){ timestamp amountUSD amount0In amount1In amount0Out amount1Out from to transaction{ block } } }`,
        );
        const rows = (d?.swaps ?? []) as any[];
        if (!rows.length) break;
        scanned += rows.length;
        for (const s of rows) {
          // A buy of THE token = the token left the pool (amountOut on its side).
          const tokOut = pair.tokenIsToken0 ? num(s.amount0Out) : num(s.amount1Out);
          const tokIn = pair.tokenIsToken0 ? num(s.amount0In) : num(s.amount1In);
          const isBuy = tokOut >= tokIn;
          if (!isBuy) continue;
          const trader = (s.from || s.to || '').toLowerCase();
          if (!trader || trader === ZERO) continue;
          const usd = cleanUsd(s.amountUSD);
          const blk = num(s.transaction?.block);
          const existing = buyersMap.get(trader);
          if (!existing) {
            buyersMap.set(trader, {
              wallet: trader,
              ts: num(s.timestamp),
              block: blk,
              usd,
              tokenAmount: tokOut,
              sniper: launchBlock != null && blk === launchBlock,
            });
          } else {
            existing.usd += usd;
            existing.tokenAmount += tokOut;
          }
        }
        const last = num(rows[rows.length - 1].timestamp);
        if (rows.length < 1000 || last >= t1) break;
        cursor = last; // timestamp_gte on next page re-reads the boundary second; dedupe is by wallet so it's harmless
      }

      const buyers = [...buyersMap.values()].sort((a, b) => a.ts - b.ts || a.block - b.block).slice(0, MAX_BUYERS);
      return {
        pair: pair.id,
        pairedWith: pair.otherSymbol,
        pairCreatedAt: t0,
        launchBlock,
        initialLiquidityUsd: firstMint ? cleanUsd(firstMint.amountUSD) : null,
        windowHours: BUY_WINDOW_S / 3600,
        swapsScanned: scanned,
        buyers,
      };
    };

    // ── Blockscout: creator behavior ────────────────────────────────────────
    const computeCreator = async (): Promise<any> => {
      if (!creator) return null;
      // One bounded pass over the creator's transactions powers three things:
      // other deployments, earliest-seen incoming native funding, and activity size.
      const deployments: { address: string; name: string | null; ts: string | null }[] = [];
      let earliestIncoming: { from: string; ts: string | null; valuePls: number } | null = null;
      let txPagesPartial = false;
      let url = `/addresses/${creator}/transactions`;
      for (let p = 0; p < TX_PAGES; p++) {
        const d = await bs(url);
        const items: any[] = d?.items ?? [];
        for (const t of items) {
          const created = t?.created_contract?.hash?.toLowerCase();
          if (created && created !== token) {
            deployments.push({ address: created, name: t?.created_contract?.name ?? null, ts: t?.timestamp ?? null });
          }
          const toHash = t?.to?.hash?.toLowerCase();
          if (toHash === creator && num(t?.value) > 0) {
            // pages are newest-first, so the last one seen is the earliest so far
            earliestIncoming = { from: (t?.from?.hash ?? '').toLowerCase(), ts: t?.timestamp ?? null, valuePls: num(t.value) / 1e18 };
          }
        }
        if (!d?.next_page_params) break;
        if (p === TX_PAGES - 1) { txPagesPartial = true; break; }
        const qs = new URLSearchParams(Object.entries(d.next_page_params).map(([k, v]) => [k, String(v)])).toString();
        url = `/addresses/${creator}/transactions?${qs}`;
      }

      // Creator's transfers of THIS token: sells (to a pair) + insider seeding.
      const insiders = new Map<string, { address: string; tokens: number; ts: string | null }>();
      let sellCount = 0, sellTokens = 0, outCount = 0;
      const td = await bs(`/addresses/${creator}/token-transfers?token=${token}&type=ERC-20`);
      for (const it of (td?.items ?? []) as any[]) {
        const from = (it?.from?.hash ?? '').toLowerCase();
        const to = (it?.to?.hash ?? '').toLowerCase();
        if (from !== creator || !to || to === ZERO || DEAD_SUFFIX.test(to)) continue;
        outCount++;
        const amt = toTokens(it?.total?.value);
        if (pairAddresses.has(to) || it?.to?.is_contract) { sellCount++; sellTokens += amt; continue; }
        const cur = insiders.get(to) ?? { address: to, tokens: 0, ts: it?.timestamp ?? null };
        cur.tokens += amt;
        insiders.set(to, cur);
      }

      // Current creator balance of the token.
      const balances = await bs(`/addresses/${creator}/token-balances`);
      const own = (Array.isArray(balances) ? balances : []).find((b: any) => b?.token?.address?.toLowerCase() === token);
      const creatorTokens = own ? toTokens(own.value) : 0;

      return {
        address: creator,
        creationTx,
        via: viaFactory,
        fundedBy: earliestIncoming,
        fundedByPartial: txPagesPartial,
        deployments: deployments.slice(0, 20),
        deploymentCount: deployments.length,
        tokenBalance: creatorTokens,
        pctSupply: totalSupply > 0 ? (creatorTokens / totalSupply) * 100 : null,
        sells: { count: sellCount, tokens: sellTokens },
        outTransfers: outCount,
        insiders: [...insiders.values()].sort((a, b) => b.tokens - a.tokens).slice(0, 15),
      };
    };

    const [firstBuyers, creatorReport] = await Promise.all([computeFirstBuyers(), computeCreator()]);

    // ── Current balances for first buyers + insiders (who still holds) ──────
    // Only if we still have budget — otherwise return the trace without them
    // (buyers show "?") instead of risking a 504.
    const toCheck = new Set<string>();
    for (const b of firstBuyers?.buyers ?? []) toCheck.add(b.wallet);
    for (const i of creatorReport?.insiders ?? []) toCheck.add(i.address);
    const checkList = [...toCheck].slice(0, BALANCE_CHECKS);
    const balanceOf = new Map<string, number>();
    if (checkList.length && timeLeft() > 6_000) {
      await mapLimit(checkList, 12, async (w) => {
        if (timeLeft() < 2_000) return; // stop starting new checks near the deadline
        const b = await bs(`/addresses/${w}/token-balances`);
        const own = (Array.isArray(b) ? b : []).find((x: any) => x?.token?.address?.toLowerCase() === token);
        balanceOf.set(w, own ? toTokens(own.value) : 0);
      });
    }
    for (const b of firstBuyers?.buyers ?? []) {
      b.currentTokens = balanceOf.has(b.wallet) ? balanceOf.get(b.wallet) : null;
      b.stillHolds = b.currentTokens == null ? null : b.currentTokens > b.tokenAmount * 0.01;
    }
    const firstBuyerSet = new Set((firstBuyers?.buyers ?? []).map((b: any) => b.wallet));
    for (const i of creatorReport?.insiders ?? []) {
      i.currentTokens = balanceOf.has(i.address) ? balanceOf.get(i.address) : null;
      i.isFirstBuyer = firstBuyerSet.has(i.address);
    }

    const payload = { chain, supported: true, token, symbol, totalSupply, creator: creatorReport, firstBuyers };
    cache.set(token, { at: Date.now(), value: payload });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build forensics' },
      { status: 500 },
    );
  }
}
