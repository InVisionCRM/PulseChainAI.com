import { NextRequest, NextResponse } from 'next/server';
import { searchPulsechain } from '@/lib/screener/dexscreener';

export const dynamic = 'force-dynamic';

/** Pair search across every PulseChain DEX (DexScreener proxy). */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return NextResponse.json({ error: 'q must be at least 2 characters' }, { status: 400 });
  }
  try {
    const pairs = await searchPulsechain(q);
    return NextResponse.json(
      { pairs },
      { headers: { 'Cache-Control': 's-maxage=10, stale-while-revalidate=30' } },
    );
  } catch (err) {
    console.error('GET /api/search failed:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 502 });
  }
}
