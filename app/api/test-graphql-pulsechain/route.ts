import { NextResponse } from 'next/server';
import { PulseChainHexStakingService } from '@/services/pulsechainHexStakingService';

export async function GET() {
  try {
    const service = new PulseChainHexStakingService();
    
    // Force GraphQL mode by temporarily disabling database
    const originalDbFlag = (service as any).isDatabaseAvailable;
    (service as any).isDatabaseAvailable = false;
    
    console.log('🔍 Testing GraphQL API to get actual active stakes count...');
    
    const metrics = await service.getStakingMetrics();
    
    // Restore original database flag
    (service as any).isDatabaseAvailable = originalDbFlag;
    
    return NextResponse.json({
      success: true,
      data: {
        totalActiveStakes: metrics.totalActiveStakes,
        topStakesCount: metrics.topStakes.length,
        totalStakedHearts: metrics.totalStakedHearts,
        averageStakeLength: metrics.averageStakeLength,
        message: 'GraphQL PulseChain data (bypassed database)'
      }
    });
  } catch (error) {
    console.error('Test GraphQL PulseChain error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}