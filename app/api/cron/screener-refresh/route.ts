import { NextRequest, NextResponse } from 'next/server';
import { runRefresh } from '@/lib/screener/refresh';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Vercel cron (every minute): discover new pairs from factory logs and
 * refresh market data for the highest-priority pairs.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const summary = await runRefresh(45000);
    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    console.error('screener-refresh cron failed:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
