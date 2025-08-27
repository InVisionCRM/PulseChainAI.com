import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function POST() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    console.log('🔧 Fixing database constraints for multi-network support...');
    const operations = [];

    try {
      // Ensure the hex_stake_starts table exists and has the right structure
      await sql`
        CREATE TABLE IF NOT EXISTS hex_stake_starts (
          id SERIAL PRIMARY KEY,
          stake_id VARCHAR(50) NOT NULL,
          staker_addr VARCHAR(42) NOT NULL,
          staked_hearts VARCHAR(50) NOT NULL,
          stake_shares VARCHAR(50) NOT NULL,
          stake_t_shares VARCHAR(50),
          staked_days INTEGER NOT NULL,
          start_day INTEGER NOT NULL,
          end_day INTEGER NOT NULL,
          timestamp VARCHAR(20) NOT NULL,
          is_auto_stake BOOLEAN DEFAULT FALSE,
          transaction_hash VARCHAR(66) NOT NULL,
          block_number VARCHAR(20) NOT NULL,
          network VARCHAR(20) DEFAULT 'ethereum',
          is_active BOOLEAN DEFAULT TRUE,
          days_served INTEGER DEFAULT 0,
          days_left INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      operations.push('✅ Ensured hex_stake_starts table exists');
    } catch (e) {
      operations.push(`❌ Error creating table: ${e}`);
    }

    try {
      // Drop any existing unique constraint on stake_id alone
      await sql.unsafe(`ALTER TABLE hex_stake_starts DROP CONSTRAINT IF EXISTS hex_stake_starts_stake_id_key CASCADE`);
      operations.push('✅ Dropped old stake_id unique constraint');
    } catch (e) {
      operations.push(`⚠️ No old constraint to drop: ${e}`);
    }

    try {
      // Add the proper composite unique constraint
      await sql.unsafe(`ALTER TABLE hex_stake_starts ADD CONSTRAINT hex_stake_starts_stake_id_network_unique UNIQUE (stake_id, network)`);
      operations.push('✅ Added composite unique constraint (stake_id, network)');
    } catch (e) {
      operations.push(`⚠️ Constraint might already exist: ${e}`);
    }

    try {
      // Ensure hex_global_info table exists with network support
      await sql`
        CREATE TABLE IF NOT EXISTS hex_global_info (
          id SERIAL PRIMARY KEY,
          hex_day INTEGER NOT NULL,
          stake_shares_total VARCHAR(50) NOT NULL,
          stake_penalty_total VARCHAR(50) NOT NULL,
          locked_hearts_total VARCHAR(50) DEFAULT '0',
          latest_stake_id VARCHAR(50),
          timestamp VARCHAR(20) NOT NULL,
          network VARCHAR(20) DEFAULT 'ethereum',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (network, hex_day)
        )
      `;
      operations.push('✅ Ensured hex_global_info table exists');
    } catch (e) {
      operations.push(`❌ Error with global info table: ${e}`);
    }

    // Check final state
    const finalConstraints = await sql`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        string_agg(kcu.column_name, ', ') as columns
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
        message: 'Database constraints fixed for multi-network support'
      }
    });

  } catch (error) {
    console.error('Fix database constraints error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}