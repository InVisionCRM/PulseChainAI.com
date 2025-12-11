import { NextRequest, NextResponse } from 'next/server';
import { fetchStat, availableStats } from '@/lib/stats';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ statId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { statId } = resolvedParams;
    const { searchParams } = new URL(request.url);
    
    // Check if stat exists
    const statConfig = availableStats.find(s => s.id === statId);
    if (!statConfig) {
      return NextResponse.json(
        { error: `Stat '${statId}' not found` },
        { status: 404 }
      );
    }
    
    // Get token address from query params
    const address = searchParams.get('address');
    if (!address) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid token address format' },
        { status: 400 }
      );
    }
    
    // Get optional wallet address for tokenBalance stat
    const walletAddress = searchParams.get('walletAddress') || undefined;
    
    // Fetch the stat
    const result = await fetchStat(statId, address, walletAddress);
    
    // Return the result
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Error fetching stat:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch stat',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

// Enable edge runtime for faster response times
export const runtime = 'nodejs';

