import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    // Get current stake count
    const stakeCount = await sql`SELECT COUNT(*) as count FROM pulsechain_stake_starts`;
    const totalStakes = parseInt(stakeCount[0].count);

    // Get highest stake ID
    const maxStakeId = await sql`SELECT MAX(CAST(stake_id AS INTEGER)) as max_id FROM pulsechain_stake_starts`;
    const latestStakeId = maxStakeId[0].max_id?.toString() || '0';

    // Update sync status with correct values
    await sql`
      UPDATE pulsechain_sync_status 
      SET 
        total_stakes_synced = ${totalStakes},
        last_synced_stake_id = ${latestStakeId},
        last_sync_completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM pulsechain_sync_status ORDER BY id DESC LIMIT 1)
    `;

    return NextResponse.json({
      success: true,
      data: {
        totalStakes,
        latestStakeId,
        message: 'Sync status updated successfully'
      }
    });

  } catch (error) {
    console.error('Fix sync status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}