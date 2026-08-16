// GET /api/portfolio/nft-media?uri=<encoded tokenURI image value>
//
// Streams NFT artwork from our own origin.
//
// Handing the browser a raw gateway URL does not work. A single gateway is a
// single point of failure and the page has no way to retry a different one:
// measured, 27 tiles pointed at ipfs.io and 3 painted, because that host answers
// 403 to plenty of requests. The browser can't race gateways — but the server
// can, so it does that here and hands back bytes that are known to be an image.
//
// This is the same shape as /api/token-logo, and it inherits that route's
// reasoning: an open image proxy is an SSRF hole and a bandwidth piñata, so the
// destination is constrained rather than free-form. Here the constraint is that
// an `ipfs://` URI is only ever fetched through our own gateway list, and an
// http(s) URI must be https and must not point anywhere internal.

import { NextRequest, NextResponse } from 'next/server';
import { cidOf, classify } from '@/lib/portfolio/nftMetadata';

export const revalidate = 0;
export const maxDuration = 30;

const GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://4everland.io/ipfs/',
  'https://flk-ipfs.xyz/ipfs/',
  'https://ipfs.io/ipfs/',
];

/** Artwork is content-addressed, so a hit can be cached hard. */
const CACHE = 'public, max-age=86400, s-maxage=604800, immutable';
const FETCH_TIMEOUT_MS = 20_000;
const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Hostnames that must never be fetched, whatever the URI says.
 *
 * Link-local covers the cloud metadata endpoint (169.254.169.254); the private
 * ranges and loopback cover anything reachable only from inside the deployment.
 */
function isInternal(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return true;
  if (/^\[?::1\]?$/.test(h)) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 127 || a === 10 || a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function candidates(uri: string): string[] {
  const cid = cidOf(uri);
  if (cid) return GATEWAYS.map((g) => g + cid);
  if (/^https:\/\//i.test(uri)) {
    try {
      const u = new URL(uri);
      if (!isInternal(u.hostname)) return [uri];
    } catch {
      /* fall through */
    }
  }
  return [];
}

/** First response that is actually an image wins; parking pages lose. */
async function race(urls: string[]): Promise<{ bytes: Uint8Array; type: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await new Promise((resolve) => {
      let left = urls.length;
      for (const url of urls) {
        void (async () => {
          try {
            const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
            if (r.ok) {
              const buf = await r.arrayBuffer();
              if (buf.byteLength <= MAX_BYTES) {
                const bytes = new Uint8Array(buf);
                // An HTML apology page is not artwork, however green its status.
                if (classify(bytes) === 'image') {
                  ctrl.abort();
                  resolve({ bytes, type: r.headers.get('content-type') || 'image/png' });
                  return;
                }
              }
            }
          } catch {
            /* this gateway is simply out of the race */
          }
          if (--left === 0) resolve(null);
        })();
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const uri = (new URL(req.url).searchParams.get('uri') ?? '').trim();
  if (!uri) return NextResponse.json({ error: 'missing uri' }, { status: 400 });

  // Inline artwork never leaves the chain — hand it straight back.
  if (uri.startsWith('data:')) return NextResponse.redirect(uri);

  const urls = candidates(uri);
  if (urls.length === 0) return NextResponse.json({ error: 'unsupported uri' }, { status: 400 });

  const got = await race(urls);
  if (!got) {
    // 404, not 500: the artwork is genuinely not retrievable, and the tile
    // should settle into its placeholder rather than retry forever.
    return NextResponse.json({ error: 'not retrievable' }, { status: 404 });
  }
  return new NextResponse(Buffer.from(got.bytes), {
    headers: { 'Content-Type': got.type, 'Cache-Control': CACHE },
  });
}
