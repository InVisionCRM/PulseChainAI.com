import { NextRequest, NextResponse } from 'next/server';
import { hexSubgraphQuery, type HexNet as Net } from '@/lib/hex/subgraph';
import {
  classifyEnds, behaviorSummary,
  type StakeRecord, type OutflowRecord,
} from '@/lib/hex/whaleBehavior';

export const revalidate = 0;
// Pages the wallet's HEX transfer history + resolves DEX pairs over RPC.
export const maxDuration = 60;

// How far back to page the wallet's HEX transfers (bounds explorer calls). Ends
// older than the oldest transfer we see are reported "unknown", never guessed.
const MAX_TRANSFER_PAGES = 12;
// Cap the ends we return so a wallet with a huge history stays responsive.
const MAX_ENDS = 40;
// Cap unique counterparties we probe for DEX-pairness (bounds RPC calls).
const MAX_PAIR_PROBES = 80;

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

interface RawHist { stakeId?: string; timestamp?: unknown; stakedHearts?: unknown; transactionHash?: unknown }

function toRecords(rows: RawHist[]): StakeRecord[] {
  return (rows ?? [])
    .map((r) => ({
      stakeId: String(r.stakeId ?? ''),
      timestamp: num(r.timestamp),
      principalHex: num(r.stakedHearts) / 1e8,
      tx: r.transactionHash ? String(r.transactionHash) : undefined,
    }))
    .filter((r) => r.timestamp > 0);
}

/** Wallet's stake starts + ends (with tx) from the staking subgraph. */
async function stakeHistory(net: Net, addr: string): Promise<{ starts: StakeRecord[]; ends: StakeRecord[] }> {
  try {
    const d = await hexSubgraphQuery<{ stakeStarts: RawHist[]; stakeEnds: RawHist[] }>(
      net,
      `{ stakeStarts(where:{ stakerAddr: "${addr}" }, first: 1000){ stakeId timestamp stakedHearts transactionHash } stakeEnds(where:{ stakerAddr: "${addr}" }, first: 1000){ stakeId timestamp stakedHearts transactionHash } }`,
    );
    return { starts: toRecords(d.stakeStarts), ends: toRecords(d.stakeEnds) };
  } catch {
    return { starts: [], ends: [] };
  }
}

const tsOf = (iso: unknown) => {
  const ms = Date.parse(String(iso));
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
};
const lc = (a: unknown) => String(a ?? '').toLowerCase();

// HEX is the SAME contract on Ethereum and PulseChain (PulseChain forked it).
const HEX_TOKEN = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
const ZERO = '0x0000000000000000000000000000000000000000';

// Native, key-free PulseChain data: Blockscout indexes transfers; the public RPC
// answers token0()/token1() so we can tell a DEX pair from a plain wallet/CEX.
const EXPLORER: Record<Net, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
};
const RPC_URL: Record<Net, string> = {
  pulsechain: process.env.PULSECHAIN_RPC_URL || 'https://rpc.pulsechain.com',
  ethereum: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
};

interface RawTransfer { ts: number; to: string; toIsContract: boolean; hex: number; tx: string }

/** Page the wallet's HEX ERC-20 transfers from the explorer (indexed on-chain
 *  data). Returns OUT transfers only + the oldest transfer timestamp seen. */
async function hexTransfersOut(net: Net, addr: string): Promise<{ out: RawTransfer[]; oldestActivityTs: number | null }> {
  const out: RawTransfer[] = [];
  let oldest: number | null = null;
  let url: string | null = `${EXPLORER[net]}/addresses/${addr}/token-transfers?type=ERC-20&token=${HEX_TOKEN}`;

  for (let page = 0; page < MAX_TRANSFER_PAGES && url; page++) {
    let items: Record<string, unknown>[] = [];
    let next: Record<string, string> | null = null;
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) break;
      const j = await res.json();
      items = (j.items ?? []) as Record<string, unknown>[];
      next = (j.next_page_params ?? null) as Record<string, string> | null;
    } catch {
      break;
    }
    for (const it of items) {
      const ts = tsOf(it.timestamp);
      if (ts > 0) oldest = oldest == null ? ts : Math.min(oldest, ts);
      const from = lc((it.from as Record<string, unknown>)?.hash);
      const toObj = it.to as Record<string, unknown> | undefined;
      const to = lc(toObj?.hash);
      // Only outflows from this wallet, excluding stake mints/burns (to 0x0 or the
      // HEX contract) which are staking activity, not sells or transfers.
      if (from !== addr || to === ZERO || to === HEX_TOKEN || !to) continue;
      const total = it.total as Record<string, unknown> | undefined;
      const dec = num(total?.decimals) || 8;
      const hex = num(total?.value) / Math.pow(10, dec);
      if (hex > 0) out.push({ ts, to, toIsContract: !!toObj?.is_contract, hex, tx: String(it.transaction_hash ?? '') });
    }
    url = next && Object.keys(next).length ? `${EXPLORER[net]}/addresses/${addr}/token-transfers?type=ERC-20&token=${HEX_TOKEN}&${new URLSearchParams(next).toString()}` : null;
  }
  return { out, oldestActivityTs: oldest };
}

async function ethCall(net: Net, to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(RPC_URL[net], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.result === 'string' ? j.result : null;
  } catch {
    return null;
  }
}

const addrFromWord = (r: string | null) => (r && r.length >= 66 ? '0x' + r.slice(-40).toLowerCase() : null);

/**
 * Of the given contract addresses, which are DEX pairs that hold HEX — i.e. a
 * HEX transfer to them is a sale. Detected via UniswapV2 token0()/token1().
 */
async function detectHexPairs(net: Net, contracts: string[]): Promise<Set<string>> {
  const pairs = new Set<string>();
  await Promise.all(
    contracts.slice(0, MAX_PAIR_PROBES).map(async (c) => {
      const [t0, t1] = await Promise.all([ethCall(net, c, '0x0dfe1681'), ethCall(net, c, '0xd21220a7')]); // token0(), token1()
      const a0 = addrFromWord(t0);
      const a1 = addrFromWord(t1);
      if (a0 && a1 && (a0 === HEX_TOKEN || a1 === HEX_TOKEN)) pairs.add(c);
    }),
  );
  return pairs;
}

/**
 * Wallet's HEX outflows classified as DEX sells vs plain "moves", plus the oldest
 * HEX-transfer timestamp (activity-coverage boundary). All from native on-chain
 * data — no third-party keyed API.
 */
async function hexOutflows(net: Net, addr: string): Promise<{ outflows: OutflowRecord[]; oldestActivityTs: number | null }> {
  const { out, oldestActivityTs } = await hexTransfersOut(net, addr);
  const contracts = [...new Set(out.filter((t) => t.toIsContract).map((t) => t.to))];
  const pairs = await detectHexPairs(net, contracts);
  const outflows: OutflowRecord[] = out.map((t) => ({
    timestamp: t.ts,
    hex: t.hex,
    usd: 0, // explorer has no historical USD; the UI approximates with the live price
    tx: t.tx,
    kind: t.toIsContract && pairs.has(t.to) ? 'sell' : 'move',
  }));
  return { outflows, oldestActivityTs };
}

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;
  const address = (req.nextUrl.searchParams.get('address') || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  try {
    const [{ starts, ends }, { outflows, oldestActivityTs }] = await Promise.all([
      stakeHistory(net, address),
      hexOutflows(net, address),
    ]);

    const behavior = classifyEnds(ends, starts, outflows, oldestActivityTs).slice(0, MAX_ENDS);
    const summary = behaviorSummary(behavior);

    return NextResponse.json(
      { address, network: net, oldestActivityTs, behavior, summary },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load whale behavior' },
      { status: 500 },
    );
  }
}
