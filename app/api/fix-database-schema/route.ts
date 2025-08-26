import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    const operations = [];

    try {
      // Drop all existing unique constraints on stake_id
      const constraints = await sql`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'hex_stake_starts' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%stake_id%'
      `;
      
      for (const constraint of constraints) {
        await sql.unsafe(`ALTER TABLE hex_stake_starts DROP CONSTRAINT ${constraint.constraint_name} CASCADE`);
        operations.push(`✅ Dropped constraint: ${constraint.constraint_name}`);
      }
    } catch (e) {
      operations.push(`❌ Error dropping constraints: ${e}`);
    }

    try {
      // Drop any existing indexes on stake_id
      const indexes = await sql`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'hex_stake_starts' 
        AND indexdef LIKE '%stake_id%'
        AND indexname != 'hex_stake_starts_pkey'
      `;
      
      for (const index of indexes) {
        await sql.unsafe(`DROP INDEX IF EXISTS ${index.indexname}`);
        operations.push(`✅ Dropped index: ${index.indexname}`);
      }
    } catch (e) {
      operations.push(`❌ Error dropping indexes: ${e}`);
    }

    try {
      // Create proper unique constraint on (stake_id, network)
      await sql.unsafe(`
        ALTER TABLE hex_stake_starts 
        ADD CONSTRAINT hex_stake_starts_stake_id_network_unique 
        UNIQUE (stake_id, network)
      `);
      operations.push('✅ Added unique constraint on (stake_id, network)');
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
        message: 'Fixed database schema for multi-network support'
      }
    });

  } catch (error) {
    console.error('Fix database schema error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}