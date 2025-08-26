import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    // Get all constraints on hex_stake_starts table
    const constraints = await sql`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'hex_stake_starts'
        AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `;

    return NextResponse.json({
      success: true,
      data: {
        constraints,
        message: 'Constraints on hex_stake_starts table'
      }
    });

  } catch (error) {
    console.error('Check constraints error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}