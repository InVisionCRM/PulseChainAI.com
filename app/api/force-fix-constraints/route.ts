import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function POST() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    console.log('🔨 Force fixing database constraints...');
    const operations = [];

    // Get all current constraints
    const currentConstraints = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
      AND table_name = 'hex_stake_starts'
      AND constraint_type IN ('UNIQUE', 'FOREIGN KEY')
    `;

    operations.push(`Found ${currentConstraints.length} existing constraints`);

    // Drop ALL constraints except primary key
    for (const constraint of currentConstraints) {
      try {
        await sql.unsafe(`ALTER TABLE hex_stake_starts DROP CONSTRAINT IF EXISTS ${constraint.constraint_name} CASCADE`);
        operations.push(`✅ Dropped ${constraint.constraint_name}`);
      } catch (e) {
        operations.push(`❌ Could not drop ${constraint.constraint_name}: ${e}`);
      }
    }

    // Now add the correct composite constraint
    try {
      await sql.unsafe(`ALTER TABLE hex_stake_starts ADD CONSTRAINT hex_stake_starts_unique_stake_network UNIQUE (stake_id, network)`);
      operations.push('✅ Added new composite constraint (stake_id, network)');
    } catch (e) {
      operations.push(`❌ Error adding new constraint: ${e}`);
    }

    // Check final result
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
      GROUP BY tc.constraint_name, tc.constraint_type
      ORDER BY tc.constraint_name
    `;

    return NextResponse.json({
      success: true,
      data: {
        operations,
        finalConstraints,
        message: 'Force fix constraints completed'
      }
    });

  } catch (error) {
    console.error('Force fix constraints error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}