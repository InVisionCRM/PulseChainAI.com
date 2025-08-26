import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    const operations = [];

    // Create new multi-network tables
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS hex_stake_starts (
          id SERIAL PRIMARY KEY,
          stake_id VARCHAR(50) UNIQUE NOT NULL,
          staker_addr VARCHAR(42) NOT NULL,
          staked_hearts DECIMAL(30,8) NOT NULL,
          stake_shares DECIMAL(30,8) NOT NULL,
          stake_t_shares DECIMAL(30,8),
          staked_days INTEGER NOT NULL,
          start_day INTEGER NOT NULL,
          end_day INTEGER NOT NULL,
          timestamp BIGINT NOT NULL,
          is_auto_stake BOOLEAN DEFAULT FALSE,
          transaction_hash VARCHAR(66) NOT NULL,
          block_number BIGINT NOT NULL,
          network VARCHAR(20) DEFAULT 'pulsechain',
          is_active BOOLEAN DEFAULT TRUE,
          days_served INTEGER DEFAULT 0,
          days_left INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      operations.push('✅ Created hex_stake_starts table');
    } catch (e) {
      operations.push(`❌ Error creating hex_stake_starts: ${e}`);
    }

    try {
      await sql`
        CREATE TABLE IF NOT EXISTS hex_sync_status (
          id SERIAL PRIMARY KEY,
          network VARCHAR(20) NOT NULL,
          last_synced_stake_id VARCHAR(50),
          last_synced_block BIGINT,
          last_synced_timestamp BIGINT,
          total_stakes_synced INTEGER DEFAULT 0,
          total_stake_ends_synced INTEGER DEFAULT 0,
          sync_in_progress BOOLEAN DEFAULT FALSE,
          last_sync_started_at TIMESTAMP,
          last_sync_completed_at TIMESTAMP,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      operations.push('✅ Created hex_sync_status table');
    } catch (e) {
      operations.push(`❌ Error creating hex_sync_status: ${e}`);
    }

    try {
      await sql`
        CREATE TABLE IF NOT EXISTS hex_global_info (
          id SERIAL PRIMARY KEY,
          hex_day INTEGER NOT NULL,
          stake_shares_total DECIMAL(30,8) NOT NULL,
          stake_penalty_total DECIMAL(30,8) NOT NULL,
          locked_hearts_total DECIMAL(30,8) DEFAULT 0,
          latest_stake_id VARCHAR(50),
          timestamp BIGINT NOT NULL,
          network VARCHAR(20) DEFAULT 'pulsechain',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      operations.push('✅ Created hex_global_info table');
    } catch (e) {
      operations.push(`❌ Error creating hex_global_info: ${e}`);
    }

    // Copy data from pulsechain tables to new hex tables
    try {
      const copied = await sql`
        INSERT INTO hex_stake_starts 
        SELECT * FROM pulsechain_stake_starts
        ON CONFLICT (stake_id) DO NOTHING
      `;
      operations.push(`✅ Copied ${copied.length} stakes from pulsechain_stake_starts`);
    } catch (e) {
      operations.push(`❌ Error copying stake starts: ${e}`);
    }

    try {
      const copiedGlobal = await sql`
        INSERT INTO hex_global_info 
        SELECT * FROM pulsechain_global_info
        ON CONFLICT DO NOTHING
      `;
      operations.push(`✅ Copied ${copiedGlobal.length} global info records`);
    } catch (e) {
      operations.push(`❌ Error copying global info: ${e}`);
    }

    try {
      // Initialize sync status for both networks
      await sql`
        INSERT INTO hex_sync_status (network, last_synced_stake_id, last_synced_block, last_synced_timestamp, total_stakes_synced)
        VALUES ('pulsechain', '3645', 0, 0, 3645)
        ON CONFLICT DO NOTHING
      `;
      await sql`
        INSERT INTO hex_sync_status (network, last_synced_stake_id, last_synced_block, last_synced_timestamp, total_stakes_synced)
        VALUES ('ethereum', '0', 0, 0, 0)
        ON CONFLICT DO NOTHING
      `;
      operations.push('✅ Initialized sync status for both networks');
    } catch (e) {
      operations.push(`❌ Error initializing sync status: ${e}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        operations,
        message: 'Multi-network hex tables created successfully'
      }
    });

  } catch (error) {
    console.error('Create hex tables error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}