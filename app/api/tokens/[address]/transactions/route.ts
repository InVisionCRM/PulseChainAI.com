import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    
    if (!address) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    // First, get the token info from DexScreener to find the pair address
    const searchResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(address)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`DexScreener search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    
    // Find the PulseChain pair for this token
    const pulsechainPair = searchData.pairs?.find((pair: any) => 
      pair.chainId === 'pulsechain' && 
      (pair.baseToken.address.toLowerCase() === address.toLowerCase() || 
       pair.quoteToken.address.toLowerCase() === address.toLowerCase())
    );

    if (!pulsechainPair) {
      return NextResponse.json(
        { error: 'No PulseChain pair found for this token' },
        { status: 404 }
      );
    }

    // Get pair details from DexScreener API (which provides transaction counts but not individual transactions)
    const pairResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/pulsechain/${pulsechainPair.pairAddress}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!pairResponse.ok) {
      throw new Error(`DexScreener pair request failed: ${pairResponse.status}`);
    }

    const pairData = await pairResponse.json();
    const pair = pairData.pair;
    
    // DexScreener API doesn't provide individual transaction data, only aggregated counts
    // Return a message explaining this limitation along with available data
    return NextResponse.json({
      items: [],
      message: 'DexScreener API does not provide individual transaction data. Only aggregated transaction counts are available.',
      transactionCounts: {
        last5Minutes: pair?.txns?.m5 || { buys: 0, sells: 0 },
        last1Hour: pair?.txns?.h1 || { buys: 0, sells: 0 },
        last6Hours: pair?.txns?.h6 || { buys: 0, sells: 0 },
        last24Hours: pair?.txns?.h24 || { buys: 0, sells: 0 }
      },
      pairInfo: {
        pairAddress: pair?.pairAddress,
        baseToken: pair?.baseToken,
        quoteToken: pair?.quoteToken,
        priceUsd: pair?.priceUsd,
        volume24h: pair?.volume?.h24
      }
    });
  } catch (error) {
    console.error('Error fetching token transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
