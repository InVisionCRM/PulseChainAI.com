'use client';

// The share button on a token page.
//
// Most of what the cards need is already on the page, so it's passed in. The
// rest — all-time volume, the launch window, holder tiers, 24h position moves,
// dollar-denominated buy/sell — lives behind endpoints the page only calls when
// their tab is open, so this fetches each one the first time a card that needs
// it is picked, and caches it for as long as the modal is open. A card whose
// figures haven't arrived says so; it never draws a zero in their place.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconShare2 } from '@tabler/icons-react';
import ShareCardModal, { SHARE_GRAD } from '@/components/share/ShareCardModal';
import CardBuilder from '@/components/share/CardBuilder';
import {
  BRAND_URL, CARD_H, CARD_W, CUSTOM_CARD_ID, DEFAULT_SPEC, TOKEN_CARDS, cardsForChain,
  drawTokenCard, sourceSupported,
  type ChainKey, type CustomSpec, type DeltasSource, type ForensicsSource, type LeaguesSource,
  type PressureSource, type SourceKey, type TokenShareData, type VolumeSource,
} from '@/lib/geicko/shareCard';
import { sourcesFor } from '@/lib/geicko/metrics';
import type { DexScreenerData, LiquidityData, OwnershipData, SmartContractHolderData, SupplyHeldData } from './types';
import { dexName } from '@/components/Screener/format';

const CHAIN_LABEL: Record<ChainKey, string> = {
  pulsechain: 'PulseChain',
  ethereum: 'Ethereum',
  robinhood: 'Robinhood Chain',
};

/** The built card's spec, kept so one layout serves every token you open. */
const SPEC_KEY = 'morbius-cardbuilder-v1';

function loadSpec(): CustomSpec {
  if (typeof window === 'undefined') return DEFAULT_SPEC;
  try {
    const raw = window.localStorage.getItem(SPEC_KEY);
    if (!raw) return DEFAULT_SPEC;
    // Merged over the default so a spec saved before a field existed still opens.
    return { ...DEFAULT_SPEC, ...(JSON.parse(raw) as Partial<CustomSpec>) };
  } catch {
    return DEFAULT_SPEC;
  }
}

/** Addresses that hold supply but aren't holders — never counted as wallets. */
const BURNS = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
]);

export interface GeickoShareCardsProps {
  token: string;
  chain: ChainKey;
  symbol: string;
  name?: string | null;
  logoUrl?: string | null;
  dexScreenerData: DexScreenerData | null;
  totalLiquidity: LiquidityData;
  totalSupply: { supply: string; decimals: number } | null;
  burnedTokens: { amount: number; percent: number } | null;
  holdersCount: number | null;
  supplyHeld: SupplyHeldData;
  smartContractHolderShare: SmartContractHolderData;
  ownershipData: OwnershipData;
  creationDate: string | null;
  /** Full-width block trigger, for sitting under the rating row. */
  full?: boolean;
}

interface Sources {
  volume?: VolumeSource | null;
  forensics?: ForensicsSource | null;
  leagues?: LeaguesSource | null;
  deltas?: DeltasSource | null;
  pressure?: PressureSource | null;
}

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

/** Sum a per-pair figure across every pool the token trades in. */
function sumPairs(pairs: any[] | undefined, pick: (p: any) => unknown): number | null {
  if (!pairs?.length) return null;
  let total = 0;
  let seen = false;
  for (const p of pairs) {
    const v = pick(p);
    if (v == null) continue;
    seen = true;
    total += num(v);
  }
  return seen ? total : null;
}

/**
 * Turn the raw signed balance changes into the card's four figures. Pools, the
 * token contract and burn addresses are dropped — they move on every trade and
 * would swamp the wallet counts.
 */
function summariseDeltas(
  raw: Record<string, string> | undefined,
  decimals: number,
  exclude: Set<string>,
): DeltasSource | null {
  if (!raw) return null;
  let added = 0;
  let trimmed = 0;
  let addedTokens = 0;
  let trimmedTokens = 0;
  let biggestAdd: { address: string; tokens: number } | null = null;
  let biggestExit: { address: string; tokens: number } | null = null;
  const scale = Math.pow(10, decimals);

  for (const [addr, change] of Object.entries(raw)) {
    const a = addr.toLowerCase();
    if (exclude.has(a) || BURNS.has(a)) continue;
    let delta: number;
    try {
      delta = Number(BigInt(change)) / scale;
    } catch {
      continue;
    }
    if (!Number.isFinite(delta) || delta === 0) continue;
    if (delta > 0) {
      added++;
      addedTokens += delta;
      if (!biggestAdd || delta > biggestAdd.tokens) biggestAdd = { address: a, tokens: delta };
    } else {
      trimmed++;
      trimmedTokens += -delta;
      if (!biggestExit || -delta > biggestExit.tokens) biggestExit = { address: a, tokens: -delta };
    }
  }
  return { added, trimmed, addedTokens, trimmedTokens, biggestAdd, biggestExit };
}

export default function GeickoShareCards(props: GeickoShareCardsProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share a card for this token"
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white transition-transform hover:-translate-y-px ${
          props.full ? 'w-full px-4 py-3 text-sm' : 'px-3.5 py-2 text-xs'
        }`}
        style={{ background: SHARE_GRAD }}
      >
        <IconShare2 className={props.full ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        Share a card
      </button>
      {open && <Cards {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function Cards({ onClose, ...p }: GeickoShareCardsProps & { onClose: () => void }) {
  const [sources, setSources] = useState<Sources>({});
  const [pending, setPending] = useState<SourceKey | null>(null);
  const asked = useRef<Set<SourceKey>>(new Set());
  const [spec, setSpec] = useState<CustomSpec>(loadSpec);
  const headerRef = useRef<HTMLImageElement | null>(null);
  const [headerReady, setHeaderReady] = useState(0);

  const decimals = p.totalSupply?.decimals ?? 18;
  const pairs = p.dexScreenerData?.pairs ?? [];

  useEffect(() => {
    try {
      window.localStorage.setItem(SPEC_KEY, JSON.stringify(spec));
    } catch {
      // A full or blocked store just means the layout won't persist.
    }
  }, [spec]);

  // The DexScreener banner, if the token has one. Same proxy as the logo — art
  // straight from the CDN would taint the canvas and break the export.
  const bannerUrl = useMemo(
    () => (pairs.find((x: any) => x?.info?.header)?.info?.header as string | undefined) ?? null,
    [pairs],
  );
  useEffect(() => {
    if (!bannerUrl) {
      headerRef.current = null;
      return;
    }
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!alive) return;
      headerRef.current = img;
      setHeaderReady((n) => n + 1);
    };
    img.onerror = () => {
      if (!alive) return;
      headerRef.current = null;
      setHeaderReady((n) => n + 1);
    };
    img.src = `/api/token-logo?url=${encodeURIComponent(bannerUrl)}`;
    return () => {
      alive = false;
    };
  }, [bannerUrl]);

  /** Pool addresses, so holder movement can exclude them. */
  const poolAddresses = useMemo(() => {
    const s = new Set<string>([p.token.toLowerCase()]);
    for (const pair of pairs) if (pair?.pairAddress) s.add(String(pair.pairAddress).toLowerCase());
    return s;
  }, [pairs, p.token]);

  const load = useCallback(
    async (key: SourceKey) => {
      if (asked.current.has(key) || !sourceSupported(key, p.chain)) return;
      asked.current.add(key);
      setPending(key);
      const qs = `token=${p.token}&network=${p.chain}`;
      try {
        if (key === 'volume') {
          // The route caps the per-pool list; ask for its maximum so the
          // "N pools carry 90%" figure is computed over a real spread, and keep
          // `pairTotals` for the denominators.
          const j = await fetch(`/api/geicko/volume?${qs}&pairs=50`).then((r) => (r.ok ? r.json() : null));
          setSources((s) => ({
            ...s,
            volume: j?.daily
              ? {
                  daily: j.daily,
                  byPair: j.byPair ?? [],
                  pairTotals: j.pairTotals ?? null,
                  allTime: j.allTime ?? null,
                }
              : null,
          }));
        } else if (key === 'forensics') {
          const j = await fetch(`/api/geicko/forensics?${qs}`).then((r) => (r.ok ? r.json() : null));
          const fb = j?.firstBuyers;
          setSources((s) => ({
            ...s,
            forensics: fb
              ? {
                  pairedWith: fb.pairedWith ?? null,
                  pairCreatedAt: fb.pairCreatedAt ?? null,
                  initialLiquidityUsd: fb.initialLiquidityUsd ?? null,
                  windowHours: fb.windowHours ?? 0,
                  buyers: fb.buyers ?? [],
                }
              : null,
          }));
        } else if (key === 'leagues') {
          const j = await fetch(`/api/geicko/token-leagues?token=${p.token}`).then((r) =>
            r.ok ? r.json() : null,
          );
          setSources((s) => ({
            ...s,
            leagues: j?.bands
              ? {
                  bands: j.bands,
                  totalHolders: j.totalHolders ?? null,
                  complete: !!j.complete,
                  scanned: j.scanned ?? 0,
                }
              : null,
          }));
        } else if (key === 'deltas') {
          const j = await fetch(`/api/geicko/holder-deltas?${qs}`).then((r) => (r.ok ? r.json() : null));
          // An incomplete walk understates movement, so it is treated as no data.
          setSources((s) => ({
            ...s,
            deltas: j?.complete ? summariseDeltas(j.deltas, decimals, poolAddresses) : null,
          }));
        } else if (key === 'pressure') {
          const j = await fetch(`/api/geicko/pressure?${qs}`).then((r) => (r.ok ? r.json() : null));
          setSources((s) => ({
            ...s,
            pressure: j?.windows
              ? { h24: j.windows.h24 ?? null, hourly: j.hourly ?? [] }
              : null,
          }));
        }
      } catch {
        // A source that doesn't answer stays null; its card says so.
        setSources((s) => ({ ...s, [key]: null }));
      } finally {
        setPending((cur) => (cur === key ? null : cur));
      }
    },
    [p.chain, p.token, decimals, poolAddresses],
  );

  const [cardId, setCardId] = useState<string | null>(null);
  const onSelect = useCallback(
    (id: string) => {
      setCardId(id);
      if (id === CUSTOM_CARD_ID) return; // its sources follow the chosen metrics
      const def = TOKEN_CARDS.find((k) => k.id === id);
      const want = def?.needs ?? def?.wants;
      if (want) void load(want);
    },
    [load],
  );

  // Whatever the built card's figures need, fetched as they're picked.
  useEffect(() => {
    if (cardId !== CUSTOM_CARD_ID) return;
    for (const src of sourcesFor(spec.metrics)) void load(src);
  }, [cardId, spec.metrics, load]);

  const data: TokenShareData = useMemo(() => {
    const primary = pairs[0];
    // "Deepest pool" has to be the deepest one, not whichever the API listed
    // first — those are usually but not always the same pair.
    const deepest = pairs.reduce(
      (best: any, x: any) => (num(x?.liquidity?.usd) > num(best?.liquidity?.usd) ? x : best),
      pairs[0],
    );
    const supply = p.totalSupply
      ? Number(p.totalSupply.supply) / Math.pow(10, p.totalSupply.decimals)
      : null;
    const created = primary?.pairCreatedAt ? Number(primary.pairCreatedAt) : null;
    const createdMs = p.creationDate ? Date.parse(p.creationDate) : NaN;
    const ageFrom = Number.isFinite(createdMs) ? createdMs : created;
    return {
      address: p.token,
      chain: p.chain,
      chainLabel: CHAIN_LABEL[p.chain],
      symbol: p.symbol || '—',
      name: p.name ?? null,
      asOf: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),

      priceUsd: primary?.priceUsd ? num(primary.priceUsd) : null,
      change: {
        m5: primary?.priceChange?.m5 ?? null,
        h1: primary?.priceChange?.h1 ?? null,
        h6: primary?.priceChange?.h6 ?? null,
        h24: primary?.priceChange?.h24 ?? null,
      },
      // Volume is per pool, so the token's figure is the sum across all of them
      // — the same aggregation the page's own 24h volume uses.
      volume: {
        m5: sumPairs(pairs, (x) => x?.volume?.m5),
        h1: sumPairs(pairs, (x) => x?.volume?.h1),
        h6: sumPairs(pairs, (x) => x?.volume?.h6),
        h24: sumPairs(pairs, (x) => x?.volume?.h24),
      },
      txns: {
        h24: primary?.txns?.h24
          ? {
              buys: pairs.reduce((s: number, x: any) => s + num(x?.txns?.h24?.buys), 0),
              sells: pairs.reduce((s: number, x: any) => s + num(x?.txns?.h24?.sells), 0),
            }
          : null,
      },
      liquidityUsd: p.totalLiquidity.usd > 0 ? p.totalLiquidity.usd : (primary?.liquidity?.usd ?? null),
      pairCount: p.totalLiquidity.pairCount || pairs.length || null,
      marketCap: primary?.marketCap != null ? num(primary.marketCap) : null,
      fdv: primary?.fdv != null ? num(primary.fdv) : null,
      topPair: deepest
        ? {
            label: `${deepest.baseToken?.symbol ?? p.symbol}/${deepest.quoteToken?.symbol ?? '?'}`,
            dexName: dexName(deepest.dexId ?? null),
            liquidityUsd: deepest.liquidity?.usd ?? null,
          }
        : null,

      totalSupply: supply,
      burnedTokens: p.burnedTokens?.amount ?? null,
      burnedPct: p.burnedTokens?.percent ?? null,
      holders: p.holdersCount,
      supplyHeld: p.supplyHeld.isLoading
        ? null
        : { top10: p.supplyHeld.top10, top20: p.supplyHeld.top20, top50: p.supplyHeld.top50 },
      contractHeldPct: p.smartContractHolderShare.isLoading ? null : p.smartContractHolderShare.percent,
      creationDate: p.creationDate,
      ageDays: ageFrom
        ? Math.max(0, Math.floor((Date.now() - (ageFrom > 1e12 ? ageFrom : ageFrom * 1000)) / 86_400_000))
        : null,
      renounced: p.ownershipData.isLoading ? null : p.ownershipData.isRenounced,
      devHoldingPct: p.ownershipData.devHoldingPercent ?? null,

      volumeAll: sources.volume ?? null,
      forensics: sources.forensics ?? null,
      leagues: sources.leagues ?? null,
      deltas: sources.deltas ?? null,
      pressure: sources.pressure ?? null,
    };
  }, [p, pairs, sources]);

  const cards = useMemo(
    () => cardsForChain(p.chain).map((k) => ({ id: k.id, name: k.name, blurb: k.blurb, group: k.group })),
    [p.chain],
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, id: string, logo: HTMLImageElement | null) => {
      drawTokenCard(ctx, id, data, logo, { custom: spec, header: headerRef.current });
    },
    [data, spec],
  );

  // Token art is cross-origin and would taint the export canvas, so it comes
  // through our own proxy — the same route the bubble share uses.
  const logoSrc = p.logoUrl ? `/api/token-logo?url=${encodeURIComponent(p.logoUrl)}` : '';

  const def = cardId ? TOKEN_CARDS.find((k) => k.id === cardId) : null;
  const busy = !!pending && (
    cardId === CUSTOM_CARD_ID
      ? sourcesFor(spec.metrics).includes(pending)
      : !!def && (def.needs === pending || def.wants === pending)
  );

  return (
    <ShareCardModal
      title={`Share ${p.symbol}`}
      cards={cards}
      groups={[
        { key: 'short', label: 'Short term' },
        { key: 'alltime', label: 'All time' },
        {
          key: 'build',
          label: 'Build',
          cardId: CUSTOM_CARD_ID,
          panel: <CardBuilder chain={p.chain} spec={spec} onChange={setSpec} />,
        },
      ]}
      draw={draw}
      drawKey={`${headerReady}:${JSON.stringify(spec)}:${data.asOf}:${data.priceUsd}:${!!data.volumeAll}:${!!data.leagues}:${!!data.deltas}:${!!data.pressure}:${!!data.forensics}`}
      logoSrc={logoSrc}
      filePrefix={`${(p.symbol || 'token').toLowerCase()}`}
      shareTitle={`${p.symbol} on Morbius`}
      shareText={`${p.symbol} — ${BRAND_URL}`}
      footNote={`${CARD_W}×${CARD_H} PNG · figures as of ${data.asOf}`}
      onSelect={onSelect}
      busy={busy}
      width={CARD_W}
      height={CARD_H}
      onClose={onClose}
    />
  );
}
