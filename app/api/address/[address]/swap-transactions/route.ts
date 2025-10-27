import { NextRequest, NextResponse } from 'next/server';
import { dexscreenerApi } from '@/services/blockchain/dexscreenerApi';

// Known DEX router addresses on PulseChain
const DEX_ROUTERS = {
  'PulseX V1': '0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02',
  'PulseX V2': '0x165C3410fC91EF562C50559f7d2289fEbed552d9',
  'PulseX': '0x165C3410fC91EF562C50559f7d2289fEbed552d9', // Default to V2
};

const WPLS_ADDRESS = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27';
const PLS_SYMBOL = 'PLS';

interface TokenTransfer {
  from: { hash: string };
  to: { hash: string };
  token: {
    address: string;
    symbol: string;
    decimals: string;
  };
  total: {
    value: string;
    decimals: string;
  };
}

interface SwapTransaction {
  id: string;
  type: 'swap';
  from: string;
  to: string;
  sentAssets: Array<{
    symbol: string;
    amount: string;
    value: number;
    tokenAddress: string;
  }>;
  receivedAssets: Array<{
    symbol: string;
    amount: string;
    value: number;
    tokenAddress: string;
  }>;
  status: 'success' | 'failed';
  timestamp: string;
  gasUsed: string;
  gasSymbol: string;
  gasValue: number;
  txHash: string;
}

// Cache for token prices to avoid excessive API calls
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_DURATION = 60000; // 1 minute

async function getTokenPrice(tokenAddress: string): Promise<number> {
  const cached = priceCache.get(tokenAddress.toLowerCase());
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price;
  }

  try {
    const result = await dexscreenerApi.getTokenProfile(tokenAddress);
    if (result.success && result.data?.marketData?.priceUsd) {
      const price = parseFloat(result.data.marketData.priceUsd);
      priceCache.set(tokenAddress.toLowerCase(), { price, timestamp: Date.now() });
      return price;
    }
  } catch (error) {
    console.error(`Error fetching price for ${tokenAddress}:`, error);
  }
  
  return 0;
}

function formatTokenAmount(value: string, decimals: string | number): string {
  const decimalCount = typeof decimals === 'string' ? parseInt(decimals) : decimals;
  const divisor = Math.pow(10, decimalCount);
  const amount = parseFloat(value) / divisor;
  
  // Format with appropriate precision
  if (amount === 0) return '0';
  if (amount < 0.000001) return amount.toExponential(2);
  if (amount < 1) return amount.toFixed(6);
  if (amount < 1000) return amount.toFixed(2);
  
  // Add commas for thousands
  return amount.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 6 
  });
}

function detectDexName(toAddress: string): string {
  const addressLower = toAddress.toLowerCase();
  for (const [name, address] of Object.entries(DEX_ROUTERS)) {
    if (address.toLowerCase() === addressLower) {
      return `✗ ${name.replace(' V2', '').replace(' V1', '')}`;
    }
  }
  return toAddress;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Valid wallet address is required' },
        { status: 400 }
      );
    }

    console.log(`[swap-transactions] Fetching transactions for address: ${address}`);

    // Fetch token transfers from PulseChain API with pagination
    // The API returns max 50 items per request, so we need to make multiple requests
    let allTokenTransfers: any[] = [];
    let currentPage = 1;
    const itemsPerPage = 50; // PulseChain API max
    const maxPages = Math.ceil(Math.min(limit, 200) / itemsPerPage); // Fetch up to 200 transactions (4 pages max)
    let lastPageData: any = null; // Store the last page data for pagination info
    
    console.log(`[swap-transactions] Will fetch up to ${maxPages} pages to get ${Math.min(limit, 200)} transactions`);
    
    for (let i = 0; i < maxPages; i++) {
      const apiUrl = `https://api.scan.pulsechain.com/api/v2/addresses/${address}/token-transfers?page=${currentPage}&limit=${itemsPerPage}`;
      console.log(`[swap-transactions] Fetching page ${currentPage}...`);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(apiUrl, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[swap-transactions] API error on page ${currentPage}: ${response.statusText}`);
        break; // Stop on error but return what we have
      }

      const data = await response.json();
      lastPageData = data; // Store the last page data for pagination info
      const pageItems = data.items || [];
      
      if (pageItems.length === 0) {
        console.log(`[swap-transactions] No more items at page ${currentPage}, stopping`);
        break; // No more data
      }
      
      allTokenTransfers = allTokenTransfers.concat(pageItems);
      console.log(`[swap-transactions] Page ${currentPage}: Got ${pageItems.length} items, total so far: ${allTokenTransfers.length}`);
      
      // If we got fewer items than requested, we've reached the end
      if (pageItems.length < itemsPerPage) {
        console.log(`[swap-transactions] Reached end of data (got ${pageItems.length} < ${itemsPerPage})`);
        break;
      }
      
      currentPage++;
    }
    
    const tokenTransfers = allTokenTransfers;
    
    console.log(`[swap-transactions] Total token transfers fetched: ${tokenTransfers.length}`);
    console.log(`[swap-transactions] Processing ${tokenTransfers.length} token transfers`);

    // Group token transfers by transaction hash to identify swaps
    const transfersByTx = new Map<string, any[]>();
    
    for (const transfer of tokenTransfers) {
      const txHash = transfer.tx_hash || transfer.transaction_hash;
      if (!transfersByTx.has(txHash)) {
        transfersByTx.set(txHash, []);
      }
      transfersByTx.get(txHash)!.push(transfer);
    }

    console.log(`[swap-transactions] Grouped into ${transfersByTx.size} transactions`);

    // Process transactions to identify swaps
    const swapTransactions: SwapTransaction[] = [];

    for (const [txHash, transfers] of transfersByTx) {
      console.log(`[swap-transactions] Processing tx ${txHash} with ${transfers.length} token transfers`);
      
      // Debug: Log transfer structure
      if (transfers.length > 0) {
        console.log(`[swap-transactions] Sample transfer:`, JSON.stringify(transfers[0], null, 2));
      }

      // Process token transfers for this transaction
      if (transfers.length > 0) {
        const sentAssets: SwapTransaction['sentAssets'] = [];
        const receivedAssets: SwapTransaction['receivedAssets'] = [];

        // Process token transfers
        for (const transfer of transfers) {
          const tokenAddress = transfer.token?.address_hash || transfer.token?.address || '';
          const symbol = transfer.token?.symbol || 'UNKNOWN';
          const decimals = transfer.token?.decimals || '18';
          const rawAmount = transfer.total?.value || transfer.value || '0';
          
          const formattedAmount = formatTokenAmount(rawAmount, decimals);
          const price = await getTokenPrice(tokenAddress);
          const usdValue = (parseFloat(rawAmount) / Math.pow(10, parseInt(decimals))) * price;

          // Fetch logo for this token
          let logoUrl: string | null = null;
          try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
            if (response.ok) {
              const data = await response.json();
              if (data.pairs && data.pairs.length > 0) {
                logoUrl = data.pairs[0].info?.imageUrl || null;
              }
            }
          } catch (error) {
            console.warn(`Failed to fetch logo for ${tokenAddress}:`, error);
          }

          // Determine if this is sent or received based on from/to addresses
          const isFromUser = transfer.from?.hash?.toLowerCase() === address.toLowerCase();
          const isToUser = transfer.to?.hash?.toLowerCase() === address.toLowerCase();

          if (isFromUser && !isToUser) {
            sentAssets.push({
              symbol,
              amount: formattedAmount,
              value: usdValue,
              tokenAddress,
              logoUrl,
            });
          } else if (isToUser && !isFromUser) {
            receivedAssets.push({
              symbol,
              amount: formattedAmount,
              value: usdValue,
              tokenAddress,
              logoUrl,
            });
          }
        }

        // Create transaction entry if we have either sent or received assets (or both)
        if (sentAssets.length > 0 || receivedAssets.length > 0) {
          console.log(`[swap-transactions] Creating transaction entry for tx ${txHash}: sentAssets=${sentAssets.length}, receivedAssets=${receivedAssets.length}`);
          
          // Get transaction details from first transfer
          const firstTransfer = transfers[0];
          
          // Try to fetch transaction details for gas info
          let gasUsed = '0';
          let gasPrice = '0';
          try {
            const txResponse = await fetch(`https://api.scan.pulsechain.com/api/v2/transactions/${txHash}`);
            if (txResponse.ok) {
              const txData = await txResponse.json();
              gasUsed = txData.gas_used || '0';
              gasPrice = txData.gas_price || '0';
            }
          } catch (error) {
            console.warn(`Failed to fetch gas info for tx ${txHash}:`, error);
          }
          
          const gasCostWei = parseFloat(gasUsed) * parseFloat(gasPrice);
          const gasCostPLS = gasCostWei / 1e18;
          
          // Get PLS price for gas value in USD
          const plsPrice = await getTokenPrice(WPLS_ADDRESS);
          const gasValueUsd = gasCostPLS * plsPrice;

          // Try to detect DEX from transaction data
          const dexName = detectDexName(firstTransfer.to?.hash || '');

          swapTransactions.push({
            id: txHash,
            type: 'swap',
            from: 'You',
            to: dexName,
            sentAssets,
            receivedAssets,
            status: firstTransfer.status === 'ok' ? 'success' : 'success', // Default to success for now
            timestamp: firstTransfer.timestamp || new Date().toISOString(),
            gasUsed: gasCostPLS.toFixed(8),
            gasSymbol: PLS_SYMBOL,
            gasValue: gasValueUsd,
            txHash: txHash,
          });
        }
      }
    }

    console.log(`[swap-transactions] Found ${swapTransactions.length} transactions`);

    return NextResponse.json({
      success: true,
      items: swapTransactions,
      pagination: {
        has_next_page: lastPageData?.next_page_params !== null,
        page,
        limit,
      },
      message: `Found ${swapTransactions.length} transactions`,
    });

  } catch (error) {
    console.error('[swap-transactions] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch swap transactions',
        success: false,
      },
      { status: 500 }
    );
  }
}

