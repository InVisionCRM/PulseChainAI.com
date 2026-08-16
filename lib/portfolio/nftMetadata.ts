// Turn a tokenURI into metadata — name, image, traits.
//
// Four URI shapes exist in the wild on PulseChain, all four verified against
// live collections:
//   ipfs://…            Moshi Mochi, Killer GF, TheEarlyBurds
//   https://…           Axolittles (storage.googleapis.com), Rare Ghost Club
//                       (a project's own Pinata host)
//   data:…;base64       Crypto Marcs — the whole JSON, and a 1200×1200 SVG
//                       inside it, is on-chain. Resolves in 0.0s.
//   direct media        some contracts point tokenURI straight at an image
//                       instead of at JSON.
//
// Two hard-won rules shape this file.
//
// FIRST: gateways are raced, never tried in turn. Sequentially, one slow gateway
// spends the whole budget before a fast one is asked; measured, the same CIDs
// went from timing out at 29s to resolving in ~1s once every gateway was asked
// at once.
//
// SECOND, and the one that actually bites: a gateway answering 200 does not mean
// it answered with your content. `ipfs.runfission.com` returns a 404KB HTML
// parking page for *any* CID, and an earlier version of this code counted that
// as a hit — which made three dead collections look healthy. So a response is
// only accepted if it parses as JSON or carries real image magic bytes, and
// anything HTML-shaped is rejected outright. Trusting the status code silently
// turns "this is gone" into "here is your NFT".

const GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://4everland.io/ipfs/',
  'https://flk-ipfs.xyz/ipfs/',
  'https://trustless-gateway.link/ipfs/',
];

/** Hosts proven to serve a parking page instead of content. Never raced. */
const DEAD_GATEWAYS = new Set(['ipfs.runfission.com']);

/**
 * Generous on purpose. A gateway that answers in 6s on its own can take longer
 * once eight of them are in flight at once and sharing the same egress, and a
 * budget tuned to the solo case turns a collection that *does* resolve into one
 * the UI reports as gone — measured: Aruharts answered from Pinata in 5.6s by
 * itself and missed a 10s race. Cold metadata is fetched once and then cached,
 * so waiting is much cheaper than being wrong.
 */
const FETCH_TIMEOUT_MS = 20_000;
/** Metadata is small; an NFT image is not, but 8MB covers the honest ones. */
const MAX_BYTES = 8 * 1024 * 1024;

export interface NftTrait {
  type: string;
  value: string;
}

export interface NftMeta {
  name: string | null;
  description: string | null;
  /** Already normalised to something a browser can load. */
  image: string | null;
  /**
   * The project's own link, when the metadata publishes one.
   *
   * `external_url` is part of the metadata standard and is the only project
   * website that can be established without a curated list — it is authored by
   * the collection itself and reached through its tokenURI. Most PulseChain
   * collections leave it out or set it empty (checked: Aruharts has the key but
   * blank, PulseBitcoinLockNFT omits it), so absence is the normal case and
   * never worth inventing a link to fill.
   */
  externalUrl: string | null;
  traits: NftTrait[];
}

/** ipfs:// and gateway URLs alike reduce to a CID + optional path. */
export function cidOf(uri: string): string | null {
  const direct = uri.match(/^ipfs:\/\/(?:ipfs\/)?(.+)$/i);
  if (direct) return direct[1];
  // subdomain gateways: https://<cid>.ipfs.<host>/<path>
  const sub = uri.match(/^https?:\/\/(ba[a-z0-9]{20,}|Qm[A-Za-z0-9]{44})\.ipfs\.[^/]+\/?(.*)$/i);
  if (sub) return sub[1] + (sub[2] ? '/' + sub[2] : '');
  const path = uri.match(/\/ipfs\/([^?#]+)/);
  if (path) return path[1];
  return null;
}

const IMAGE_MAGIC = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46, 0x38], // GIF
  [0x52, 0x49, 0x46, 0x46], // WEBP (RIFF)
];

/**
 * Is this actually content, or a gateway's apology page?
 *
 * Returns the parsed JSON, the literal 'image' marker, or null to reject.
 */
export function classify(bytes: Uint8Array): { json: unknown } | 'image' | null {
  if (bytes.length < 8) return null;
  const head = new TextDecoder().decode(bytes.slice(0, 600)).trim().toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html') || head.includes('<head>')) {
    return null;
  }
  const first = head[0];
  if (first === '{' || first === '[') {
    try {
      return { json: JSON.parse(new TextDecoder().decode(bytes)) };
    } catch {
      return null;
    }
  }
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'image';
  if (IMAGE_MAGIC.some((m) => m.every((b, i) => bytes[i] === b))) return 'image';
  return null;
}

async function grab(url: string, signal: AbortSignal): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url, { signal, redirect: 'follow' });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return null;
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export interface Fetched {
  bytes: Uint8Array;
  kind: { json: unknown } | 'image';
  /** Where it came from — useful when a collection's own host is the only one. */
  source: string;
}

/**
 * Fetch a tokenURI's content, racing every plausible source.
 *
 * Resolves with the first response that survives `classify`; a gateway that
 * answers with a parking page loses the race rather than winning it.
 */
export async function fetchUri(uri: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Fetched | null> {
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    if (comma < 0) return null;
    const meta = uri.slice(0, comma);
    const body = uri.slice(comma + 1);
    try {
      const bytes = meta.includes('base64')
        ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
        : new TextEncoder().encode(decodeURIComponent(body));
      const kind = classify(bytes);
      return kind ? { bytes, kind, source: 'on-chain' } : null;
    } catch {
      return null;
    }
  }

  const urls: string[] = [];
  if (/^https?:\/\//i.test(uri)) {
    try {
      if (!DEAD_GATEWAYS.has(new URL(uri).hostname)) urls.push(uri);
    } catch {
      /* unparseable — fall through to the CID path */
    }
  }
  const cid = cidOf(uri);
  if (cid) urls.push(...GATEWAYS.map((g) => g + cid));
  if (urls.length === 0) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await new Promise<Fetched | null>((resolve) => {
      let outstanding = urls.length;
      for (const url of urls) {
        void grab(url, ctrl.signal).then((bytes) => {
          if (bytes) {
            const kind = classify(bytes);
            if (kind) {
              ctrl.abort(); // the losers stop downloading
              resolve({ bytes, kind, source: url });
              return;
            }
          }
          if (--outstanding === 0) resolve(null);
        });
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

/** ipfs:// → a gateway URL the browser can actually load. */
export function toLoadable(uri: string): string {
  if (uri.startsWith('data:') || /^https?:\/\//i.test(uri)) return uri;
  const cid = cidOf(uri);
  return cid ? GATEWAYS[0] + cid : uri;
}

/** Pull the fields we show out of whatever shape the JSON arrived in. */
export function readMeta(json: unknown): NftMeta {
  const j = (json ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  // `image_data` / `svg_image_data` carry the artwork inline — Crypto Marcs puts
  // a full SVG there — so they count as an image, not as a missing one.
  const rawImage =
    str(j.image) ?? str(j.image_url) ?? str(j.image_data) ?? str(j.svg_image_data) ?? null;

  const attrs = Array.isArray(j.attributes) ? j.attributes : [];
  const traits: NftTrait[] = [];
  for (const a of attrs) {
    if (!a || typeof a !== 'object') continue;
    const o = a as Record<string, unknown>;
    const type = str(o.trait_type) ?? str(o.traitType) ?? str(o.key);
    const value = o.value == null ? null : String(o.value);
    if (type && value) traits.push({ type, value });
  }
  // Only http(s) — a metadata file is untrusted input, and javascript:/data:
  // in an href is a script-injection vector, not a website.
  const ext = str(j.external_url) ?? str(j.external_link) ?? str(j.website);
  const externalUrl = ext && /^https?:\/\//i.test(ext) ? ext : null;

  return {
    name: str(j.name),
    description: str(j.description),
    image: rawImage ? toLoadable(rawImage) : null,
    externalUrl,
    traits,
  };
}
