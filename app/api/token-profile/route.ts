import { NextRequest, NextResponse } from 'next/server';
import { getTokenProfileCustom, setTokenProfileCustom } from '@/lib/db/tokenProfileCustom';

const ADMIN_SECRET = process.env.GOLD_ADMIN_SECRET || process.env.ADMIN_SECRET;

function isAuthorized(request: NextRequest): boolean {
  if (!ADMIN_SECRET) return false;
  const header = request.headers.get('x-admin-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return header === ADMIN_SECRET;
}

/** GET ?address=0x... — public, returns custom description, logo_url, custom_links for token */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  }
  try {
    const profile = await getTokenProfileCustom(address);
    if (!profile) {
      return NextResponse.json({ description: null, logo_url: null, custom_links: [] });
    }
    return NextResponse.json(profile);
  } catch (e) {
    console.error('GET /api/token-profile', e);
    return NextResponse.json({ error: 'Failed to load token profile' }, { status: 500 });
  }
}

/** POST — admin only. Body: { address, description?, logo_url?, custom_links? } */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const address = body?.address;
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }
    const result = await setTokenProfileCustom(address, {
      description: body.description,
      logo_url: body.logo_url,
      custom_links: Array.isArray(body.custom_links) ? body.custom_links : undefined,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Failed to save' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/token-profile', e);
    return NextResponse.json({ error: 'Failed to save token profile' }, { status: 500 });
  }
}
