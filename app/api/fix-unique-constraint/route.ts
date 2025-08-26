import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    const operations = [];

    try {
      // Drop the existing unique constraint on stake_id
      await sql.unsafe(`
        ALTER TABLE hex_stake_starts 
        DROP CONSTRAINT IF EXISTS hex_stake_starts_stake_id_key
      `);
      operations.push('✅ Dropped old unique constraint on stake_id');
    } catch (e) {
      operations.push(`⚠️ Could not drop constraint (may not exist): ${e}`);
    }

    try {
      // Create a new composite unique constraint on (stake_id, network)
      await sql.unsafe(`
        ALTER TABLE hex_stake_starts 
        ADD CONSTRAINT hex_stake_starts_stake_id_network_key 
        UNIQUE (stake_id, network)
      `);
      operations.push('✅ Added composite unique constraint on (stake_id, network)');
    } catch (e) {
      operations.push(`❌ Error adding composite constraint: ${e}`);
    }

    // Check current data state
    const networkCounts = await sql`
      SELECT network, COUNT(*) as count
      FROM hex_stake_starts
      GROUP BY network
    `;

    return NextResponse.json({
      success: true,
      data: {
        operations,
        currentData: networkCounts,
        message: 'Database constraint fixed for multi-network support'
      }
    });

  } catch (error) {
    console.error('Fix constraint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}