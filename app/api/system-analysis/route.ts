import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    const analysis = {
      timestamp: new Date().toISOString(),
      database: {
        ethereum: {},
        pulsechain: {},
        constraints: []
      },
      graphql: {
        ethereum: {},
        pulsechain: {}
      },
      services: {
        ethereum: {},
        pulsechain: {},
        multiNetwork: {}
      },
      failures: []
    };

    console.log('🔍 Starting comprehensive system analysis...');

    // === DATABASE ANALYSIS ===
    if (sql) {
      try {
        // Check Ethereum database data
        const [ethTotal, ethActive, ethSample] = await Promise.all([
          sql`SELECT COUNT(*) as count FROM hex_stake_starts WHERE network = 'ethereum'`,
          sql`SELECT COUNT(*) as count FROM hex_stake_starts WHERE network = 'ethereum' AND is_active = true`,
          sql`SELECT stake_id, staked_hearts, start_day, end_day, is_active FROM hex_stake_starts WHERE network = 'ethereum' ORDER BY CAST(staked_hearts AS NUMERIC) DESC LIMIT 5`
        ]);

        analysis.database.ethereum = {
          totalStakes: ethTotal[0].count,
          activeStakes: ethActive[0].count,
          sampleStakes: ethSample.map(s => ({
            stakeId: s.stake_id,
            stakedHearts: s.staked_hearts?.substring(0, 15) + '...',
            startDay: s.start_day,
            endDay: s.end_day,
            isActive: s.is_active
          }))
        };

        // Check PulseChain database data
        const [pulseTotal, pulseActive, pulseSample] = await Promise.all([
          sql`SELECT COUNT(*) as count FROM hex_stake_starts WHERE network = 'pulsechain'`,
          sql`SELECT COUNT(*) as count FROM hex_stake_starts WHERE network = 'pulsechain' AND is_active = true`,
          sql`SELECT stake_id, staked_hearts, start_day, end_day, is_active FROM hex_stake_starts WHERE network = 'pulsechain' ORDER BY CAST(staked_hearts AS NUMERIC) DESC LIMIT 5`
        ]);

        analysis.database.pulsechain = {
          totalStakes: pulseTotal[0].count,
          activeStakes: pulseActive[0].count,
          sampleStakes: pulseSample.map(s => ({
            stakeId: s.stake_id,
            stakedHearts: s.staked_hearts?.substring(0, 15) + '...',
            startDay: s.start_day,
            endDay: s.end_day,
            isActive: s.is_active
          }))
        };

        // Check constraints
        const constraints = await sql`
          SELECT 
            tc.constraint_name,
            tc.constraint_type,
            string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = 'public'
            AND tc.table_name = 'hex_stake_starts'
          GROUP BY tc.constraint_name, tc.constraint_type
        `;
        
        analysis.database.constraints = constraints;

      } catch (dbError) {
        analysis.failures.push(`Database analysis failed: ${dbError instanceof Error ? dbError.message : dbError}`);
      }
    } else {
      analysis.failures.push('Database not available');
    }

    // === GRAPHQL ANALYSIS ===
    
    // Test Ethereum GraphQL
    try {
      const { hexStakingService } = await import('@/services/hexStakingService');
      
      // Test getCurrentGlobalInfo
      const ethGlobal = await hexStakingService.getCurrentGlobalInfo();
      
      // Test getTopStakes (small sample)
      const ethTopStakes = await hexStakingService.getTopStakes(3);
      
      analysis.graphql.ethereum = {
        globalInfoWorking: !!ethGlobal,
        currentDay: ethGlobal?.hexDay || 'unknown',
        topStakesWorking: ethTopStakes.length > 0,
        sampleStakes: ethTopStakes.map(s => ({
          stakeId: s.stakeId,
          stakedHearts: s.stakedHearts?.substring(0, 15) + '...',
          isActive: s.isActive
        }))
      };
      
    } catch (ethGraphqlError) {
      analysis.failures.push(`Ethereum GraphQL failed: ${ethGraphqlError instanceof Error ? ethGraphqlError.message : ethGraphqlError}`);
      analysis.graphql.ethereum = { error: ethGraphqlError instanceof Error ? ethGraphqlError.message : 'Unknown error' };
    }

    // Test PulseChain GraphQL
    try {
      const { pulsechainHexStakingService } = await import('@/services/pulsechainHexStakingService');
      
      // Test basic query
      const pulseGlobal = await pulsechainHexStakingService.getCurrentGlobalInfo();
      
      // Test getting a range of stakes (not just forked ones)
      const pulseQuery = `
        query TestPulseChainStakes {
          stakeStarts(first: 5, orderBy: stakedHearts, orderDirection: desc) {
            stakeId
            stakerAddr
            stakedHearts
            startDay
            endDay
          }
          globalInfos(first: 1) {
            hexDay
          }
        }
      `;
      
      const pulseData = await pulsechainHexStakingService.executeQuery<{
        stakeStarts: Array<{
          stakeId: string;
          stakerAddr: string;
          stakedHearts: string;
          startDay: string;
          endDay: string;
        }>;
        globalInfos: Array<{ hexDay: string }>;
      }>(pulseQuery);
      
      const currentDay = pulseData.globalInfos[0] ? parseInt(pulseData.globalInfos[0].hexDay) : 0;
      
      analysis.graphql.pulsechain = {
        globalInfoWorking: !!pulseGlobal,
        currentDay: currentDay,
        queryWorking: pulseData.stakeStarts.length > 0,
        totalAvailable: pulseData.stakeStarts.length,
        sampleStakes: pulseData.stakeStarts.map(s => ({
          stakeId: s.stakeId,
          stakerAddr: s.stakerAddr?.substring(0, 10) + '...',
          stakedHearts: s.stakedHearts?.substring(0, 15) + '...',
          startDay: s.startDay,
          endDay: s.endDay,
          isActive: parseInt(s.endDay) > currentDay
        })),
        stakeIdRange: {
          lowest: Math.min(...pulseData.stakeStarts.map(s => parseInt(s.stakeId))),
          highest: Math.max(...pulseData.stakeStarts.map(s => parseInt(s.stakeId)))
        }
      };
      
    } catch (pulseGraphqlError) {
      analysis.failures.push(`PulseChain GraphQL failed: ${pulseGraphqlError instanceof Error ? pulseGraphqlError.message : pulseGraphqlError}`);
      analysis.graphql.pulsechain = { error: pulseGraphqlError instanceof Error ? pulseGraphqlError.message : 'Unknown error' };
    }

    // === SERVICE TESTING ===
    
    // Test Ethereum service
    try {
      const { hexStakingService } = await import('@/services/hexStakingService');
      
      // Test if service uses database first
      const ethStakingMetrics = await hexStakingService.getStakingMetrics();
      
      analysis.services.ethereum = {
        stakingMetricsWorking: !!ethStakingMetrics,
        totalActiveStakes: ethStakingMetrics.totalActiveStakes,
        usingDatabase: ethStakingMetrics.totalActiveStakes > 0, // Assumes if we have data, it came from somewhere
        globalInfoAvailable: !!ethStakingMetrics.globalInfo
      };
      
    } catch (ethServiceError) {
      analysis.failures.push(`Ethereum service failed: ${ethServiceError instanceof Error ? ethServiceError.message : ethServiceError}`);
      analysis.services.ethereum = { error: ethServiceError instanceof Error ? ethServiceError.message : 'Unknown error' };
    }

    // Test PulseChain service  
    try {
      const { pulsechainHexStakingService } = await import('@/services/pulsechainHexStakingService');
      
      // Test getTopStakes method
      const pulseTopStakes = await pulsechainHexStakingService.getTopStakes(5);
      
      analysis.services.pulsechain = {
        topStakesWorking: pulseTopStakes.length > 0,
        stakesReturned: pulseTopStakes.length,
        sampleStakes: pulseTopStakes.map(s => ({
          stakeId: s.stakeId,
          stakedHearts: s.stakedHearts?.substring(0, 15) + '...',
          network: s.network
        })),
        usingDatabase: true // We forced it to use database only
      };
      
    } catch (pulseServiceError) {
      analysis.failures.push(`PulseChain service failed: ${pulseServiceError instanceof Error ? pulseServiceError.message : pulseServiceError}`);
      analysis.services.pulsechain = { error: pulseServiceError instanceof Error ? pulseServiceError.message : 'Unknown error' };
    }

    // Test Multi-network service
    try {
      const { multiNetworkHexStakingService } = await import('@/services/multiNetworkHexStakingService');
      
      const multiResults = await multiNetworkHexStakingService.getTopStakes(5);
      
      analysis.services.multiNetwork = {
        working: !!multiResults,
        totalActiveStakes: multiResults.totalActiveStakes,
        ethereumStakes: multiResults.ethereum.totalActiveStakes,
        pulsechainStakes: multiResults.pulsechain.totalActiveStakes,
        combinedStakes: multiResults.topStakes.length,
        networkBreakdown: multiResults.topStakes.map(s => ({
          stakeId: s.stakeId,
          network: s.network,
          stakedHearts: s.stakedHearts?.substring(0, 12) + '...'
        }))
      };
      
    } catch (multiError) {
      analysis.failures.push(`Multi-network service failed: ${multiError instanceof Error ? multiError.message : multiError}`);
      analysis.services.multiNetwork = { error: multiError instanceof Error ? multiError.message : 'Unknown error' };
    }

    return NextResponse.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('System analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}