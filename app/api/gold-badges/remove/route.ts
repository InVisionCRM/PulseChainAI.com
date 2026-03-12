import { NextRequest, NextResponse } from 'next/server';
import { removeGoldBadge } from '@/lib/db/goldBadges';

const ADMIN_SECRET = process.env.GOLD_ADMIN_SECRET || process.env.ADMIN_SECRET;

function isAuthorized(request: NextRequest): boolean {
  if (!ADMIN_SECRET) return false;
  const header = request.headers.get('x-admin-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return header === ADMIN_SECRET;
}

/** DELETE: remove a GOLD badge by address (admin only) */
export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  }
  try {
    const result = await removeGoldBadge(address);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Failed to remove' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/gold-badges/remove', e);
    return NextResponse.json({ error: 'Failed to remove gold badge' }, { status: 500 });
  }
}
