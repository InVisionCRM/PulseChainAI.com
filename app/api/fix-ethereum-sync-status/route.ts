import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    // Get current Ethereum stake count
    const stakeCount = await sql`
      SELECT COUNT(*) as count 
      FROM hex_stake_starts 
      WHERE network = 'ethereum'
    `;
    const totalStakes = parseInt(stakeCount[0].count);

    // Get highest Ethereum stake ID
    const maxStakeId = await sql`
      SELECT MAX(CAST(stake_id AS INTEGER)) as max_id 
      FROM hex_stake_starts 
      WHERE network = 'ethereum'
    `;
    const latestStakeId = maxStakeId[0].max_id?.toString() || '0';

    // Update sync status for Ethereum with correct values
    await sql`
      UPDATE hex_sync_status 
      SET 
        total_stakes_synced = ${totalStakes},
        last_synced_stake_id = ${latestStakeId},
        last_sync_completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE network = 'ethereum'
    `;

    // If no Ethereum sync status exists, create it
    const insertResult = await sql`
      INSERT INTO hex_sync_status (
        network, 
        last_synced_stake_id, 
        total_stakes_synced, 
        last_sync_completed_at,
        sync_in_progress
      ) 
      VALUES ('ethereum', ${latestStakeId}, ${totalStakes}, CURRENT_TIMESTAMP, false)
      ON CONFLICT (id) DO NOTHING
    `;

    return NextResponse.json({
      success: true,
      data: {
        totalStakes,
        latestStakeId,
        message: 'Ethereum sync status updated successfully'
      }
    });

  } catch (error) {
    console.error('Fix Ethereum sync status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}