import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch top pairs from DexScreener API for PulseChain using multiple endpoints
    const endpoints = [
      'https://api.dexscreener.com/latest/dex/tokens/0xA1077a294dDE1B09bB078844df40758a5D0f9a27', // WPLS token (primary)
      'https://api.dexscreener.com/latest/dex/search?q=pulsechain' // Fallback search
    ];

    const allPairs = [];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Accept': 'application/json',
          },
          next: { revalidate: 60 } // Cache for 1 minute
        });

        if (response.ok) {
          const data = await response.json();
          if (data.pairs) {
            allPairs.push(...data.pairs);
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch from ${endpoint}:`, err);
      }
    }

    // Create a map to track unique tokens by address to avoid duplicates
    const uniqueTokens = new Map();
    
    // Filter for PulseChain pairs and sort by liquidity
    const pulsechainPairs = allPairs
      ?.filter((pair: any) => {
        const isWPLSPair = pair.baseToken?.symbol === 'WPLS' || pair.quoteToken?.symbol === 'WPLS';
        const hasLiquidity = pair.liquidity?.usd > 500; // Lowered from 1000 to get more pairs
        const isValidPair = pair.chainId === 'pulsechain' && isWPLSPair && hasLiquidity;
        
        if (isValidPair) {
          // Get the non-WPLS token to check for uniqueness
          const nonWPLSToken = pair.baseToken?.symbol === 'WPLS' ? pair.quoteToken : pair.baseToken;
          const tokenAddress = nonWPLSToken?.address;
          
          if (tokenAddress && !uniqueTokens.has(tokenAddress)) {
            uniqueTokens.set(tokenAddress, true);
            return true;
          }
        }
        return false;
      })
      ?.sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      ?.slice(0, 15) // Top 15 trending WPLS pairs by volume
      ?.map((pair: any) => {
        const nonWPLSToken = pair.baseToken?.symbol === 'WPLS' ? pair.quoteToken : pair.baseToken;
        return {
          baseToken: pair.baseToken?.symbol || 'Unknown',
          quoteToken: pair.quoteToken?.symbol || 'Unknown',
          baseTokenAddress: pair.baseToken?.address || null,
          quoteTokenAddress: pair.quoteToken?.address || null,
          baseTokenLogo: pair.baseToken?.logoURI || pair.baseToken?.logo || null,
          quoteTokenLogo: pair.quoteToken?.logoURI || pair.quoteToken?.logo || null,
          priceUsd: parseFloat(pair.priceUsd || '0'),
          priceChange24h: pair.priceChange?.h24 || 0,
          liquidity: pair.liquidity?.usd || 0,
          volume24h: pair.volume?.h24 || 0,
          dexId: pair.dexId || 'unknown',
          // Add the non-WPLS token info for display
          displayToken: nonWPLSToken?.symbol || 'Unknown',
          displayTokenAddress: nonWPLSToken?.address || null,
        };
      }) || [];

    console.log(`Found ${allPairs.length} total pairs, ${pulsechainPairs.length} trending unique pairs after filtering`);
    
    return NextResponse.json({ pairs: pulsechainPairs });
  } catch (error) {
    console.error('Error fetching top pairs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top pairs', pairs: [] },
      { status: 500 }
    );
  }
}

