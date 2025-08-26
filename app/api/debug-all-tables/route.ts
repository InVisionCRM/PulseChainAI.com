import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    // Get all table names
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    // Check for any ethereum-related data
    const ethereumCheck = await sql`
      SELECT 'pulsechain_stake_starts' as table_name, network, COUNT(*) as count
      FROM pulsechain_stake_starts 
      WHERE network = 'ethereum'
      GROUP BY network
      UNION ALL
      SELECT 'pulsechain_stake_starts' as table_name, network, COUNT(*) as count
      FROM pulsechain_stake_starts 
      WHERE network = 'pulsechain'
      GROUP BY network
    `;

    return NextResponse.json({
      success: true,
      data: {
        allTables: tables.map(t => t.table_name),
        networkData: ethereumCheck
      }
    });

  } catch (error) {
    console.error('Debug all tables error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}