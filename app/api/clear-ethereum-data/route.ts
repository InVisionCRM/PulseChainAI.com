import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    // Clear all Ethereum data
    const deletedStakes = await sql`
      DELETE FROM hex_stake_starts WHERE network = 'ethereum'
    `;
    
    const deletedGlobal = await sql`
      DELETE FROM hex_global_info WHERE network = 'ethereum'
    `;
    
    const deletedSync = await sql`
      DELETE FROM hex_sync_status WHERE network = 'ethereum'
    `;

    // Check remaining data
    const remainingStakes = await sql`
      SELECT network, COUNT(*) as count
      FROM hex_stake_starts
      GROUP BY network
    `;

    return NextResponse.json({
      success: true,
      data: {
        deletedStakes: deletedStakes.length,
        deletedGlobal: deletedGlobal.length,
        deletedSync: deletedSync.length,
        remainingData: remainingStakes,
        message: 'Cleared all Ethereum data from database'
      }
    });

  } catch (error) {
    console.error('Clear Ethereum data error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}