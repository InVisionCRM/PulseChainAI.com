import { NextRequest, NextResponse } from 'next/server';

const ADMIN_TOKEN = process.env.ADMIN_API_KEY;

const ADMIN_ONLY_PATTERNS: RegExp[] = [
  /^\/api\/admin(?:\/|$)/,
  /^\/api\/check-/,
  /^\/api\/clear-ethereum-data(?:\/|$)/,
  /^\/api\/copy-data(?:\/|$)/,
  /^\/api\/create-hex-tables(?:\/|$)/,
  /^\/api\/debug-/,
  /^\/api\/ethereum-full-sync(?:\/|$)/,
  /^\/api\/fix-/,
  /^\/api\/force-/,
  /^\/api\/migrate-tables(?:\/|$)/,
  /^\/api\/simple-pulsechain-sync(?:\/|$)/,
  /^\/api\/sync-(?:database|now)(?:\/|$)/,
  /^\/api\/system-analysis(?:\/|$)/,
];

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ONLY_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api') && isAdminRoute(pathname)) {
    if (!ADMIN_TOKEN) {
      return NextResponse.json(
        { error: 'Server misconfigured: ADMIN_API_KEY missing' },
        { status: 500 },
      );
    }

    const header = request.headers.get('authorization') || '';
    if (header !== `Bearer ${ADMIN_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
