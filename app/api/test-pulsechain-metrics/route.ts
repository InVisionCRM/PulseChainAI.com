import { NextResponse } from 'next/server';
import { PulseChainHexStakingService } from '@/services/pulsechainHexStakingService';

export async function GET() {
  try {
    const service = new PulseChainHexStakingService();
    const metrics = await service.getStakingMetrics();
    
    return NextResponse.json({
      success: true,
      data: metrics,
      message: 'PulseChain staking metrics fetched successfully'
    });
  } catch (error) {
    console.error('Test PulseChain metrics error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}