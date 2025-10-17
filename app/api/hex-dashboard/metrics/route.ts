import { NextResponse } from 'next/server';
import { unifiedHexStakingService } from '@/services/unifiedHexStakingService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network') as 'ethereum' | 'pulsechain';

    if (!network || (network !== 'ethereum' && network !== 'pulsechain')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid network parameter. Must be "ethereum" or "pulsechain"'
      }, { status: 400 });
    }

    const metrics = await unifiedHexStakingService.getStakingMetrics(network);

    return NextResponse.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting staking metrics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get staking metrics'
    }, { status: 500 });
  }
}
