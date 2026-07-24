import { NextRequest, NextResponse } from 'next/server';
import { getChain, isChainKey } from '@/lib/chains/registry';
import type { ChainKey } from '@/lib/chains/types';
import { blockscoutJson } from '@/lib/blockscout';
import { launchpadByAddress, launchpadsForChain } from '@/lib/launchpads';
import { cached } from '@/lib/geicko/serverCache';
import { robinscanAddress } from '@/lib/robinscan';

// Launchpad activity leaderboard.
//
// "Which launchpads are popular, and what's launched/bonded on each?" — answered
// data-first: take the chain's actively-trading tokens (GeckoTerminal), resolve
// each token's on-chain creator (its launchpad factory), group by creator, and
// rank the groups by 24h volume. Known factories are labelled from the registry
// (PUMP.tires, NOXA, bow.fun, LaunchHood, …); prolific unknown creators surface
// by address so the registry can grow. Every token here is trading on an AMM, so
// it has already bonded/graduated — coins still on the bonding curve aren't
// exposed by free sources (no public API / subgraph). Free: GeckoTerminal +
// Blockscout, no Moralis.

export const revalidate = 0;
export const maxDuration = 60;

const GT = 'https://api.geckoterminal.com/api/v2';
const MAX_PAGES = 3;         // GeckoTerminal pages of pools to scan (20/page)
const MAX_TOKENS = 50;       // distinct tokens to attribute
const TOP_TOKENS_PER_PAD = 6;
const CREATOR_TTL = 60 * 60 * 1000; // creators are immutable — cache an hour

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

async function gtJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

interface TokenRow {
  address: string;
  symbol: string;
  name: string;
  volume24: number;
  liquidityUsd: number;
  logo: string | null;
}

// Top actively-trading tokens on the chain, deepest-volume first.
async function topTokens(net: string): Promise<TokenRow[]> {
  const pages = await Promise.all(
    Array.from({ length: MAX_PAGES }, (_, i) =>
      gtJson(`${GT}/networks/${net}/pools?include=base_token&sort=h24_volume_usd_desc&page=${i + 1}`),
    ),
  );
  const tokenMeta = new Map<string, { address: string; symbol: string; name: string; image: string | null }>();
  const rows: TokenRow[] = [];
  const seen = new Set<string>();
  for (const j of pages) {
    if (!j) continue;
    for (const inc of (j.included ?? []) as any[]) {
      if (inc.type === 'token') {
        tokenMeta.set(inc.id, {
          address: String(inc.attributes?.address ?? '').toLowerCase(),
          symbol: inc.attributes?.symbol ?? '?',
          name: inc.attributes?.name ?? inc.attributes?.symbol ?? '',
          image:
            inc.attributes?.image_url && inc.attributes.image_url !== 'missing.png'
              ? inc.attributes.image_url
              : null,
        });
      }
    }
    for (const p of (j.data ?? []) as any[]) {
      const baseId = p?.relationships?.base_token?.data?.id ?? '';
      const meta = tokenMeta.get(baseId);
      const addr = meta?.address;
      if (!addr || seen.has(addr)) continue;
      seen.add(addr);
      rows.push({
        address: addr,
        symbol: meta.symbol,
        name: meta.name,
        volume24: num(p?.attributes?.volume_usd?.h24),
        liquidityUsd: num(p?.attributes?.reserve_in_usd),
        logo: meta.image,
      });
      if (rows.length >= MAX_TOKENS) return rows;
    }
  }
  return rows;
}

// A token's creator (its launchpad factory), from the chain's Blockscout.
// Cached per token — the value never changes.
async function creatorOf(chain: ChainKey, base: string | null, token: string): Promise<string | null> {
  return cached(
    `launchpad-creator:${chain}:${token}`,
    CREATOR_TTL,
    async () => {
      // Robinhood's Blockscout doesn't reliably return the creator, which
      // collapsed the whole leaderboard (NOXA/Pons never attributed). robinscan
      // has it. Other chains keep using Blockscout.
      if (chain === 'robinhood') {
        const info = await robinscanAddress(token);
        return info?.contractCreator ? info.contractCreator.toLowerCase() : null;
      }
      const bases = base ? [base] : undefined;
      const d = await blockscoutJson(`/addresses/${token}`, bases ? { bases } : undefined);
      const c = d?.creator_address_hash;
      return typeof c === 'string' ? c.toLowerCase() : null;
    },
    (v) => v != null, // don't cache a transient miss
  );
}

interface PadGroup {
  key: string;               // creator address (lowercase)
  name: string;
  url: string | null;
  known: boolean;
  tokens: TokenRow[];
  volume24: number;
  liquidityUsd: number;
}

async function build(chain: ChainKey, net: string) {
  const tokens = await topTokens(net);
  if (tokens.length === 0) {
    // GeckoTerminal returned nothing — still list the registered pads (quiet).
    const launchpads = launchpadsForChain(chain)
      .filter((p) => p.factory)
      .map((p) => ({
        factory: (p.factory as string).toLowerCase(), name: p.name, url: p.url, known: true,
        likelyLaunchpad: true, tokenCount: 0, volume24: 0, liquidityUsd: 0, topTokens: [] as TokenRow[],
      }));
    return { chain, launchpads, tokensScanned: 0, tokensAttributed: 0, source: 'geckoterminal-empty' };
  }

  const creators = await Promise.all(
    tokens.map((t) => creatorOf(chain, getChain(chain).blockscoutApiBase, t.address).then((c) => [t, c] as const)),
  );

  const groups = new Map<string, PadGroup>();
  let attributed = 0;
  for (const [t, creator] of creators) {
    if (!creator) continue;
    attributed++;
    let g = groups.get(creator);
    if (!g) {
      const pad = launchpadByAddress(creator);
      g = {
        key: creator,
        name: pad?.name ?? `${creator.slice(0, 6)}…${creator.slice(-4)}`,
        url: pad?.url ?? null,
        known: !!pad,
        tokens: [],
        volume24: 0,
        liquidityUsd: 0,
      };
      groups.set(creator, g);
    }
    g.tokens.push(t);
    g.volume24 += t.volume24;
    g.liquidityUsd += t.liquidityUsd;
  }

  // Always surface the chain's registered launchpads, even when they have no
  // attributed tokens in the current top set (so e.g. PUMP.tires still shows on
  // its page during a quiet stretch).
  for (const pad of launchpadsForChain(chain)) {
    if (!pad.factory) continue;
    const key = pad.factory.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { key, name: pad.name, url: pad.url, known: true, tokens: [], volume24: 0, liquidityUsd: 0 });
    }
  }

  const launchpads = [...groups.values()]
    .map((g) => ({
      factory: g.key,
      name: g.name,
      url: g.url,
      known: g.known,
      // A real launchpad factory deploys many tokens; a one-off deployer (a
      // stablecoin issuer, a solo dev) shows up with a single token. Flag the
      // former so the UI can feature launchpads and de-emphasise one-offs.
      likelyLaunchpad: g.known || g.tokens.length >= 2,
      tokenCount: g.tokens.length,
      volume24: g.volume24,
      liquidityUsd: g.liquidityUsd,
      topTokens: [...g.tokens].sort((a, b) => b.volume24 - a.volume24).slice(0, TOP_TOKENS_PER_PAD),
    }))
    // Known/likely launchpads first, then by 24h volume.
    .sort((a, b) => Number(b.likelyLaunchpad) - Number(a.likelyLaunchpad) || b.volume24 - a.volume24);

  return {
    chain,
    launchpads,
    tokensScanned: tokens.length,
    tokensAttributed: attributed,
    source: 'geckoterminal+blockscout',
  };
}

export async function GET(req: NextRequest) {
  const netRaw = (req.nextUrl.searchParams.get('chain') || '').toLowerCase();
  if (!isChainKey(netRaw)) {
    return NextResponse.json({ error: 'unknown chain' }, { status: 400 });
  }
  const chain = netRaw as ChainKey;
  const gtSlug = getChain(chain).geckoterminalSlug;
  if (!gtSlug) {
    return NextResponse.json({ error: 'chain not indexed by GeckoTerminal' }, { status: 400 });
  }

  try {
    const payload = await cached(
      `launchpad-activity:${chain}`,
      180_000, // 3 min
      () => build(chain, gtSlug),
      (v) => Array.isArray(v.launchpads) && v.launchpads.length > 0,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=180, s-maxage=180, stale-while-revalidate=1800' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'failed' },
      { status: 500 },
    );
  }
}
