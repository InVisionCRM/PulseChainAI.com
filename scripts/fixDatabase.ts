#!/usr/bin/env tsx

import { sql } from '../lib/db/connection';

async function fixDatabase() {
  try {
    console.log('🔧 Checking and fixing PulseChain database tables...');
    
    // Check if our tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'pulsechain_%'
    `;
    
    console.log('PulseChain tables found:', tables.map(t => t.table_name));
    
    if (tables.length === 0) {
      console.log('🔧 Creating PulseChain tables...');
      
      // Create tables one by one
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS pulsechain_stake_starts (
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
      `);
      
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS pulsechain_stake_ends (
          id SERIAL PRIMARY KEY,
          stake_id VARCHAR(50) NOT NULL,
          staker_addr VARCHAR(42) NOT NULL,
          payout DECIMAL(30,8) DEFAULT 0,
          staked_hearts DECIMAL(30,8) NOT NULL,
          penalty DECIMAL(30,8) DEFAULT 0,
          served_days INTEGER NOT NULL,
          timestamp BIGINT NOT NULL,
          transaction_hash VARCHAR(66) NOT NULL,
          block_number BIGINT NOT NULL,
          network VARCHAR(20) DEFAULT 'pulsechain',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS pulsechain_global_info (
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
      `);
      
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS pulsechain_sync_status (
          id SERIAL PRIMARY KEY,
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
      `);
      
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS pulsechain_staker_metrics (
          id SERIAL PRIMARY KEY,
          staker_addr VARCHAR(42) UNIQUE NOT NULL,
          total_stakes INTEGER DEFAULT 0,
          active_stakes INTEGER DEFAULT 0,
          ended_stakes INTEGER DEFAULT 0,
          total_staked_hearts DECIMAL(30,8) DEFAULT 0,
          total_t_shares DECIMAL(30,8) DEFAULT 0,
          total_payouts DECIMAL(30,8) DEFAULT 0,
          total_penalties DECIMAL(30,8) DEFAULT 0,
          average_stake_length DECIMAL(10,2) DEFAULT 0,
          first_stake_date TIMESTAMP,
          last_stake_date TIMESTAMP,
          network VARCHAR(20) DEFAULT 'pulsechain',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indexes
      try {
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_starts_staker_addr ON pulsechain_stake_starts(staker_addr)`);
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_starts_stake_id ON pulsechain_stake_starts(stake_id)`);
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_starts_is_active ON pulsechain_stake_starts(is_active)`);
        console.log('✅ Created indexes');
      } catch (error) {
        console.warn('⚠️ Some indexes may already exist:', error);
      }
      
      // Insert initial sync status
      await sql`
        INSERT INTO pulsechain_sync_status (
          last_synced_stake_id, 
          last_synced_block, 
          last_synced_timestamp,
          sync_in_progress
        ) VALUES ('0', 0, 0, FALSE)
        ON CONFLICT DO NOTHING
      `;
      
      console.log('✅ PulseChain tables created successfully');
    } else {
      console.log('✅ PulseChain tables already exist');
    }
    
    // Verify tables were created
    const finalTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'pulsechain_%'
    `;
    
    console.log('Final PulseChain tables:', finalTables.map(t => t.table_name));
    
  } catch (error) {
    console.error('❌ Error fixing database:', error);
  }
}

fixDatabase();