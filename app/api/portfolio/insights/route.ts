import { NextRequest, NextResponse } from 'next/server';

// Per-token insights for the portfolio's Aceternity-style expandable card.
// Aggregates the DexScreener token profile (description / socials / market
// cap / liquidity) with PulseScan / eth.blockscout creator info, so the
// portfolio can show contextual research per holding without sending the
// user to the full /geicko page. The geicko page stays the link target for
// the deep-dive (full audit + holders + AI chat).

type ChainId = 'ethereum' | 'pulsechain';

const DEX_TOKENS_URL = 'https://api.dexscreener.com/latest/dex/tokens';
const BLOCKSCOUT_BASE: Record<ChainId, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
};

// Known pump.tires factory address — tokens created via this contract
// inherit pump.tires' guarantees (always renounced, fixed supply, no
// owner functions). Mirrored from services/contractAuditService.ts.
const PUMP_TIRES_CREATOR = '0x6538a83a81d855b965983161af6a83e616d16fd5';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dead';

// DexScreener returns a Cloudflare HTML challenge without a real UA.
const DEX_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface Social {
  type: string;
  url: string;
}

interface Website {
  label: string;
  url: string;
}

interface InsightsResponse {
  address: string;
  chain: ChainId;
  description: string | null;
  socials: Social[];
  websites: Website[];
  iconImageUrl: string | null;
  headerImageUrl: string | null;
  marketCap: number | null;
  fdv: number | null;
  totalSupply: number | null;
  liquidityUsd: number | null;
  pairCount: number;
  primaryPairUrl: string | null;
  creatorAddress: string | null;
  isPumpTires: boolean;
  ownershipRenounced: boolean | null;
  fetchedAt: number;
}

const insightsCache = new Map<string, InsightsResponse>();

const cacheKey = (chain: ChainId, address: string) =>
  `${chain}:${address.toLowerCase()}`;

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(init || {}), signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchDexProfile(address: string): Promise<any | null> {
  const r = await fetchWithTimeout(`${DEX_TOKENS_URL}/${address}`, {
    headers: DEX_HEADERS,
    next: { revalidate: 60 },
  });
  if (!r || !r.ok) return null;
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchTokenMetadata(
  chain: ChainId,
  address: string,
): Promise<any | null> {
  const r = await fetchWithTimeout(
    `${BLOCKSCOUT_BASE[chain]}/tokens/${address}`,
  );
  if (!r || !r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchAddressInfo(
  chain: ChainId,
  address: string,
): Promise<any | null> {
  const r = await fetchWithTimeout(
    `${BLOCKSCOUT_BASE[chain]}/addresses/${address}`,
  );
  if (!r || !r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

function bestPair(pairs: any[], address: string): any | null {
  if (!Array.isArray(pairs) || pairs.length === 0) return null;
  const target = address.toLowerCase();
  const withTarget = pairs.filter((p) => {
    const base = p?.baseToken?.address?.toLowerCase();
    const quote = p?.quoteToken?.address?.toLowerCase();
    return base === target || quote === target;
  });
  return (
    withTarget
      .map((p) => ({ pair: p, liq: Number(p?.liquidity?.usd) || 0 }))
      .sort((a, b) => b.liq - a.liq)[0]?.pair ?? null
  );
}

function dedupeBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

function gatherSocials(pair: any): Social[] {
  const collected: Social[] = [];
  const push = (arr: any) => {
    if (!Array.isArray(arr)) return;
    for (const s of arr) {
      if (s?.type && s?.url) collected.push({ type: String(s.type), url: String(s.url) });
    }
  };
  push(pair?.info?.socials);
  push(pair?.profile?.socials);
  push(pair?.baseToken?.links?.socials);
  // Some pair shapes expose link fields by name (twitter, telegram, discord).
  const links = pair?.baseToken?.links;
  if (links && typeof links === 'object') {
    for (const key of ['twitter', 'telegram', 'discord', 'reddit', 'github']) {
      if (links[key]) collected.push({ type: key, url: String(links[key]) });
    }
  }
  return dedupeBy(collected, (s) => `${s.type}|${s.url}`);
}

function gatherWebsites(pair: any): Website[] {
  const collected: Website[] = [];
  const push = (arr: any) => {
    if (!Array.isArray(arr)) return;
    for (const w of arr) {
      if (w?.url) {
        collected.push({
          label: String(w.label || w.url),
          url: String(w.url),
        });
      }
    }
  };
  push(pair?.info?.websites);
  push(pair?.profile?.websites);
  const wsite = pair?.baseToken?.links?.website;
  if (wsite) collected.push({ label: 'Website', url: String(wsite) });
  return dedupeBy(collected, (w) => w.url);
}

function toNumberSafe(raw: unknown, decimals: number): number | null {
  if (raw == null) return null;
  try {
    const big = BigInt(String(raw));
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = Number(big / divisor);
    const fraction = Number(big % divisor) / Number(divisor);
    const n = whole + fraction;
    return Number.isFinite(n) ? n : null;
  } catch {
    const n = parseFloat(String(raw));
    return Number.isFinite(n) ? n / 10 ** decimals : null;
  }
}

async function buildInsights(
  chain: ChainId,
  address: string,
): Promise<InsightsResponse> {
  const [dexData, tokenMeta, addrInfo] = await Promise.all([
    fetchDexProfile(address),
    fetchTokenMetadata(chain, address),
    fetchAddressInfo(chain, address),
  ]);

  const pair = bestPair(dexData?.pairs || [], address);
  const socials = pair ? gatherSocials(pair) : [];
  const websites = pair ? gatherWebsites(pair) : [];

  // Token metadata via the chain's explorer — gives us creator + supply.
  const creatorRaw =
    addrInfo?.creator_address_hash ||
    addrInfo?.creator_address ||
    tokenMeta?.creator_address_hash ||
    null;
  const creatorAddress =
    typeof creatorRaw === 'string' ? creatorRaw.toLowerCase() : null;
  const isPumpTires = creatorAddress === PUMP_TIRES_CREATOR;

  // Heuristic for "renounced": pump.tires inherits renounced; otherwise we
  // can't tell without reading owner() on the contract, which is more
  // expensive. Leave null to mean "unknown" rather than guessing wrong.
  const ownershipRenounced = isPumpTires ? true : null;

  const totalSupplyRaw = tokenMeta?.total_supply;
  const decimals = tokenMeta?.decimals
    ? parseInt(tokenMeta.decimals, 10)
    : 18;
  const totalSupply =
    totalSupplyRaw != null
      ? toNumberSafe(totalSupplyRaw, Number.isFinite(decimals) ? decimals : 18)
      : null;

  const marketCap =
    Number(pair?.marketCap) ||
    (tokenMeta?.circulating_market_cap
      ? Number(tokenMeta.circulating_market_cap)
      : null);
  const fdv = Number(pair?.fdv) || null;
  const liquidityUsd = Number(pair?.liquidity?.usd) || null;

  const description =
    pair?.info?.description ||
    pair?.profile?.description ||
    pair?.description ||
    null;

  const iconImageUrl =
    pair?.info?.imageUrl ||
    pair?.profile?.iconImageUrl ||
    tokenMeta?.icon_url ||
    null;
  const headerImageUrl =
    pair?.info?.header ||
    pair?.profile?.headerImageUrl ||
    null;

  return {
    address: address.toLowerCase(),
    chain,
    description: description ? String(description) : null,
    socials,
    websites,
    iconImageUrl,
    headerImageUrl,
    marketCap: Number.isFinite(marketCap) ? (marketCap as number) : null,
    fdv: Number.isFinite(fdv) ? (fdv as number) : null,
    totalSupply,
    liquidityUsd,
    pairCount: Array.isArray(dexData?.pairs) ? dexData.pairs.length : 0,
    primaryPairUrl: pair?.url || null,
    creatorAddress,
    isPumpTires,
    ownershipRenounced,
    fetchedAt: Date.now(),
  };
}

function isValidAddress(s: unknown): s is string {
  return (
    typeof s === 'string' && /^0x[a-f0-9]{40}$/i.test(s)
  );
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const address = body?.address;
  const chain: ChainId = body?.chain === 'ethereum' ? 'ethereum' : 'pulsechain';
  if (!isValidAddress(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  const key = cacheKey(chain, address);
  const cached = insightsCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ insights: cached }, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  }

  const insights = await buildInsights(chain, address.toLowerCase());
  insightsCache.set(key, insights);

  return NextResponse.json({ insights }, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  });
}
