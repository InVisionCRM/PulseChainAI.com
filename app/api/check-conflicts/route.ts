import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    // Check for stake_id conflicts between networks
    const conflicts = await sql`
      SELECT stake_id, COUNT(*) as count, array_agg(network) as networks
      FROM hex_stake_starts
      GROUP BY stake_id
      HAVING COUNT(*) > 1
      ORDER BY stake_id
    `;

    // Get sample data from each network
    const ethereumSample = await sql`
      SELECT stake_id, network, staker_addr
      FROM hex_stake_starts 
      WHERE network = 'ethereum'
      ORDER BY id
      LIMIT 5
    `;

    const pulsechainSample = await sql`
      SELECT stake_id, network, staker_addr
      FROM hex_stake_starts 
      WHERE network = 'pulsechain'
      ORDER BY id
      LIMIT 5
    `;

    // Check the stake_id ranges
    const stakeIdRanges = await sql`
      SELECT 
        network,
        MIN(CAST(stake_id AS INTEGER)) as min_stake_id,
        MAX(CAST(stake_id AS INTEGER)) as max_stake_id,
        COUNT(*) as total_stakes
      FROM hex_stake_starts
      WHERE stake_id ~ '^[0-9]+$'  -- Only numeric stake_ids
      GROUP BY network
      ORDER BY network
    `;

    return NextResponse.json({
      success: true,
      data: {
        conflicts: conflicts.length,
        conflictDetails: conflicts.slice(0, 10), // First 10 conflicts
        ethereumSample,
        pulsechainSample,
        stakeIdRanges,
        message: 'Conflict analysis complete'
      }
    });

  } catch (error) {
    console.error('Check conflicts error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}