import { NextRequest, NextResponse } from 'next/server';
import { getRatings, getUserVote, castVote, hashIp } from '@/lib/db/tokenSocial';

export const dynamic = 'force-dynamic';

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// GET /api/geicko/ratings?chain=pulsechain&token=0x..  → { up, down, yourVote }
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = sp.get('chain') || 'pulsechain';
  const token = sp.get('token') || '';
  const counts = await getRatings(chain, token);
  if (!counts) return NextResponse.json({ up: 0, down: 0, yourVote: 0, unavailable: true });
  const yourVote = await getUserVote(chain, token, hashIp(clientIp(req)));
  return NextResponse.json({ ...counts, yourVote });
}

// POST /api/geicko/ratings  { chain, token, vote: 'up' | 'down' }
export async function POST(req: NextRequest) {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const raw = payload?.vote;
  const vote: 1 | -1 | null = raw === 'up' || raw === 1 ? 1 : raw === 'down' || raw === -1 ? -1 : null;
  if (vote === null) return NextResponse.json({ error: 'vote must be up or down.' }, { status: 400 });

  const res = await castVote(
    String(payload?.chain ?? ''),
    String(payload?.token ?? ''),
    hashIp(clientIp(req)),
    vote,
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error, counts: res.counts, yourVote: res.yourVote },
      { status: res.status },
    );
  }
  return NextResponse.json({ ok: true, ...res.counts, yourVote: res.yourVote });
}
