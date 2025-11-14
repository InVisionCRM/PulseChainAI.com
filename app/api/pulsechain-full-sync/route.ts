import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';
import { hexStakingDb } from '@/lib/db/hexStakingDb';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';

type GraphStakeStart = {
  stakeId: string;
  stakerAddr: string;
  stakedHearts: string;
  stakeShares: string;
  stakeTShares: string;
  stakedDays: string;
  startDay: string;
  endDay: string;
  timestamp: string;
  isAutoStake: boolean;
  transactionHash: string;
  blockNumber: string;
};

type GraphStakeEnd = {
  stakeId: string;
  stakerAddr: string;
  payout: string;
  stakedHearts: string;
  penalty: string;
  servedDays: string;
  timestamp: string;
  transactionHash: string;
  blockNumber: string;
};

const BATCH_SIZE = 1000;
const MAX_SKIP = 5000;

async function fetchStakeStarts(): Promise<GraphStakeStart[]> {
  let all: GraphStakeStart[] = [];
  let skip = 0;
  let hasMore = true;

  const query = `
    query GetStakeStarts($limit: Int!, $skip: Int!) {
      stakeStarts(
        first: $limit,
        skip: $skip,
        orderBy: stakeId,
        orderDirection: asc
      ) {
        stakeId
        stakerAddr
        stakedHearts
        stakeShares
        stakeTShares
        stakedDays
        startDay
        endDay
        timestamp
        isAutoStake
        transactionHash
        blockNumber
      }
    }
  `;

  while (hasMore && skip < MAX_SKIP) {
    console.log(`📥 Fetching PulseChain stake starts batch @ ${skip}`);
    const data = await pulsechainHexStakingService.executeQuery<{
      stakeStarts: GraphStakeStart[];
    }>(query, { limit: BATCH_SIZE, skip });

    all = all.concat(data.stakeStarts);
    skip += BATCH_SIZE;
    hasMore = data.stakeStarts.length === BATCH_SIZE && skip < MAX_SKIP;
    if (hasMore) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`✅ PulseChain stake starts fetched: ${all.length}`);
  return all;
}

async function fetchStakeEnds(): Promise<GraphStakeEnd[]> {
  let all: GraphStakeEnd[] = [];
  let skip = 0;
  let hasMore = true;

  const query = `
    query GetStakeEnds($limit: Int!, $skip: Int!) {
      stakeEnds(
        first: $limit,
        skip: $skip,
        orderBy: stakeId,
        orderDirection: asc
      ) {
        stakeId
        stakerAddr
        payout
        stakedHearts
        penalty
        servedDays
        timestamp
        transactionHash
        blockNumber
      }
    }
  `;

  while (hasMore && skip < MAX_SKIP) {
    console.log(`📥 Fetching PulseChain stake ends batch @ ${skip}`);
    const data = await pulsechainHexStakingService.executeQuery<{
      stakeEnds: GraphStakeEnd[];
    }>(query, { limit: BATCH_SIZE, skip });

    all = all.concat(data.stakeEnds);
    skip += BATCH_SIZE;
    hasMore = data.stakeEnds.length === BATCH_SIZE && skip < MAX_SKIP;
    if (hasMore) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`✅ PulseChain stake ends fetched: ${all.length}`);
  return all;
}

export async function GET() {
  try {
    console.log('🚀 Starting full PulseChain HEX staking sync...');

    const [stakeStarts, stakeEnds] = await Promise.all([
      fetchStakeStarts(),
      fetchStakeEnds()
    ]);

    const endedIds = new Set(stakeEnds.map((end) => end.stakeId));
    const activeStakes = stakeStarts.filter((start) => !endedIds.has(start.stakeId));
    console.log(`🎯 Active PulseChain stakes detected: ${activeStakes.length}`);

    const globalInfo = await pulsechainHexStakingService.getCurrentGlobalInfo();
    const currentDay = globalInfo ? parseInt(globalInfo.hexDay) : 0;

    // Reset pulsechain records before inserting
    await sql`DELETE FROM hex_stake_starts WHERE network = 'pulsechain'`;

    const dbBatchSize = 100;
    let inserted = 0;

    for (let i = 0; i < activeStakes.length; i += dbBatchSize) {
      const batch = activeStakes.slice(i, i + dbBatchSize).map((stake) => {
        const startDay = parseInt(stake.startDay);
        const endDay = parseInt(stake.endDay);
        return {
          stake_id: `pulsechain_${stake.stakeId}`,
          staker_addr: stake.stakerAddr,
          staked_hearts: stake.stakedHearts,
          stake_shares: stake.stakeShares,
          stake_t_shares: stake.stakeTShares || stake.stakeShares,
          staked_days: parseInt(stake.stakedDays),
          start_day: startDay,
          end_day: endDay,
          timestamp: stake.timestamp,
          is_auto_stake: stake.isAutoStake,
          transaction_hash: stake.transactionHash || 'unknown',
          block_number: stake.blockNumber || '0',
          network: 'pulsechain' as const,
          is_active: true,
          days_served: Math.max(0, currentDay - startDay),
          days_left: Math.max(0, endDay - currentDay)
        };
      });

      await hexStakingDb.insertStakeStartsBatch(batch);
      inserted += batch.length;
      console.log(`✅ Inserted PulseChain batch ${Math.floor(i / dbBatchSize) + 1}/${Math.ceil(activeStakes.length / dbBatchSize)}`);
    }

    const finalCount = await hexStakingDb.getActiveStakes({ network: 'pulsechain', limit: 100000 });

    await hexStakingDb.updateSyncStatus('pulsechain', {
      total_stakes_synced: finalCount.length,
      last_synced_stake_id: activeStakes.length ? activeStakes[activeStakes.length - 1].stakeId : '0',
      last_sync_completed_at: new Date().toISOString()
    });

    if (globalInfo) {
      try {
        await hexStakingDb.insertGlobalInfo({
          hex_day: parseInt(globalInfo.hexDay),
          stake_shares_total: globalInfo.stakeSharesTotal || '0',
          stake_penalty_total: globalInfo.stakePenaltyTotal || '0',
          locked_hearts_total: globalInfo.lockedHeartsTotal || '0',
          latest_stake_id: globalInfo.latestStakeId || '0',
          timestamp: (globalInfo.timestamp as string | undefined) || Date.now().toString(),
          network: 'pulsechain'
        });
      } catch (globalError) {
        console.warn('⚠️ PulseChain global info insert failed (likely already exists):', globalError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        inserted,
        totalActive: activeStakes.length,
        finalDbCount: finalCount.length,
        message: `PulseChain sync completed with ${finalCount.length} active stakes`
      }
    });
  } catch (error) {
    console.error('PulseChain full sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
