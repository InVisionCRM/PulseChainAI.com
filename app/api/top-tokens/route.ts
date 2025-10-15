import { NextRequest, NextResponse } from 'next/server';
import { dexscreenerTopTokensApi } from '@/services/dexscreenerTopTokensApi';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'volume'; // volume, gainers, losers, liquidity, new, trending
    const limit = parseInt(searchParams.get('limit') || '50');

    console.log(`Fetching top tokens sorted by: ${sortBy}, limit: ${limit}`);

    let tokens;

    switch (sortBy) {
      case 'gainers':
        tokens = await dexscreenerTopTokensApi.getTopGainers(limit);
        break;
      case 'losers':
        tokens = await dexscreenerTopTokensApi.getTopLosers(limit);
        break;
      case 'liquidity':
        tokens = await dexscreenerTopTokensApi.getTopByLiquidity(limit);
        break;
      case 'new':
        tokens = await dexscreenerTopTokensApi.getNewTokens(limit);
        break;
      case 'trending':
        tokens = await dexscreenerTopTokensApi.getTrendingTokens(limit);
        break;
      case 'volume':
      default:
        tokens = await dexscreenerTopTokensApi.getTopTokensByVolume(limit);
        break;
    }

    return NextResponse.json(
      {
        success: true,
        sortBy,
        count: tokens.length,
        tokens,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    console.error('Error fetching top tokens:', error);
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
