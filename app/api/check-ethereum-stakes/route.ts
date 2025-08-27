import { NextResponse } from 'next/server';
import { hexStakingService } from '@/services/hexStakingService';

export async function GET() {
  try {
    // Get a small sample of Ethereum stakes to compare with PulseChain
    const topStakes = await hexStakingService.getTopStakes(5);
    
    return NextResponse.json({
      success: true,
      data: {
        sampleStakes: topStakes.map(stake => ({
          stakeId: stake.stakeId,
          stakerAddr: stake.stakerAddr,
          stakedHearts: stake.stakedHearts.substring(0, 15) + '...',
          startDay: stake.startDay,
          endDay: stake.endDay,
          isActive: stake.isActive,
          daysLeft: stake.daysLeft
        })),
        message: 'Sample stakes from Ethereum GraphQL'
      }
    });
    
  } catch (error) {
    console.error('Check Ethereum stakes error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}