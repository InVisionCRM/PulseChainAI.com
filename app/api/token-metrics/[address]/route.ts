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
  };
  ownershipData: {
    creatorAddress: string | null;
    ownerAddress: string | null;
    isRenounced: boolean;
    renounceTxHash: string | null;
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
    const items: Array<{ value?: string }> = Array.isArray(data?.items) ? data.items : [];

    let top10Sum = 0;
    let top20Sum = 0;
    let top50Sum = 0;

    items.forEach((holder, index) => {
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

async function calculateSmartContractShare(address: string, totalSupply: number) {
  try {
    const data = await fetchJson(`${BASE_URL}/tokens/${address}/holders?limit=50`);
    const items: Array<{ address?: { hash?: string; is_contract?: boolean }; value?: string }> =
      Array.isArray(data?.items) ? data.items : [];

    let contractSum = 0;
    let contractCount = 0;

    items.forEach((holder) => {
      if (holder.address?.is_contract) {
        contractSum += Number(holder.value || 0);
        contractCount++;
      }
    });

    return {
      percent: totalSupply > 0 ? (contractSum / totalSupply) * 100 : 0,
      contractCount,
    };
  } catch (error) {
    console.error('Failed to calculate smart contract share:', error);
    return { percent: 0, contractCount: 0 };
  }
}

async function getOwnershipData(address: string) {
  try {
    let creatorAddress: string | null = null;
    let creationTxHash: string | null = null;
    let ownerAddress: string | null = null;
    let isRenounced = false;
    let renounceTxHash: string | null = null;

    // Fetch address info and token info in parallel
    const [addressInfo, tokenInfo] = await Promise.all([
      fetchJson(`${BASE_URL}/addresses/${address}`).catch(() => null),
      fetchJson(`${BASE_URL}/tokens/${address}`).catch(() => null)
    ]);

    creatorAddress = addressInfo?.creator_address_hash || null;
    creationTxHash = addressInfo?.creation_tx_hash || null;

    // Special exception for HEX token - always show as renounced
    const isHexToken = address?.toLowerCase() === '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';

    if (creationTxHash) {
      // Fetch creation transaction to get owner (from address)
      const creationTx = await fetchJson(`${BASE_URL}/transactions/${creationTxHash}`).catch(() => null);
      ownerAddress = creationTx?.from?.hash || creationTx?.from || null;
    }

    // Check if ownership was renounced by checking creator's transactions
    if (creatorAddress && !isHexToken) {
      try {
        const creatorTxs = await fetchJson(
          `${BASE_URL}/addresses/${creatorAddress}/transactions?limit=100`
        );

        const renounceTx = (creatorTxs?.items || []).find((tx: any) =>
          (tx?.method || '').toLowerCase() === 'renounceownership'
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

    return {
      creatorAddress,
      ownerAddress: ownerAddress || creatorAddress,
      isRenounced: finalIsRenounced,
      renounceTxHash: isHexToken ? 'HEX_TOKEN_EXCEPTION' : renounceTxHash,
    };
  } catch (error) {
    console.error('Failed to get ownership data:', error);
    return {
      creatorAddress: null,
      ownerAddress: null,
      isRenounced: false,
      renounceTxHash: null,
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
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address;

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

    // Run all calculations in parallel
    const [
      burnedTokens,
      supplyHeld,
      smartContractShare,
      ownershipData,
      creationDate
    ] = await Promise.all([
      calculateBurnedTokens(address, decimals, totalSupply),
      calculateSupplyHeld(address, totalSupply),
      calculateSmartContractShare(address, totalSupply),
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
