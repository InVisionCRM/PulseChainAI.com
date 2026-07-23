import { Type } from '@google/genai';

// Tool registry for the Gumshoe analyst agent. Each tool is a thin wrapper over
// an API route we already ship, trimmed to the essentials so the model reasons
// over compact JSON instead of huge payloads. The agent runs on the geicko token
// pages, so every tool defaults to the token/chain the user is currently viewing
// when `token`/`network` args are omitted — letting people ask "who's the
// creator?" without repeating the address.
//
// Nothing here talks to an LLM; this is just the callable surface. The Gemini
// function-calling loop lives in app/api/gumshoe/route.ts.

export interface ToolContext {
  origin: string;      // e.g. https://scan.morbius.io — for same-origin fetches
  token: string | null; // the token the user is viewing (default subject)
  network: string;      // the chain the user is viewing
}

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;
const short = (a?: string | null) => (a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || null);

// Canonical PulseChain addresses for majors, so common symbols resolve reliably
// instead of depending on a fuzzy DexScreener search that can pick a scam clone.
const KNOWN_TOKENS: Record<string, string> = {
  HEX: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39',
  PLSX: '0x95b303987a60c71504d99aa1b13b4da07b0790ab',
  INC: '0x2fa878ab3f87cc1c9737fc071108f17c1a5ab23b',
  WPLS: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',
  PLS: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',
};

async function getJson(url: string, init?: RequestInit): Promise<any | null> {
  try {
    const r = await fetch(url, { ...init, headers: { accept: 'application/json', ...(init?.headers || {}) } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// Turn a token name/symbol/address into a canonical address. Address → passthrough;
// major symbol → curated map; otherwise DexScreener search, preferring an EXACT
// symbol match on the same chain by highest liquidity (not just the first hit).
async function resolveTokenAddress(query: string, origin: string, network: string): Promise<{ address: string; symbol?: string } | null> {
  const q = (query || '').trim();
  if (ADDR_RX.test(q)) return { address: q.toLowerCase() };
  const up = q.toUpperCase();
  if (KNOWN_TOKENS[up]) return { address: KNOWN_TOKENS[up], symbol: up };
  const d = await getJson(`${origin}/api/search?q=${encodeURIComponent(q)}`);
  const cands = (d?.pairs ?? [])
    .map((p: any) => ({
      address: (p.baseAddress || p.baseToken?.address || '').toLowerCase(),
      symbol: String(p.baseSymbol || p.baseToken?.symbol || ''),
      chain: p.chainId ?? null,
      liq: Number(p.liquidityUsd ?? p.liquidity?.usd ?? 0),
    }))
    .filter((c: any) => ADDR_RX.test(c.address));
  const exact = cands.filter((c: any) => c.symbol.toUpperCase() === up && (!network || !c.chain || c.chain === network));
  const pick = (exact.length ? exact : cands).sort((a: any, b: any) => b.liq - a.liq)[0];
  return pick ? { address: pick.address, symbol: pick.symbol } : null;
}

// Resolve a token arg against the current-page default.
function resolveToken(args: any, ctx: ToolContext): string | null {
  const t = (args?.token || ctx.token || '').toLowerCase();
  return ADDR_RX.test(t) ? t : null;
}
function resolveNetwork(args: any, ctx: ToolContext): string {
  return (args?.network || ctx.network || 'pulsechain').toLowerCase();
}

// ── Gemini function declarations ──────────────────────────────────────────────

export const TOOL_DECLARATIONS = [
  {
    name: 'get_token_overview',
    description:
      'Core facts about a token: name, price, market cap, FDV, total/circulating supply, holder count, age/creation date, liquidity, and ownership (creator wallet, renounced?, dev/launcher current holding %). Use this first for general "what is this token" questions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        token: { type: Type.STRING, description: 'Token contract address (0x…). Omit to use the token the user is viewing.' },
        network: { type: Type.STRING, description: "Chain: 'pulsechain', 'robinhood', or 'ethereum'. Omit to use the current chain." },
      },
    },
  },
  {
    name: 'get_forensics',
    description:
      "A token's on-chain forensics: the creator wallet, who funded the creator, how much of supply the creator still holds, whether the creator has sold to a DEX, other contracts the creator has deployed (with names), the number of first buyers and snipers (bought in the launch block), and insider seed wallets. Use for founder/creator behavior and launch-integrity questions. PulseChain gives the richest data.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        token: { type: Type.STRING, description: 'Token contract address. Omit to use the current token.' },
        network: { type: Type.STRING, description: 'Chain. Omit to use the current chain.' },
      },
    },
  },
  {
    name: 'analyze_connections',
    description:
      "Analyzes whether a set of a token's wallets are connected — to EACH OTHER or to a TARGET wallet — via native-coin funding (who funded whom). Two wallets are linked if one funded the other or they share an ordinary (non-exchange) funder. Choose the population with `scope`: 'first_buyers' (the earliest buyers) or 'holders' (the largest holders) — MATCH what the user asked (if they say 'holders', use holders; if 'buyers', use first_buyers). Optionally set `target` to 'creator' (the token's creator/launcher) or a specific 0x wallet to count how many of that set are connected TO it. Use for ANY question like 'are the buyers connected', 'how many holders are linked to the creator', 'did the founder use multiple wallets', 'are holders connected to 0x…'. PulseChain only.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        token: { type: Type.STRING, description: 'Token contract address. Omit to use the current token.' },
        scope: { type: Type.STRING, description: "Which wallets to analyze: 'holders' (largest holders) or 'first_buyers' (earliest buyers, the default). Match the user's wording." },
        target: { type: Type.STRING, description: "Optional connection target: 'creator' for the token's creator/launcher wallet, or a specific 0x address. Omit to just cluster the set among themselves." },
      },
    },
  },
  {
    name: 'get_top_holders',
    description:
      'The token\'s largest holders and how concentrated supply is (e.g. top 10/20/50 share). Use for whale/concentration/distribution questions. Marks holders that are LP pools or contracts.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        token: { type: Type.STRING, description: 'Token contract address. Omit to use the current token.' },
        network: { type: Type.STRING, description: 'Chain. Omit to use the current chain.' },
      },
    },
  },
  {
    name: 'get_liquidity',
    description:
      'Liquidity pools for the token across DEXes: total liquidity (TVL), number of pairs, and the largest pairs with their reserves. Use for liquidity/TVL/"where does it trade" questions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        token: { type: Type.STRING, description: 'Token contract address. Omit to use the current token.' },
        network: { type: Type.STRING, description: 'Chain. Omit to use the current chain.' },
      },
    },
  },
  {
    name: 'get_volume_history',
    description:
      'All-time trading volume for a token from the PulseX subgraph: total volume since launch, total trades, average daily volume, best day, current liquidity, and volume by pair. PulseChain only. Use for volume/activity-over-time questions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        token: { type: Type.STRING, description: 'Token contract address. Omit to use the current token.' },
      },
    },
  },
  {
    name: 'trace_wallet_funding',
    description:
      "Traces a wallet's funding ancestry: who first funded it, who funded THEM, and so on, back to a known origin (an exchange, LP locker, or a dead end). Use to answer 'where did this wallet's money come from' or to check if a wallet leads back to an exchange or a specific source. PulseChain.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        wallet: { type: Type.STRING, description: 'The wallet address (0x…) to trace.' },
      },
      required: ['wallet'],
    },
  },
  {
    name: 'classify_addresses',
    description:
      'Labels a set of addresses: known entity (exchange, router, LP locker, burn address, …) when recognized, otherwise whether each is a normal wallet (EOA), a DEX pool, a token, or a generic contract. Use to make sense of a list of addresses.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        addresses: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Addresses to classify (0x…).' },
        network: { type: Type.STRING, description: 'Chain. Omit to use the current chain.' },
      },
      required: ['addresses'],
    },
  },
  {
    name: 'get_lp_position',
    description:
      "For a specific wallet's LP position in a PulseX pair: fees earned (estimated, isolated from impermanent loss), net profit/loss since providing, amounts deposited/withdrawn, current value, and how long they've provided. Use for 'how much has this LP earned' questions. PulseChain.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        pair: { type: Type.STRING, description: 'The LP pair (pool) contract address (0x…).' },
        wallet: { type: Type.STRING, description: 'The liquidity-provider wallet address (0x…).' },
      },
      required: ['pair', 'wallet'],
    },
  },
  {
    name: 'resolve_token',
    description:
      'Look up a token by name or symbol and return matching contract addresses (with symbol, name, chain, liquidity). Call this FIRST whenever the user names a token by word instead of address (e.g. "how many also hold PLSX") so you can pass a real address to other tools. Already-address inputs pass straight through.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Token name, symbol, or address to look up.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'holder_overlap',
    description:
      "How many of token A's largest holders ALSO hold token B — a cross-token overlap you can't see on a single token page. Use for 'how many holders of this token also hold X' / 'do these two communities overlap' questions. Pass addresses; resolve names with resolve_token first. Checks each of A's top holders for any on-chain balance of B.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        tokenA: { type: Type.STRING, description: "The base token's address (whose holders you're checking). Omit to use the token the user is viewing." },
        tokenB: { type: Type.STRING, description: 'The other token address to check those holders against.' },
        network: { type: Type.STRING, description: 'Chain. Omit to use the current chain.' },
      },
      required: ['tokenB'],
    },
  },
  {
    name: 'check_wallet_link',
    description:
      "Determines whether two wallets are connected, by tracing each wallet's funding ancestry (who first funded it, and so on) and checking if one funded the other or they share an ordinary (non-exchange) funder. Use for 'is wallet A connected to wallet B / are these the same person' questions. A shared exchange is not treated as a connection. PulseChain.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        walletA: { type: Type.STRING, description: 'First wallet address (0x…).' },
        walletB: { type: Type.STRING, description: 'Second wallet address (0x…).' },
      },
      required: ['walletA', 'walletB'],
    },
  },
] as const;

// ── Executors ─────────────────────────────────────────────────────────────────

export async function executeTool(name: string, args: any, ctx: ToolContext): Promise<any> {
  const o = ctx.origin;
  switch (name) {
    case 'get_token_overview': {
      const token = resolveToken(args, ctx);
      const network = resolveNetwork(args, ctx);
      if (!token) return { error: 'No token address available.' };
      const [metrics, pools] = await Promise.all([
        getJson(`${o}/api/token-metrics/${token}?network=${network}`),
        getJson(`${o}/api/geicko/pools?token=${token}&network=${network}`),
      ]);
      const pairs: any[] = pools?.pairs ?? [];
      const primary = pairs[0] ?? null;
      const own = metrics?.ownershipData ?? {};
      const supply = metrics?.totalSupply
        ? Number(metrics.totalSupply.supply) / 10 ** Number(metrics.totalSupply.decimals)
        : null;
      const priceUsd = primary ? Number(primary.priceUsd) || null : null;
      return {
        token,
        network,
        priceUsd,
        marketCapUsd: supply && priceUsd ? supply * priceUsd : (primary?.marketCap ?? primary?.fdv ?? null),
        totalSupply: supply,
        holders: metrics?.holdersCount ?? null,
        creationDate: metrics?.creationDate ?? null,
        totalLiquidityUsd: pairs.reduce((s, p) => s + (Number(p.liquidity?.usd) || 0), 0) || null,
        pairCount: pairs.length || null,
        burnedPercent: metrics?.burnedTokens?.percent ?? null,
        supplyHeld: metrics?.supplyHeld ? { top10: metrics.supplyHeld.top10, top20: metrics.supplyHeld.top20, top50: metrics.supplyHeld.top50 } : null,
        creator: short(own.creatorAddress),
        creatorFull: own.creatorAddress ?? null,
        isRenounced: own.isRenounced ?? null,
        launchpad: own.isPumpTiresToken ? 'pump.tires' : null,
        devWallet: short(own.devWallet),
        devHoldingPercent: own.devHoldingPercent ?? null,
      };
    }

    case 'get_forensics': {
      const token = resolveToken(args, ctx);
      const network = resolveNetwork(args, ctx);
      if (!token) return { error: 'No token address available.' };
      const f = await getJson(`${o}/api/geicko/forensics?token=${token}&network=${network}`);
      if (!f) return { error: 'Forensics unavailable for this token.' };
      const c = f.creator ?? null;
      const buyers: any[] = f.firstBuyers?.buyers ?? [];
      return {
        token,
        creator: short(c?.address),
        creatorFull: c?.address ?? null,
        fundedBy: c?.fundedBy ? { from: short(c.fundedBy.from), pls: c.fundedBy.valuePls } : null,
        creatorHoldsPctSupply: c?.pctSupply ?? null,
        creatorDexSells: c?.sells?.count ?? null,
        otherContractsDeployed: c?.deploymentCount ?? null,
        otherDeployments: (c?.deployments ?? []).slice(0, 12).map((d: any) => ({ address: short(d.address), name: d.name ?? null, date: d.ts ?? null })),
        launchedViaFactory: c?.via ? short(c.via.address) : null,
        firstBuyerCount: buyers.length,
        sniperCount: buyers.filter((b) => b.sniper).length,
        firstBuyersStillHolding: buyers.filter((b) => b.stillHolds === true).length,
        insiderSeedWallets: (f.creator?.insiders ?? []).slice(0, 8).map((i: any) => ({ address: short(i.address), isFirstBuyer: !!i.isFirstBuyer })),
      };
    }

    case 'analyze_connections': {
      const token = resolveToken(args, ctx);
      if (!token) return { error: 'No token address available.' };
      const scope = String(args?.scope || 'first_buyers').toLowerCase() === 'holders' ? 'holders' : 'first_buyers';
      const target = String(args?.target || '').toLowerCase();
      const qs = new URLSearchParams({ token, scope, network: 'pulsechain' });
      if (target) qs.set('target', target);
      const d = await getJson(`${o}/api/geicko/connections?${qs.toString()}`);
      if (!d || d.supported === false) return { error: 'Connection analysis is PulseChain-only.' };
      if (!d.hasData) return { note: `No ${scope.replace('_', ' ')} found to analyze for this token.` };
      return {
        scope: d.scope,
        walletsAnalyzed: d.walletsAnalyzed,
        target: d.target,
        targetKind: d.targetKind,
        connectedToTarget: d.connectedToTarget, // { count, wallets:[{address, via}] } or null
        clusterCount: d.clusterCount,
        walletsInClusters: d.walletsInClusters,
        clusters: d.clusters,
        note: d.note,
        interpretationHint:
          'connectedToTarget.count is how many of the analyzed wallets are funding-linked to the target. Clusters group wallets that share a funder (likely one operator); a cluster with isTokenCreator=true means the creator funded those wallets.',
      };
    }

    case 'get_top_holders': {
      const token = resolveToken(args, ctx);
      const network = resolveNetwork(args, ctx);
      if (!token) return { error: 'No token address available.' };
      const h = await getJson(`${o}/api/geicko/holders?token=${token}&network=${network}`);
      const list: any[] = h?.holders ?? h?.items ?? [];
      // `totalSupply` may be a raw integer string or an object {supply}; holder
      // `value` is in the same raw units, so the ratio is decimals-agnostic.
      const totalSupply = Number(h?.totalSupply?.supply ?? h?.totalSupply ?? h?.total_supply ?? 0);
      return {
        token,
        holderCount: h?.holdersCount ?? h?.count ?? list.length ?? null,
        topHolders: list.slice(0, 15).map((x: any) => {
          const val = Number(x.value ?? x.balance ?? 0);
          return {
            address: short(x.address),
            isContract: x.isContract ?? null,
            pctSupply: totalSupply > 0 && Number.isFinite(val) ? Number(((val / totalSupply) * 100).toFixed(3)) : null,
          };
        }),
      };
    }

    case 'get_liquidity': {
      const token = resolveToken(args, ctx);
      const network = resolveNetwork(args, ctx);
      if (!token) return { error: 'No token address available.' };
      const p = await getJson(`${o}/api/geicko/pools?token=${token}&network=${network}`);
      const pairs: any[] = p?.pairs ?? [];
      return {
        token,
        totalLiquidityUsd: pairs.reduce((s, x) => s + (Number(x.liquidity?.usd) || 0), 0) || null,
        pairCount: pairs.length,
        topPairs: pairs
          .slice()
          .sort((a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))
          .slice(0, 6)
          .map((x: any) => ({
            pair: `${x.baseToken?.symbol ?? '?'}/${x.quoteToken?.symbol ?? '?'}`,
            dex: x.dexId ?? null,
            liquidityUsd: Math.round(Number(x.liquidity?.usd) || 0),
            address: short(x.pairAddress),
          })),
      };
    }

    case 'get_volume_history': {
      const token = resolveToken(args, ctx);
      if (!token) return { error: 'No token address available.' };
      const v = await getJson(`${o}/api/geicko/volume?token=${token}&network=pulsechain`);
      if (!v || v.supported === false) return { error: 'Volume history is PulseChain-only and unavailable here.' };
      const at = v.allTime ?? {};
      const days = at.days || (v.daily?.length ?? 0);
      return {
        totalVolumeUsd: at.volumeUsd ?? null,
        totalTrades: at.txns ?? null,
        days,
        avgDailyVolumeUsd: at.volumeUsd && days ? at.volumeUsd / days : null,
        bestDay: at.bestDay ? { date: at.bestDay.date, volumeUsd: at.bestDay.volumeUsd } : null,
        currentLiquidityUsd: at.currentLiquidity ?? null,
        firstDate: at.firstDate ?? null,
        volumeByPair: (v.byPair ?? []).slice(0, 6),
      };
    }

    case 'trace_wallet_funding': {
      const wallet = (args?.wallet || '').toLowerCase();
      if (!ADDR_RX.test(wallet)) return { error: 'A valid wallet address is required.' };
      const d = await getJson(`${o}/api/portfolio/funding-trace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: wallet, chain: 'pulsechain' }),
      });
      const steps: any[] = d?.trace?.steps ?? [];
      return {
        wallet: short(wallet),
        reachedOrigin: d?.trace?.reachedOrigin ?? null,
        hops: steps.length ? steps.length - 1 : 0,
        chain: steps.map((s: any, i: number) => ({
          step: i,
          address: short(s.address),
          label: s.label ?? null,
          fundedBy: s.fundedBy ? { from: short(s.fundedBy.from ?? s.fundedBy.address), amount: s.fundedBy.amount ?? null } : null,
        })),
      };
    }

    case 'classify_addresses': {
      const addresses: string[] = Array.isArray(args?.addresses) ? args.addresses.filter((a: string) => ADDR_RX.test(a)) : [];
      const network = resolveNetwork(args, ctx);
      if (!addresses.length) return { error: 'Provide at least one valid address.' };
      const d = await getJson(`${o}/api/portfolio/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: addresses.slice(0, 25).map((a) => ({ address: a, chain: network })) }),
      });
      const map = d?.classifications ?? {};
      return {
        results: addresses.slice(0, 25).map((a) => {
          const c = map[`${network}:${a.toLowerCase()}`] ?? map[a.toLowerCase()] ?? {};
          return { address: short(a), label: c.label ?? null, type: c.type ?? c.category ?? null };
        }),
      };
    }

    case 'get_lp_position': {
      const pair = (args?.pair || '').toLowerCase();
      const wallet = (args?.wallet || '').toLowerCase();
      if (!ADDR_RX.test(pair) || !ADDR_RX.test(wallet)) return { error: 'Valid pair and wallet addresses are required.' };
      const d = await getJson(`${o}/api/portfolio/lp-position?chain=pulsechain&pair=${pair}&wallet=${wallet}`);
      if (!d || d.supported === false) return { error: 'LP position analysis is PulseChain-only.' };
      if (!d.hasHistory) return { note: 'No liquidity-providing history found for this wallet+pair (may have been received by transfer).' };
      return {
        pair: d.pair ? `${d.pair.token0}/${d.pair.token1}` : short(pair),
        feesEarnedUsd: d.feesUsd ?? null,
        netPnlUsd: d.netPnlUsd ?? null,
        depositedUsd: d.depositedUsd ?? null,
        withdrawnUsd: d.withdrawnUsd ?? null,
        currentValueUsd: d.currentValueUsd ?? null,
        daysProviding: d.daysProviding ? Math.round(d.daysProviding) : null,
        feeAprPercent: d.feeApr ?? null,
        partialHistory: d.partialHistory ?? false,
        note: 'Fees are estimated (isolated from impermanent loss); net P&L includes impermanent loss.',
      };
    }

    case 'resolve_token': {
      const query = String(args?.query || '').trim();
      const network = resolveNetwork(args, ctx);
      if (query.length < 2) return { error: 'Provide a token name, symbol, or address.' };
      const best = await resolveTokenAddress(query, o, network);
      if (!best) return { query, matches: [], note: 'No token found by that name/symbol. Ask the user for the contract address.' };
      return { query, best, note: 'Use best.address in the next tool call.' };
    }

    case 'holder_overlap': {
      const a = (args?.tokenA || ctx.token || '').toLowerCase();
      const network = resolveNetwork(args, ctx);
      // Resolve token B even if the model passed a symbol/name (robust to bad routing).
      const rawB = String(args?.tokenB || '');
      const resolvedB = ADDR_RX.test(rawB) ? { address: rawB.toLowerCase() } : await resolveTokenAddress(rawB, o, network);
      const b = resolvedB?.address ?? '';
      if (!ADDR_RX.test(a) || !ADDR_RX.test(b)) return { error: `Could not resolve token${!ADDR_RX.test(b) ? ' B (\"' + rawB + '\")' : ' A'}. Ask the user for its contract address.` };
      if (a === b) return { error: 'The two tokens must be different.' };
      const d = await getJson(`${o}/api/geicko/holder-overlap?tokenA=${a}&tokenB=${b}&network=${network}`);
      if (!d) return { error: 'Overlap analysis unavailable.' };
      if (!d.hasData) return { note: "Couldn't read holders for the base token." };
      return {
        holdersChecked: d.holdersChecked,
        alsoHoldOtherToken: d.overlapCount,
        overlapPercent: d.overlapPercent,
        overlappingWallets: (d.overlappingWallets ?? []).slice(0, 12).map(short),
        note: d.note,
      };
    }

    case 'check_wallet_link': {
      const a = (args?.walletA || '').toLowerCase();
      const b = (args?.walletB || '').toLowerCase();
      if (!ADDR_RX.test(a) || !ADDR_RX.test(b)) return { error: 'Two valid wallet addresses are required.' };
      if (a === b) return { error: 'The two wallets are the same address.' };
      const d = await getJson(`${o}/api/portfolio/wallet-link?a=${a}&b=${b}&network=pulsechain`);
      if (!d || d.supported === false) return { error: 'Wallet-link analysis is PulseChain-only.' };
      return {
        connected: d.connected,
        relationship: d.relationship,
        sharedFunder: d.link,
        sharedFunderLabel: d.linkLabel,
        walletA_fundingChain: d.walletA_fundingChain,
        walletB_fundingChain: d.walletB_fundingChain,
        note: d.note,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
