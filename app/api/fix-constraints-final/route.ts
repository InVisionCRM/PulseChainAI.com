import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    const operations = [];

    try {
      // Drop the problematic unique constraint on stake_id
      await sql.unsafe(`ALTER TABLE hex_stake_starts DROP CONSTRAINT IF EXISTS hex_stake_starts_stake_id_key CASCADE`);
      operations.push('✅ Dropped stake_id unique constraint');
    } catch (e) {
      operations.push(`❌ Error dropping stake_id constraint: ${e}`);
    }

    try {
      // Drop any existing unique indexes on stake_id alone
      await sql.unsafe(`DROP INDEX IF EXISTS hex_stake_starts_stake_id_key`);
      operations.push('✅ Dropped stake_id unique index');
    } catch (e) {
      operations.push(`❌ Error dropping stake_id index: ${e}`);
    }

    try {
      // Create the composite unique constraint
      await sql.unsafe(`ALTER TABLE hex_stake_starts ADD CONSTRAINT hex_stake_starts_stake_id_network_unique UNIQUE (stake_id, network)`);
      operations.push('✅ Added unique constraint on (stake_id, network)');
    } catch (e) {
      operations.push(`❌ Error adding composite constraint: ${e}`);
    }

    // Verify final state
    const finalConstraints = await sql`
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
        operations,
        finalConstraints,
        message: 'Fixed constraints for multi-network support'
      }
    });

  } catch (error) {
    console.error('Fix constraints error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}