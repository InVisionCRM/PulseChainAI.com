import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const tokenAddress = searchParams.get('tokenAddress');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    console.log('[address-transfers] Request:', { address, tokenAddress, page, limit });

    if (!address) {
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
    }

    // Build query parameters for token transfers
    const params = new URLSearchParams({
      type: 'ERC-20,ERC-721,ERC-1155',
      filter: 'to | from',
      page: page.toString(),
    });

    // Add token filter if provided
    if (tokenAddress) {
      params.append('token', tokenAddress);
    }

    // Fetch token transfers directly from PulseScan API
    const apiUrl = `https://api.scan.pulsechain.com/api/v2/addresses/${address}/token-transfers?${params.toString()}`;
    console.log('[address-transfers] Fetching from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('[address-transfers] PulseScan response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[address-transfers] PulseScan API error:`, response.status, response.statusText, errorText);
      return NextResponse.json(
        { error: `Failed to fetch transfers: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[address-transfers] Data received, items count:', data.items?.length || 0);

    console.log('[address-transfers] Returning:', data.items?.length || 0, 'transfers');
    return NextResponse.json({
      success: true,
      items: data.items || [],
      next_page_params: data.next_page_params,
    });

  } catch (error) {
    console.error('[address-transfers] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

