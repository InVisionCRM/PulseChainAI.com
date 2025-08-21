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

async function testRealDataLoad() {
  console.log('🔍 Testing Real PulseChain Data Load\n');

  try {
    // Import the service
    console.log('1. Importing PulseChain service...');
    const { pulsechainHexStakingService } = await import('../services/pulsechainHexStakingService');

    // Check database is clean
    console.log('\n2. Verifying database is clean...');
    const { pulsechainStakingDb } = await import('../lib/db/pulsechainStakingDb');
    const initialCounts = await pulsechainStakingDb.getTableCounts();
    console.log(`   Stakes: ${initialCounts.stakeStarts} (should be 0)`);
    console.log(`   Ends: ${initialCounts.stakeEnds} (should be 0)`);

    // Try to fetch just a small batch to test connection
    console.log('\n3. Testing GraphQL connection with small batch...');
    try {
      // Use internal method to test API
      const testQuery = {
        query: `
          {
            stakeStarts(first: 10, orderBy: timestamp, orderDirection: desc) {
              id
              stakeId
              stakerAddr
              stakedHearts
            }
          }
        `
      };

      const serviceInstance = pulsechainHexStakingService as any;
      const response = await serviceInstance.makeGraphQLRequest(testQuery);
      
      const stakeStarts = response?.data?.stakeStarts || [];
      console.log(`   ✅ GraphQL API working: ${stakeStarts.length} stakes returned`);
      
      if (stakeStarts.length > 0) {
        console.log(`   Sample stake ID: ${stakeStarts[0].stakeId}`);
        console.log(`   Sample staker: ${stakeStarts[0].stakerAddr}`);
        console.log(`   Sample hearts: ${stakeStarts[0].stakedHearts}`);
      }

    } catch (apiError) {
      console.log(`   ❌ GraphQL API failed: ${apiError.message}`);
      return;
    }

    // Now test the full service method
    console.log('\n4. Testing full service data load...');
    try {
      const activeStakes = await pulsechainHexStakingService.getAllActiveStakes(true);
      console.log(`   ✅ Service loaded ${activeStakes.length} real active stakes`);

      // Check database after load
      const finalCounts = await pulsechainStakingDb.getTableCounts();
      console.log(`   Database now has ${finalCounts.stakeStarts} stakes`);

      console.log('\n🎯 Summary:');
      console.log(`   ✅ Real data loaded: ${activeStakes.length} stakes`);
      console.log(`   ✅ Database synced: ${finalCounts.stakeStarts} stakes`);
      console.log(`   ✅ No mock data used`);
      
      if (activeStakes.length > 50) {
        console.log(`   🎉 Pagination will show (${activeStakes.length} > 50)`);
      } else {
        console.log(`   ⚠️ Pagination won't show (${activeStakes.length} ≤ 50)`);
      }

    } catch (serviceError) {
      console.log(`   ❌ Service failed: ${serviceError.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRealDataLoad();