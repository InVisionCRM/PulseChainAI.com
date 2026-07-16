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
  type HistoryCursor,
} from '@/services';
import { looksLikeSpamRaw } from '@/lib/portfolio/tokenVisibility';
import { labelFor, protocolFor } from '@/lib/portfolio/protocols';
import { fetchUsdPrices } from '@/lib/portfolio/dexPrices';

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
  robinhood: 'https://robinhoodchain.blockscout.com/api/v2',
};

// Trimmed from 10s → 8s: fail a bit faster on a slow/down explorer without
// cutting off legitimately slow-but-successful responses (this route has no
// RPC fallback — an RPC can't return decoded tx history).
const FETCH_TIMEOUT_MS = 8_000;
const MAX_TT_PAGES = 4; // transfer pages swept per transactions page
const CACHE_TTL_MS = 20_000;
const ADDRESS_RX = /^0x[a-f0-9]{40}$/;

type PageParams = Record<string, string | number> | null;

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

interface PathResult {
  items: WalletTransaction[];
  nextCursor: HistoryCursor | null;
}

// ── Blockscout path ─────────────────────────────────────────────────────

async function fetchViaBlockscout(
  chain: ChainId,
  wallet: string,
  cursor: HistoryCursor | null,
): Promise<PathResult> {
  // Spine: one transactions page.
  const txBase = `${BLOCKSCOUT_BASE[chain]}/addresses/${wallet}/transactions`;
  const txData = await fetchJson(withParams(txBase, cursor?.tx ?? null));
  const txItems: any[] = Array.isArray(txData?.items) ? txData.items : [];

  // Sweep transfers to cover this page's oldest timestamp.
  const windowFloorTs = txItems.reduce((min, tx) => {
    const ts = tsOf(tx?.timestamp);
    return ts > 0 && ts < min ? ts : min;
  }, Number.POSITIVE_INFINITY);
  const sweep = await sweepTransfers(
    chain,
    wallet,
    cursor?.tt ?? null,
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
  const nextCursor: HistoryCursor | null =
    txNext || sweep.next
      ? { source: 'blockscout', tx: txNext, tt: sweep.next }
      : null;

  return { items, nextCursor };
}

// ── Otterscan path — PulseChain primary ─────────────────────────────────
//
// PulseChain's Blockscout host is unreliable, so we read history straight
// from g4mm4's Erigon archive node via the Otterscan ots_* namespace. Its
// address index covers sender, receiver, AND log participants, so inbound
// ERC-20 receives are included (verified). We decode receipt logs into flows
// and resolve token symbol/decimals via eth_call (cached module-wide).

const OTTERSCAN_RPC = 'https://rpc-pulsechain.g4mm4.io';
const OTS_PAGE_SIZE = 25;
const RPC_TIMEOUT_MS = 12_000;
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DECIMALS_SELECTOR = '0x313ce567';
const SYMBOL_SELECTOR = '0x95d89b41';

// 4-byte selector → friendly method label. deriveAction() pattern-matches on
// these, so covering the common ERC-20 / PulseX-router calls is what counts.
const SELECTOR_METHODS: Record<string, string> = {
  '0xa9059cbb': 'transfer',
  '0x23b872dd': 'transferFrom',
  '0x095ea7b3': 'approve',
  '0xd0e30db0': 'deposit',
  '0x2e1a7d4d': 'withdraw',
  '0x38ed1739': 'swapExactTokensForTokens',
  '0x7ff36ab5': 'swapExactETHForTokens',
  '0x18cbafe5': 'swapExactTokensForETH',
  '0x8803dbee': 'swapTokensForExactTokens',
  '0xfb3bdb41': 'swapETHForExactTokens',
  '0x4a25d94a': 'swapTokensForExactETH',
  '0x5c11d795': 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
  '0xb6f9de95': 'swapExactETHForTokensSupportingFeeOnTransferTokens',
  '0x791ac947': 'swapExactTokensForETHSupportingFeeOnTransferTokens',
  '0xe8e33700': 'addLiquidity',
  '0xf305d719': 'addLiquidityETH',
  '0xbaa2abde': 'removeLiquidity',
  '0x02751cec': 'removeLiquidityETH',
  '0xaf2979eb': 'removeLiquidityETHSupportingFeeOnTransferTokens',
  '0xded9382a': 'removeLiquidityETHWithPermit',
  '0xac9650d8': 'multicall',
  '0x5ae401dc': 'multicall',
  '0x3593564c': 'execute',
  // Mint / burn — also detected structurally from zero-address Transfer legs.
  '0x40c10f19': 'mint',
  '0xa0712d68': 'mint',
  '0x42966c68': 'burn',
  '0x9dc29fac': 'burn',
  '0x79cc6790': 'burnFrom',
};

// Best-effort 4-byte selector → function signature, via the ethereum-lists
// mirror (the 4byte.directory API is blocked from our egress). So an unknown
// call shows its real name ("stakeEnd(uint256,uint40)") instead of a raw
// selector. Cached process-wide; misses cache null so we don't re-fetch them.
const SIG_BASE = 'https://raw.githubusercontent.com/ethereum-lists/4bytes/master/signatures';
const SIG_TIMEOUT_MS = 3500;
const MAX_SIG_LOOKUPS = 50;
const sigCache = new Map<string, string | null>();

async function resolveSignature(selector: string): Promise<string | null> {
  const key = selector.toLowerCase();
  if (sigCache.has(key)) return sigCache.get(key) ?? null;
  let sig: string | null = null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), SIG_TIMEOUT_MS);
  try {
    const r = await fetch(`${SIG_BASE}/${key.replace(/^0x/, '')}`, { signal: controller.signal });
    if (r.ok) {
      // Collisions are ';'-separated; the first entry is the canonical one.
      const text = (await r.text()).trim();
      sig = text.split(';')[0]?.trim() || null;
    }
  } catch {
    sig = null;
  } finally {
    clearTimeout(t);
  }
  sigCache.set(key, sig);
  return sig;
}

const RAW_SELECTOR_RX = /^0x[0-9a-f]{8}$/;

// Replace raw-selector method labels with real signatures, in place. Unique
// selectors are resolved once (deduped, in parallel, cached) so the cost is
// bounded; a newly-known name can also sharpen a generic 'contract' action.
async function enrichMethods(items: WalletTransaction[]): Promise<void> {
  const selectors = [
    ...new Set(items.map((it) => it.method).filter((m): m is string => !!m && RAW_SELECTOR_RX.test(m))),
  ].slice(0, MAX_SIG_LOOKUPS);
  if (selectors.length === 0) return;

  const resolved = new Map<string, string>();
  await Promise.all(
    selectors.map(async (sel) => {
      const sig = await resolveSignature(sel);
      if (sig) resolved.set(sel, sig);
    }),
  );
  if (resolved.size === 0) return;

  for (const it of items) {
    const sig = it.method && resolved.get(it.method);
    if (!sig) continue;
    it.method = sig;
    if (it.action === 'contract') {
      const hasIn = it.flows.some((f) => f.direction === 'in');
      const hasOut = it.flows.some((f) => f.direction === 'out');
      it.action = deriveAction(sig, false, hasIn, hasOut);
    }
  }
}

const hexToBig = (h: unknown): bigint => {
  try {
    return BigInt(String(h));
  } catch {
    return 0n;
  }
};

async function rpc(method: string, params: unknown[]): Promise<any | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const r = await fetch(OTTERSCAN_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    if (!r.ok) return null;
    const d: any = await r.json();
    return d?.error || d?.result === undefined ? null : d.result;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function rpcBatch(
  calls: { method: string; params: unknown[] }[],
): Promise<(any | null)[]> {
  if (calls.length === 0) return [];
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const body = calls.map((c, i) => ({
      jsonrpc: '2.0',
      id: i,
      method: c.method,
      params: c.params,
    }));
    const r = await fetch(OTTERSCAN_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!r.ok) return calls.map(() => null);
    const arr: any = await r.json();
    if (!Array.isArray(arr)) return calls.map(() => null);
    const out: (any | null)[] = new Array(calls.length).fill(null);
    for (const x of arr) {
      if (typeof x?.id === 'number' && x.id < out.length) {
        out[x.id] = x?.error || x?.result === undefined ? null : x.result;
      }
    }
    return out;
  } catch {
    return calls.map(() => null);
  } finally {
    clearTimeout(t);
  }
}

// Decode a symbol() return — ABI dynamic string, or legacy bytes32.
function decodeAbiString(hex: unknown): string {
  if (typeof hex !== 'string' || !hex.startsWith('0x')) return '';
  const data = hex.slice(2);
  if (data.length === 0) return '';
  if (data.length >= 128) {
    const len = parseInt(data.slice(64, 128), 16);
    if (Number.isFinite(len) && len > 0 && len <= 128 && data.length >= 128 + len * 2) {
      try {
        const s = Buffer.from(data.slice(128, 128 + len * 2), 'hex')
          .toString('utf8')
          .replace(/\0+$/, '')
          .trim();
        if (s) return s;
      } catch {
        /* fall through to bytes32 */
      }
    }
  }
  try {
    const s = Buffer.from(data.slice(0, 64), 'hex')
      .toString('utf8')
      .replace(/\0+$/, '')
      .trim();
    return /^[\x20-\x7e]+$/.test(s) ? s : '';
  } catch {
    return '';
  }
}

interface TokenMeta {
  symbol: string;
  decimals: number;
}
const tokenMetaCache = new Map<string, TokenMeta>();

async function resolveTokenMeta(addresses: string[]): Promise<void> {
  const missing = [...new Set(addresses.map((a) => a.toLowerCase()))].filter(
    (a) => a && !tokenMetaCache.has(a),
  );
  if (missing.length === 0) return;
  const calls = missing.flatMap((addr) => [
    { method: 'eth_call', params: [{ to: addr, data: DECIMALS_SELECTOR }, 'latest'] },
    { method: 'eth_call', params: [{ to: addr, data: SYMBOL_SELECTOR }, 'latest'] },
  ]);
  const res = await rpcBatch(calls);
  missing.forEach((addr, i) => {
    const decHex = res[i * 2];
    let decimals = 18;
    if (typeof decHex === 'string' && decHex !== '0x') {
      const d = parseInt(decHex, 16);
      if (Number.isFinite(d) && d >= 0 && d <= 36) decimals = d;
    }
    const symbol = decodeAbiString(res[i * 2 + 1]) || `${addr.slice(0, 6)}…`;
    tokenMetaCache.set(addr, { symbol, decimals });
  });
}

function assembleFromOts(wallet: string, tx: any, receipt: any): WalletTransaction | null {
  const hash = String(tx?.hash || '').toLowerCase();
  if (!hash) return null;
  const from = String(tx?.from || '').toLowerCase();
  const to = String(tx?.to || '').toLowerCase();
  const timestamp = Number(receipt?.timestamp ?? 0) * 1000;

  // Flows from receipt logs — ERC-20 Transfer where the wallet is a party.
  // Capture the "other party" so plain sends/receives show the real
  // counterparty (the log peer) instead of the tx's `to` (the token contract).
  const rawFlows: TokenFlow[] = [];
  let outPeer: string | undefined;
  let inPeer: string | undefined;
  // Token created (Transfer from 0x0 → wallet) or destroyed (wallet → 0x0).
  let mintedIn = false;
  let burnedOut = false;
  const ZERO = '0x0000000000000000000000000000000000000000';
  const logs: any[] = Array.isArray(receipt?.logs) ? receipt.logs : [];
  for (const log of logs) {
    const topics: string[] = Array.isArray(log?.topics) ? log.topics : [];
    if (topics.length !== 3 || topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
    const lfrom = ('0x' + topics[1].slice(26)).toLowerCase();
    const lto = ('0x' + topics[2].slice(26)).toLowerCase();
    const direction: 'in' | 'out' | null =
      lto === wallet ? 'in' : lfrom === wallet ? 'out' : null;
    if (!direction) continue;
    if (direction === 'out' && !outPeer) outPeer = lto;
    if (direction === 'in' && !inPeer) inPeer = lfrom;
    if (direction === 'in' && lfrom === ZERO) mintedIn = true;
    if (direction === 'out' && lto === ZERO) burnedOut = true;
    const token = String(log?.address || '').toLowerCase();
    const meta = tokenMetaCache.get(token) || {
      symbol: `${token.slice(0, 6)}…`,
      decimals: 18,
    };
    rawFlows.push({
      direction,
      tokenAddress: token,
      symbol: meta.symbol,
      decimals: meta.decimals,
      amountFormatted: formatUnits(hexToBig(log?.data).toString(), meta.decimals),
      isLp: looksLikeLp(meta.symbol, ''),
      isScam: looksLikeSpamRaw({
        name: meta.symbol,
        symbol: meta.symbol,
        hasPrice: false,
        hasLogo: false,
      }),
    });
  }

  // Native value leg.
  const nativeBig = hexToBig(tx?.value);
  if (nativeBig > 0n) {
    const dir: 'in' | 'out' | null =
      from === wallet ? 'out' : to === wallet ? 'in' : null;
    if (dir) {
      rawFlows.push({
        direction: dir,
        tokenAddress: NATIVE_TOKEN_ADDRESS,
        symbol: CHAIN_NATIVE_SYMBOL.pulsechain,
        decimals: 18,
        amountFormatted: formatUnits(nativeBig.toString(), 18),
        isNative: true,
      });
    }
  }

  const flows = aggregateFlows(rawFlows);
  const hasIn = flows.some((f) => f.direction === 'in');
  const hasOut = flows.some((f) => f.direction === 'out');

  const input = String(tx?.input || tx?.data || '');
  const selector = input.slice(0, 10).toLowerCase();
  const method = SELECTOR_METHODS[selector];
  const toIsWrapped = to === WRAPPED_NATIVE.pulsechain;
  // Mint/burn (zero-address Transfer) take precedence over the flow-based guess
  // — e.g. HEX minted to you on stake-end, or tokens you sent to the burn address.
  const action: TxActionType =
    burnedOut && !hasIn ? 'burn' : mintedIn && !hasOut ? 'mint' : deriveAction(method || '', toIsWrapped, hasIn, hasOut);

  const status: WalletTransaction['status'] =
    receipt?.status === '0x0' || receipt?.status === 0 ? 'failed' : 'success';

  // Gas is only paid by the sender.
  let gasFeeNative: number | undefined;
  if (from === wallet) {
    const gasUsed = hexToBig(receipt?.gasUsed);
    const gasPrice = hexToBig(receipt?.effectiveGasPrice ?? tx?.gasPrice);
    if (gasUsed > 0n && gasPrice > 0n) {
      gasFeeNative = formatUnits((gasUsed * gasPrice).toString(), 18);
    }
  }

  // Prefer the real log peer; ignore mint/burn (zero address) and self, where
  // the meaningful counterparty is the contract the wallet interacted with.
  const realPeer = (p: string | undefined) =>
    p && p !== ZERO && p !== wallet ? p : undefined;
  const counterparty =
    action === 'send'
      ? (realPeer(outPeer) ?? to) || undefined
      : action === 'receive'
        ? (realPeer(inPeer) ?? (from !== wallet ? from : to)) || undefined
        : to || undefined;
  const proto = protocolFor('pulsechain', counterparty);

  return {
    hash,
    chain: 'pulsechain',
    timestamp,
    action,
    method: method || (selector.length === 10 && selector !== '0x' ? selector : undefined),
    status,
    flows,
    counterparty,
    counterpartyLabel: labelFor('pulsechain', counterparty, null),
    protocol: proto ? { name: proto.name, kind: proto.kind } : undefined,
    gasFeeNative,
    isScam: flows.some((f) => f.isScam),
  };
}

// Returns null (not an empty page) when the node is unreachable, so the
// caller can fall back to Blockscout.
async function fetchViaOtterscan(
  wallet: string,
  startBlock: number | null,
): Promise<PathResult | null> {
  const res = await rpc('ots_searchTransactionsBefore', [
    wallet,
    startBlock ?? 0,
    OTS_PAGE_SIZE,
  ]);
  if (!res || !Array.isArray(res.txs)) return null;

  const txs: any[] = res.txs;
  const receipts: any[] = Array.isArray(res.receipts) ? res.receipts : [];
  const rcByHash = new Map<string, any>();
  for (const rc of receipts) {
    const h = String(rc?.transactionHash || '').toLowerCase();
    if (h) rcByHash.set(h, rc);
  }

  // One batched eth_call sweep for every token touched on this page.
  const tokenAddrs: string[] = [];
  for (const rc of receipts) {
    for (const log of rc?.logs || []) {
      if (
        Array.isArray(log?.topics) &&
        log.topics.length === 3 &&
        log.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
        log?.address
      ) {
        tokenAddrs.push(String(log.address).toLowerCase());
      }
    }
  }
  await resolveTokenMeta(tokenAddrs);

  const items = txs
    .map((tx) =>
      assembleFromOts(wallet, tx, rcByHash.get(String(tx?.hash || '').toLowerCase())),
    )
    .filter((x): x is WalletTransaction => x !== null)
    .sort((a, b) => b.timestamp - a.timestamp);

  // Current-USD pricing (DexScreener) for flows — the Otterscan path has no
  // exchange_rate like Blockscout does. Native PLS prices via WPLS.
  const priceAddrs: string[] = [];
  for (const it of items) {
    for (const f of it.flows) {
      priceAddrs.push(f.isNative ? WRAPPED_NATIVE.pulsechain : f.tokenAddress);
    }
  }
  const prices = await fetchUsdPrices(priceAddrs);
  for (const it of items) {
    for (const f of it.flows) {
      if (f.valueUsd != null) continue;
      const addr = (f.isNative ? WRAPPED_NATIVE.pulsechain : f.tokenAddress).toLowerCase();
      const p = prices.get(addr);
      if (p != null) f.valueUsd = f.amountFormatted * p;
    }
  }

  let nextCursor: HistoryCursor | null = null;
  if (!res.lastPage && txs.length > 0) {
    const minBlock = txs.reduce((m, t) => {
      const b = Number(hexToBig(t?.blockNumber));
      return b > 0 && b < m ? b : m;
    }, Number.POSITIVE_INFINITY);
    if (Number.isFinite(minBlock)) nextCursor = { source: 'otterscan', block: minBlock };
  }
  return { items, nextCursor };
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

  const chain: ChainId = body?.chain === 'ethereum' ? 'ethereum' : body?.chain === 'robinhood' ? 'robinhood' : 'pulsechain';
  const wallet = String(body?.address || '').trim().toLowerCase();
  if (!ADDRESS_RX.test(wallet)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  const cursor: HistoryCursor | null =
    body?.cursor && typeof body.cursor === 'object' ? body.cursor : null;
  const isFirstPage = !cursor;

  if (isFirstPage) {
    const hit = cache.get(`${chain}:${wallet}`);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return NextResponse.json(hit.payload);
    }
  }

  let result: PathResult;
  if (chain === 'pulsechain' && cursor?.source !== 'blockscout') {
    // PulseChain primary: Otterscan on g4mm4's Erigon node. Fall back to
    // Blockscout (fresh first page) only if the node is unreachable.
    const ots = await fetchViaOtterscan(wallet, cursor?.block ?? null);
    result = ots ?? (await fetchViaBlockscout('pulsechain', wallet, null));
  } else {
    result = await fetchViaBlockscout(chain, wallet, cursor);
  }

  // Turn any remaining raw 4-byte selectors into real function names.
  await enrichMethods(result.items);

  const payload: WalletHistoryResponse = {
    chain,
    address: wallet,
    items: result.items,
    nextCursor: result.nextCursor,
    fetchedAt: Date.now(),
  };

  if (isFirstPage) {
    cache.set(`${chain}:${wallet}`, { payload, at: Date.now() });
  }

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'private, max-age=15' },
  });
}
