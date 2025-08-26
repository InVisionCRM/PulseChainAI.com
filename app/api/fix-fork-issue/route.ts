import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    const operations = [];

    // Update existing PulseChain stake IDs to be prefixed with network
    const pulsechainUpdated = await sql`
      UPDATE hex_stake_starts 
      SET stake_id = 'pulsechain_' || stake_id 
      WHERE network = 'pulsechain' 
      AND stake_id NOT LIKE 'pulsechain_%'
    `;
    operations.push(`✅ Updated ${pulsechainUpdated.length} PulseChain stakes with network prefix`);

    // Check current data state
    const networkCounts = await sql`
      SELECT network, COUNT(*) as count, 
             MIN(stake_id) as min_stake_id, 
             MAX(stake_id) as max_stake_id
      FROM hex_stake_starts
      GROUP BY network
    `;

    return NextResponse.json({
      success: true,
      data: {
        operations,
        networkCounts,
        message: 'Fixed fork overlap issue by prefixing stake IDs'
      }
    });

  } catch (error) {
    console.error('Fix fork issue error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}