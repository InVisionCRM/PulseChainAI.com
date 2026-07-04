import { NextRequest, NextResponse } from 'next/server';
import { getCreationDateViaRpc } from '@/lib/geicko/rpcHolders';

const CACHE_DURATION = 120; // 2 minutes cache
const BASE_URL = 'https://api.scan.pulsechain.com/api/v2';

interface TokenMetrics {
  burnedTokens: {
    amount: number;
    percent: number;
  } | null;
  holdersCount: number | null;
  creationDate: string | null;
  supplyHeld: {
    top10: number;
    top20: number;
    top50: number;
  };
  smartContractHolderShare: {
    percent: number;
    contractCount: number;
    /** @deprecated Use contractHolders for rich tooltip data */
    contractAddresses: string[];
    /** Per-holder details: address, value (raw), percent of supply, type (LP | Contract) */
    contractHolders: Array<{
      address: string;
      value: string;
      percent: number;
      type: 'LP' | 'Contract';
    }>;
  };
  ownershipData: {
    creatorAddress: string | null;
    ownerAddress: string | null;
    isRenounced: boolean;
    renounceTxHash: string | null;
    /** Creation tx "to" address — used to detect pump.tires tokens launched via factory (user called factory) */
    creationTxTo: string | null;
    /** True when token was created by or via a known Pump.tires contract (shows badge) */
    isPumpTiresToken: boolean;
  };
  totalSupply: {
    supply: string;
    decimals: number;
  } | null;
}

const PUMP_TIRES_CREATOR = '0x6538A83a81d855B965983161AF6a83e616D16fD5';

const isBurnAddress = (addr: string): boolean => {
  const lower = (addr || '').toLowerCase();
  return (
    lower.endsWith('dead') ||
    lower.endsWith('0000') ||
    lower.endsWith('0369') ||
    lower.endsWith('000369')
  );
};

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: CACHE_DURATION }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Fetch the top-N holders once per request and share the response between
// calculateBurnedTokens / calculateSupplyHeld / calculateSmartContractShare.
// Previously each branch made its own call (3× PulseScan calls for the
// same data), and burned-tokens paginated 10 pages sequentially. For
// every token we've sampled the burn-address holder is in the top 50
// anyway, so a single 50-row page is sufficient and drops the slowest
// branch from up-to-10 sequential calls to one.
type HoldersItem = {
  address?: { hash?: string; is_contract?: boolean };
  value?: string;
};

async function fetchTopHolders(address: string): Promise<HoldersItem[]> {
  try {
    const data = await fetchJson(
      `${BASE_URL}/tokens/${address}/holders?limit=50`,
    );
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

function calculateBurnedFromHolders(
  holders: HoldersItem[],
  decimals: number,
  totalSupply: number,
) {
  const deadValueRaw = holders.reduce(
    (sum, it) =>
      sum + (isBurnAddress(it.address?.hash || '') ? Number(it.value || '0') : 0),
    0,
  );
  const burnedAmount = decimals ? deadValueRaw / Math.pow(10, decimals) : deadValueRaw;
  const burnedPct = totalSupply > 0 ? (deadValueRaw / totalSupply) * 100 : 0;
  return { amount: burnedAmount, percent: burnedPct };
}

function calculateSupplyHeldFromHolders(
  holders: HoldersItem[],
  totalSupply: number,
) {
  // Exclude burn addresses and contract addresses so "Supply Held" = EOA/non-burn only
  const eoaOnly = holders.filter(
    (holder) =>
      !isBurnAddress(holder.address?.hash || '') && !holder.address?.is_contract,
  );

  let top10Sum = 0;
  let top20Sum = 0;
  let top50Sum = 0;

  eoaOnly.forEach((holder, index) => {
    const value = Number(holder.value || 0);
    if (index < 10) top10Sum += value;
    if (index < 20) top20Sum += value;
    if (index < 50) top50Sum += value;
  });

  return {
    top10: totalSupply > 0 ? (top10Sum / totalSupply) * 100 : 0,
    top20: totalSupply > 0 ? (top20Sum / totalSupply) * 100 : 0,
    top50: totalSupply > 0 ? (top50Sum / totalSupply) * 100 : 0,
  };
}

// DexScreener returns a Cloudflare HTML challenge for fetches without a
// real User-Agent — silently kills the JSON parse and stalls this branch
// of the metrics fan-out. Same UA every other DexScreener-hitting route
// in this repo uses.
const DEX_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function fetchTokenPairAddresses(tokenAddress: string): Promise<Set<string>> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      { headers: DEX_HEADERS, next: { revalidate: CACHE_DURATION } },
    );
    if (!res.ok) return new Set();
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return new Set();
    const data = await res.json();
    const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
    const set = new Set<string>();
    pairs.forEach((p: { pairAddress?: string }) => {
      if (p?.pairAddress) set.add(p.pairAddress.toLowerCase());
    });
    return set;
  } catch {
    return new Set();
  }
}

function calculateSmartContractShareFromHolders(
  holders: HoldersItem[],
  totalSupply: number,
  pairAddresses: Set<string>,
) {
  try {
    let contractSum = 0;
    const contractHolders: Array<{ address: string; value: string; percent: number; type: 'LP' | 'Contract' }> = [];

    holders.forEach((holder) => {
      if (holder.address?.is_contract && holder.address?.hash) {
        const value = holder.value || '0';
        const valueNum = Number(value);
        contractSum += valueNum;
        const percent = totalSupply > 0 ? (valueNum / totalSupply) * 100 : 0;
        const addrLower = holder.address.hash.toLowerCase();
        const type = pairAddresses.has(addrLower) ? 'LP' : 'Contract';
        contractHolders.push({
          address: holder.address.hash,
          value,
          percent,
          type,
        });
      }
    });

    return {
      percent: totalSupply > 0 ? (contractSum / totalSupply) * 100 : 0,
      contractCount: contractHolders.length,
      contractAddresses: contractHolders.map((h) => h.address),
      contractHolders,
    };
  } catch (error) {
    console.error('Failed to calculate smart contract share:', error);
    return {
      percent: 0,
      contractCount: 0,
      contractAddresses: [],
      contractHolders: [],
    };
  }
}

/** Known Pump.tires contract addresses (factory / deployer). Tokens created by or via these show the badge. */
const PUMP_TIRES_ADDRESSES = new Set([
  PUMP_TIRES_CREATOR.toLowerCase(),
  // Add other known pump.tires factory/deployer addresses here if needed
]);

// User-curated PulseChain RPC pool — same order as /api/portfolio/lp and
// /api/portfolio/balances. rpc.pulsechain.com (the previous single
// endpoint used here) has been timing out for stretches and was the
// reason the geicko sidebar took 10+ seconds to load owner() data.
const PLC_RPC_URLS = [
  'https://rpc.pulsechainrpc.com',
  'https://pulsechain-rpc.publicnode.com',
  'https://rpc.gigatheminter.com',
  'https://rpc-pulsechain.g4mm4.io',
];
const RPC_TIMEOUT_MS = 4_000;

// keccak256("owner()") = 0x8da5cb5b
const OWNER_SELECTOR = '0x8da5cb5b';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

async function callOwnerRpc(
  url: string,
  contractAddress: string,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: contractAddress, data: OWNER_SELECTOR }, 'latest'],
        id: 1,
      }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const json = await response.json();
    if (json?.error || !json?.result) return null;
    return json.result as string;
  } catch {
    return null;
  }
}

/**
 * Calls owner() on the contract via eth_call. Queries the whole curated
 * RPC pool in parallel and takes the first usable answer, so one slow or
 * timing-out endpoint no longer stalls the response for RPC_TIMEOUT_MS ×
 * pool-size (previously up to 16s of sequential walking — the single
 * biggest contributor to the "everything spins forever" sidebar).
 * Returns the owner address, or null if the contract has no owner()
 * function or returns the zero address.
 */
async function getOnChainOwner(contractAddress: string): Promise<string | null> {
  const results = await Promise.allSettled(
    PLC_RPC_URLS.map((url) => callOwnerRpc(url, contractAddress)),
  );
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const raw = result.value;
    if (!raw || raw === '0x') continue;
    // 32-byte padded address — extract the last 20 bytes
    const addr = '0x' + raw.slice(-40);
    if (addr.toLowerCase() === ZERO_ADDRESS) return null;
    return addr;
  }
  return null;
}

// ---- On-chain RPC fallback for the token facts -------------------------
// PulseScan's v2 REST API has recurring outages (HTTP 500 across every
// endpoint). When it's down we read what we can straight off-chain via the
// same RPC pool used for owner() above, so total supply / decimals / burned
// still render instead of the whole sidebar failing. Holder-derived figures
// (holders count, supply-held %, contract share) need an indexer we don't
// have without PulseScan, so those degrade rather than fabricate numbers.

// keccak256 selectors
const TOTAL_SUPPLY_SELECTOR = '0x18160ddd'; // totalSupply()
const DECIMALS_SELECTOR = '0x313ce567'; // decimals()
const BALANCE_OF_SELECTOR = '0x70a08231'; // balanceOf(address)

// Well-known burn sinks on PulseChain. Their suffixes match isBurnAddress()
// (…0000 / …dead / …0369) so RPC-derived burned totals line up with the
// PulseScan-derived ones.
const BURN_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dEaD',
  '0x0000000000000000000000000000000000000369',
];

const hexToNumber = (hex: string | null): number => {
  if (!hex || hex === '0x') return 0;
  try {
    return Number(BigInt(hex));
  } catch {
    return 0;
  }
};

// Generic eth_call across the whole RPC pool; first usable answer wins. One
// slow/timing-out endpoint can't stall the response since every call carries
// its own timeout and they run in parallel.
async function callRpc(to: string, data: string): Promise<string | null> {
  const results = await Promise.allSettled(
    PLC_RPC_URLS.map((url) =>
      (async () => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{ to, data }, 'latest'],
            id: 1,
          }),
          signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const json = await res.json();
        if (json?.error || !json?.result || json.result === '0x') return null;
        return json.result as string;
      })().catch(() => null),
    ),
  );
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }
  return null;
}

async function getTokenFactsViaRpc(
  address: string,
): Promise<{ totalSupplyRaw: string; totalSupply: number; decimals: number } | null> {
  const [supplyHex, decimalsHex] = await Promise.all([
    callRpc(address, TOTAL_SUPPLY_SELECTOR),
    callRpc(address, DECIMALS_SELECTOR),
  ]);
  if (supplyHex == null) return null;
  let totalSupplyRaw: string;
  try {
    totalSupplyRaw = BigInt(supplyHex).toString();
  } catch {
    return null;
  }
  const decimals = (decimalsHex ? hexToNumber(decimalsHex) : 0) || 18;
  return { totalSupplyRaw, totalSupply: Number(totalSupplyRaw), decimals };
}

async function getBurnedViaRpc(
  address: string,
  decimals: number,
  totalSupply: number,
): Promise<{ amount: number; percent: number } | null> {
  const balances = await Promise.all(
    BURN_ADDRESSES.map((burn) =>
      callRpc(
        address,
        BALANCE_OF_SELECTOR + burn.slice(2).toLowerCase().padStart(64, '0'),
      ),
    ),
  );
  if (balances.every((b) => b == null)) return null;
  const raw = balances.reduce((sum, b) => sum + hexToNumber(b), 0);
  const amount = decimals ? raw / Math.pow(10, decimals) : raw;
  const percent = totalSupply > 0 ? (raw / totalSupply) * 100 : 0;
  return { amount, percent };
}

async function getOwnershipData(address: string) {
  try {
    let creatorAddress: string | null = null;
    let creationTxHash: string | null = null;
    let creationTxTo: string | null = null;
    let renounceTxHash: string | null = null;

    // Fetch address info and token info in parallel
    const [addressInfo] = await Promise.all([
      fetchJson(`${BASE_URL}/addresses/${address}`).catch(() => null),
      fetchJson(`${BASE_URL}/tokens/${address}`).catch(() => null)
    ]);

    creatorAddress = addressInfo?.creator_address_hash || null;
    creationTxHash = addressInfo?.creation_tx_hash || null;

    // Special exception for HEX token - always show as renounced
    const isHexToken = address?.toLowerCase() === '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';

    if (creationTxHash) {
      const creationTx = await fetchJson(`${BASE_URL}/transactions/${creationTxHash}`).catch(() => null);
      creationTxTo = creationTx?.to?.hash || creationTx?.to || null;
    }

    // Primary source of truth: call owner() on-chain.
    // null means the contract has no owner() or it returned address(0) — treat as renounced/no-owner.
    const onChainOwner = isHexToken ? null : await getOnChainOwner(address);

    // ownerAddress is the live on-chain owner (null = no owner / renounced)
    const ownerAddress = onChainOwner;

    let isRenounced = onChainOwner === null;

    // If on-chain still shows an owner, also check the creator's tx history for a
    // renounceOwnership call directed at this contract, as a belt-and-suspenders check.
    if (!isRenounced && creatorAddress) {
      try {
        const creatorTxs = await fetchJson(
          `${BASE_URL}/addresses/${creatorAddress}/transactions?limit=100`
        );

        const renounceTx = (creatorTxs?.items || []).find((tx: any) =>
          (tx?.method || '').toLowerCase() === 'renounceownership' &&
          (tx?.to?.hash || tx?.to || '').toLowerCase() === address.toLowerCase()
        );

        if (renounceTx) {
          isRenounced = true;
          renounceTxHash = renounceTx.hash || null;
        }
      } catch (error) {
        console.error('Failed to check renounce status:', error);
      }
    }

    const finalIsRenounced = isHexToken ? true : isRenounced;
    const isPumpTiresToken =
      PUMP_TIRES_ADDRESSES.has((creatorAddress || '').toLowerCase()) ||
      PUMP_TIRES_ADDRESSES.has((creationTxTo || '').toLowerCase());

    return {
      creatorAddress,
      ownerAddress,
      isRenounced: finalIsRenounced,
      renounceTxHash: isHexToken ? 'HEX_TOKEN_EXCEPTION' : renounceTxHash,
      creationTxTo,
      isPumpTiresToken,
    };
  } catch (error) {
    console.error('Failed to get ownership data:', error);
    return {
      creatorAddress: null,
      ownerAddress: null,
      isRenounced: false,
      renounceTxHash: null,
      creationTxTo: null,
      isPumpTiresToken: false,
    };
  }
}

async function getCreationDate(address: string) {
  try {
    const addressInfo = await fetchJson(`${BASE_URL}/addresses/${address}`);
    const creationTxHash = addressInfo?.creation_tx_hash;

    if (creationTxHash) {
      const creationTx = await fetchJson(`${BASE_URL}/transactions/${creationTxHash}`);
      const timestamp = creationTx?.timestamp || creationTx?.block_timestamp;

      if (timestamp) {
        const creationDate = new Date(timestamp);
        return `${creationDate.getUTCFullYear()}-${String(creationDate.getUTCMonth() + 1).padStart(2, '0')}-${String(creationDate.getUTCDate()).padStart(2, '0')}`;
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to get creation date:', error);
    return null;
  }
}

/**
 * The "fast" half of the metrics: everything derivable from PulseScan's
 * token info + the top-50 holders (+ DexScreener pairs for LP labelling).
 * None of this touches the flaky on-chain owner() RPC pool, so the Holders
 * count, supply, and supply-held figures can render without waiting on the
 * ownership branch — which is the whole reason the sidebar felt slow.
 */
async function getCoreMetrics(
  address: string,
): Promise<Omit<TokenMetrics, 'ownershipData'>> {
  // Token info first — it already carries the holders count and total supply.
  // PulseScan v2 goes down for stretches (HTTP 500 everywhere); catch that
  // instead of throwing so we can fall back to on-chain reads below.
  const tokenInfo = await fetchJson(`${BASE_URL}/tokens/${address}`).catch(
    () => null,
  );

  if (tokenInfo) {
    // The top-50 holders (shared across burned/supply-held/contract-share),
    // the DexScreener pairs (for LP detection), and the creation date all run
    // in parallel. fetchTokenPairAddresses used to block this batch by running
    // sequentially before it.
    const [holders, pairAddresses, creationDate] = await Promise.all([
      fetchTopHolders(address),
      fetchTokenPairAddresses(address),
      getCreationDate(address),
    ]);

    const decimals = Number(tokenInfo?.decimals || 18);
    const totalSupply = Number(tokenInfo?.total_supply || 0);
    const totalHoldersCount = Number(tokenInfo?.holders || 0);

    return {
      burnedTokens: calculateBurnedFromHolders(holders, decimals, totalSupply),
      holdersCount: totalHoldersCount,
      creationDate,
      supplyHeld: calculateSupplyHeldFromHolders(holders, totalSupply),
      smartContractHolderShare: calculateSmartContractShareFromHolders(
        holders,
        totalSupply,
        pairAddresses,
      ),
      totalSupply: {
        supply: tokenInfo?.total_supply || '0',
        decimals,
      },
    };
  }

  // PulseScan unavailable — read the token facts straight off-chain. Total
  // supply, decimals and burned still render; holder-derived figures (holders
  // count, supply-held %, contract share) need an indexer we don't have without
  // PulseScan, so they degrade to null/empty instead of failing the request.
  // The explorer-only lookups (holders, creation date) are skipped entirely
  // here since a null tokenInfo means they'd only time out too.
  const facts = await getTokenFactsViaRpc(address);
  if (!facts) {
    throw new Error('token metrics unavailable (PulseScan and RPC both failed)');
  }
  const { totalSupplyRaw, totalSupply, decimals } = facts;

  // Burned (burn-sink balances) and the creation date (deployment block →
  // timestamp) both come off-chain and run in parallel — neither needs the
  // indexer, so "Age" renders during an outage instead of showing a dash.
  const [burnedTokens, creationDate] = await Promise.all([
    getBurnedViaRpc(address, decimals, totalSupply),
    getCreationDateViaRpc(address),
  ]);

  return {
    burnedTokens,
    holdersCount: null,
    creationDate,
    supplyHeld: { top10: 0, top20: 0, top50: 0 },
    smartContractHolderShare: {
      percent: 0,
      contractCount: 0,
      contractAddresses: [],
      contractHolders: [],
    },
    totalSupply: {
      supply: totalSupplyRaw,
      decimals,
    },
  };
}

const CACHE_HEADERS = {
  'Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=${CACHE_DURATION * 2}`,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid token address' },
        { status: 400 }
      );
    }

    // Callers can request just the fast core fields or just the slow
    // ownership branch, so the two render independently on the client and
    // Holders never waits on the on-chain owner() lookup. Omitting ?scope
    // returns the full payload (backwards compatible).
    const scope = request.nextUrl.searchParams.get('scope');

    if (scope === 'ownership') {
      const ownershipData = await getOwnershipData(address);
      return NextResponse.json({ ownershipData }, { headers: CACHE_HEADERS });
    }

    if (scope === 'core') {
      const core = await getCoreMetrics(address);
      return NextResponse.json(core, { headers: CACHE_HEADERS });
    }

    const [core, ownershipData] = await Promise.all([
      getCoreMetrics(address),
      getOwnershipData(address),
    ]);

    const metrics: TokenMetrics = { ...core, ownershipData };

    return NextResponse.json(metrics, { headers: CACHE_HEADERS });

  } catch (error) {
    console.error('Failed to fetch token metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token metrics' },
      { status: 500 }
    );
  }
}
