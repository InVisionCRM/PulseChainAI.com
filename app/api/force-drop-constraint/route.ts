import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    const operations = [];

    try {
      // Force drop the unique constraint on stake_id
      await sql.unsafe(`ALTER TABLE hex_stake_starts DROP CONSTRAINT hex_stake_starts_stake_id_key CASCADE`);
      operations.push('✅ Force dropped stake_id unique constraint');
    } catch (e) {
      operations.push(`❌ Error dropping stake_id constraint: ${e}`);
    }

    try {
      // Create a unique index on (stake_id, network) instead
      await sql.unsafe(`CREATE UNIQUE INDEX hex_stake_starts_stake_id_network_idx ON hex_stake_starts (stake_id, network)`);
      operations.push('✅ Created unique index on (stake_id, network)');
    } catch (e) {
      operations.push(`❌ Error creating composite index: ${e}`);
    }

    // Check final constraints
    const constraints = await sql`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'hex_stake_starts'
        AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
      GROUP BY tc.constraint_name, tc.constraint_type
      ORDER BY tc.constraint_name
    `;

    const indexes = await sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'hex_stake_starts' 
      AND indexdef LIKE '%UNIQUE%'
    `;

    return NextResponse.json({
      success: true,
      data: {
        operations,
        constraints,
        uniqueIndexes: indexes,
        message: 'Forced constraint changes'
      }
    });

  } catch (error) {
    console.error('Force drop constraint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}