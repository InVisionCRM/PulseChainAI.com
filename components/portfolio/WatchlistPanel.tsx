'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconSearch,
  IconStar,
  IconX,
  IconRefresh,
  IconFolder,
  IconFolderPlus,
  IconPlus,
  IconTrash,
  IconCheck,
} from '@tabler/icons-react';
import { useWatchlistStore } from '@/lib/stores/watchlistStore';
import type { WatchedToken, WatchPriceEntry } from '@/lib/stores/watchlistStore';
import {
  useWatchlistGroupsStore,
  resolveWlGroupId,
  DEFAULT_WL_GROUP_ID,
  type WatchlistGroup,
} from '@/lib/stores/watchlistGroupsStore';
import {
  groupBase,
  groupRgba,
  GROUP_COLORS,
  GROUP_COLOR_KEYS,
} from '@/lib/stores/groupsStore';
import { useInsightsStore } from '@/lib/stores/insightsStore';
import type { ChainId, PortfolioToken } from '@/services';
import { fmtPrice, fmtPct } from '@/lib/format';

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

  const groups = useWatchlistGroupsStore((s) => s.groups);
  const assignments = useWatchlistGroupsStore((s) => s.assignments);

  // Default group always first; the rest keep creation order.
  const orderedGroups = useMemo(() => {
    const def = groups.find((g) => g.id === DEFAULT_WL_GROUP_ID);
    const rest = groups.filter((g) => g.id !== DEFAULT_WL_GROUP_ID);
    return def ? [def, ...rest] : rest;
  }, [groups]);

  const tokensByGroup = useMemo(() => {
    const map = new Map<string, WatchedToken[]>();
    for (const t of tokens) {
      const gid = resolveWlGroupId(groups, assignments, t.chain, t.address);
      const arr = map.get(gid) ?? [];
      arr.push(t);
      map.set(gid, arr);
    }
    return map;
  }, [tokens, groups, assignments]);

  // Only switch to sectioned rendering once the user has created a custom
  // group; with just the default group the flat list reads cleaner.
  const hasCustomGroups = groups.length > 1;

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
    <aside
      id="watchlist"
      className="scroll-mt-20 rounded-2xl border border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl p-4 lg:sticky lg:top-4 lg:flex lg:flex-col lg:max-h-[calc(100vh-2rem)]"
    >
      <div className="flex items-center justify-between mb-3 lg:shrink-0">
        <div className="flex items-center gap-2 text-orange-400/80 text-xs font-semibold uppercase tracking-wider">
          <IconStar className="h-4 w-4" />
          Watchlist
          {tokens.length > 0 && (
            <span className="text-[var(--text-faint)] normal-case font-normal">
              · {tokens.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading || tokens.length === 0}
          className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-30"
          title="Refresh prices"
        >
          <IconRefresh className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative mb-3 lg:shrink-0">
        <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-faint)] pointer-events-none" />
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
          className="w-full rounded-lg bg-[var(--surface-2)] border border-[var(--line)] pl-8 pr-2 py-2 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-orange-500/60"
        />
        {open && query.trim().length >= 2 && (
          <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] shadow-2xl max-h-72 overflow-y-auto">
            {searching && hits.length === 0 && (
              <div className="px-3 py-2 text-xs text-[var(--text-faint)]">Searching…</div>
            )}
            {!searching && hits.length === 0 && (
              <div className="px-3 py-2 text-xs text-[var(--text-faint)]">No tokens found.</div>
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
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-2)] text-left"
              >
                <Icon32 logoURI={h.logoURI} symbol={h.symbol} chain={h.chain} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--text)] truncate">
                    {h.symbol}
                  </div>
                  <div className="text-xs text-[var(--text-faint)] truncate">{h.name}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:-mr-2 lg:pr-2">
      {tokens.length === 0 ? (
        <div className="text-sm text-[var(--text-faint)] py-6 text-center">
          Track tokens you don't hold yet. Paste an address or search above.
        </div>
      ) : (
        <>
          <WlGroupManager groups={orderedGroups} tokensByGroup={tokensByGroup} />

          {!hasCustomGroups ? (
            <ul className="space-y-1">
              {tokens.map((t) => (
                <TokenRow
                  key={`${t.chain}:${t.address}`}
                  token={t}
                  price={prices[t.address]}
                  groups={orderedGroups}
                  currentGroupId={resolveWlGroupId(
                    groups,
                    assignments,
                    t.chain,
                    t.address,
                  )}
                  showGroupPicker={false}
                  onOpenInsights={openInsights}
                  onRemove={remove}
                />
              ))}
            </ul>
          ) : (
            <div className="space-y-4">
              {orderedGroups.map((g) => {
                const ts = tokensByGroup.get(g.id) ?? [];
                // Empty groups live only in the manager bar — no section until a
                // token lands in them, to avoid empty headers.
                if (ts.length === 0) return null;
                return (
                  <WlGroupSection key={g.id} group={g} count={ts.length}>
                    {ts.map((t) => (
                      <TokenRow
                        key={`${t.chain}:${t.address}`}
                        token={t}
                        price={prices[t.address]}
                        groups={orderedGroups}
                        currentGroupId={g.id}
                        showGroupPicker
                        onOpenInsights={openInsights}
                        onRemove={remove}
                      />
                    ))}
                  </WlGroupSection>
                );
              })}
            </div>
          )}
        </>
      )}
      </div>
    </aside>
  );
}

// Manager bar — create / rename / recolour / delete groups. Mirrors the
// portfolio PortfolioGroups manager so the two grouping features feel identical.
function WlGroupManager({
  groups,
  tokensByGroup,
}: {
  groups: WatchlistGroup[];
  tokensByGroup: Map<string, WatchedToken[]>;
}) {
  const createGroup = useWatchlistGroupsStore((s) => s.createGroup);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId
    ? groups.find((g) => g.id === editingId) ?? null
    : null;

  return (
    <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 text-[var(--text-faint)] text-[10px] font-semibold uppercase tracking-wider">
          <IconFolder className="h-3.5 w-3.5" />
          Groups
          <span className="text-[var(--text-faint)] normal-case font-normal">
            · {groups.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEditingId(createGroup())}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] text-[11px] font-semibold px-2 py-1 transition-colors"
        >
          <IconPlus className="h-3 w-3" />
          New group
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <WlGroupChip
            key={g.id}
            group={g}
            count={(tokensByGroup.get(g.id) ?? []).length}
            active={editingId === g.id}
            onClick={() => setEditingId((cur) => (cur === g.id ? null : g.id))}
          />
        ))}
      </div>

      {editing && (
        <WlGroupEditor
          key={editing.id}
          group={editing}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function WlGroupChip({
  group,
  count,
  active,
  onClick,
}: {
  group: WatchlistGroup;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors"
      style={{
        backgroundColor: groupRgba(group.color, active ? 0.28 : 0.14),
        borderColor: groupRgba(group.color, active ? 0.9 : 0.4),
        color: '#fff',
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: groupBase(group.color) }}
      />
      {group.name}
      <span className="text-[var(--text-faint)] font-normal">· {count}</span>
    </button>
  );
}

function WlGroupEditor({
  group,
  onClose,
}: {
  group: WatchlistGroup;
  onClose: () => void;
}) {
  const renameGroup = useWatchlistGroupsStore((s) => s.renameGroup);
  const setGroupColor = useWatchlistGroupsStore((s) => s.setGroupColor);
  const removeGroup = useWatchlistGroupsStore((s) => s.removeGroup);

  const [name, setName] = useState(group.name);
  const isDefault = group.id === DEFAULT_WL_GROUP_ID;

  const commitName = () => {
    const n = name.trim();
    if (n && n !== group.name) renameGroup(group.id, n);
  };

  return (
    <div className="mt-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-2.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitName();
              onClose();
            }
          }}
          autoFocus
          placeholder="Group name"
          className="flex-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] px-2.5 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--line)]"
        />
        {!isDefault && (
          <button
            type="button"
            onClick={() => {
              removeGroup(group.id);
              onClose();
            }}
            title="Delete group"
            className="text-[var(--text-faint)] hover:text-red-400 shrink-0"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            commitName();
            onClose();
          }}
          title="Done"
          className="text-[var(--text-muted)] hover:text-[var(--text)] shrink-0"
        >
          <IconCheck className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {GROUP_COLOR_KEYS.map((k) => {
          const selected = group.color === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setGroupColor(group.id, k)}
              title={GROUP_COLORS[k].label}
              aria-pressed={selected}
              className="h-5 w-5 rounded-full transition-transform hover:scale-110"
              style={{
                backgroundColor: groupBase(k),
                boxShadow: selected ? '0 0 0 2px #0F1A2E, 0 0 0 4px #fff' : 'none',
              }}
            />
          );
        })}
      </div>

      {isDefault && (
        <p className="text-[11px] text-[var(--text-faint)] leading-snug">
          Default group — new and ungrouped tokens land here. Rename and recolour
          it freely; it can't be deleted.
        </p>
      )}
    </div>
  );
}

function WlGroupSection({
  group,
  count,
  children,
}: {
  group: WatchlistGroup;
  count: number;
  children: React.ReactNode;
}) {
  const base = groupBase(group.color);
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-1.5 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: base }} />
        <h3 className="text-xs font-bold tracking-wide" style={{ color: base }}>
          {group.name}
        </h3>
        <span className="text-[11px] text-[var(--text-faint)]">· {count}</span>
      </div>
      <ul
        className="space-y-1 pl-2"
        style={{ borderLeft: `2px solid ${groupRgba(group.color, 0.5)}` }}
      >
        {children}
      </ul>
    </section>
  );
}

function TokenRow({
  token: t,
  price: p,
  groups,
  currentGroupId,
  showGroupPicker,
  onOpenInsights,
  onRemove,
}: {
  token: WatchedToken;
  price?: WatchPriceEntry;
  groups: WatchlistGroup[];
  currentGroupId: string;
  showGroupPicker: boolean;
  onOpenInsights: (token: PortfolioToken) => void;
  onRemove: (address: string, chain: ChainId) => void;
}) {
  const priceUsd = p?.priceUsd;
  const change = p?.priceChange24h;
  const logo = p?.logoURI || t.logoURI;
  const sym = p?.symbol || t.symbol;
  const name = p?.name || t.name;
  const changeTxt = fmtPct(change);

  return (
    <li className="group relative flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => onOpenInsights(toInsightsToken(t, p))}
        className="flex items-center gap-2 min-w-0 flex-1 text-left"
        title={`Open insights — ${sym}`}
      >
        <Icon32 logoURI={logo} symbol={sym} chain={t.chain} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--text)] truncate">{sym}</div>
          <div className="text-[10px] text-[var(--text-faint)] truncate">{name}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm text-[var(--text)] tabular-nums">
            {priceUsd != null ? fmtPrice(priceUsd) : <span className="text-[var(--text-faint)]">—</span>}
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

      {showGroupPicker && (
        <GroupPicker token={t} groups={groups} currentGroupId={currentGroupId} />
      )}

      <button
        type="button"
        onClick={() => onRemove(t.address, t.chain)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-faint)] hover:text-red-400 shrink-0"
        title="Remove from watchlist"
      >
        <IconX className="h-4 w-4" />
      </button>
    </li>
  );
}

// Per-token folder button → popover listing every group. Picking one moves the
// token; the current group is checked. Closes on outside click / Escape.
function GroupPicker({
  token,
  groups,
  currentGroupId,
}: {
  token: WatchedToken;
  groups: WatchlistGroup[];
  currentGroupId: string;
}) {
  const assignToken = useWatchlistGroupsStore((s) => s.assignToken);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = groups.find((g) => g.id === currentGroupId);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Group: ${current?.name ?? 'Watchlist'}`}
        className={`${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-opacity text-[var(--text-faint)] hover:text-[var(--text)]`}
      >
        <IconFolderPlus className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] shadow-2xl py-1">
          {groups.map((g) => {
            const selected = g.id === currentGroupId;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  assignToken(token.chain, token.address, g.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--surface-2)]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: groupBase(g.color) }}
                />
                <span className="flex-1 truncate">{g.name}</span>
                {selected && <IconCheck className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
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
      <div className="w-7 h-7 rounded-full bg-[var(--surface-2)] flex items-center justify-center overflow-hidden">
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
          <span className="text-[9px] text-[var(--text)] font-semibold">
            {symbol.slice(0, 3).toUpperCase()}
          </span>
        )}
      </div>
      <span
        title={CHAIN_NAME[chain]}
        className={`absolute -bottom-[3px] -right-[3px] h-3 w-3 rounded-full overflow-hidden flex items-center justify-center ring-2 ring-[#0e2747] ${
          isEth ? 'bg-white' : 'bg-[var(--surface-2)]'
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
