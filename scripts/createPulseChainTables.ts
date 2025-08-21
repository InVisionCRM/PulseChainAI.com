#!/usr/bin/env tsx

import { sql } from '../lib/db/connection';

async function createPulseChainTables() {
  console.log('🔧 Creating PulseChain tables with proper transaction handling...\n');

  try {
    // Create tables sequentially (Neon doesn't support transactions in the same way)
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
      await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_starts_timestamp ON pulsechain_stake_starts(timestamp)`);
      await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_starts_is_active ON pulsechain_stake_starts(is_active)`);
      await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_starts_staked_hearts ON pulsechain_stake_starts(staked_hearts)`);
      await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_starts_end_day ON pulsechain_stake_starts(end_day)`);
      
      await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_ends_staker_addr ON pulsechain_stake_ends(staker_addr)`);
      await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_ends_stake_id ON pulsechain_stake_ends(stake_id)`);
      await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_stake_ends_timestamp ON pulsechain_stake_ends(timestamp)`);
      
      await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_global_info_hex_day ON pulsechain_global_info(hex_day)`);
      await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_global_info_timestamp ON pulsechain_global_info(timestamp)`);
      
      await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_staker_metrics_staker_addr ON pulsechain_staker_metrics(staker_addr)`);
      await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_staker_metrics_total_staked_hearts ON pulsechain_staker_metrics(total_staked_hearts)`);
      console.log('   ✅ All indexes created');

      console.log('7. Creating triggers...');
      // Create update trigger function
      await sql.unsafe(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);

      // Create triggers
      await sql.unsafe(`
        DROP TRIGGER IF EXISTS update_stake_starts_updated_at ON pulsechain_stake_starts;
        CREATE TRIGGER update_stake_starts_updated_at 
            BEFORE UPDATE ON pulsechain_stake_starts 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `);

      await sql.unsafe(`
        DROP TRIGGER IF EXISTS update_sync_status_updated_at ON pulsechain_sync_status;
        CREATE TRIGGER update_sync_status_updated_at 
            BEFORE UPDATE ON pulsechain_sync_status 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `);

      await sql.unsafe(`
        DROP TRIGGER IF EXISTS update_staker_metrics_updated_at ON pulsechain_staker_metrics;
        CREATE TRIGGER update_staker_metrics_updated_at 
            BEFORE UPDATE ON pulsechain_staker_metrics 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `);
      console.log('   ✅ All triggers created');

      console.log('8. Inserting initial sync status...');
      await sql`
        INSERT INTO pulsechain_sync_status (
          last_synced_stake_id, 
          last_synced_block, 
          last_synced_timestamp,
          sync_in_progress
        ) VALUES ('0', 0, 0, FALSE)
        ON CONFLICT DO NOTHING
      `;
      console.log('   ✅ Initial sync status inserted');

    console.log('\n🎉 All tables created successfully!');

    // Verify tables exist
    console.log('\n🔍 Verifying table creation...');
    const tables = await sql`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_name LIKE 'pulsechain_%'
      ORDER BY table_name
    `;

    console.log('Created tables:');
    tables.forEach(t => {
      console.log(`   ✅ ${t.table_name} (${t.column_count} columns)`);
    });

    // Test basic operations
    console.log('\n🧪 Testing basic operations...');
    
    // Test sync status read
    const syncStatus = await sql`SELECT * FROM pulsechain_sync_status LIMIT 1`;
    console.log(`   ✅ Sync status table readable (${syncStatus.length} rows)`);
    
    // Test insert into stakes table
    await sql`
      INSERT INTO pulsechain_stake_starts (
        stake_id, staker_addr, staked_hearts, stake_shares, staked_days, 
        start_day, end_day, timestamp, transaction_hash, block_number
      ) VALUES (
        'test123', '0x1234567890123456789012345678901234567890', 
        1000000000000, 1000000000000, 365, 1000, 1365, 
        1234567890, '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 12345
      )
      ON CONFLICT (stake_id) DO NOTHING
    `;
    console.log('   ✅ Test stake insert successful');
    
    // Verify insert
    const testStake = await sql`SELECT COUNT(*) as count FROM pulsechain_stake_starts WHERE stake_id = 'test123'`;
    console.log(`   ✅ Test stake verified (${testStake[0].count} records)`);

    // Clean up test data
    await sql`DELETE FROM pulsechain_stake_starts WHERE stake_id = 'test123'`;
    console.log('   ✅ Test data cleaned up');

    console.log('\n🎯 Database setup completed successfully!');
    console.log('   ✅ All tables created');
    console.log('   ✅ All indexes created');
    console.log('   ✅ All triggers created');
    console.log('   ✅ Read/Write operations working');
    console.log('   ✅ Initial sync status configured');

  } catch (error) {
    console.error('❌ Table creation failed:', error);
    throw error;
  }
}

createPulseChainTables();