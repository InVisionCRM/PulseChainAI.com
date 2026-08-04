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

/**
 * Redirects are followed BY HAND, re-checking the allow-list at every hop.
 *
 * `fetch()` follows 3xx automatically, which would quietly defeat the check
 * above: an allow-listed CDN answering `302 -> http://169.254.169.254/…` would
 * have us fetch the metadata endpoint and hand back its bytes. Only the first
 * URL was ever validated.
 *
 * Refusing redirects outright isn't an option — they're load-bearing here.
 * `dd.dexscreener.com/ds-data/tokens/…` answers `301` to
 * `cdn.dexscreener.com/tokens/…` (verified), so a legitimate logo can and does
 * hop hosts. Two hops covers that with room to spare.
 */
const MAX_REDIRECTS = 2;

/** https + allow-listed host, applied to the initial URL and every hop. */
function checkTarget(u: URL): string | null {
  if (u.protocol !== 'https:') return 'https only';
  if (!ALLOWED_HOSTS.has(u.hostname)) return `host not allowed: ${u.hostname}`;
  return null;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'url required' }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'malformed url' }, { status: 400 });
  }

  const bad = checkTarget(target);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  try {
    let upstream: Response;
    let url = target;
    for (let hop = 0; ; hop++) {
      upstream = await fetch(url.toString(), {
        headers: { Accept: 'image/*' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        // Do NOT let fetch chase these itself — see MAX_REDIRECTS above.
        redirect: 'manual',
      });

      if (upstream.status < 300 || upstream.status >= 400) break;

      const loc = upstream.headers.get('location');
      if (!loc) return NextResponse.json({ error: 'redirect without location' }, { status: 502 });
      if (hop >= MAX_REDIRECTS) {
        return NextResponse.json({ error: 'too many redirects' }, { status: 502 });
      }

      // Resolve relative Location values against the URL that issued them.
      let next: URL;
      try {
        next = new URL(loc, url);
      } catch {
        return NextResponse.json({ error: 'malformed redirect' }, { status: 502 });
      }
      const badHop = checkTarget(next);
      if (badHop) {
        return NextResponse.json({ error: `redirect blocked — ${badHop}` }, { status: 400 });
      }
      url = next;
    }

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
