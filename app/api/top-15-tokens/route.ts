import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🏆 Fetching top 15 PulseChain tokens...');

    // Fetch multiple searches and combine
    const searches = ['PLSX', 'HEX', 'INC', 'WPLS', 'DAI', 'USDC', 'TIME', 'XGAME', 'PCOCK', 'PSSH', 'MOST', 'LOAN', 'SPARK', 'TONI', 'PHUX'];
    const allPairs: any[] = [];

    for (const searchTerm of searches) {
      try {
        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${searchTerm}`,
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.pairs) {
            allPairs.push(...data.pairs);
          }
        }
      } catch (err) {
        console.error(`Failed to fetch ${searchTerm}:`, err);
      }
    }

    console.log(`   Fetched ${allPairs.length} total pairs from searches`);

    // Filter for quality PulseChain pairs
    const pulsechainPairs = allPairs.filter((pair: any) =>
      pair.chainId === 'pulsechain' &&
      pair.liquidity?.usd >= 1000 &&
      pair.volume?.h24 >= 50
    );

    console.log(`   Found ${pulsechainPairs.length} pairs meeting criteria`);

    // Calculate trending scores and deduplicate by token address
    const tokenMap = new Map<string, any>();

    for (const pair of pulsechainPairs) {
      const tokenAddress = pair.baseToken?.address;
      if (!tokenAddress) continue;

      const priceChange = pair.priceChange?.h24 || 0;
      const volume = pair.volume?.h24 || 0;
      const liquidity = pair.liquidity?.usd || 0;
      const txCount = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);

      // Calculate trending score (same as ticker bar)
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

      const token = {
        address: tokenAddress,
        symbol: pair.baseToken?.symbol || 'UNKNOWN',
        name: pair.baseToken?.name || 'Unknown Token',
        priceUsd: parseFloat(pair.priceUsd || '0'),
        priceChange24h: priceChange,
        priceChange6h: pair.priceChange?.h6 || 0,
        priceChange1h: pair.priceChange?.h1 || 0,
        volume24h: volume,
        volume6h: pair.volume?.h6 || 0,
        liquidity: liquidity,
        fdv: pair.fdv,
        marketCap: pair.marketCap,
        txCount24h: txCount,
        buys24h: pair.txns?.h24?.buys || 0,
        sells24h: pair.txns?.h24?.sells || 0,
        pairAddress: pair.pairAddress,
        dexId: pair.dexId,
        trendingScore,
        url: pair.url,
      };

      // Keep the pair with highest liquidity for each token
      const existing = tokenMap.get(tokenAddress);
      if (!existing || token.liquidity > existing.liquidity) {
        tokenMap.set(tokenAddress, token);
      }
    }

    // Convert to array and sort by trending score
    const topTokens = Array.from(tokenMap.values())
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 15)
      .map((token, index) => ({
        ...token,
        rank: index + 1,
      }));

    console.log(`✅ Returning top ${topTokens.length} trending tokens`);

    return NextResponse.json(
      {
        success: true,
        count: topTokens.length,
        tokens: topTokens,
        metadata: {
          source: 'DexScreener',
          chain: 'PulseChain',
          timestamp: new Date().toISOString(),
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching top 15 tokens:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch top tokens',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
