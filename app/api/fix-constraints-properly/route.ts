import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function POST() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    console.log('🔧 Properly fixing database constraints for multi-network...');
    const operations = [];

    try {
      // Drop the problematic single-column unique constraint
      await sql.unsafe(`ALTER TABLE hex_stake_starts DROP CONSTRAINT IF EXISTS hex_stake_starts_stake_id_key CASCADE`);
      operations.push('✅ Dropped single stake_id unique constraint');
    } catch (e) {
      operations.push(`⚠️ Could not drop constraint: ${e}`);
    }

    try {
      // Drop any existing composite constraint first
      await sql.unsafe(`ALTER TABLE hex_stake_starts DROP CONSTRAINT IF EXISTS hex_stake_starts_stake_id_network_unique CASCADE`);
      operations.push('✅ Dropped existing composite constraint');
    } catch (e) {
      operations.push(`⚠️ No existing composite constraint: ${e}`);
    }

    try {
      // Add the proper composite unique constraint
      await sql.unsafe(`ALTER TABLE hex_stake_starts ADD CONSTRAINT hex_stake_starts_stake_id_network_unique UNIQUE (stake_id, network)`);
      operations.push('✅ Added composite unique constraint (stake_id, network)');
    } catch (e) {
      operations.push(`❌ Error adding composite constraint: ${e}`);
    }

    // Verify final state
    const finalConstraints = await sql`
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
        finalConstraints,
        message: 'Database constraints properly fixed'
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