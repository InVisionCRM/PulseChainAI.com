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

async function testPulsechainDataFetch() {
  console.log('🔍 Testing PulseChain Data Fetch and Database Sync\n');

  try {
    // Import the service
    console.log('1. Importing PulseChain service...');
    const { pulsechainHexStakingService } = await import('../services/pulsechainHexStakingService');

    // Check initial status
    console.log('\n2. Checking initial cache status...');
    const initialStatus = await pulsechainHexStakingService.getCacheStatus();
    console.log(`   Database available: ${initialStatus.databaseAvailable ? '✅' : '❌'}`);
    console.log(`   Stakes in memory: ${initialStatus.totalActiveStakes}`);
    console.log(`   Database counts: ${JSON.stringify(initialStatus.databaseCounts)}`);

    // Fetch active stakes
    console.log('\n3. Fetching active stakes...');
    const activeStakes = await pulsechainHexStakingService.getAllActiveStakes(true); // Force refresh
    console.log(`   ✅ Fetched ${activeStakes.length} active stakes`);

    // Check status after fetch
    console.log('\n4. Checking status after fetch...');
    const postFetchStatus = await pulsechainHexStakingService.getCacheStatus();
    console.log(`   Stakes in memory: ${postFetchStatus.totalActiveStakes}`);
    console.log(`   Database counts: ${JSON.stringify(postFetchStatus.databaseCounts)}`);

    // Test database directly
    console.log('\n5. Checking database directly...');
    const { pulsechainStakingDb } = await import('../lib/db/pulsechainStakingDb');
    const dbCounts = await pulsechainStakingDb.getTableCounts();
    console.log(`   Direct database counts: ${JSON.stringify(dbCounts)}`);

    console.log('\n🎯 Results:');
    if (activeStakes.length > 0) {
      console.log(`   ✅ GraphQL API working: ${activeStakes.length} stakes fetched`);
      
      if (dbCounts.stakeStarts > 0) {
        console.log(`   ✅ Database sync working: ${dbCounts.stakeStarts} stakes in DB`);
        console.log('   🎉 SUCCESS: Data is fetching and syncing to database!');
      } else {
        console.log(`   ❌ Database sync FAILED: 0 stakes in DB despite ${activeStakes.length} fetched`);
        console.log('   🔧 Need to debug the sync logic');
      }
    } else {
      console.log('   ❌ GraphQL API not returning data');
    }

    // Show sample stake
    if (activeStakes.length > 0) {
      console.log('\n📊 Sample stake data:');
      console.log(JSON.stringify(activeStakes[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPulsechainDataFetch();