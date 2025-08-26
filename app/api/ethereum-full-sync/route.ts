import { NextResponse } from 'next/server';
import { hexStakingService } from '@/services/hexStakingService';
import { hexStakingDb } from '@/lib/db/hexStakingDb';

export async function GET() {
  try {
    console.log('🔄 Starting full Ethereum sync to match GraphQL data...');
    
    // Get all active stakes from GraphQL (the source of truth: 3,752 stakes)
    const allActiveStakes = await hexStakingService.getAllActiveStakes();
    console.log(`📡 GraphQL returned ${allActiveStakes.length} active Ethereum stakes`);
    
    // Get current database count
    const currentDbCount = await hexStakingDb.getActiveStakes({ network: 'ethereum', limit: 100000 });
    console.log(`🗄️ Database currently has ${currentDbCount.length} Ethereum stakes`);
    
    // Get global info for current day calculation
    const stakingMetrics = await hexStakingService.getStakingMetrics();
    const currentDay = stakingMetrics.globalInfo ? parseInt(stakingMetrics.globalInfo.hexDay) : 0;
    console.log(`📅 Current HEX day: ${currentDay}`);
    
    // Convert all GraphQL stakes to database format (prefix with network to avoid fork conflicts)
    const dbStakeStarts = allActiveStakes.map(stake => ({
      stake_id: `ethereum_${stake.stakeId}`,
      staker_addr: stake.stakerAddr,
      staked_hearts: stake.stakedHearts,
      stake_shares: stake.stakeShares,
      stake_t_shares: stake.stakeTShares || '0',
      staked_days: parseInt(stake.stakedDays),
      start_day: parseInt(stake.startDay),
      end_day: parseInt(stake.endDay),
      timestamp: stake.timestamp,
      is_auto_stake: stake.isAutoStake,
      transaction_hash: stake.transactionHash,
      block_number: stake.blockNumber,
      network: 'ethereum',
      is_active: true, // These are all active stakes from getAllActiveStakes
      days_served: stake.daysServed || Math.max(0, currentDay - parseInt(stake.startDay)),
      days_left: stake.daysLeft || Math.max(0, parseInt(stake.endDay) - currentDay)
    }));
    
    console.log('💾 Inserting all Ethereum stakes to database...');
    
    // Insert in batches to avoid overwhelming the database
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < dbStakeStarts.length; i += batchSize) {
      const batch = dbStakeStarts.slice(i, i + batchSize);
      await hexStakingDb.insertStakeStartsBatch(batch);
      inserted += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(dbStakeStarts.length/batchSize)} (${inserted}/${dbStakeStarts.length} stakes)`);
    }
    
    // Get final count
    const finalDbCount = await hexStakingDb.getActiveStakes({ network: 'ethereum', limit: 100000 });
    console.log(`🎉 Final database count: ${finalDbCount.length} Ethereum stakes`);
    
    // Update sync status
    const latestStakeId = Math.max(...allActiveStakes.map(s => parseInt(s.stakeId))).toString();
    await hexStakingDb.updateSyncStatus('ethereum', {
      total_stakes_synced: finalDbCount.length,
      last_synced_stake_id: latestStakeId,
      last_sync_completed_at: new Date().toISOString()
    });
    
    // Store global info
    if (stakingMetrics.globalInfo) {
      try {
        await hexStakingDb.insertGlobalInfo({
          hex_day: parseInt(stakingMetrics.globalInfo.hexDay),
          stake_shares_total: stakingMetrics.globalInfo.stakeSharesTotal,
          stake_penalty_total: stakingMetrics.globalInfo.stakePenaltyTotal,
          locked_hearts_total: stakingMetrics.globalInfo.lockedHeartsTotal,
          latest_stake_id: stakingMetrics.globalInfo.latestStakeId,
          timestamp: stakingMetrics.globalInfo.timestamp,
          network: 'ethereum'
        });
      } catch (globalError) {
        console.warn('⚠️ Global info insert failed (may already exist):', globalError);
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        before: currentDbCount.length,
        after: finalDbCount.length,
        graphqlStakes: allActiveStakes.length,
        inserted: inserted,
        latestStakeId: latestStakeId,
        message: `Successfully synced ${finalDbCount.length} Ethereum stakes to database`
      }
    });

  } catch (error) {
    console.error('Full Ethereum sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}