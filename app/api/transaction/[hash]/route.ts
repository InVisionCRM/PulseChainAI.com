import { NextRequest, NextResponse } from 'next/server';
import { pulsechainApi } from '@/services';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    
    if (!hash) {
      return NextResponse.json({ error: 'Transaction hash is required' }, { status: 400 });
    }

    const result = await pulsechainApi.getTransaction(hash);
    
    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || 'Unknown error' }, { status: 404 });
    }

    return NextResponse.json(result.data);

  } catch (error) {
    console.error('Transaction fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch transaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 