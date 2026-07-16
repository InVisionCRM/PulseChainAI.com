import { NextRequest, NextResponse } from 'next/server';
import { blockscoutJson } from '@/lib/blockscout';
import { getChain, isChainKey } from '@/lib/chains/registry';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const tokenAddress = searchParams.get('tokenAddress');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const netRaw = (searchParams.get('network') || 'pulsechain').toLowerCase();
    const chain = isChainKey(netRaw) ? netRaw : 'pulsechain';
    const bases = chain === 'pulsechain' ? undefined
      : (getChain(chain).blockscoutApiBase ? [getChain(chain).blockscoutApiBase as string] : undefined);

    console.log('[address-transfers] Request:', { address, tokenAddress, page, limit });

    if (!address) {
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
    }

    // Build query parameters for token transfers. Kept to the common
    // denominator both Blockscout instances accept: the .box mirror rejects
    // `filter=to | from` (single-value enum only) and the `page` param
    // (cursor-based). Omitting `filter` already returns both directions, and
    // page 1 is the default, so this works on either instance.
    const params = new URLSearchParams({
      type: 'ERC-20,ERC-721,ERC-1155',
    });

    // Add token filter if provided
    if (tokenAddress) {
      params.append('token', tokenAddress);
    }
    // Only the primary supports numbered pages; request it just past page 1.
    if (page > 1) {
      params.append('page', page.toString());
    }

    // Fetch token transfers from Blockscout, failing over from the canonical
    // explorer to the scan.pulsechain.box mirror when the primary is down.
    const path = `/addresses/${address}/token-transfers?${params.toString()}`;
    const data = await blockscoutJson(path, bases ? { bases } : undefined);

    if (!data) {
      return NextResponse.json(
        { error: 'Failed to fetch transfers: explorer unavailable' },
        { status: 502 }
      );
    }

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

