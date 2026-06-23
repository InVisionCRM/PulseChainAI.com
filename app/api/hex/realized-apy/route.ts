import { NextRequest, NextResponse } from 'next/server';
import { hexStakingDb } from '@/lib/db/hexStakingDb';
import { realizedApyBuckets } from '@/lib/hex/realizedApy';

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const network = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as
    | 'ethereum'
    | 'pulsechain';
  try {
    const rows = await hexStakingDb.getEndedStakeReturns(network, 5000);
    const buckets = realizedApyBuckets(rows);
    return NextResponse.json(
      { network, sample: rows.length, buckets },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load realized returns' },
      { status: 500 },
    );
  }
}
