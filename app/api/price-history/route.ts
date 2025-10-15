import { NextRequest, NextResponse } from 'next/server';
import { onChainDexPriceService } from '@/services/onChainDexPriceService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pairAddress = searchParams.get('pairAddress');
    const chain = searchParams.get('chain') || '0x171'; // Default to PulseChain
    const timeRange = searchParams.get('timeRange') as '1H' | '1D' | '1W' | '1M' | '1Y' | 'ALL' || '1D';

    if (!pairAddress) {
      return NextResponse.json(
        { error: 'pairAddress is required' },
        { status: 400 }
      );
    }

    // Only support PulseChain
    if (chain !== '0x171' && chain !== '369') {
      return NextResponse.json(
        { error: 'Only PulseChain (0x171 or 369) is supported' },
        { status: 400 }
      );
    }

    console.log(`🔍 Fetching on-chain price history for pair ${pairAddress}, range: ${timeRange}`);

    let priceHistory: { timestamp: number; value: number; volume?: number }[] = [];

    try {
      // Reconstruct price history from on-chain Sync events
      priceHistory = await onChainDexPriceService.getPriceHistoryFromChain(
        pairAddress,
        timeRange
      );
      
      if (priceHistory.length > 0) {
        console.log(`✅ Successfully reconstructed ${priceHistory.length} price points from on-chain data`);
      } else {
        console.warn('⚠️ No price data found for this pair/timerange');
      }
    } catch (error) {
      console.error('❌ On-chain price reconstruction failed:', error);
      throw error;
    }

    if (priceHistory.length === 0) {
      return NextResponse.json(
        {
          error: 'No price data available. This could mean: 1) The pair address is invalid, 2) No Sync events found for this pair, or 3) The timeframe is too far back.',
          data: [],
          source: 'on-chain'
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        data: priceHistory,
        count: priceHistory.length,
        success: true,
        source: 'on-chain'
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('❌ Error fetching price history:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch price history',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
