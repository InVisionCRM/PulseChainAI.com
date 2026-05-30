import { NextRequest, NextResponse } from 'next/server';
import {
  NATIVE_TOKEN_ADDRESS,
  WRAPPED_NATIVE,
  CHAIN_NATIVE_SYMBOL,
  type ChainId,
  type TokenFlow,
  type TxActionType,
  type WalletTransaction,
  type WalletHistoryResponse,
} from '@/services';
import { looksLikeSpamRaw } from '@/lib/portfolio/tokenVisibility';
import { labelFor, protocolFor } from '@/lib/portfolio/protocols';

// DeBank-style decoded transaction history for a wallet.
//
// Blockscout exposes the two halves of a "what happened" feed separately:
//   • /addresses/{a}/transactions   → method, gas, status, native value,
//                                     counterparty, decoded_input
//   • /addresses/{a}/token-transfers → the per-token ERC-20 movements
// We use transactions as the chronological spine (one page per request) and
// enrich each row with its token flows, matched by tx hash. Both endpoints
// are reverse-chronological, so we sweep transfer pages until they cover the
// transactions page's time window, then hand both cursors back to the client
// for "load more".
//
// v1 caveat: if a single transactions page references transfers deeper than
// MAX_TT_PAGES, the boundary rows render without their ERC-20 flow chips
// (the row still shows method / native value / gas / status). Acceptable for
// a first cut; a unified server index is the eventual fix.

const BLOCKSCOUT_BASE: Record<ChainId, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
};

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TT_PAGES = 4; // transfer pages swept per transactions page
const CACHE_TTL_MS = 20_000;
const ADDRESS_RX = /^0x[a-f0-9]{40}$/;

type PageParams = Record<string, string | number> | null;

interface Cursor {
  tx: PageParams;
  tt: PageParams;
}

// ── fetch helpers ───────────────────────────────────────────────────────

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

function withParams(base: string, params: PageParams): string {
  if (!params) return base;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null) sp.set(k, String(v));
  }
  const q = sp.toString();
  if (!q) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${q}`;
}

const tsOf = (iso: unknown): number => {
  if (typeof iso !== 'string') return 0;
  const n = new Date(iso).getTime();
  return Number.isFinite(n) ? n : 0;
};

// bigint-safe raw → human number (display precision only).
function formatUnits(raw: unknown, decimals: number): number {
  try {
    const big = BigInt(String(raw));
    const neg = big < 0n;
    const abs = neg ? -big : big;
    const divisor = 10n ** BigInt(decimals);
    const whole = abs / divisor;
    const frac = abs % divisor;
    const num = Number(whole) + Number(frac) / Number(divisor);
    return neg ? -num : num;
  } catch {
    return 0;
  }
}

const addrOf = (party: any): string =>
  String(party?.hash || party?.address_hash || party || '').toLowerCase();

const looksLikeLp = (symbol: string, name: string): boolean =>
  /(^|[^a-z])lp$/i.test(symbol) ||
  /\b(plp|plt)\b/i.test(symbol) ||
  /\blp\b/i.test(name) ||
  /liquidity/i.test(name);

// ── token-transfer sweep ────────────────────────────────────────────────

interface SweepResult {
  flowsByHash: Map<string, TokenFlow[]>;
  next: PageParams;
}

// Walk token-transfer pages from `start`, building wallet-centric flows
// (only legs where the wallet is sender or receiver), until we've covered
// `windowFloorTs` or hit the page cap. Returns the cursor to resume from.
async function sweepTransfers(
  chain: ChainId,
  wallet: string,
  start: PageParams,
  windowFloorTs: number,
): Promise<SweepResult> {
  const base = `${BLOCKSCOUT_BASE[chain]}/addresses/${wallet}/token-transfers?type=ERC-20`;
  const flowsByHash = new Map<string, TokenFlow[]>();
  let cursor: PageParams = start;
  let next: PageParams = start;

  for (let page = 0; page < MAX_TT_PAGES; page++) {
    const data = await fetchJson(withParams(base, cursor));
    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) {
      next = null;
      break;
    }

    let oldestTs = Number.POSITIVE_INFINITY;
    for (const it of items) {
      const ts = tsOf(it?.timestamp);
      if (ts > 0 && ts < oldestTs) oldestTs = ts;

      const from = addrOf(it?.from);
      const to = addrOf(it?.to);
      const direction: 'in' | 'out' | null =
        to === wallet ? 'in' : from === wallet ? 'out' : null;
      if (!direction) continue; // intermediate router↔pair hop — skip

      const hash = String(it?.transaction_hash || it?.tx_hash || '').toLowerCase();
      if (!hash) continue;

      const tk = it?.token || {};
      const decimals = Number(tk?.decimals ?? it?.total?.decimals ?? 18) || 18;
      const rawValue = it?.total?.value ?? it?.value ?? '0';
      const symbol = String(tk?.symbol || '???');
      const name = String(tk?.name || '');
      const rate = tk?.exchange_rate != null ? Number(tk.exchange_rate) : null;
      const amountFormatted = formatUnits(rawValue, decimals);

      const flow: TokenFlow = {
        direction,
        tokenAddress: String(tk?.address || tk?.address_hash || '').toLowerCase(),
        symbol,
        name: name || undefined,
        decimals,
        amountFormatted,
        logoURI: tk?.icon_url || undefined,
        isLp: looksLikeLp(symbol, name),
        valueUsd:
          rate != null && Number.isFinite(rate)
            ? amountFormatted * rate
            : undefined,
        isScam: looksLikeSpamRaw({
          name,
          symbol,
          hasPrice: rate != null && rate > 0,
          hasLogo: !!tk?.icon_url,
        }),
      };

      const list = flowsByHash.get(hash) ?? [];
      list.push(flow);
      flowsByHash.set(hash, list);
    }

    const np: PageParams =
      data?.next_page_params && typeof data.next_page_params === 'object'
        ? data.next_page_params
        : null;
    next = np;
    cursor = np;
    // Covered the transactions window (or no timestamps to compare) → stop.
    if (!np || (windowFloorTs > 0 && oldestTs <= windowFloorTs)) break;
  }

  return { flowsByHash, next };
}

// ── per-tx assembly ─────────────────────────────────────────────────────

// Collapse multiple legs of the same token+direction into one chip, summing
// amounts and USD — the user-facing net, like DeBank.
function aggregateFlows(flows: TokenFlow[]): TokenFlow[] {
  const byKey = new Map<string, TokenFlow>();
  for (const f of flows) {
    const key = `${f.direction}:${f.tokenAddress}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...f });
    } else {
      prev.amountFormatted += f.amountFormatted;
      if (f.valueUsd != null) prev.valueUsd = (prev.valueUsd ?? 0) + f.valueUsd;
    }
  }
  // Inflows first, then outflows (matches the UI's stacking).
  return [...byKey.values()].sort((a, b) =>
    a.direction === b.direction ? 0 : a.direction === 'in' ? -1 : 1,
  );
}

function deriveAction(
  methodRaw: string,
  toIsWrapped: boolean,
  hasIn: boolean,
  hasOut: boolean,
): TxActionType {
  const m = methodRaw.toLowerCase();
  if (m.startsWith('approve')) return 'approve';
  if (m.includes('addliquidity')) return 'add_lp';
  if (m.includes('removeliquidity')) return 'remove_lp';
  if (toIsWrapped && m.startsWith('deposit')) return 'wrap';
  if (toIsWrapped && m.startsWith('withdraw')) return 'unwrap';
  if (/claim|getreward|harvest/.test(m)) return 'claim';
  if (/unstake|unstak|exit|withdraw/.test(m) && (hasIn || hasOut)) return 'unstake';
  if (/stake|enterstak|lock/.test(m)) return 'stake';
  if (hasIn && hasOut) return 'swap';
  if (hasOut) return 'send';
  if (hasIn) return 'receive';
  return 'contract';
}

function assembleTx(
  chain: ChainId,
  wallet: string,
  tx: any,
  flowsByHash: Map<string, TokenFlow[]>,
): WalletTransaction | null {
  const hash = String(tx?.hash || '').toLowerCase();
  if (!hash) return null;

  const from = addrOf(tx?.from);
  const to = addrOf(tx?.to);
  const timestamp = tsOf(tx?.timestamp);

  const flows: TokenFlow[] = [...(flowsByHash.get(hash) ?? [])];

  // Native value leg (PLS/ETH moved by the tx itself).
  const nativeRaw = String(tx?.value ?? '0');
  if (nativeRaw !== '0' && nativeRaw !== '') {
    const dir: 'in' | 'out' | null =
      from === wallet ? 'out' : to === wallet ? 'in' : null;
    if (dir) {
      flows.push({
        direction: dir,
        tokenAddress: NATIVE_TOKEN_ADDRESS,
        symbol: CHAIN_NATIVE_SYMBOL[chain],
        decimals: 18,
        amountFormatted: formatUnits(nativeRaw, 18),
        isNative: true,
      });
    }
  }

  const aggregated = aggregateFlows(flows);
  const hasIn = aggregated.some((f) => f.direction === 'in');
  const hasOut = aggregated.some((f) => f.direction === 'out');

  const methodRaw = String(tx?.method || tx?.decoded_input?.method_call || '');
  const toIsWrapped = to === WRAPPED_NATIVE[chain];
  const action = deriveAction(methodRaw, toIsWrapped, hasIn, hasOut);

  // Counterparty: the "other side" for plain transfers, else the contract.
  let counterparty: string | undefined;
  let cpName: string | null = null;
  if (action === 'receive') {
    counterparty = from || undefined;
    cpName = tx?.from?.name || null;
  } else {
    counterparty = to || undefined;
    cpName = tx?.to?.name || null;
  }

  // Status — show failures (the user explicitly wanted them).
  const result = tx?.result;
  const status: WalletTransaction['status'] =
    tx?.status === 'error' || (typeof result === 'string' && result !== 'success' && result !== '')
      ? 'failed'
      : 'success';

  // Gas is only paid by the sender.
  let gasFeeNative: number | undefined;
  if (from === wallet) {
    const feeVal = tx?.fee?.value;
    if (feeVal != null) {
      gasFeeNative = formatUnits(feeVal, 18);
    } else if (tx?.gas_used != null && tx?.gas_price != null) {
      try {
        gasFeeNative = formatUnits(
          (BigInt(String(tx.gas_used)) * BigInt(String(tx.gas_price))).toString(),
          18,
        );
      } catch {
        /* leave undefined */
      }
    }
  }

  const proto = protocolFor(chain, counterparty);
  const isScam = aggregated.some((f) => f.isScam);

  return {
    hash,
    chain,
    timestamp,
    action,
    method: methodRaw || undefined,
    status,
    flows: aggregated,
    counterparty,
    counterpartyLabel: labelFor(chain, counterparty, cpName),
    protocol: proto ? { name: proto.name, kind: proto.kind } : undefined,
    gasFeeNative,
    isScam,
  };
}

// ── tiny first-page cache ───────────────────────────────────────────────

const cache = new Map<string, { payload: WalletHistoryResponse; at: number }>();

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const chain: ChainId = body?.chain === 'ethereum' ? 'ethereum' : 'pulsechain';
  const wallet = String(body?.address || '').trim().toLowerCase();
  if (!ADDRESS_RX.test(wallet)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  const cursor: Cursor =
    body?.cursor && typeof body.cursor === 'object'
      ? { tx: body.cursor.tx ?? null, tt: body.cursor.tt ?? null }
      : { tx: null, tt: null };
  const isFirstPage = !cursor.tx && !cursor.tt;

  if (isFirstPage) {
    const hit = cache.get(`${chain}:${wallet}`);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return NextResponse.json(hit.payload);
    }
  }

  // Spine: one transactions page.
  const txBase = `${BLOCKSCOUT_BASE[chain]}/addresses/${wallet}/transactions`;
  const txData = await fetchJson(withParams(txBase, cursor.tx));
  const txItems: any[] = Array.isArray(txData?.items) ? txData.items : [];

  // Sweep transfers to cover this page's oldest timestamp.
  const windowFloorTs = txItems.reduce((min, tx) => {
    const ts = tsOf(tx?.timestamp);
    return ts > 0 && ts < min ? ts : min;
  }, Number.POSITIVE_INFINITY);
  const sweep = await sweepTransfers(
    chain,
    wallet,
    cursor.tt,
    Number.isFinite(windowFloorTs) ? windowFloorTs : 0,
  );

  const items = txItems
    .map((tx) => assembleTx(chain, wallet, tx, sweep.flowsByHash))
    .filter((x): x is WalletTransaction => x !== null)
    .sort((a, b) => b.timestamp - a.timestamp);

  const txNext: PageParams =
    txData?.next_page_params && typeof txData.next_page_params === 'object'
      ? txData.next_page_params
      : null;
  const nextCursor: Cursor | null =
    txNext || sweep.next ? { tx: txNext, tt: sweep.next } : null;

  const payload: WalletHistoryResponse = {
    chain,
    address: wallet,
    items,
    nextCursor,
    fetchedAt: Date.now(),
  };

  if (isFirstPage) {
    cache.set(`${chain}:${wallet}`, { payload, at: Date.now() });
  }

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'private, max-age=15' },
  });
}
