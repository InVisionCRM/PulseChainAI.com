#!/usr/bin/env tsx

import { sql } from '../lib/db/connection';

async function setupTables() {
  console.log('🔧 Setting up PulseChain database tables...\n');

  try {
    console.log('1. Creating pulsechain_stake_starts table...');
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
    console.log('   ✅ pulsechain_stake_starts created');

    console.log('2. Creating pulsechain_stake_ends table...');
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
    console.log('   ✅ pulsechain_stake_ends created');

    console.log('3. Creating pulsechain_global_info table...');
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
    console.log('   ✅ pulsechain_global_info created');

    console.log('4. Creating pulsechain_sync_status table...');
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
    console.log('   ✅ pulsechain_sync_status created');

    console.log('5. Creating pulsechain_staker_metrics table...');
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
    console.log('   ✅ pulsechain_staker_metrics created');

    console.log('6. Creating indexes...');
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_starts_staker_addr ON pulsechain_stake_starts(staker_addr)`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_starts_stake_id ON pulsechain_stake_starts(stake_id)`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_starts_is_active ON pulsechain_stake_starts(is_active)`);
    console.log('   ✅ Indexes created');

    console.log('7. Inserting initial sync status...');
    const existingSync = await sql`SELECT COUNT(*) as count FROM pulsechain_sync_status`;
    if (existingSync[0].count === 0) {
      await sql`
        INSERT INTO pulsechain_sync_status (
          last_synced_stake_id, 
          last_synced_block, 
          last_synced_timestamp,
          sync_in_progress
        ) VALUES ('0', 0, 0, FALSE)
      `;
      console.log('   ✅ Initial sync status inserted');
    } else {
      console.log('   ✅ Sync status already exists');
    }

    console.log('\n🔍 Verifying table creation...');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'pulsechain_%'
      ORDER BY table_name
    `;

    console.log('Created PulseChain tables:');
    tables.forEach(t => {
      console.log(`   ✅ ${t.table_name}`);
    });

    console.log('\n🧪 Testing database operations...');
    
    // Test read operations
    const syncStatus = await sql`SELECT * FROM pulsechain_sync_status LIMIT 1`;
    console.log(`   ✅ Sync status read: ${syncStatus.length} record(s)`);
    
    // Test write operation
    await sql`
      INSERT INTO pulsechain_stake_starts (
        stake_id, staker_addr, staked_hearts, stake_shares, staked_days, 
        start_day, end_day, timestamp, transaction_hash, block_number
      ) VALUES (
        'test_setup_123', '0x1234567890123456789012345678901234567890', 
        1000000000000, 1000000000000, 365, 1000, 1365, 
        1234567890, '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 12345
      )
      ON CONFLICT (stake_id) DO NOTHING
    `;
    
    // Verify write
    const testStake = await sql`SELECT * FROM pulsechain_stake_starts WHERE stake_id = 'test_setup_123'`;
    console.log(`   ✅ Test stake write: ${testStake.length} record(s)`);
    
    // Clean up
    await sql`DELETE FROM pulsechain_stake_starts WHERE stake_id = 'test_setup_123'`;
    console.log('   ✅ Test data cleaned up');

    console.log('\n🎯 Database setup completed successfully!');
    console.log('   ✅ All PulseChain tables created');
    console.log('   ✅ Indexes created for performance');
    console.log('   ✅ Read/Write operations working');
    console.log('   ✅ Database is ready for use');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  }
}

setupTables();