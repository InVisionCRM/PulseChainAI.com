import { NextRequest, NextResponse } from 'next/server';
import { addComment, listComments, deleteComment, hashIp } from '@/lib/db/tokenSocial';

export const dynamic = 'force-dynamic';

const ADMIN_SECRET = process.env.GOLD_ADMIN_SECRET || process.env.ADMIN_SECRET;

function isAdmin(req: NextRequest): boolean {
  if (!ADMIN_SECRET) return false;
  const header =
    req.headers.get('x-admin-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return header === ADMIN_SECRET;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// GET /api/geicko/comments?chain=pulsechain&token=0x..&offset=0
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = sp.get('chain') || 'pulsechain';
  const token = sp.get('token') || '';
  const offset = Number(sp.get('offset') || 0) || 0;
  const res = await listComments(chain, token, 25, offset);
  if (!res) return NextResponse.json({ comments: [], hasMore: false, unavailable: true });
  return NextResponse.json(res);
}

// POST /api/geicko/comments  { chain, token, name, body, website? (honeypot) }
export async function POST(req: NextRequest) {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  // Honeypot: real users never fill a hidden field. Pretend success so bots
  // don't learn they were caught, but store nothing.
  if (typeof payload?.website === 'string' && payload.website.trim() !== '') {
    return NextResponse.json({ ok: true, comment: null });
  }
  const res = await addComment(
    String(payload?.chain ?? ''),
    String(payload?.token ?? ''),
    String(payload?.name ?? ''),
    String(payload?.body ?? ''),
    hashIp(clientIp(req)),
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, comment: res.comment });
}

// DELETE /api/geicko/comments?id=123   (admin only)
export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const ok = await deleteComment(id);
  return NextResponse.json({ ok });
}
