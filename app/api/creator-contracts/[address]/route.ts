import { NextRequest, NextResponse } from 'next/server';
import { pulsechainApi } from '@/services';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    
    if (!address) {
      return NextResponse.json({ error: 'Creator address is required' }, { status: 400 });
    }

    const result = await pulsechainApi.getAddressTransactions(address);
    
    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || 'Unknown error' }, { status: 404 });
    }

    // Filter for contract creation transactions
    const contractCreations = result.data.items?.filter((tx: any) => 
      tx.is_contract_creation === true
    ) || [];

    return NextResponse.json({
      creator: address,
      totalContracts: contractCreations.length,
      contracts: contractCreations.map((tx: any) => ({
        hash: tx.hash,
        timestamp: tx.timestamp,
        contractAddress: tx.to?.hash || null,
        value: tx.value
      }))
    });

  } catch (error) {
    console.error('Creator contracts fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch creator contracts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 