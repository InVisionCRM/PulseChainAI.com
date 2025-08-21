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

async function testDatabaseSync() {
  console.log('🧪 Testing PulseChain Database Sync Issue\n');

  try {
    // Test 1: Check database status
    console.log('1. Checking database status...');
    const { databaseStatus } = await import('../lib/db/databaseStatus');
    
    // Reset to force fresh check
    databaseStatus.reset();
    const isAvailable = await databaseStatus.checkAvailability();
    console.log(`   Database available: ${isAvailable ? '✅' : '❌'}`);

    // Test 2: Test service initialization
    console.log('\n2. Testing service database detection...');
    const { pulsechainHexStakingService } = await import('../services/pulsechainHexStakingService');
    
    // Force re-initialize
    await (pulsechainHexStakingService as any).initializeDatabase();
    
    // Test cache status
    const cacheStatus = await pulsechainHexStakingService.getCacheStatus();
    console.log(`   Service database available: ${cacheStatus.databaseAvailable ? '✅' : '❌'}`);
    console.log(`   Total stakes in memory: ${cacheStatus.totalActiveStakes}`);
    
    if (cacheStatus.databaseCounts) {
      console.log(`   Database stake count: ${cacheStatus.databaseCounts.stakeStarts}`);
    }

    // Test 3: Try to fetch data and see if it syncs
    if (cacheStatus.totalActiveStakes > 0 && !cacheStatus.databaseAvailable) {
      console.log('\n3. Found data in memory but database not detected by service');
      console.log('   This is why data is not syncing to database!');
      
      // Test direct database operations
      console.log('\n4. Testing direct database operations...');
      const { pulsechainStakingDb } = await import('../lib/db/pulsechainStakingDb');
      
      try {
        const counts = await pulsechainStakingDb.getTableCounts();
        console.log('   ✅ Direct database operations work:');
        console.log(`     - Stake starts: ${counts.stakeStarts}`);
        console.log(`     - Stake ends: ${counts.stakeEnds}`);
        console.log(`     - Global info: ${counts.globalInfo}`);
        console.log(`     - Staker metrics: ${counts.stakerMetrics}`);
      } catch (dbError) {
        console.log(`   ❌ Direct database operations failed: ${dbError.message}`);
      }
    }

    console.log('\n🎯 Diagnosis:');
    if (isAvailable && !cacheStatus.databaseAvailable) {
      console.log('   ⚠️ DATABASE STATUS MISMATCH DETECTED!');
      console.log('   - Database is actually working');
      console.log('   - Service thinks database is unavailable');
      console.log('   - This prevents automatic syncing');
      console.log('   - Need to fix service initialization timing');
    } else if (isAvailable && cacheStatus.databaseAvailable) {
      console.log('   ✅ Database status correctly detected');
      console.log('   - Check if data is actually syncing during fetch');
    } else {
      console.log('   ❌ Database genuinely not available');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDatabaseSync();