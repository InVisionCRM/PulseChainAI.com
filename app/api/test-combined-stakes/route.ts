import { NextResponse } from 'next/server';
import { multiNetworkHexStakingService } from '@/services/multiNetworkHexStakingService';

export async function GET() {
  try {
    console.log('🧪 Testing combined multi-network stakes...');
    
    // Test with a small limit to get results quickly
    const result = await multiNetworkHexStakingService.getTopStakes(10);
    
    // Analyze the results
    const analysis = {
      totals: {
        totalActiveStakes: result.totalActiveStakes,
        totalStakedHearts: result.totalStakedHearts,
        averageStakeLength: result.averageStakeLength
      },
      ethereum: {
        totalActiveStakes: result.ethereum.totalActiveStakes,
        totalStakedHearts: result.ethereum.totalStakedHearts,
        averageStakeLength: result.ethereum.averageStakeLength,
        sampleStakes: result.ethereum.topStakes.slice(0, 3).map(stake => ({
          stakeId: stake.stakeId,
          stakedHearts: stake.stakedHearts.substring(0, 15) + '...',
          network: stake.network
        }))
      },
      pulsechain: {
        totalActiveStakes: result.pulsechain.totalActiveStakes,
        totalStakedHearts: result.pulsechain.totalStakedHearts,
        averageStakeLength: result.pulsechain.averageStakeLength,
        sampleStakes: result.pulsechain.topStakes.slice(0, 3).map(stake => ({
          stakeId: stake.stakeId,
          stakedHearts: stake.stakedHearts.substring(0, 15) + '...',
          network: stake.network
        }))
      },
      combinedTopStakes: result.topStakes.map(stake => ({
        stakeId: stake.stakeId,
        network: stake.network,
        stakedHearts: stake.stakedHearts.substring(0, 15) + '...',
        isActive: stake.isActive,
        daysLeft: stake.daysLeft
      }))
    };
    
    return NextResponse.json({
      success: true,
      data: analysis,
      message: 'Multi-network stakes combined successfully'
    });
    
  } catch (error) {
    console.error('Combined stakes test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}