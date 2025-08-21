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

async function cleanDatabase() {
  console.log('🧹 Cleaning Database of All Test Data\n');

  try {
    const { sql } = await import('../lib/db/connection');
    
    console.log('1. Cleaning all tables...');
    
    // Clean all tables
    await sql`DELETE FROM pulsechain_stake_starts`;
    await sql`DELETE FROM pulsechain_stake_ends`;
    await sql`DELETE FROM pulsechain_global_info`;
    await sql`DELETE FROM pulsechain_staker_metrics`;
    
    // Reset sync status
    await sql`
      UPDATE pulsechain_sync_status 
      SET 
        last_synced_stake_id = '0',
        last_synced_block = 0,
        last_synced_timestamp = 0,
        total_stakes_synced = 0,
        total_stake_ends_synced = 0,
        sync_in_progress = FALSE,
        last_sync_started_at = NULL,
        last_sync_completed_at = NULL,
        error_message = NULL,
        updated_at = CURRENT_TIMESTAMP
    `;

    console.log('   ✅ All tables cleaned');

    // Verify cleanup
    console.log('\n2. Verifying cleanup...');
    const { pulsechainStakingDb } = await import('../lib/db/pulsechainStakingDb');
    const counts = await pulsechainStakingDb.getTableCounts();
    
    console.log(`   Stakes: ${counts.stakeStarts} (should be 0)`);
    console.log(`   Ends: ${counts.stakeEnds} (should be 0)`);
    console.log(`   Global: ${counts.globalInfo} (should be 0)`);
    console.log(`   Metrics: ${counts.stakerMetrics} (should be 0)`);

    if (counts.stakeStarts === 0 && counts.stakeEnds === 0 && counts.globalInfo === 0 && counts.stakerMetrics === 0) {
      console.log('\n✅ Database completely cleaned!');
      console.log('🎯 Ready for real PulseChain data');
      console.log('\nNext: Start the app and visit PulseChain tab to load real data');
    } else {
      console.log('\n⚠️ Some data remains - manual cleanup may be needed');
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

cleanDatabase();