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
        DROP CONSTRAINT hex_stake_starts_stake_id_key
      `);
      operations.push('✅ Dropped old unique constraint hex_stake_starts_stake_id_key');
    } catch (e) {
      operations.push(`❌ Error dropping constraint: ${e}`);
    }

    try {
      // Create a new composite unique constraint on (stake_id, network)
      await sql.unsafe(`
        ALTER TABLE hex_stake_starts 
        ADD CONSTRAINT hex_stake_starts_stake_id_network_key 
        UNIQUE (stake_id, network)
      `);
      operations.push('✅ Added composite unique constraint hex_stake_starts_stake_id_network_key');
    } catch (e) {
      operations.push(`❌ Error adding composite constraint: ${e}`);
    }

    // Check constraints again
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

    return NextResponse.json({
      success: true,
      data: {
        operations,
        constraints,
        message: 'Fixed database constraints'
      }
    });

  } catch (error) {
    console.error('Fix constraint properly error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}