import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function POST(request: Request) {
  try {
    const { network, action } = await request.json();
    
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    console.log(`🔄 Database sync requested: ${network} - ${action}`);
    const results: any = {
      network,
      action,
      timestamp: new Date().toISOString(),
      operations: []
    };

    if (action === 'sync_ethereum') {
      // Sync Ethereum stakes to database
      results.operations.push('Starting Ethereum database sync...');
      
      try {
        // Import and use the GraphQL service ONLY for sync purposes
        const { hexStakingService } = await import('@/services/hexStakingService');
        
        // Get current global info for day calculations
        const globalInfo = await hexStakingService.getCurrentGlobalInfo();
        const currentDay = globalInfo ? parseInt(globalInfo.hexDay) : 0;
        
        if (globalInfo) {
          // Store global info
          await sql`
            INSERT INTO hex_global_info (
              hex_day, stake_shares_total, stake_penalty_total, locked_hearts_total,
              latest_stake_id, timestamp, network
            ) VALUES (
              ${currentDay}, ${globalInfo.stakeSharesTotal}, ${globalInfo.stakePenaltyTotal},
              ${globalInfo.lockedHeartsTotal}, ${globalInfo.latestStakeId}, ${globalInfo.timestamp}, 'ethereum'
            )
            ON CONFLICT (network, hex_day) DO UPDATE SET
              stake_shares_total = EXCLUDED.stake_shares_total,
              stake_penalty_total = EXCLUDED.stake_penalty_total,
              locked_hearts_total = EXCLUDED.locked_hearts_total,
              latest_stake_id = EXCLUDED.latest_stake_id,
              timestamp = EXCLUDED.timestamp
          `;
          results.operations.push(`✅ Stored Ethereum global info for day ${currentDay}`);
        }
        
        // Get all active stakes via GraphQL (one-time sync)
        const activeStakes = await hexStakingService.getAllActiveStakes();
        results.operations.push(`📊 Retrieved ${activeStakes.length} active Ethereum stakes`);
        
        // Store stakes in database in batches
        const batchSize = 100;
        for (let i = 0; i < activeStakes.length; i += batchSize) {
          const batch = activeStakes.slice(i, i + batchSize);
          
          for (const stake of batch) {
            await sql`
              INSERT INTO hex_stake_starts (
                stake_id, staker_addr, staked_hearts, stake_shares, stake_t_shares,
                staked_days, start_day, end_day, timestamp, is_auto_stake,
                transaction_hash, block_number, network, is_active, days_served, days_left
              ) VALUES (
                ${stake.stakeId}, ${stake.stakerAddr}, ${stake.stakedHearts},
                ${stake.stakeShares}, ${stake.stakeTShares || stake.stakeShares}, ${parseInt(stake.stakedDays)},
                ${parseInt(stake.startDay)}, ${parseInt(stake.endDay)}, ${stake.timestamp}, ${stake.isAutoStake},
                ${stake.transactionHash}, ${stake.blockNumber}, 'ethereum',
                ${stake.isActive}, ${stake.daysServed || 0}, ${stake.daysLeft || 0}
              )
              ON CONFLICT (stake_id, network) DO UPDATE SET
                is_active = EXCLUDED.is_active,
                days_served = EXCLUDED.days_served,
                days_left = EXCLUDED.days_left,
                updated_at = CURRENT_TIMESTAMP
            `;
          }
          
          results.operations.push(`✅ Synced Ethereum batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activeStakes.length / batchSize)}`);
        }
        
      } catch (error) {
        results.operations.push(`❌ Ethereum sync error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (action === 'sync_pulsechain') {
      // Sync PulseChain stakes to database
      results.operations.push('Starting PulseChain database sync...');
      
      try {
        // Import the PulseChain service for sync purposes
        const { pulsechainHexStakingService } = await import('@/services/pulsechainHexStakingService');
        
        // Get current global info
        const globalInfo = await pulsechainHexStakingService.getCurrentGlobalInfo();
        const currentDay = globalInfo ? parseInt(globalInfo.hexDay) : 0;
        
        if (globalInfo) {
          // Store global info
          await sql`
            INSERT INTO hex_global_info (
              hex_day, stake_shares_total, stake_penalty_total, locked_hearts_total,
              latest_stake_id, timestamp, network
            ) VALUES (
              ${currentDay}, ${globalInfo.stakeSharesTotal}, ${globalInfo.stakePenaltyTotal},
              '0', '', ${Date.now().toString()}, 'pulsechain'
            )
            ON CONFLICT (network, hex_day) DO UPDATE SET
              stake_shares_total = EXCLUDED.stake_shares_total,
              stake_penalty_total = EXCLUDED.stake_penalty_total,
              timestamp = EXCLUDED.timestamp
          `;
          results.operations.push(`✅ Stored PulseChain global info for day ${currentDay}`);
        }
        
        // Manually fetch a limited set of PulseChain stakes for sync
        const query = `
          query GetPulseChainStakes {
            stakeStarts(first: 1000, orderBy: stakedHearts, orderDirection: desc) {
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
            }
            globalInfos(first: 1, orderBy: timestamp, orderDirection: desc) {
              hexDay
            }
          }
        `;

        const data = await pulsechainHexStakingService.executeQuery<{
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
          }>;
          globalInfos: Array<{ hexDay: string }>;
        }>(query);

        const pulseCurrentDay = data.globalInfos[0] ? parseInt(data.globalInfos[0].hexDay) : currentDay;
        results.operations.push(`📊 Retrieved ${data.stakeStarts.length} PulseChain stakes`);
        
        // Filter for active stakes only
        const activeStakes = data.stakeStarts.filter(stake => 
          parseInt(stake.endDay) > pulseCurrentDay
        );
        
        results.operations.push(`📊 Filtered to ${activeStakes.length} active PulseChain stakes`);
        
        // Store stakes in database
        for (const stake of activeStakes) {
          await sql`
            INSERT INTO hex_stake_starts (
              stake_id, staker_addr, staked_hearts, stake_shares, stake_t_shares,
              staked_days, start_day, end_day, timestamp, is_auto_stake,
              transaction_hash, block_number, network, is_active, days_served, days_left
            ) VALUES (
              ${stake.stakeId}, ${stake.stakerAddr}, ${stake.stakedHearts},
              ${stake.stakeShares}, ${stake.stakeTShares || stake.stakeShares}, ${parseInt(stake.stakedDays)},
              ${parseInt(stake.startDay)}, ${parseInt(stake.endDay)}, ${stake.timestamp}, ${stake.isAutoStake},
              'unknown', '0', 'pulsechain',
              true, ${Math.max(0, pulseCurrentDay - parseInt(stake.startDay))}, 
              ${Math.max(0, parseInt(stake.endDay) - pulseCurrentDay)}
            )
            ON CONFLICT (stake_id, network) DO UPDATE SET
              is_active = EXCLUDED.is_active,
              days_served = EXCLUDED.days_served,
              days_left = EXCLUDED.days_left,
              updated_at = CURRENT_TIMESTAMP
          `;
        }
        
        results.operations.push(`✅ Synced ${activeStakes.length} PulseChain stakes to database`);
        
      } catch (error) {
        results.operations.push(`❌ PulseChain sync error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (action === 'status') {
      // Check database status
      const [ethCount, pulseCount, ethGlobal, pulseGlobal] = await Promise.all([
        sql`SELECT COUNT(*) as count FROM hex_stake_starts WHERE network = 'ethereum'`,
        sql`SELECT COUNT(*) as count FROM hex_stake_starts WHERE network = 'pulsechain'`,
        sql`SELECT hex_day FROM hex_global_info WHERE network = 'ethereum' ORDER BY id DESC LIMIT 1`,
        sql`SELECT hex_day FROM hex_global_info WHERE network = 'pulsechain' ORDER BY id DESC LIMIT 1`
      ]);
      
      results.status = {
        ethereum: {
          stakesCount: ethCount[0].count,
          currentDay: ethGlobal[0]?.hex_day || 0
        },
        pulsechain: {
          stakesCount: pulseCount[0].count,
          currentDay: pulseGlobal[0]?.hex_day || 0
        }
      };
    }
    
    return NextResponse.json({
      success: true,
      data: results
    });
    
  } catch (error) {
    console.error('Database sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}