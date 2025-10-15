import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pairAddress = searchParams.get('pairAddress');
    const resolution = searchParams.get('resolution') || '60'; // 60 = hourly, 1440 = daily
    
    if (!pairAddress) {
      return NextResponse.json({ error: 'pairAddress required' }, { status: 400 });
    }

    // Build the DexScreener internal API URL
    const url = `https://io.dexscreener.com/dex/chart/amm/v3/uniswap/bars/pulsechain/${pairAddress}?res=${resolution}&cb=2`;
    
    console.log('🔍 Fetching DexScreener chart:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://dexscreener.com/',
        'Origin': 'https://dexscreener.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.error('❌ DexScreener error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `DexScreener API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    console.log('✅ Chart data fetched:', data?.bars?.length || 0, 'candles');
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
      },
    });
  } catch (error) {
    console.error('❌ Error fetching DexScreener chart:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data', details: (error as Error).message },
      { status: 500 }
    );
  }
}

