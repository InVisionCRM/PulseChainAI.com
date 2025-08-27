import { NextResponse } from 'next/server';
import { hexStakingService } from '@/services/hexStakingService';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';

export async function GET() {
  try {
    console.log('🚀 Quick test of both networks...');
    
    // Get just top 5 stakes from each network using their cached data
    const [ethStakes, pulseStakes] = await Promise.allSettled([
      hexStakingService.getTopStakes(5),
      pulsechainHexStakingService.getTopStakes(5)
    ]);
    
    const result: any = {
      timestamp: new Date().toISOString(),
      ethereum: {
        status: ethStakes.status,
        count: ethStakes.status === 'fulfilled' ? ethStakes.value.length : 0,
        stakes: ethStakes.status === 'fulfilled' ? ethStakes.value.map(s => ({
          stakeId: s.stakeId,
          network: 'ethereum',
          stakedHearts: s.stakedHearts.substring(0, 12) + '...',
          isActive: s.isActive
        })) : [],
        error: ethStakes.status === 'rejected' ? ethStakes.reason.message : null
      },
      pulsechain: {
        status: pulseStakes.status,
        count: pulseStakes.status === 'fulfilled' ? pulseStakes.value.length : 0,
        stakes: pulseStakes.status === 'fulfilled' ? pulseStakes.value.map(s => ({
          stakeId: s.stakeId,
          network: 'pulsechain',
          stakedHearts: s.stakedHearts.substring(0, 12) + '...',
          isActive: s.isActive
        })) : [],
        error: pulseStakes.status === 'rejected' ? pulseStakes.reason.message : null
      }
    };
    
    // Check if we have duplicates (same stake IDs on both networks)
    if (result.ethereum.stakes.length > 0 && result.pulsechain.stakes.length > 0) {
      const ethStakeIds = result.ethereum.stakes.map((s: any) => s.stakeId);
      const pulseStakeIds = result.pulsechain.stakes.map((s: any) => s.stakeId);
      const duplicateIds = ethStakeIds.filter((id: string) => pulseStakeIds.includes(id));
      
      result.analysis = {
        hasDuplicateStakeIds: duplicateIds.length > 0,
        duplicateIds,
        ethereumIdRange: `${Math.min(...ethStakeIds.map((id: string) => parseInt(id)))} - ${Math.max(...ethStakeIds.map((id: string) => parseInt(id)))}`,
        pulsechainIdRange: `${Math.min(...pulseStakeIds.map((id: string) => parseInt(id)))} - ${Math.max(...pulseStakeIds.map((id: string) => parseInt(id)))}`
      };
    }
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Quick test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}