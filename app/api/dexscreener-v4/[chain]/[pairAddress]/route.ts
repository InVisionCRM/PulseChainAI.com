import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { chain: string; pairAddress: string } }
) {
  try {
    const { chain, pairAddress } = params;
    
    // Fetch from DexScreener v4 endpoint
    const url = `https://io.dexscreener.com/dex/pair-details/v4/${chain}/${pairAddress}`;
    console.log('Proxying DexScreener V4 request:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('DexScreener V4 API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `DexScreener API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Error proxying DexScreener V4 request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from DexScreener' },
      { status: 500 }
    );
  }
}

