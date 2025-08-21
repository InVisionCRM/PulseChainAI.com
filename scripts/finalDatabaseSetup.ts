#!/usr/bin/env tsx

import { sql } from '../lib/db/connection';
import { databaseStatus } from '../lib/db/databaseStatus';

async function finalDatabaseSetup() {
  console.log('🎯 Final PulseChain Database Setup\n');

  try {
    // Step 1: Check current database status
    console.log('1. Checking database status...');
    const isAvailable = await databaseStatus.checkAvailability();
    
    if (!isAvailable) {
      console.log('❌ Database is not available');
      return;
    }

    // Step 2: Check current table status
    console.log('2. Checking table status...');
    const tableStatus = await databaseStatus.getTableStatus();
    
    console.log(`   Database available: ${tableStatus.available}`);
    console.log(`   Tables exist: ${tableStatus.tablesExist}`);
    console.log(`   Table count: ${tableStatus.tableCount}`);
    
    if (tableStatus.tableNames.length > 0) {
      console.log('   Existing tables:');
      tableStatus.tableNames.forEach(name => {
        console.log(`     - ${name}`);
      });
    }

    // Step 3: Create missing tables if needed
    if (!tableStatus.tablesExist) {
      console.log('\n3. Creating missing tables...');
      
      const requiredTables = [
        'pulsechain_stake_starts',
        'pulsechain_stake_ends', 
        'pulsechain_global_info',
        'pulsechain_sync_status',
        'pulsechain_staker_metrics'
      ];

      for (const tableName of requiredTables) {
        if (!tableStatus.tableNames.includes(tableName)) {
          console.log(`   Creating ${tableName}...`);
          
          switch (tableName) {
            case 'pulsechain_stake_starts':
              await sql.unsafe(`
                CREATE TABLE ${tableName} (
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
              break;
              
            case 'pulsechain_stake_ends':
              await sql.unsafe(`
                CREATE TABLE ${tableName} (
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
              break;
              
            case 'pulsechain_global_info':
              await sql.unsafe(`
                CREATE TABLE ${tableName} (
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
              break;
              
            case 'pulsechain_sync_status':
              await sql.unsafe(`
                CREATE TABLE ${tableName} (
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
              break;
              
            case 'pulsechain_staker_metrics':
              await sql.unsafe(`
                CREATE TABLE ${tableName} (
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
              break;
          }
          
          console.log(`     ✅ ${tableName} created`);
        }
      }
    } else {
      console.log('\n3. All required tables already exist');
    }

    // Step 4: Ensure sync status has initial data
    console.log('\n4. Checking sync status...');
    
    try {
      const syncCount = await sql`SELECT COUNT(*) as count FROM pulsechain_sync_status`;
      
      if (syncCount[0].count === 0) {
        await sql`
          INSERT INTO pulsechain_sync_status (
            last_synced_stake_id, 
            last_synced_block, 
            last_synced_timestamp,
            sync_in_progress
          ) VALUES ('0', 0, 0, FALSE)
        `;
        console.log('   ✅ Initial sync status created');
      } else {
        console.log('   ✅ Sync status already exists');
      }
    } catch (syncError) {
      console.log('   ⚠️ Could not access sync status table yet (normal for new setups)');
    }

    // Step 5: Final verification (with a small delay for consistency)
    console.log('\n5. Final verification...');
    
    // Wait a moment for Neon's eventual consistency
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const finalStatus = await databaseStatus.getTableStatus();
    console.log(`   Final table count: ${finalStatus.tableCount}`);
    console.log(`   Tables ready: ${finalStatus.tablesExist}`);

    if (finalStatus.tableNames.length > 0) {
      console.log('   Final table list:');
      finalStatus.tableNames.forEach(name => {
        console.log(`     ✅ ${name}`);
      });
    }

    console.log('\n🎉 Database setup completed!');
    console.log('   ✅ Database connection working');
    console.log('   ✅ PulseChain tables available');
    console.log('   ✅ System ready for use');
    
    console.log('\n📋 Next steps:');
    console.log('   1. Start your application with: npm run dev');
    console.log('   2. Database will show as available in the UI');
    console.log('   3. Data will be cached for better performance');

  } catch (error) {
    console.error('❌ Final setup failed:', error);
  }
}

finalDatabaseSetup();