import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    // Get a sample of stakes with their network info
    const stakes = await sql`
      SELECT stake_id, network, staker_addr, staked_hearts, start_day, end_day, created_at 
      FROM pulsechain_stake_starts 
      ORDER BY id DESC 
      LIMIT 10
    `;

    // Get global info
    const globalInfo = await sql`
      SELECT hex_day, network, locked_hearts_total, created_at
      FROM pulsechain_global_info 
      ORDER BY id DESC 
      LIMIT 5
    `;

    // Get table counts by network
    const networkCounts = await sql`
      SELECT network, COUNT(*) as count
      FROM pulsechain_stake_starts 
      GROUP BY network
    `;

    // Get sync status
    const syncStatus = await sql`
      SELECT * FROM pulsechain_sync_status ORDER BY id DESC LIMIT 1
    `;

    return NextResponse.json({
      success: true,
      data: {
        sampleStakes: stakes,
        globalInfo,
        networkCounts,
        syncStatus: syncStatus[0] || null,
        totalStakes: stakes.length > 0 ? await sql`SELECT COUNT(*) as total FROM pulsechain_stake_starts` : []
      }
    });

  } catch (error) {
    console.error('Debug DB error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}