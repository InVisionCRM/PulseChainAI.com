import { NextRequest, NextResponse } from 'next/server';

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

async function calculateBurnedTokens(address: string, decimals: number, totalSupply: number) {
  try {
    const limit = 50;
    let nextParams: Record<string, string> | undefined = undefined;
    let deadValueRaw = 0;

    // Paginate through holders to calculate burned tokens (up to 10 pages)
    for (let i = 0; i < 10; i++) {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (nextParams) {
        Object.entries(nextParams).forEach(([k, v]) => qs.set(k, String(v)));
      }

      const data = await fetchJson(`${BASE_URL}/tokens/${address}/holders?${qs.toString()}`);
      const items: Array<{ address?: { hash?: string }; value?: string }> =
        Array.isArray(data?.items) ? data.items : [];

      // Calculate burned tokens on this page
      const burnedOnPage = items.reduce(
        (sum, it) => sum + (isBurnAddress(it.address?.hash || '') ? Number(it.value || '0') : 0),
        0
      );
      deadValueRaw += burnedOnPage;

      // If no more pages, stop pagination
      if (!data?.next_page_params) break;
      nextParams = data.next_page_params as Record<string, string>;
    }

    const burnedAmount = decimals ? deadValueRaw / Math.pow(10, decimals) : deadValueRaw;
    const burnedPct = totalSupply > 0 ? (deadValueRaw / totalSupply) * 100 : 0;
    return { amount: burnedAmount, percent: burnedPct };
  } catch (error) {
    console.error('Failed to calculate burned tokens:', error);
    return null;
  }
}

async function calculateSupplyHeld(address: string, totalSupply: number) {
  try {
    const data = await fetchJson(`${BASE_URL}/tokens/${address}/holders?limit=50`);
    const items: Array<{ address?: { hash?: string; is_contract?: boolean }; value?: string }> =
      Array.isArray(data?.items) ? data.items : [];

    // Exclude burn addresses and contract addresses so "Supply Held" = EOA/non-burn only
    const eoaOnly = items.filter(
      (holder) =>
        !isBurnAddress(holder.address?.hash || '') && !holder.address?.is_contract
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
  } catch (error) {
    console.error('Failed to calculate supply held:', error);
    return { top10: 0, top20: 0, top50: 0 };
  }
}

async function fetchTokenPairAddresses(tokenAddress: string): Promise<Set<string>> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      { next: { revalidate: CACHE_DURATION } }
    );
    if (!res.ok) return new Set();
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

async function calculateSmartContractShare(
  address: string,
  totalSupply: number,
  pairAddresses: Set<string>
) {
  try {
    const data = await fetchJson(`${BASE_URL}/tokens/${address}/holders?limit=50`);
    const items: Array<{ address?: { hash?: string; is_contract?: boolean }; value?: string }> =
      Array.isArray(data?.items) ? data.items : [];

    let contractSum = 0;
    const contractHolders: Array<{ address: string; value: string; percent: number; type: 'LP' | 'Contract' }> = [];

    items.forEach((holder) => {
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

const PLC_RPC_URL = 'https://rpc.pulsechain.com';
// keccak256("owner()") = 0x8da5cb5b
const OWNER_SELECTOR = '0x8da5cb5b';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Calls owner() on the contract via eth_call.
 * Returns the owner address, or null if the contract has no owner() function
 * (reverts) or returns the zero address.
 */
async function getOnChainOwner(contractAddress: string): Promise<string | null> {
  try {
    const response = await fetch(PLC_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: contractAddress, data: OWNER_SELECTOR }, 'latest'],
        id: 1,
      }),
    });
    const json = await response.json();
    // A revert or missing function returns an error or '0x'
    if (json.error || !json.result || json.result === '0x') return null;
    // Result is a 32-byte padded address — extract the last 20 bytes
    const raw = json.result as string;
    const addr = '0x' + raw.slice(-40);
    if (addr.toLowerCase() === ZERO_ADDRESS) return null;
    return addr;
  } catch {
    return null;
  }
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

    // Fetch token info first (needed for calculations)
    const tokenInfo = await fetchJson(`${BASE_URL}/tokens/${address}`);
    const decimals = Number(tokenInfo?.decimals || 18);
    const totalSupply = Number(tokenInfo?.total_supply || 0);
    const totalHoldersCount = Number(tokenInfo?.holders || 0);

    // Fetch pair addresses for LP detection (used in smart contract share)
    const pairAddresses = await fetchTokenPairAddresses(address);

    // Run all calculations in parallel (smartContractShare uses pairAddresses)
    const [
      burnedTokens,
      supplyHeld,
      smartContractShare,
      ownershipData,
      creationDate
    ] = await Promise.all([
      calculateBurnedTokens(address, decimals, totalSupply),
      calculateSupplyHeld(address, totalSupply),
      calculateSmartContractShare(address, totalSupply, pairAddresses),
      getOwnershipData(address),
      getCreationDate(address)
    ]);

    const metrics: TokenMetrics = {
      burnedTokens,
      holdersCount: totalHoldersCount,
      creationDate,
      supplyHeld,
      smartContractHolderShare: smartContractShare,
      ownershipData,
      totalSupply: {
        supply: tokenInfo?.total_supply || '0',
        decimals
      }
    };

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=${CACHE_DURATION * 2}`
      }
    });

  } catch (error) {
    console.error('Failed to fetch token metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token metrics' },
      { status: 500 }
    );
  }
}
