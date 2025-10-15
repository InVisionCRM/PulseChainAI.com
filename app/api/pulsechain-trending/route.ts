import { NextRequest, NextResponse } from 'next/server';

// This endpoint aggregates trending tokens from multiple sources
// No API keys required - completely free!

interface TrendingToken {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  txCount24h: number;
  fdv?: number;
  trendingScore: number;
  pairAddress: string;
  dexId: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const minLiquidity = parseFloat(searchParams.get('minLiquidity') || '1000'); // Minimum $1k liquidity
    const minVolume = parseFloat(searchParams.get('minVolume') || '100'); // Minimum $100 volume

    console.log(`🔥 Fetching trending PulseChain tokens...`);

    // Fetch from DexScreener (FREE public API)
    const response = await fetch(
      'https://api.dexscreener.com/latest/dex/search?q=pulsechain',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const data = await response.json();

    // Filter and process PulseChain pairs
    const pulsechainPairs = data.pairs?.filter((pair: any) =>
      pair.chainId === 'pulsechain' &&
      pair.liquidity?.usd >= minLiquidity &&
      pair.volume?.h24 >= minVolume
    ) || [];

    console.log(`   Found ${pulsechainPairs.length} pairs meeting criteria`);

    // Calculate trending scores and deduplicate by token address
    const tokenMap = new Map<string, TrendingToken>();

    for (const pair of pulsechainPairs) {
      const tokenAddress = pair.baseToken?.address;
      if (!tokenAddress) continue;

      const priceChange = pair.priceChange?.h24 || 0;
      const volume = pair.volume?.h24 || 0;
      const liquidity = pair.liquidity?.usd || 0;
      const txCount = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);

      // Calculate trending score:
      // - Positive price change is good
      // - High volume relative to liquidity is good
      // - High transaction count is good
      // - Balanced buy/sell ratio is neutral

      const volumeToLiquidityRatio = liquidity > 0 ? volume / liquidity : 0;
      const priceChangeMultiplier = 1 + (priceChange / 100);
      const volumeScore = Math.log10(volume + 1) * 1000;
      const liquidityScore = Math.log10(liquidity + 1) * 500;
      const txScore = Math.log10(txCount + 1) * 200;

      const trendingScore =
        (volumeScore * priceChangeMultiplier) +
        liquidityScore +
        txScore +
        (volumeToLiquidityRatio * 1000);

      const token: TrendingToken = {
        address: tokenAddress,
        symbol: pair.baseToken?.symbol || 'UNKNOWN',
        name: pair.baseToken?.name || 'Unknown Token',
        priceUsd: parseFloat(pair.priceUsd || '0'),
        priceChange24h: priceChange,
        volume24h: volume,
        liquidity: liquidity,
        txCount24h: txCount,
        fdv: pair.fdv,
        trendingScore,
        pairAddress: pair.pairAddress,
        dexId: pair.dexId,
      };

      // Keep the pair with highest liquidity for each token
      const existing = tokenMap.get(tokenAddress);
      if (!existing || token.liquidity > existing.liquidity) {
        tokenMap.set(tokenAddress, token);
      }
    }

    // Convert to array and sort by trending score
    const trendingTokens = Array.from(tokenMap.values())
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);

    console.log(`✅ Returning top ${trendingTokens.length} trending tokens`);

    return NextResponse.json(
      {
        success: true,
        count: trendingTokens.length,
        filters: {
          minLiquidity,
          minVolume,
          limit,
        },
        tokens: trendingTokens,
        metadata: {
          source: 'DexScreener',
          chain: 'PulseChain',
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
    console.error('Error fetching trending tokens:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch trending tokens',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
