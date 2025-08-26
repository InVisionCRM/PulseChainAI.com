import { NextResponse } from 'next/server';
import { hexStakingService } from '@/services/hexStakingService';

export async function GET() {
  try {
    console.log('🔍 Testing Ethereum HEX data fetch...');
    
    // Test the getAllActiveStakes method
    const activeStakes = await hexStakingService.getAllActiveStakes();
    console.log(`📊 getAllActiveStakes returned: ${activeStakes.length} stakes`);
    
    // Test the getStakingMetrics method
    const stakingMetrics = await hexStakingService.getStakingMetrics();
    console.log(`📊 getStakingMetrics returned: ${stakingMetrics.totalActiveStakes} total active stakes`);
    
    // Test the getAllStakeStartsPaginated method
    const allStakeStarts = await hexStakingService.getAllStakeStartsPaginated(1000);
    console.log(`📊 getAllStakeStartsPaginated returned: ${allStakeStarts.length} stake starts`);

    return NextResponse.json({
      success: true,
      data: {
        activeStakes: activeStakes.length,
        totalActiveStakes: stakingMetrics.totalActiveStakes,
        allStakeStarts: allStakeStarts.length,
        stakingMetrics: stakingMetrics,
        sampleActiveStakes: activeStakes.slice(0, 3).map(s => ({
          stakeId: s.stakeId,
          stakerAddr: s.stakerAddr.slice(0, 10) + '...',
          stakedHearts: s.stakedHearts
        })),
        message: 'Ethereum data fetch test complete'
      }
    });

  } catch (error) {
    console.error('Test Ethereum fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}