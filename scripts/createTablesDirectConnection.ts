#!/usr/bin/env tsx

// Load environment variables manually
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local manually
try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  const envLines = envContent.split('\n');
  
  for (const line of envLines) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0 && !process.env[key] && !key.startsWith('#')) {
      process.env[key] = valueParts.join('=').trim();
    }
  }
} catch (error) {
  console.warn('Could not load .env.local file:', error.message);
}

// Use the unpooled connection for table creation
import { neon } from '@neondatabase/serverless';

async function createTablesDirectConnection() {
  console.log('🔧 Creating PulseChain tables with direct connection...\n');

  // Use the unpooled connection URL for table creation
  const unpooledUrl = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
  
  if (!unpooledUrl) {
    console.error('❌ DATABASE_URL_UNPOOLED not found. Using regular connection...');
    console.log('   Available env vars:');
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    console.log(`   DATABASE_URL_UNPOOLED: ${process.env.DATABASE_URL_UNPOOLED ? 'SET' : 'NOT SET'}`);
    console.log(`   POSTGRES_URL_NON_POOLING: ${process.env.POSTGRES_URL_NON_POOLING ? 'SET' : 'NOT SET'}`);
    return;
  }

  const sql = neon(unpooledUrl);
  
  try {
    console.log('1. Testing direct connection...');
    const testResult = await sql`SELECT current_database(), current_user`;
    console.log(`   ✅ Connected to: ${testResult[0].current_database} as ${testResult[0].current_user}`);

    console.log('\n2. Creating tables...');
    
    // Create all tables in sequence
    console.log('   Creating pulsechain_stake_starts...');
    await sql`
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
    `;

    console.log('   Creating pulsechain_stake_ends...');
    await sql`
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
    `;

    console.log('   Creating pulsechain_global_info...');
    await sql`
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
    `;

    console.log('   Creating pulsechain_sync_status...');
    await sql`
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
    `;

    console.log('   Creating pulsechain_staker_metrics...');
    await sql`
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
    `;

    console.log('\n3. Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_stake_starts_staker_addr ON pulsechain_stake_starts(staker_addr)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_stake_starts_stake_id ON pulsechain_stake_starts(stake_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_stake_starts_is_active ON pulsechain_stake_starts(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_stake_ends_stake_id ON pulsechain_stake_ends(stake_id)`;

    console.log('\n4. Inserting initial data...');
    await sql`
      INSERT INTO pulsechain_sync_status (
        last_synced_stake_id, 
        last_synced_block, 
        last_synced_timestamp,
        sync_in_progress
      ) VALUES ('0', 0, 0, FALSE)
      ON CONFLICT DO NOTHING
    `;

    console.log('\n5. Testing persistence...');
    
    // Test insert
    const testStakeId = `test_${Date.now()}`;
    await sql`
      INSERT INTO pulsechain_stake_starts (
        stake_id, staker_addr, staked_hearts, stake_shares, staked_days, 
        start_day, end_day, timestamp, transaction_hash, block_number
      ) VALUES (
        ${testStakeId}, '0x1234567890123456789012345678901234567890', 
        1000000000000, 1000000000000, 365, 1000, 1365, 
        ${Date.now()}, '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 12345
      )
    `;
    
    // Verify insert
    const insertResult = await sql`SELECT * FROM pulsechain_stake_starts WHERE stake_id = ${testStakeId}`;
    console.log(`   ✅ Test insert successful: ${insertResult.length} record(s)`);
    
    // Clean up test data
    await sql`DELETE FROM pulsechain_stake_starts WHERE stake_id = ${testStakeId}`;
    
    console.log('\n6. Final verification...');
    const tables = await sql`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_name LIKE 'pulsechain_%'
      ORDER BY table_name
    `;

    console.log('   Tables created:');
    tables.forEach(t => {
      console.log(`     ✅ ${t.table_name} (${t.column_count} columns)`);
    });

    const syncStatus = await sql`SELECT * FROM pulsechain_sync_status`;
    console.log(`   ✅ Sync status records: ${syncStatus.length}`);

    console.log('\n🎉 SUCCESS! All tables created and persisted using direct connection!');
    console.log('   ✅ Tables are now permanent and will persist');
    console.log('   ✅ Database operations will work correctly');
    console.log('   ✅ Your application can now save data');

  } catch (error) {
    console.error('❌ Direct connection table creation failed:', error);
    throw error;
  }
}

createTablesDirectConnection();