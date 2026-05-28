import { NextRequest, NextResponse } from 'next/server';

// Token-approval inventory for a given wallet. Walks the wallet's
// outbound transactions filtered to the ERC-20 approve() selector, keeps
// the most-recent approval per (token, spender), and returns any whose
// allowance is still non-zero. Token metadata is enriched per address
// from Blockscout's tokens endpoint. Revoking is delegated to revoke.cash
// via per-row deeplinks — we don't write transactions from the app.

type ChainId = 'ethereum' | 'pulsechain';

const BLOCKSCOUT_BASE: Record<ChainId, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
};

// Anything above this is functionally "unlimited" (real ERC-20 supplies
// don't reach 1e60). Bigger than 2**200, smaller than 2**256.
const UNLIMITED_THRESHOLD = 10n ** 60n;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_TOKEN_INFO_LOOKUPS = 30;
// Blockscout V2 doesn't accept a method/method_id filter on the
// transactions endpoint (returns 422), so we fetch outbound txs in
// pages and filter for approve() client-side. Cap at a few pages so we
// don't spend forever on busy addresses.
const MAX_TX_PAGES = 6;

interface ApprovalEntry {
  token: {
    address: string;
    symbol: string | null;
    name: string | null;
    logoURI: string | null;
  };
  spender: string;
  spenderName: string | null;
  amount: string;
  isUnlimited: boolean;
  updatedAt: number;
  txHash: string;
}

const ADDRESS_RX = /^0x[a-f0-9]{40}$/;

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function buildTxUrl(
  chain: ChainId,
  address: string,
  next: Record<string, string | number> | null,
): string {
  const base = `${BLOCKSCOUT_BASE[chain]}/addresses/${address}/transactions?filter=from`;
  if (!next) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) params.set(k, String(v));
  return `${base}&${params.toString()}`;
}

function isApprove(tx: any): boolean {
  // Prefer the explorer's decoded method name; fall back to the raw call
  // signature on decoded_input for older blocks where method is absent.
  if (tx?.method === 'approve') return true;
  const call = tx?.decoded_input?.method_call;
  return typeof call === 'string' && call.startsWith('approve(');
}

async function fetchApprovalTxs(chain: ChainId, address: string): Promise<any[]> {
  // Blockscout V2 ignores (in fact 422s on) method/method_id filters on
  // the address transactions endpoint, so we walk pages of outbound txs
  // and filter for approve() client-side. Cap at MAX_TX_PAGES so we
  // don't spend forever on heavy wallets.
  const approves: any[] = [];
  let next: Record<string, string | number> | null = null;
  for (let i = 0; i < MAX_TX_PAGES; i++) {
    const r = await fetchWithTimeout(buildTxUrl(chain, address, next));
    if (!r || !r.ok) break;
    let d: any;
    try {
      d = await r.json();
    } catch {
      break;
    }
    const items = Array.isArray(d?.items) ? d.items : [];
    for (const tx of items) if (isApprove(tx)) approves.push(tx);
    const np = d?.next_page_params;
    if (!np || typeof np !== 'object') break;
    next = np;
  }
  return approves;
}

interface ParsedApprove {
  tokenAddress: string;
  tokenNameFromTx: string | null;
  spender: string;
  spenderNameFromTx: string | null;
  amount: string;
  txHash: string;
  ts: number;
}

function parseApprove(tx: any): ParsedApprove | null {
  const params = tx?.decoded_input?.parameters;
  if (!Array.isArray(params) || params.length < 2) return null;

  // Blockscout occasionally varies parameter ordering for non-standard
  // approves; identify by name when possible, else fall back to positional.
  const spenderParam = params.find((p: any) => /spender|guy|usr/i.test(p?.name)) ?? params[0];
  const amountParam = params.find((p: any) => /amount|value|wad|rawAmount/i.test(p?.name)) ?? params[1];

  const spender = String(spenderParam?.value || '').toLowerCase();
  if (!ADDRESS_RX.test(spender)) return null;

  const amount = String(amountParam?.value ?? '0');
  const tokenAddress = String(tx?.to?.hash || '').toLowerCase();
  if (!ADDRESS_RX.test(tokenAddress)) return null;

  const ts = tx?.timestamp ? new Date(tx.timestamp).getTime() : 0;
  if (!Number.isFinite(ts) || ts <= 0) return null;

  return {
    tokenAddress,
    tokenNameFromTx: tx?.to?.name || null,
    spender,
    spenderNameFromTx: tx?.decoded_input?.parameters?.[0]?.name || null,
    amount,
    txHash: tx?.hash || '',
    ts,
  };
}

async function fetchTokenInfo(chain: ChainId, address: string): Promise<any | null> {
  const r = await fetchWithTimeout(`${BLOCKSCOUT_BASE[chain]}/tokens/${address}`);
  if (!r || !r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchAddressName(
  chain: ChainId,
  address: string,
): Promise<string | null> {
  const r = await fetchWithTimeout(`${BLOCKSCOUT_BASE[chain]}/addresses/${address}`);
  if (!r || !r.ok) return null;
  try {
    const d = await r.json();
    return (
      d?.name ||
      d?.public_tags?.[0]?.display_name ||
      d?.private_tags?.[0]?.display_name ||
      null
    );
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const chain: ChainId = body?.chain === 'ethereum' ? 'ethereum' : 'pulsechain';
  const address = String(body?.address || '').trim().toLowerCase();
  if (!ADDRESS_RX.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  const txs = await fetchApprovalTxs(chain, address);
  if (txs.length === 0) {
    return NextResponse.json({ approvals: [] });
  }

  // Keep the most-recent approve per (token, spender)
  const latest = new Map<string, ParsedApprove>();
  for (const tx of txs) {
    const parsed = parseApprove(tx);
    if (!parsed) continue;
    const key = `${parsed.tokenAddress}:${parsed.spender}`;
    const prev = latest.get(key);
    if (!prev || parsed.ts > prev.ts) latest.set(key, parsed);
  }

  // Drop revoked (amount === 0)
  const active = [...latest.values()].filter((a) => {
    try {
      return BigInt(a.amount) > 0n;
    } catch {
      return false;
    }
  });

  if (active.length === 0) {
    return NextResponse.json({ approvals: [] });
  }

  // Enrich tokens in parallel, bounded
  const tokenAddresses = Array.from(new Set(active.map((a) => a.tokenAddress)));
  const lookups = tokenAddresses.slice(0, MAX_TOKEN_INFO_LOOKUPS);
  const tokenInfos = await Promise.all(
    lookups.map(async (addr) => [addr, await fetchTokenInfo(chain, addr)] as const),
  );
  const tokenInfoMap = Object.fromEntries(tokenInfos);

  // Spender names: only fetch a few uniques to avoid spamming the explorer
  const spenderAddresses = Array.from(new Set(active.map((a) => a.spender)));
  const spenderNames = await Promise.all(
    spenderAddresses
      .slice(0, MAX_TOKEN_INFO_LOOKUPS)
      .map(async (addr) => [addr, await fetchAddressName(chain, addr)] as const),
  );
  const spenderNameMap = Object.fromEntries(spenderNames);

  const approvals: ApprovalEntry[] = active
    .map((a) => {
      const info = tokenInfoMap[a.tokenAddress] || {};
      let isUnlimited = false;
      try {
        isUnlimited = BigInt(a.amount) > UNLIMITED_THRESHOLD;
      } catch {
        // leave false
      }
      return {
        token: {
          address: a.tokenAddress,
          symbol: info?.symbol || null,
          name: info?.name || a.tokenNameFromTx || null,
          logoURI: info?.icon_url || null,
        },
        spender: a.spender,
        spenderName: spenderNameMap[a.spender] || null,
        amount: a.amount,
        isUnlimited,
        updatedAt: a.ts,
        txHash: a.txHash,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return NextResponse.json(
    { approvals, chain },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
