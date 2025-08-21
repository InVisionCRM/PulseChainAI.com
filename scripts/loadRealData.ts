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

async function loadRealData() {
  console.log('🚀 Loading Real PulseChain Data\n');

  try {
    console.log('1. Checking database is clean...');
    const { pulsechainStakingDb } = await import('../lib/db/pulsechainStakingDb');
    const beforeCounts = await pulsechainStakingDb.getTableCounts();
    console.log(`   Before: ${beforeCounts.stakeStarts} stakes`);

    console.log('\n2. Loading real PulseChain data...');
    const { pulsechainHexStakingService } = await import('../services/pulsechainHexStakingService');
    
    // This will load real data from GraphQL and sync to database
    const activeStakes = await pulsechainHexStakingService.getAllActiveStakes(true);
    
    console.log(`\n✅ SUCCESS!`);
    console.log(`   Real stakes loaded: ${activeStakes.length}`);
    
    // Check database after load
    const afterCounts = await pulsechainStakingDb.getTableCounts();
    console.log(`   Database stakes: ${afterCounts.stakeStarts}`);
    
    if (activeStakes.length > 50) {
      console.log('\n🎉 PAGINATION READY!');
      console.log(`   ${activeStakes.length} stakes > 50 per page`);
      console.log('   Pagination controls will now show in the app');
    }

    console.log('\n🎯 Your PulseChain dashboard is ready with real data!');

  } catch (error) {
    console.error('❌ Failed to load real data:', error.message);
  }
}

loadRealData();