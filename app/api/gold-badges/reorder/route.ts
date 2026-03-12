import { NextRequest, NextResponse } from 'next/server';
import { reorderGoldBadges } from '@/lib/db/goldBadges';

const ADMIN_SECRET = process.env.GOLD_ADMIN_SECRET || process.env.ADMIN_SECRET;

function isAuthorized(request: NextRequest): boolean {
  if (!ADMIN_SECRET) return false;
  const header = request.headers.get('x-admin-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return header === ADMIN_SECRET;
}

/** PATCH: reorder GOLD badges by passing ordered array of addresses (admin only) */
export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const orderedAddresses = Array.isArray(body?.orderedAddresses) ? body.orderedAddresses : body?.addresses;
    if (!Array.isArray(orderedAddresses) || orderedAddresses.length === 0) {
      return NextResponse.json({ error: 'Missing orderedAddresses (array of addresses)' }, { status: 400 });
    }
    const list = orderedAddresses.filter((a: unknown) => typeof a === 'string').map((a: string) => a.trim());
    const result = await reorderGoldBadges(list);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Failed to reorder' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/gold-badges/reorder', e);
    return NextResponse.json({ error: 'Failed to reorder gold badges' }, { status: 500 });
  }
}
