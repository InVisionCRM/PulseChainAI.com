import { NextRequest, NextResponse } from 'next/server';
import { getGoldBadges, getGoldBadgesWithLogo, addGoldBadge } from '@/lib/db/goldBadges';

const ADMIN_SECRET = process.env.GOLD_ADMIN_SECRET || process.env.ADMIN_SECRET;

function isAuthorized(request: NextRequest): boolean {
  if (!ADMIN_SECRET) return false;
  const header = request.headers.get('x-admin-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return header === ADMIN_SECRET;
}

/** GET: public list of GOLD badge addresses (ordered). List includes logo_url from token profile when set. */
export async function GET() {
  try {
    const list = await getGoldBadgesWithLogo();
    return NextResponse.json({ addresses: list.map((r) => r.token_address), list });
  } catch (e) {
    console.error('GET /api/gold-badges', e);
    return NextResponse.json({ error: 'Failed to load gold badges' }, { status: 500 });
  }
}

/** POST: add a GOLD badge (admin only) */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const tokenAddress = typeof body?.address === 'string' ? body.address : body?.token_address;
    if (!tokenAddress) {
      return NextResponse.json({ error: 'Missing address or token_address' }, { status: 400 });
    }
    const displayOrder = typeof body?.display_order === 'number' ? body.display_order : undefined;
    const symbol = typeof body?.symbol === 'string' ? body.symbol : undefined;
    const name = typeof body?.name === 'string' ? body.name : undefined;
    const result = await addGoldBadge(tokenAddress, displayOrder, symbol ?? null, name ?? null);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Failed to add' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/gold-badges', e);
    return NextResponse.json({ error: 'Failed to add gold badge' }, { status: 500 });
  }
}
