import { NextResponse } from 'next/server';
import { multiNetworkHexStakingService } from '@/services/multiNetworkHexStakingService';

export async function GET() {
  try {
    console.log('=== TESTING MULTI-NETWORK STAKING SERVICE ===');
    
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: []
    };
    
    // Test 1: Get top stakes from both networks
    try {
      console.log('1. Testing getTopStakes(10)...');
      const topStakes = await multiNetworkHexStakingService.getTopStakes(10);
      
      results.tests.push({
        test: 'getTopStakes',
        success: true,
        data: {
          totalActiveStakes: topStakes.totalActiveStakes,
          totalStakedHearts: topStakes.totalStakedHearts,
          ethereum: {
            totalActiveStakes: topStakes.ethereum.totalActiveStakes,
            topStakesCount: topStakes.ethereum.topStakes.length
          },
          pulsechain: {
            totalActiveStakes: topStakes.pulsechain.totalActiveStakes,
            topStakesCount: topStakes.pulsechain.topStakes.length
          },
          combinedTopStakes: topStakes.topStakes.slice(0, 5).map(stake => ({
            network: stake.network,
            stakeId: stake.stakeId,
            stakedHearts: stake.stakedHearts.substring(0, 15) + '...',
            isActive: stake.isActive
          }))
        }
      });
      
    } catch (error) {
      results.tests.push({
        test: 'getTopStakes',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Test 2: Check individual network services
    try {
      console.log('2. Testing individual network services...');
      
      // Import the individual services
      const { hexStakingService } = await import('@/services/hexStakingService');
      const { pulsechainHexStakingService } = await import('@/services/pulsechainHexStakingService');
      
      const [ethTopStakes, pulseTopStakes] = await Promise.allSettled([
        hexStakingService.getTopStakes(5),
        pulsechainHexStakingService.getTopStakes(5)
      ]);
      
      results.tests.push({
        test: 'individualServices',
        success: true,
        data: {
          ethereum: {
            status: ethTopStakes.status,
            count: ethTopStakes.status === 'fulfilled' ? ethTopStakes.value.length : 0,
            sampleStakeIds: ethTopStakes.status === 'fulfilled' 
              ? ethTopStakes.value.slice(0, 3).map(s => s.stakeId)
              : [],
            error: ethTopStakes.status === 'rejected' ? ethTopStakes.reason.message : null
          },
          pulsechain: {
            status: pulseTopStakes.status,
            count: pulseTopStakes.status === 'fulfilled' ? pulseTopStakes.value.length : 0,
            sampleStakeIds: pulseTopStakes.status === 'fulfilled' 
              ? pulseTopStakes.value.slice(0, 3).map(s => s.stakeId)
              : [],
            error: pulseTopStakes.status === 'rejected' ? pulseTopStakes.reason.message : null
          }
        }
      });
      
    } catch (error) {
      results.tests.push({
        test: 'individualServices',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Test 3: Check database directly
    try {
      console.log('3. Testing database queries...');
      const { sql } = await import('@/lib/db/connection');
      
      if (sql) {
        const [ethCount, pulseCount] = await Promise.all([
          sql`SELECT COUNT(*) as count FROM hex_stake_starts WHERE network = 'ethereum'`,
          sql`SELECT COUNT(*) as count FROM hex_stake_starts WHERE network = 'pulsechain'`
        ]);
        
        results.tests.push({
          test: 'databaseCounts',
          success: true,
          data: {
            ethereum: ethCount[0].count,
            pulsechain: pulseCount[0].count
          }
        });
      } else {
        results.tests.push({
          test: 'databaseCounts',
          success: false,
          error: 'Database not available'
        });
      }
      
    } catch (error) {
      results.tests.push({
        test: 'databaseCounts',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return NextResponse.json({
      success: true,
      data: results
    });
    
  } catch (error) {
    console.error('Test multi-network error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}