import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const tokenAddress = searchParams.get('tokenAddress');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    console.log('[address-transactions] Request:', { address, tokenAddress, page, limit });

    if (!address) {
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
    }

    // Fetch transactions directly from PulseScan API
    const apiUrl = `https://api.scan.pulsechain.com/api/v2/addresses/${address}/transactions?page=${page}&limit=${limit}`;
    console.log('[address-transactions] Fetching from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('[address-transactions] PulseScan response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[address-transactions] PulseScan API error:`, response.status, response.statusText, errorText);
      return NextResponse.json(
        { error: `Failed to fetch transactions: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[address-transactions] Data received, items count:', data.items?.length || 0);
    let transactions = data.items || [];

    // Filter by token address if provided (check if transaction involves the token)
    if (tokenAddress) {
      const beforeFilter = transactions.length;
      transactions = transactions.filter((tx: any) => {
        // Check if transaction is to the token contract
        if (tx.to?.hash?.toLowerCase() === tokenAddress.toLowerCase()) {
          return true;
        }
        // Check if any token transfers involve this token
        if (tx.token_transfers && Array.isArray(tx.token_transfers)) {
          return tx.token_transfers.some((transfer: any) => 
            transfer.token?.address?.toLowerCase() === tokenAddress.toLowerCase()
          );
        }
        return false;
      });
      console.log(`[address-transactions] Filtered transactions: ${beforeFilter} -> ${transactions.length} (for token: ${tokenAddress})`);
    }

    console.log('[address-transactions] Returning:', transactions.length, 'transactions');
    return NextResponse.json({
      success: true,
      items: transactions,
      next_page_params: data.next_page_params,
    });

  } catch (error) {
    console.error('[address-transactions] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

