#!/usr/bin/env tsx

import { initializeDatabase, testDatabaseConnection, checkTablesExist } from '../lib/db/connection';
import { pulsechainSyncService } from '../lib/sync/pulsechainSyncService';

async function main() {
  console.log('🔧 Initializing PulseChain Staking Database...\n');

  try {
    // Test database connection
    console.log('1. Testing database connection...');
    const isConnected = await testDatabaseConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connection successful\n');

    // Check if tables exist
    console.log('2. Checking existing tables...');
    const tables = await checkTablesExist();
    console.log('Table status:', tables);
    console.log('');

    // Initialize database schema
    if (!tables.stakeStarts || !tables.syncStatus) {
      console.log('3. Initializing database schema...');
      await initializeDatabase();
      console.log('✅ Database schema initialized\n');
    } else {
      console.log('3. Database schema already exists\n');
    }

    // Ask user if they want to perform initial sync
    const shouldSync = process.argv.includes('--sync');
    
    if (shouldSync) {
      console.log('4. Performing initial data sync...');
      console.log('⚠️  This may take several minutes for the first sync...\n');
      
      const result = await pulsechainSyncService.performSync();
      
      if (result.success) {
        console.log(`✅ Initial sync completed:`);
        console.log(`   - New stakes: ${result.newStakes}`);
        console.log(`   - New stake ends: ${result.newStakeEnds}`);
        console.log(`   - Updated stakes: ${result.updatedStakes}\n`);
      } else {
        console.log(`❌ Initial sync failed: ${result.error}\n`);
      }
    } else {
      console.log('4. Skipping initial sync (use --sync flag to enable)\n');
    }

    console.log('🎉 Database initialization complete!');
    console.log('\nNext steps:');
    console.log('1. Your application will now use the database for faster queries');
    console.log('2. Data will be automatically synced every 30 minutes');
    console.log('3. You can manually trigger syncs through the admin interface');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);