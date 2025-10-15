import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    // Check what's actually in the database for both networks
    const [ethStakes, pulseStakes] = await Promise.all([
      sql`
        SELECT stake_id, staker_addr, staked_hearts, network, is_active 
        FROM hex_stake_starts 
        WHERE network = 'ethereum' 
        AND is_active = true
        ORDER BY CAST(staked_hearts AS NUMERIC) DESC 
        LIMIT 5
      `,
      sql`
        SELECT stake_id, staker_addr, staked_hearts, network, is_active 
        FROM hex_stake_starts 
        WHERE network = 'pulsechain' 
        AND is_active = true
        ORDER BY CAST(staked_hearts AS NUMERIC) DESC 
        LIMIT 5
      `
    ]);

    // Also check what the GraphQL actually returns for PulseChain
    let graphqlSample = [];
    try {
      const { pulsechainHexStakingService } = await import('@/services/pulsechainHexStakingService');
      
      const query = `
        query GetSamplePulseStakes {
          stakeStarts(first: 5, orderBy: stakeId, orderDirection: asc) {
            stakeId
            stakerAddr
            stakedHearts
            startDay
            endDay
          }
          globalInfos(first: 1, orderBy: timestamp, orderDirection: desc) {
            hexDay
          }
        }
      `;

      const data = await pulsechainHexStakingService.executeQuery<{
        stakeStarts: Array<{
          stakeId: string;
          stakerAddr: string;
          stakedHearts: string;
          startDay: string;
          endDay: string;
        }>;
        globalInfos: Array<{ hexDay: string }>;
      }>(query);
      
      const currentDay = data.globalInfos[0] ? parseInt(data.globalInfos[0].hexDay) : 0;
      graphqlSample = data.stakeStarts.map(stake => ({
        ...stake,
        isActive: parseInt(stake.endDay) > currentDay,
        currentDay
      }));
      
    } catch (error) {
      console.error('Error fetching GraphQL sample:', error);
      graphqlSample = [{ error: error instanceof Error ? error.message : 'Unknown error' }];
    }

    return NextResponse.json({
      success: true,
      data: {
        database: {
          ethereum: ethStakes.map(stake => ({
            stakeId: stake.stake_id,
            stakerAddr: stake.staker_addr?.substring(0, 10) + '...',
            stakedHearts: stake.staked_hearts?.substring(0, 15) + '...',
            network: stake.network,
            isActive: stake.is_active
          })),
          pulsechain: pulseStakes.map(stake => ({
            stakeId: stake.stake_id,
            stakerAddr: stake.staker_addr?.substring(0, 10) + '...',
            stakedHearts: stake.staked_hearts?.substring(0, 15) + '...',
            network: stake.network,
            isActive: stake.is_active
          }))
        },
        graphqlActual: graphqlSample,
        analysis: {
          databaseHasCorrectIds: pulseStakes.length > 0 && !pulseStakes[0].stake_id.includes('pulsechain_'),
          graphqlWorking: Array.isArray(graphqlSample) && graphqlSample.length > 0 && !graphqlSample[0].error
        }
      }
    });

  } catch (error) {
    console.error('Check database stakes error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}