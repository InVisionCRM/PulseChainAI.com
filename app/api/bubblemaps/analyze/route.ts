import { NextRequest, NextResponse } from 'next/server';
import { analyzeWalletClusters } from '@/lib/bubblemaps/clusterAnalyzer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenAddress = searchParams.get('tokenAddress');
    const topHolders = parseInt(searchParams.get('topHolders') || '50');
    const daysBack = parseInt(searchParams.get('daysBack') || '30');

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return NextResponse.json(
        { error: 'Invalid token address format' },
        { status: 400 }
      );
    }

    console.log(`[bubblemaps-analyze] Analyzing clusters for token ${tokenAddress}, top ${topHolders} holders, ${daysBack} days back`);

    const result = await analyzeWalletClusters({
      tokenAddress,
      topHoldersCount: topHolders,
      daysBack
    });

    console.log(`[bubblemaps-analyze] Found ${result.clusters.length} clusters`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[bubblemaps-analyze] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}