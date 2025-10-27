import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const priceUsd = parseFloat(searchParams.get('priceUsd') || '0');
    const priceWpls = parseFloat(searchParams.get('priceWpls') || '0');
    
    if (!address) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    console.log(`[token-transactions] Fetching transactions for token: ${address}, page: ${page}, limit: ${limit}`);

    // Fetch token transfers directly from PulseScan API
    const apiUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${address}/transfers?page=${page}&limit=${limit}`;
    console.log(`[token-transactions] Fetching from: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log(`[token-transactions] PulseScan response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[token-transactions] PulseScan API error:`, response.status, response.statusText, errorText);
      return NextResponse.json(
        { error: `Failed to fetch token transactions: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[token-transactions] Data received, items count: ${data.items?.length || 0}`);

    // Filter to only include 'token_transfer' type transactions (actual transfers between addresses)
    const transferTransactions = (data.items || []).filter((transfer: any) => {
      return transfer.type === 'token_transfer';
    });
    
    console.log(`[token-transactions] Filtered to token_transfer type only, count: ${transferTransactions.length}`);

    // Transform the data to match the expected format
    const transactions = transferTransactions.map((transfer: any) => {
      const tokenAmount = parseFloat(transfer.total?.value || '0');
      const decimals = parseInt(transfer.token?.decimals || '18');
      const formattedAmount = tokenAmount / Math.pow(10, decimals);
      
      // Calculate USD and WPLS values
      const usdValue = formattedAmount * priceUsd;
      const wplsValue = formattedAmount * priceWpls;
      
      return {
        txHash: transfer.tx_hash,
        timestamp: transfer.timestamp,
        type: transfer.type === 'token_transfer' ? 
          (transfer.from?.hash?.toLowerCase() === address.toLowerCase() ? 'sell' : 'buy') :
          transfer.type === 'token_minting' ? 'buy' :
          transfer.type === 'token_burning' ? 'sell' : 'transfer',
        from: transfer.from?.hash,
        to: transfer.to?.hash,
        amount: transfer.total?.value || '0',
        tokenSymbol: transfer.token?.symbol || 'TOKEN',
        tokenDecimals: transfer.token?.decimals || 18,
        tokenAddress: transfer.token?.address || address,
        value: usdValue, // Calculated USD value
        wplsValue: wplsValue, // Calculated WPLS value
        gasUsed: 0, // Not available in token transfers
        gasPrice: 0, // Not available in token transfers
        blockNumber: 0, // Not available in token transfers
        confirmations: 0 // Not available in token transfers
      };
    });

    return NextResponse.json({
      success: true,
      items: transactions,
      pagination: data.pagination || null,
      message: `Found ${transactions.length} token transactions`
    });

  } catch (error) {
    console.error('Error fetching token transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token transactions' },
      { status: 500 }
    );
  }
}
