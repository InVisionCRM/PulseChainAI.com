import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chain: string; pairAddress: string }> }
) {
  try {
    const { chain, pairAddress } = await params;
    
    // Fetch from DexScreener v4 endpoint
    const url = `https://io.dexscreener.com/dex/pair-details/v4/${chain}/${pairAddress}`;
    console.log('Proxying DexScreener V4 request:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://dexscreener.com/',
      },
      cache: 'no-store',
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

