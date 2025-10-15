import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function POST() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    console.log('🧹 Cleaning up PulseChain database and resyncing with REAL data...');
    const operations = [];

    // Step 1: Clear existing fake PulseChain data
    try {
      const deleted = await sql`
        DELETE FROM hex_stake_starts 
        WHERE network = 'pulsechain'
      `;
      operations.push(`🗑️ Deleted ${deleted.count || 0} fake PulseChain stakes from database`);
    } catch (error) {
      operations.push(`❌ Error deleting old data: ${error}`);
      return NextResponse.json({ success: false, error: 'Failed to clean database' });
    }

    // Step 2: Fetch REAL PulseChain data from GraphQL (the forked Ethereum stakes)
    try {
      const { pulsechainHexStakingService } = await import('@/services/pulsechainHexStakingService');
      
      // Get current day for active stake calculation
      const globalQuery = `
        query GetGlobalInfo {
          globalInfos(first: 1, orderBy: timestamp, orderDirection: desc) {
            hexDay
          }
        }
      `;
      
      const globalData = await pulsechainHexStakingService.executeQuery<{
        globalInfos: Array<{ hexDay: string }>;
      }>(globalQuery);
      
      const currentDay = globalData.globalInfos[0] ? parseInt(globalData.globalInfos[0].hexDay) : 2096;
      operations.push(`📅 Current PulseChain day: ${currentDay}`);
      
      // Fetch real stakes - start with the forked Ethereum stakes (IDs 1-1000)
      const stakesQuery = `
        query GetRealPulseChainStakes {
          stakeStarts(
            first: 1000, 
            orderBy: stakeId, 
            orderDirection: asc,
            where: { stakeId_lt: "10000" }
          ) {
            id
            stakeId
            stakerAddr
            stakedHearts
            stakeShares
            stakedDays
            startDay
            endDay
            timestamp
            isAutoStake
            stakeTShares
            transactionHash
            blockNumber
          }
        }
      `;

      const stakesData = await pulsechainHexStakingService.executeQuery<{
        stakeStarts: Array<{
          id: string;
          stakeId: string;
          stakerAddr: string;
          stakedHearts: string;
          stakeShares: string;
          stakedDays: string;
          startDay: string;
          endDay: string;
          timestamp: string;
          isAutoStake: boolean;
          stakeTShares: string;
          transactionHash: string;
          blockNumber: string;
        }>;
      }>(stakesQuery);

      operations.push(`📊 Retrieved ${stakesData.stakeStarts.length} REAL PulseChain stakes from GraphQL`);

      // Step 3: Filter for active stakes and insert them with REAL IDs
      let insertedCount = 0;
      for (const stake of stakesData.stakeStarts) {
        const endDay = parseInt(stake.endDay);
        const startDay = parseInt(stake.startDay);
        const isActive = endDay > currentDay;
        const daysServed = Math.max(0, currentDay - startDay);
        const daysLeft = Math.max(0, endDay - currentDay);

        // Insert with the REAL stake ID (not prefixed!)
        await sql`
          INSERT INTO hex_stake_starts (
            stake_id, staker_addr, staked_hearts, stake_shares, stake_t_shares,
            staked_days, start_day, end_day, timestamp, is_auto_stake,
            transaction_hash, block_number, network, is_active, days_served, days_left
          ) VALUES (
            ${stake.stakeId}, ${stake.stakerAddr}, ${stake.stakedHearts},
            ${stake.stakeShares}, ${stake.stakeTShares || stake.stakeShares}, ${parseInt(stake.stakedDays)},
            ${startDay}, ${endDay}, ${stake.timestamp}, ${stake.isAutoStake},
            ${stake.transactionHash || 'unknown'}, ${stake.blockNumber || '0'}, 'pulsechain',
            ${isActive}, ${daysServed}, ${daysLeft}
          )
          ON CONFLICT (stake_id, network) DO UPDATE SET
            is_active = EXCLUDED.is_active,
            days_served = EXCLUDED.days_served,
            days_left = EXCLUDED.days_left,
            updated_at = CURRENT_TIMESTAMP
        `;
        
        if (isActive) insertedCount++;
      }

      operations.push(`✅ Inserted ${insertedCount} active PulseChain stakes with REAL IDs`);

      // Step 4: Store updated global info
      await sql`
        INSERT INTO hex_global_info (
          hex_day, stake_shares_total, stake_penalty_total, locked_hearts_total,
          latest_stake_id, timestamp, network
        ) VALUES (
          ${currentDay}, '0', '0', '0', '', ${Date.now().toString()}, 'pulsechain'
        )
        ON CONFLICT (network, hex_day) DO UPDATE SET
          timestamp = EXCLUDED.timestamp
      `;
      operations.push(`✅ Updated PulseChain global info`);

    } catch (error) {
      operations.push(`❌ Error fetching/storing real data: ${error instanceof Error ? error.message : error}`);
    }

    // Step 5: Verify the fix
    const verification = await sql`
      SELECT COUNT(*) as count, 
             string_agg(stake_id, ', ') as sample_ids
      FROM (
        SELECT stake_id 
        FROM hex_stake_starts 
        WHERE network = 'pulsechain' 
        AND is_active = true
        ORDER BY CAST(stake_id AS INTEGER)
        LIMIT 10
      ) as sample
    `;

    operations.push(`🔍 Verification: ${verification[0].count} active PulseChain stakes`);
    operations.push(`📋 Sample IDs: ${verification[0].sample_ids}`);

    return NextResponse.json({
      success: true,
      data: {
        operations,
        message: 'PulseChain database fixed with real forked Ethereum stake IDs'
      }
    });

  } catch (error) {
    console.error('Fix PulseChain data error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}