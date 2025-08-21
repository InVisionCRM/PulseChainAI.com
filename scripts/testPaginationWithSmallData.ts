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

async function testPaginationWithSmallData() {
  console.log('🧪 Testing Pagination with Small Data Set\n');

  try {
    // Clean database first
    console.log('1. Cleaning database...');
    const { sql } = await import('../lib/db/connection');
    await sql`DELETE FROM pulsechain_stake_starts`;
    console.log('   ✅ Database cleaned');

    // Create exactly 75 test stakes (to test pagination at 50 per page)
    console.log('\n2. Creating 75 test stakes...');
    const { pulsechainStakingDb } = await import('../lib/db/pulsechainStakingDb');
    
    const testStakes = [];
    for (let i = 1; i <= 75; i++) {
      testStakes.push({
        stake_id: `test_stake_${i}`,
        staker_addr: `0x${i.toString().padStart(40, '0')}`,
        staked_hearts: (i * 1000000000000).toString(),
        stake_shares: (i * 1000000000000).toString(),
        stake_t_shares: i.toString(),
        staked_days: 365 + i,
        start_day: 1000 + i,
        end_day: 1365 + i,
        timestamp: (Date.now() + i).toString(),
        is_auto_stake: i % 2 === 0,
        transaction_hash: `0x${i.toString().padStart(64, '0')}`,
        block_number: (12345 + i).toString(),
        network: 'pulsechain',
        is_active: true,
        days_served: i * 2,
        days_left: 365 - (i * 2)
      });
    }

    await pulsechainStakingDb.insertStakeStartsBatch(testStakes);
    
    // Verify counts
    const counts = await pulsechainStakingDb.getTableCounts();
    console.log(`   ✅ Inserted ${counts.stakeStarts} stakes`);

    // Test service cache status 
    console.log('\n3. Testing service integration...');
    const { pulsechainHexStakingService } = await import('../services/pulsechainHexStakingService');
    
    // Get cache status
    const cacheStatus = await pulsechainHexStakingService.getCacheStatus();
    console.log(`   Database available: ${cacheStatus.databaseAvailable ? '✅' : '❌'}`);
    console.log(`   Database stake count: ${cacheStatus.databaseCounts?.stakeStarts || 0}`);

    // Test getting active stakes from database
    console.log('\n4. Testing database fetch...');
    const dbStakes = await pulsechainStakingDb.getActiveStakes({ limit: 100 });
    console.log(`   ✅ Retrieved ${dbStakes.length} stakes from database`);

    console.log('\n🎯 Summary:');
    console.log(`   ✅ Database: ${counts.stakeStarts} stakes`);
    console.log(`   ✅ Service detects: ${cacheStatus.databaseCounts?.stakeStarts || 0} stakes`);
    console.log(`   ✅ Active stakes query: ${dbStakes.length} stakes`);
    console.log('\n🚀 Ready to test pagination!');
    console.log('   Start the app and go to PulseChain tab');
    console.log('   With 75 stakes and 50 per page, you should see pagination controls');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPaginationWithSmallData();