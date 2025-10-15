import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function POST() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    console.log('🔄 Simple PulseChain sync without constraint issues...');
    const operations = [];

    // Clear PulseChain data first
    try {
      const deleted = await sql`DELETE FROM hex_stake_starts WHERE network = 'pulsechain'`;
      operations.push(`🗑️ Cleared ${deleted.count || 0} existing PulseChain stakes`);
    } catch (error) {
      operations.push(`❌ Error clearing data: ${error}`);
    }

    // Fetch real data
    try {
      const { pulsechainHexStakingService } = await import('@/services/pulsechainHexStakingService');
      
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
      operations.push(`📅 Current day: ${currentDay}`);

      // Get first 100 real stakes (the forked ones)
      const stakesQuery = `
        query GetRealStakes {
          stakeStarts(first: 100, orderBy: stakeId, orderDirection: asc) {
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
          }
        }
      `;

      const stakesData = await pulsechainHexStakingService.executeQuery<{
        stakeStarts: Array<{
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
        }>;
      }>(stakesQuery);

      operations.push(`📊 Retrieved ${stakesData.stakeStarts.length} real stakes`);

      // Insert them one by one with simple INSERT (no ON CONFLICT)
      let activeCount = 0;
      for (const stake of stakesData.stakeStarts) {
        const endDay = parseInt(stake.endDay);
        const startDay = parseInt(stake.startDay);
        const isActive = endDay > currentDay;
        
        if (isActive) {
          try {
            await sql`
              INSERT INTO hex_stake_starts (
                stake_id, staker_addr, staked_hearts, stake_shares, stake_t_shares,
                staked_days, start_day, end_day, timestamp, is_auto_stake,
                transaction_hash, block_number, network, is_active, days_served, days_left
              ) VALUES (
                ${stake.stakeId}, ${stake.stakerAddr}, ${stake.stakedHearts},
                ${stake.stakeShares}, ${stake.stakeTShares || stake.stakeShares}, ${parseInt(stake.stakedDays)},
                ${startDay}, ${endDay}, ${stake.timestamp}, ${stake.isAutoStake},
                'unknown', '0', 'pulsechain',
                true, ${Math.max(0, currentDay - startDay)}, ${Math.max(0, endDay - currentDay)}
              )
            `;
            activeCount++;
          } catch (insertError) {
            operations.push(`⚠️ Could not insert stake ${stake.stakeId}: ${insertError}`);
          }
        }
      }

      operations.push(`✅ Successfully inserted ${activeCount} active PulseChain stakes with REAL IDs`);

    } catch (error) {
      operations.push(`❌ Error: ${error instanceof Error ? error.message : error}`);
    }

    // Verify results
    const verification = await sql`
      SELECT COUNT(*) as count, 
             MIN(stake_id) as min_id,
             MAX(stake_id) as max_id
      FROM hex_stake_starts 
      WHERE network = 'pulsechain' 
      AND is_active = true
    `;

    operations.push(`🔍 Final count: ${verification[0].count} active PulseChain stakes`);
    operations.push(`📋 ID range: ${verification[0].min_id} to ${verification[0].max_id}`);

    return NextResponse.json({
      success: true,
      data: {
        operations,
        message: 'Simple PulseChain sync completed'
      }
    });

  } catch (error) {
    console.error('Simple PulseChain sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}