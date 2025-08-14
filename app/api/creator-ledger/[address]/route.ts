import { NextRequest, NextResponse } from 'next/server';
import { pulsechainApi } from '@/services';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    
    if (!address) {
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
    }

    const result = await pulsechainApi.getAddressTransactions(address);
    
    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || 'Unknown error' }, { status: 500 });
    }

    if (!result.data.items || result.data.items.length === 0) {
      return NextResponse.json({
        creator: address,
        totalTransactions: 0,
        transactions: []
      });
    }

    // Enhanced transaction classification and processing
    const ledger = result.data.items?.map((tx: any) => {
      // Determine transaction type based on method name and contract creation
      let transactionType = 'Transfer';
      let methodDisplay = tx.method_name || 'Contract Creation';
      
      if (tx.created_contract !== null) {
        transactionType = 'Contract Creation';
        methodDisplay = 'Contract Creation';
      } else if (tx.method_name) {
        const methodLower = tx.method_name.toLowerCase();
        
        // Liquidity operations
        if (methodLower.includes('addliquidity') || methodLower.includes('add_liquidity')) {
          transactionType = 'Add Liquidity';
        } else if (methodLower.includes('removeliquidity') || methodLower.includes('remove_liquidity')) {
          transactionType = 'Remove Liquidity';
        } else if (methodLower.includes('swap') || methodLower.includes('exact')) {
          transactionType = 'Swap';
        } else if (methodLower.includes('transfer') || methodLower.includes('send')) {
          transactionType = 'Transfer';
        } else if (methodLower.includes('approve') || methodLower.includes('allowance')) {
          transactionType = 'Approve';
        } else if (methodLower.includes('mint') || methodLower.includes('create')) {
          transactionType = 'Mint';
        } else if (methodLower.includes('burn') || methodLower.includes('destroy')) {
          transactionType = 'Burn';
        } else if (methodLower.includes('stake') || methodLower.includes('lock')) {
          transactionType = 'Stake';
        } else if (methodLower.includes('unstake') || methodLower.includes('unlock')) {
          transactionType = 'Unstake';
        } else {
          transactionType = 'Contract Interaction';
        }
      }
      
      // Format addresses for display with contract names
      const formatAddress = (address: string, contractName?: string) => {
        if (!address || address === 'N/A') return 'N/A';
        const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
        return contractName ? `${contractName} (${shortAddress})` : shortAddress;
      };
      
      // Format value for display
      const formatValue = (value: string) => {
        if (!value || value === '0') return '0 PLS';
        try {
          const numValue = parseFloat(value);
          if (numValue > 0) {
            return `${(numValue / 1e18).toFixed(6)} PLS`;
          }
        } catch {
          // If parsing fails, return original value
        }
        return `${value} wei`;
      };
      
      return {
        hash: tx.hash,
        timestamp: tx.timestamp,
        blockNumber: tx.block_number,
        from: tx.from?.hash || 'N/A',
        to: tx.to?.hash || 'N/A',
        fromDisplay: formatAddress(tx.from?.hash, tx.from?.name),
        toDisplay: formatAddress(tx.to?.hash, tx.to?.name),
        value: tx.value,
        valueDisplay: formatValue(tx.value),
        gasUsed: tx.gas_used,
        gasPrice: tx.gas_price,
        status: tx.status,
        method: methodDisplay,
        isContractCreation: tx.created_contract !== null,
        contractAddress: tx.created_contract?.hash || tx.to?.hash || null,
        contractAddressDisplay: formatAddress(tx.created_contract?.hash || tx.to?.hash, tx.created_contract?.name || tx.to?.name),
        fee: tx.fee || '0',
        feeDisplay: formatValue(tx.fee || '0'),
        type: transactionType,
        // Token transfer data
        tokenTransfers: tx.token_transfers || []
      };
    }) || [];

    return NextResponse.json({
      creator: address,
      totalTransactions: ledger.length,
      transactions: ledger
    });

  } catch (error) {
    console.error('Creator ledger fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch creator ledger',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 