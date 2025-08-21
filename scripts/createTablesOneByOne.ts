#!/usr/bin/env tsx

import { sql } from '../lib/db/connection';

async function createTablesOneByOne() {
  try {
    console.log('🔧 Creating PulseChain tables one by one...');
    
    // Create stake starts table
    console.log('Creating pulsechain_stake_starts...');
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
    console.log('✅ Created pulsechain_stake_starts');
    
    // Create stake ends table
    console.log('Creating pulsechain_stake_ends...');
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
    console.log('✅ Created pulsechain_stake_ends');
    
    // Create global info table
    console.log('Creating pulsechain_global_info...');
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
    console.log('✅ Created pulsechain_global_info');
    
    // Create sync status table
    console.log('Creating pulsechain_sync_status...');
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
    console.log('✅ Created pulsechain_sync_status');
    
    // Create staker metrics table
    console.log('Creating pulsechain_staker_metrics...');
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
    console.log('✅ Created pulsechain_staker_metrics');
    
    // Add a small delay before checking tables
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check what tables were created
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'pulsechain_%'
    `;
    
    console.log('✅ PulseChain tables created:', tables.map(t => t.table_name));
    
    // Try to insert initial sync record
    try {
      console.log('Inserting initial sync record...');
      await sql`
        INSERT INTO pulsechain_sync_status (
          last_synced_stake_id, 
          last_synced_block, 
          last_synced_timestamp,
          sync_in_progress
        ) VALUES ('0', 0, 0, FALSE)
        ON CONFLICT DO NOTHING
      `;
      console.log('✅ Initial sync record inserted');
    } catch (insertError) {
      console.warn('⚠️ Could not insert initial sync record:', insertError);
    }
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  }
}

createTablesOneByOne();