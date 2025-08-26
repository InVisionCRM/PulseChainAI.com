import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    // Check for both old and new table names
    const oldTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'pulsechain_%'
      ORDER BY table_name
    `;

    const newTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'hex_%'
      ORDER BY table_name
    `;

    // Check data in any existing table
    let dataCheck = null;
    if (newTables.length > 0 && newTables.find(t => t.table_name === 'hex_stake_starts')) {
      try {
        dataCheck = await sql`SELECT COUNT(*) as count, network FROM hex_stake_starts GROUP BY network`;
      } catch (e) {
        dataCheck = `Error checking hex_stake_starts: ${e}`;
      }
    } else if (oldTables.length > 0 && oldTables.find(t => t.table_name === 'pulsechain_stake_starts')) {
      try {
        dataCheck = await sql`SELECT COUNT(*) as count, network FROM pulsechain_stake_starts GROUP BY network`;
      } catch (e) {
        dataCheck = `Error checking pulsechain_stake_starts: ${e}`;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        oldTables: oldTables.map(t => t.table_name),
        newTables: newTables.map(t => t.table_name),
        dataCheck
      }
    });

  } catch (error) {
    console.error('Check tables error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}