import { NextResponse } from 'next/server';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';

export async function GET() {
  try {
    // Get a small sample of stakes directly from GraphQL to inspect their format
    const query = `
      query GetSampleStakes {
        stakeStarts(first: 5, orderBy: stakeId, orderDirection: asc) {
          id
          stakeId
          stakerAddr
          stakedHearts
          startDay
          endDay
          timestamp
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
        startDay: string;
        endDay: string;
        timestamp: string;
      }>;
      globalInfos: Array<{ hexDay: string }>;
    }>(query);

    const currentDay = data.globalInfos[0] ? parseInt(data.globalInfos[0].hexDay) : 0;
    
    return NextResponse.json({
      success: true,
      data: {
        currentDay,
        sampleStakes: data.stakeStarts.map(stake => ({
          ...stake,
          isStillActive: parseInt(stake.endDay) > currentDay,
          daysLeft: Math.max(0, parseInt(stake.endDay) - currentDay)
        })),
        message: 'Sample stakes directly from PulseChain GraphQL'
      }
    });
    
  } catch (error) {
    console.error('Check PulseChain stakes error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}