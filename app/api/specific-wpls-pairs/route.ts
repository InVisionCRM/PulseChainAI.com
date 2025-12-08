import { NextResponse } from 'next/server';

// Specific tokens to display with their WPLS pairs
const SPECIFIC_TOKENS = [
  { symbol: 'WPLS', address: null }, // WPLS paired with itself isn't useful, but we'll fetch WPLS data
  { symbol: 'PLSX', address: null },
  { symbol: 'HEX', address: null },
  { symbol: 'INC', address: null },
  { symbol: 'TIME', address: null },
  { symbol: 'XGAME', address: null },
  { symbol: 'PCOCK', address: null },
  { symbol: 'PSSH', address: null },
  { symbol: 'MOST', address: null },
  { symbol: 'DAI', address: '0xf598cB1D27Fb2c5C731F535AD6c1D0ec5EfE1320' },
];

// Manually include known WPLS pairs by pair address (e.g., Morbius)
const MANUAL_WPLS_PAIRS: Array<{ symbol: string; pairAddress: string }> = [
  { symbol: 'MORBIUS', pairAddress: '0x81acd0AA872675678A25fbB154992A2baD4F6CEF' },
];

// WPLS contract address on PulseChain
const WPLS_ADDRESS = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27';

interface TokenPairData {
  address: string;
  symbol: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  pairAddress: string;
  dexId: string;
}

export async function GET() {
  try {
    console.log('🎯 Fetching specific WPLS pairs...');

    const tokenPairs: TokenPairData[] = [];

    // Fetch data for each token
    for (const token of SPECIFIC_TOKENS) {
      try {
        // Skip WPLS itself
        if (token.symbol === 'WPLS') {
          continue;
        }

        let searchQuery = '';
        if (token.address) {
          searchQuery = token.address;
        } else {
          searchQuery = `${token.symbol} pulsechain`;
        }

        console.log(`   Searching for ${token.symbol}...`);

        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          console.log(`   ⚠️ Failed to fetch ${token.symbol}: ${response.status}`);
          continue;
        }

        const data = await response.json();

        // Filter for PulseChain pairs that include WPLS
        const wplsPairs = data.pairs?.filter((pair: any) => {
          if (pair.chainId !== 'pulsechain') return false;

          const token0Address = pair.baseToken?.address?.toLowerCase();
          const token1Address = pair.quoteToken?.address?.toLowerCase();
          const wplsAddr = WPLS_ADDRESS.toLowerCase();

          // Check if this pair includes WPLS and matches our target token
          const hasWPLS = token0Address === wplsAddr || token1Address === wplsAddr;

          if (!hasWPLS) return false;

          // Check if the other token matches our search
          if (token.address) {
            const targetAddr = token.address.toLowerCase();
            return token0Address === targetAddr || token1Address === targetAddr;
          } else {
            // Match by symbol
            const token0Symbol = pair.baseToken?.symbol?.toUpperCase();
            const token1Symbol = pair.quoteToken?.symbol?.toUpperCase();
            return token0Symbol === token.symbol.toUpperCase() ||
                   token1Symbol === token.symbol.toUpperCase();
          }
        }) || [];

        if (wplsPairs.length === 0) {
          console.log(`   ⚠️ No WPLS pair found for ${token.symbol}`);
          continue;
        }

        // Take the pair with highest liquidity
        const bestPair = wplsPairs.sort((a: any, b: any) =>
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];

        // Determine which token is not WPLS
        const token0Address = bestPair.baseToken?.address?.toLowerCase();
        const isToken0WPLS = token0Address === WPLS_ADDRESS.toLowerCase();
        const targetToken = isToken0WPLS ? bestPair.quoteToken : bestPair.baseToken;

        const pairData: any = {
          address: targetToken.address,
          symbol: targetToken.symbol,
          name: targetToken.name,
          priceUsd: parseFloat(bestPair.priceUsd || '0'),
          priceChange24h: bestPair.priceChange?.h24 || 0,
          priceChange6h: bestPair.priceChange?.h6 || 0,
          priceChange1h: bestPair.priceChange?.h1 || 0,
          volume24h: bestPair.volume?.h24 || 0,
          volume6h: bestPair.volume?.h6 || 0,
          liquidity: bestPair.liquidity?.usd || 0,
          fdv: bestPair.fdv,
          marketCap: bestPair.marketCap,
          txCount24h: (bestPair.txns?.h24?.buys || 0) + (bestPair.txns?.h24?.sells || 0),
          buys24h: bestPair.txns?.h24?.buys || 0,
          sells24h: bestPair.txns?.h24?.sells || 0,
          pairAddress: bestPair.pairAddress,
          dexId: bestPair.dexId,
          url: bestPair.url,
        };

        tokenPairs.push(pairData);
        console.log(`   ✅ Found ${token.symbol}/WPLS pair`);
      } catch (error) {
        console.error(`   ❌ Error fetching ${token.symbol}:`, error);
        continue;
      }
    }

    // Manually fetch and append any manual WPLS pairs
    for (const manual of MANUAL_WPLS_PAIRS) {
      try {
        const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/pairs/pulsechain/${manual.pairAddress}`);
        if (!pairRes.ok) {
          console.log(`   ⚠️ Failed to fetch manual pair ${manual.symbol}: ${pairRes.status}`);
          continue;
        }
        const pairDataResp = await pairRes.json();
        const pairData = pairDataResp.pair;
        if (!pairData) {
          console.log(`   ⚠️ Manual pair ${manual.symbol} returned no data`);
          continue;
        }

        const baseAddr = pairData.baseToken?.address?.toLowerCase();
        const quoteAddr = pairData.quoteToken?.address?.toLowerCase();
        const wplsAddr = WPLS_ADDRESS.toLowerCase();
        const hasWPLS = baseAddr === wplsAddr || quoteAddr === wplsAddr;
        if (!hasWPLS) {
          console.log(`   ⚠️ Manual pair ${manual.symbol} is not a WPLS pair`);
          continue;
        }

        const targetToken = baseAddr === wplsAddr ? pairData.quoteToken : pairData.baseToken;

        tokenPairs.push({
          address: targetToken.address,
          symbol: targetToken.symbol || manual.symbol,
          name: targetToken.name || manual.symbol,
          priceUsd: parseFloat(pairData.priceUsd || '0'),
          priceChange24h: pairData.priceChange?.h24 || 0,
          priceChange6h: pairData.priceChange?.h6 || 0,
          priceChange1h: pairData.priceChange?.h1 || 0,
          volume24h: pairData.volume?.h24 || 0,
          volume6h: pairData.volume?.h6 || 0,
          liquidity: pairData.liquidity?.usd || 0,
          fdv: pairData.fdv,
          marketCap: pairData.marketCap,
          txCount24h: (pairData.txns?.h24?.buys || 0) + (pairData.txns?.h24?.sells || 0),
          buys24h: pairData.txns?.h24?.buys || 0,
          sells24h: pairData.txns?.h24?.sells || 0,
          pairAddress: manual.pairAddress,
          dexId: pairData.dexId,
          url: pairData.url,
        });
        console.log(`   ✅ Added manual pair ${manual.symbol}/WPLS`);
      } catch (error) {
        console.error(`   ❌ Error fetching manual pair ${manual.symbol}:`, error);
      }
    }

    console.log(`✅ Successfully fetched ${tokenPairs.length} WPLS pairs`);

    return NextResponse.json(
      {
        success: true,
        count: tokenPairs.length,
        tokens: tokenPairs,
        metadata: {
          source: 'DexScreener',
          chain: 'PulseChain',
          pairType: 'WPLS pairs only',
          timestamp: new Date().toISOString(),
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240', // Cache for 2 minutes
        },
      }
    );
  } catch (error) {
    console.error('Error fetching specific WPLS pairs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch specific WPLS pairs',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
