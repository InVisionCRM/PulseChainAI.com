import { NextResponse } from 'next/server';
import { unifiedHexStakingService } from '@/services/unifiedHexStakingService';

export async function GET() {
  try {
    const status = await unifiedHexStakingService.getDatabaseStatus();

    return NextResponse.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting database status:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get database status'
    }, { status: 500 });
  }
}
