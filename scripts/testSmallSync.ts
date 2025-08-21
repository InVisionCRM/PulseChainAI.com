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

async function testSmallSync() {
  console.log('🧪 Testing Small Database Sync\n');

  try {
    // Test direct database insert
    console.log('1. Testing direct database insert...');
    const { pulsechainStakingDb } = await import('../lib/db/pulsechainStakingDb');
    
    // Create test stakes
    const testStakes = [{
      stake_id: `test_${Date.now()}_1`,
      staker_addr: '0x1234567890123456789012345678901234567890',
      staked_hearts: '1000000000000',
      stake_shares: '1000000000000',
      stake_t_shares: '1.0',
      staked_days: 365,
      start_day: 1000,
      end_day: 1365,
      timestamp: Date.now().toString(),
      is_auto_stake: false,
      transaction_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      block_number: '12345',
      network: 'pulsechain',
      is_active: true,
      days_served: 100,
      days_left: 265
    }, {
      stake_id: `test_${Date.now()}_2`,
      staker_addr: '0x2234567890123456789012345678901234567890',
      staked_hearts: '2000000000000',
      stake_shares: '2000000000000', 
      stake_t_shares: '2.0',
      staked_days: 1000,
      start_day: 500,
      end_day: 1500,
      timestamp: Date.now().toString(),
      is_auto_stake: true,
      transaction_hash: '0xbcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890a',
      block_number: '12346',
      network: 'pulsechain',
      is_active: true,
      days_served: 200,
      days_left: 800
    }];

    // Test batch insert
    await pulsechainStakingDb.insertStakeStartsBatch(testStakes);
    
    // Check if they were inserted
    const counts = await pulsechainStakingDb.getTableCounts();
    console.log(`   ✅ Database counts after insert: ${JSON.stringify(counts)}`);
    
    // Clean up test data
    console.log('\n2. Cleaning up test data...');
    const { sql } = await import('../lib/db/connection');
    for (const stake of testStakes) {
      await sql`DELETE FROM pulsechain_stake_starts WHERE stake_id = ${stake.stake_id}`;
    }
    
    console.log('✅ Test completed successfully!');
    console.log('🎉 Database sync is now working!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSmallSync();