'use client';

import { useEffect, useState } from 'react';
import {
  IconSearch,
  IconStar,
  IconX,
  IconRefresh,
} from '@tabler/icons-react';
import { useWatchlistStore } from '@/lib/stores/watchlistStore';
import type { WatchedToken, WatchPriceEntry } from '@/lib/stores/watchlistStore';
import { useInsightsStore } from '@/lib/stores/insightsStore';
import type { ChainId, PortfolioToken } from '@/services';

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;

// Both chains have a Blockscout search endpoint that returns mixed
// results (tokens, addresses, txs). Querying both in parallel and
// filtering to type === 'token' gives a cross-chain symbol/name search
// for free. Address pastes hit the token-info endpoint instead so we
// can pick up tokens that haven't been indexed by the search yet.
const BLOCKSCOUT_BASE: Record<ChainId, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
};

// Real chain marks overlaid as a small badge on the token icon (DeBank /
// Zapper / Zerion convention) instead of a text pill. Mirrors WalletCard.
const CHAIN_LOGO: Record<ChainId, string> = {
  ethereum: '/ethlogo.svg',
  pulsechain: '/LogoVector.svg',
};

const CHAIN_NAME: Record<ChainId, string> = {
  ethereum: 'Ethereum',
  pulsechain: 'PulseChain',
};

interface SearchHit {
  address: string;
  chain: ChainId;
  symbol: string;
  name: string;
  logoURI?: string;
}

async function searchCrossChain(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  // Address paste → look the token up on every chain.
  if (ADDRESS_RX.test(q)) {
    const results = await Promise.all(
      (['pulsechain', 'ethereum'] as ChainId[]).map(async (chain) => {
        try {
          const r = await fetch(`${BLOCKSCOUT_BASE[chain]}/tokens/${q}`);
          if (!r.ok) return null;
          const d = await r.json();
          if (!d?.symbol || !d?.name) return null;
          return {
            address: q.toLowerCase(),
            chain,
            symbol: d.symbol,
            name: d.name,
            logoURI: d.icon_url || undefined,
          } satisfies SearchHit;
        } catch {
          return null;
        }
      }),
    );
    return results.filter((x): x is SearchHit => x !== null);
  }

  // Name / symbol search on each chain.
  const lists = await Promise.all(
    (['pulsechain', 'ethereum'] as ChainId[]).map(async (chain) => {
      try {
        const r = await fetch(
          `${BLOCKSCOUT_BASE[chain]}/search?q=${encodeURIComponent(q)}`,
        );
        if (!r.ok) return [] as SearchHit[];
        const d = await r.json();
        const items: any[] = d?.items || [];
        return items
          .filter((i) => i.type === 'token')
          .slice(0, 5)
          .map((i): SearchHit | null => {
            const address = (i.address_hash || i.address || '').toLowerCase();
            if (!ADDRESS_RX.test(address)) return null;
            return {
              address,
              chain,
              symbol: i.symbol || '???',
              name: i.name || 'Unknown',
              logoURI: i.icon_url || undefined,
            };
          })
          .filter((x): x is SearchHit => x !== null);
      } catch {
        return [] as SearchHit[];
      }
    }),
  );

  // Flatten and dedupe by (chain, address)
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const hit of lists.flat()) {
    const k = `${hit.chain}:${hit.address}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(hit);
  }
  return out;
}

const fmtUsd = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return '$0.00';
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 0.01 ? 6 : 2,
  })}`;
};

const fmtChange = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return null;
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

// The insights modal takes a PortfolioToken, but a watched token has no
// balance — it's price-only. Synthesize a zero-balance token so a watchlist
// row can open the same modal a portfolio holding does; the modal only reads
// address/chain (for its fetch) plus symbol/name/logo/price for the header.
function toInsightsToken(t: WatchedToken, p?: WatchPriceEntry): PortfolioToken {
  return {
    address: t.address,
    chain: t.chain,
    name: p?.name || t.name,
    symbol: p?.symbol || t.symbol,
    decimals: 18,
    balance: '0',
    balanceFormatted: 0,
    logoURI: p?.logoURI || t.logoURI,
    priceUsd: p?.priceUsd ?? undefined,
    priceChange24h: p?.priceChange24h ?? undefined,
    valueUsd: 0,
    isNative: false,
    isLp: false,
  };
}

export function WatchlistPanel() {
  const tokens = useWatchlistStore((s) => s.tokens);
  const prices = useWatchlistStore((s) => s.prices);
  const add = useWatchlistStore((s) => s.add);
  const remove = useWatchlistStore((s) => s.remove);
  const refresh = useWatchlistStore((s) => s.refresh);
  const isLoading = useWatchlistStore((s) => s.isLoading);
  const openInsights = useInsightsStore((s) => s.openInsights);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  // Debounced cross-chain search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = setTimeout(async () => {
      const results = await searchCrossChain(q);
      setHits(results);
      setSearching(false);
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  // Refresh prices on mount + every 90s while panel is mounted
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 90_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleAdd = (hit: SearchHit) => {
    if (add(hit)) {
      setQuery('');
      setHits([]);
      setOpen(false);
    }
  };

  return (
    <aside className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-4 lg:sticky lg:top-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-orange-400/80 text-xs font-semibold uppercase tracking-wider">
          <IconStar className="h-4 w-4" />
          Watchlist
          {tokens.length > 0 && (
            <span className="text-white/40 normal-case font-normal">
              · {tokens.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading || tokens.length === 0}
          className="text-white/50 hover:text-white disabled:opacity-30"
          title="Refresh prices"
        >
          <IconRefresh className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative mb-3">
        <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Paste 0x… or search by name"
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-lg bg-black/40 border border-white/15 pl-8 pr-2 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/60"
        />
        {open && query.trim().length >= 2 && (
          <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-white/15 bg-[#0d2a4d] shadow-2xl max-h-72 overflow-y-auto">
            {searching && hits.length === 0 && (
              <div className="px-3 py-2 text-xs text-white/40">Searching…</div>
            )}
            {!searching && hits.length === 0 && (
              <div className="px-3 py-2 text-xs text-white/40">No tokens found.</div>
            )}
            {hits.map((h) => (
              <button
                key={`${h.chain}:${h.address}`}
                type="button"
                onMouseDown={(e) => {
                  // mousedown beats the input's blur so we don't lose the click
                  e.preventDefault();
                  handleAdd(h);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left"
              >
                <Icon32 logoURI={h.logoURI} symbol={h.symbol} chain={h.chain} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">
                    {h.symbol}
                  </div>
                  <div className="text-xs text-white/50 truncate">{h.name}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {tokens.length === 0 ? (
        <div className="text-sm text-white/40 py-6 text-center">
          Track tokens you don't hold yet. Paste an address or search above.
        </div>
      ) : (
        <ul className="space-y-1">
          {tokens.map((t) => {
            const p = prices[t.address];
            const priceUsd = p?.priceUsd;
            const change = p?.priceChange24h;
            const logo = p?.logoURI || t.logoURI;
            const sym = p?.symbol || t.symbol;
            const name = p?.name || t.name;
            const changeTxt = fmtChange(change);
            return (
              <li
                key={`${t.chain}:${t.address}`}
                className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5"
              >
                <button
                  type="button"
                  onClick={() => openInsights(toInsightsToken(t, p))}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  title={`Open insights — ${sym}`}
                >
                  <Icon32 logoURI={logo} symbol={sym} chain={t.chain} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate">
                      {sym}
                    </div>
                    <div className="text-[10px] text-white/40 truncate">{name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-white tabular-nums">
                      {priceUsd != null ? fmtUsd(priceUsd) : <span className="text-white/30">—</span>}
                    </div>
                    <div
                      className="text-[10px] tabular-nums"
                      style={{
                        color:
                          change == null
                            ? 'rgba(255,255,255,0.3)'
                            : change >= 0
                            ? '#4ade80'
                            : '#f87171',
                      }}
                    >
                      {changeTxt ?? '—'}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => remove(t.address, t.chain)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-red-400 shrink-0"
                  title="Remove from watchlist"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function Icon32({
  logoURI,
  symbol,
  chain,
}: {
  logoURI?: string | null;
  symbol: string;
  chain: ChainId;
}) {
  const isEth = chain === 'ethereum';
  return (
    <div className="relative w-7 h-7 shrink-0">
      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
        {logoURI ? (
          <img
            src={logoURI}
            alt={symbol}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="text-[9px] text-white font-semibold">
            {symbol.slice(0, 3).toUpperCase()}
          </span>
        )}
      </div>
      <span
        title={CHAIN_NAME[chain]}
        className={`absolute -bottom-[3px] -right-[3px] h-3 w-3 rounded-full overflow-hidden flex items-center justify-center ring-2 ring-[#0e2747] ${
          isEth ? 'bg-white' : 'bg-[#0b1f3a]'
        }`}
      >
        <img
          src={CHAIN_LOGO[chain]}
          alt={CHAIN_NAME[chain]}
          className="h-full w-full object-contain p-[1px]"
        />
      </span>
    </div>
  );
}
