// GET /api/token-logo?url=<encoded logo url>
//
// Re-serves a token logo from OUR origin so a canvas that draws it stays
// exportable.
//
// Why this has to exist: the logo CDNs send no `Access-Control-Allow-Origin`
// (verified — `cdn.dexscreener.com` returns none). Drawing such an image onto a
// canvas taints it, and a tainted canvas throws SecurityError on `toBlob()` /
// `toDataURL()`. So the bubble field can be rendered but never exported, which
// is exactly what the share button needs to do. Loading the same bytes through
// this route makes them same-origin, so the share canvas stays clean.
//
// This is deliberately NOT on the page's hot path — bubbles still load logos
// straight from the CDN. Only the share render pulls through here, so a page
// view costs this route nothing.
//
// Hosts are allow-listed. An open image proxy is an SSRF hole (internal IPs,
// cloud metadata endpoints) and a free bandwidth piñata; the list below is the
// set of hosts the screener's own `imageUrl` values actually come from —
// DexScreener for PulseChain rows, CoinGecko's CDN for the GeckoTerminal-backed
// chains.

import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'cdn.dexscreener.com',
  'dd.dexscreener.com',
  'coin-images.coingecko.com',
  'assets.coingecko.com',
]);

/** Logos are content-addressed or versioned, so they can be cached hard. */
const CACHE = 'public, max-age=86400, s-maxage=604800, immutable';

const FETCH_TIMEOUT_MS = 10_000;
/** A token logo is a few hundred KB at most; anything larger isn't one. */
const MAX_BYTES = 4 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'url required' }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'malformed url' }, { status: 400 });
  }

  if (target.protocol !== 'https:') {
    return NextResponse.json({ error: 'https only' }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: `host not allowed: ${target.hostname}` }, { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { Accept: 'image/*' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
    }

    // Only ever hand back an image — this route must not become a way to
    // relay arbitrary content through our origin.
    const type = upstream.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) {
      return NextResponse.json({ error: `not an image: ${type || 'unknown'}` }, { status: 415 });
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'image too large' }, { status: 413 });
    }

    return new NextResponse(buf, {
      headers: {
        'Content-Type': type,
        'Cache-Control': CACHE,
        // The share canvas loads this with crossOrigin="anonymous"; without
        // this header the browser refuses the image and we're back to a
        // tainted canvas.
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'fetch failed' },
      { status: 502 },
    );
  }
}
