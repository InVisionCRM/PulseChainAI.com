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
 * How many gateways to race per image.
 *
 * Kept low on purpose. A gallery opens a dozen tiles at once, and six gateways
 * each turned that into ~72 simultaneous outbound requests — enough to saturate
 * the server's egress and wedge the dev server outright, with individual images
 * taking 13-20s. Three is plenty: the winner is almost always the collection's
 * own host or the first public gateway, and the rest were only ever insurance.
 */
const RACE_WIDTH = 3;

/**
 * Successful artwork, kept in memory for the life of the process.
 *
 * The bytes behind a CID never change, so a hit is permanently valid. Bounded
 * because a wallet with hundreds of NFTs would otherwise pin every image it has
 * ever shown.
 */
const hits = new Map<string, { bytes: Uint8Array; type: string }>();
const MAX_CACHED = 120;

/**
 * Fetches already running, keyed by URI.
 *
 * A grid re-rendering asks for the same image several times in quick
 * succession; without this each of those starts its own race.
 */
const inFlight = new Map<string, Promise<{ bytes: Uint8Array; type: string } | null>>();

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

/**
 * Where to look for this image, best bet first.
 *
 * The URI's own host goes first whenever it has one. An earlier version handed
 * back only public gateways as soon as the path contained `/ipfs/`, which threw
 * away the collection's own pinning host — and that host is usually the one
 * place the content is actually pinned. Rare Ghost Club serves its art from
 * `nervous.mypinata.cloud` in ~1.3s while the public gateways 404 on the same
 * CID, so dropping it turned working artwork into a missing tile.
 */
function candidates(uri: string): string[] {
  const out: string[] = [];
  if (/^https:\/\//i.test(uri)) {
    try {
      const u = new URL(uri);
      if (!isInternal(u.hostname)) out.push(uri);
    } catch {
      /* not a usable URL — the CID path below may still work */
    }
  }
  const cid = cidOf(uri);
  if (cid) out.push(...GATEWAYS.map((g) => g + cid));
  return out;
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

  const cached = hits.get(uri);
  if (cached) {
    return new NextResponse(Buffer.from(cached.bytes), {
      headers: { 'Content-Type': cached.type, 'Cache-Control': CACHE },
    });
  }

  const urls = candidates(uri).slice(0, RACE_WIDTH);
  if (urls.length === 0) return NextResponse.json({ error: 'unsupported uri' }, { status: 400 });

  let job = inFlight.get(uri);
  if (!job) {
    job = race(urls).finally(() => inFlight.delete(uri));
    inFlight.set(uri, job);
  }
  const got = await job;
  if (got) {
    // Cheap eviction: drop the oldest insertion. Map preserves insertion order,
    // and any hit is as good as any other once it is in hand.
    if (hits.size >= MAX_CACHED) hits.delete(hits.keys().next().value as string);
    hits.set(uri, got);
  }
  if (!got) {
    // 404, not 500: the artwork is genuinely not retrievable, and the tile
    // should settle into its placeholder rather than retry forever.
    return NextResponse.json({ error: 'not retrievable' }, { status: 404 });
  }
  return new NextResponse(Buffer.from(got.bytes), {
    headers: { 'Content-Type': got.type, 'Cache-Control': CACHE },
  });
}
