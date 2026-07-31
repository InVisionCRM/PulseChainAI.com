import React, { useEffect, useRef, useState } from 'react';
import { LoaderThree } from '@/components/ui/loader';
import { Holder, HolderStats, TokenInfo } from './types';
import { isBurnAddress } from './utils';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';
import { fmtAmount, fmtNum } from '@/lib/format';
import TransferOriginFlow from './TransferOriginFlow';

// Compact USD for the holder value column: "$1.2M", "$3.4k", "$12", "<$1", "$0".
function fmtUsd(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '$0';
  if (v < 1) return '<$1';
  if (v < 1000) return `$${Math.round(v)}`;
  if (v < 1_000_000) return `$${(v / 1000).toFixed(v < 10_000 ? 1 : 0)}k`;
  if (v < 1_000_000_000) return `$${(v / 1_000_000).toFixed(v < 10_000_000 ? 1 : 0)}M`;
  return `$${(v / 1_000_000_000).toFixed(1)}B`;
}

/** Signed USD for PnL cells — the sign carries the meaning, so it leads. */
function fmtPnl(v: number): string {
  const a = Math.abs(v);
  const body = a >= 1000 ? fmtUsd(a).slice(1) : a.toFixed(2);
  return `${v >= 0 ? '+' : '−'}$${body}`;
}

function fmtDate(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: '2-digit', month: 'short', day: 'numeric',
  });
}

/** The same shortening the connections endpoint applies to cluster wallets. */
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Payload of /api/geicko/holder-detail — see that route for field semantics. */
interface HolderDetail {
  supported: boolean;
  hasData: boolean;
  priceNow?: number;
  trades?: {
    swaps: number;
    buyCount: number; sellCount: number; buyUsd: number; sellUsd: number;
    buyTokens: number; sellTokens: number;
    biggestBuy: { usd: number; ts: number } | null;
    biggestSell: { usd: number; ts: number } | null;
    firstBuyTs: number | null; lastBuyTs: number | null; lastSellTs: number | null;
  };
  pnl?: {
    realizedUsd: number;
    unrealizedUsd: number | null;
    netUsd: number;
    basisComplete: boolean;
    avgCostUsd: number | null;
    swapTrackedTokens: number;
  };
  lp?: {
    isProvider: boolean;
    everProvided: boolean;
    positions: {
      pair: string; label: string; adds: number; removes: number;
      addedUsd: number; removedUsd: number; sharePct: number; valueUsd: number; active: boolean;
    }[];
  };
  note?: string;
}

type DetailState = 'loading' | 'error' | HolderDetail;

/** Payload of /api/geicko/holder-origin — a budgeted walk, see that route. */
interface TraceNode {
  address: string;
  short: string;
  label: string | null;
  isContract: boolean;
  tokens: number;
  transfers: number;
  origin:
    | { kind: 'bought'; boughtTokens: number; boughtUsd: number; firstBuyTs: number | null; avgPriceUsd: number | null; coversSent: number }
    | { kind: 'minted' } | { kind: 'router' } | { kind: 'known'; category: string | null }
    | { kind: 'depth-capped' } | { kind: 'budget-capped' } | { kind: 'time-capped' }
    | { kind: 'untraceable' }
    | null;
  upstream: TraceNode[] | null;
}

interface HolderOrigin {
  supported: boolean;
  hasData: boolean;
  inboundTokens?: number;
  routerDeliveredTokens?: number;
  coveragePct?: number | null;
  traces?: TraceNode[];
  limits?: { truncated?: boolean; nodesUsed?: number; maxDepth?: number; timedOut?: boolean };
  note?: string;
}

type OriginState = 'loading' | 'error' | HolderOrigin;

interface ClustersState {
  status: 'loading' | 'error' | 'done';
  /** shortened wallet → { funder, count } for every clustered wallet */
  byWallet: Map<string, { funder: string; label: string | null; count: number }>;
}

export interface GeickoHoldersTabProps {
  /** Holders loaded so far (accumulates as more pages are lazily fetched) */
  holders: Holder[];
  /** Aggregated holder statistics */
  holderStats: HolderStats;
  /** Is the initial load in flight */
  isLoadingHolders: boolean;
  /** Token information for decimals and total supply */
  tokenInfo: TokenInfo | null;
  /** Set of LP addresses for tagging */
  lpAddressSet: Set<string>;
  /** Callback when opening the holder modal (portfolio / transactions / stakes) */
  onViewHolder: (address: string) => void;
  /** Whether another page of holders can be lazily loaded */
  hasMore: boolean;
  /** Is a "load more" fetch in flight */
  isLoadingMore: boolean;
  /** Fetch the next page of holders (cursor-based, server-side) */
  onLoadMore: () => void;
  /** Estimated wallet value (core + stablecoins) per lowercased address. */
  holderValues: Record<string, { usd: number; native: number; core: number; stable: number }>;
  /** The token being viewed — what the expanded row's trade history is about. */
  tokenAddress: string;
  /** Chain key; the per-holder detail is PulseX-backed, so PulseChain only. */
  network: string;
}

/**
 * Holders tab for Geicko
 * Displays holder statistics and a paginated table of top holders. Each row
 * expands into that wallet's trading record for this token — buys/sells,
 * biggest trades, PnL, first/last activity, LP positions and funding-cluster
 * membership — fetched on first expand and cached for the session.
 */
export default function GeickoHoldersTab({
  holders,
  holderStats,
  isLoadingHolders,
  tokenInfo,
  lpAddressSet,
  onViewHolder,
  hasMore,
  isLoadingMore,
  onLoadMore,
  holderValues,
  tokenAddress,
  network,
}: GeickoHoldersTabProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [origins, setOrigins] = useState<Record<string, OriginState>>({});
  const [clusters, setClusters] = useState<ClustersState | null>(null);
  const canExpand = network === 'pulsechain' && !!tokenAddress;

  // The cluster analysis covers the top holders as a set, so one fetch serves
  // every row. It can take a while server-side (funding-graph walks); it loads
  // lazily on the first expand and each row shows it as its own async slot.
  const fetchClusters = () => {
    if (clusters) return;
    setClusters({ status: 'loading', byWallet: new Map() });
    fetch(`/api/geicko/connections?token=${tokenAddress}&scope=holders&network=pulsechain`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const byWallet = new Map<string, { funder: string; label: string | null; count: number }>();
        for (const c of d?.clusters ?? []) {
          for (const w of c.wallets ?? []) {
            if (typeof w === 'string') byWallet.set(w.toLowerCase(), { funder: c.sharedFunder, label: c.funderLabel ?? null, count: c.count });
          }
        }
        // Only a genuine fetch failure (`d === null`, from `!r.ok`) is an error.
        // A successful `hasData:false` response means there were no real
        // (non-contract) wallets to analyze — a legitimate empty state, which
        // ClusterLine renders as "Not in any shared-funder cluster…".
        setClusters({ status: d == null ? 'error' : 'done', byWallet });
      })
      .catch(() => setClusters({ status: 'error', byWallet: new Map() }));
  };

  const traceOrigin = (addr: string) => {
    if (origins[addr]) return;
    setOrigins((o) => ({ ...o, [addr]: 'loading' }));
    fetch(`/api/geicko/holder-origin?token=${tokenAddress}&wallet=${addr}&network=pulsechain`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: HolderOrigin) => setOrigins((o) => ({ ...o, [addr]: d })))
      .catch(() => setOrigins((o) => ({ ...o, [addr]: 'error' })));
  };

  const toggleExpand = (holder: Holder, balance: number) => {
    const addr = (holder.address || '').toLowerCase();
    if (!addr || !canExpand) return;
    if (expanded === addr) {
      setExpanded(null);
      return;
    }
    setExpanded(addr);
    fetchClusters();
    if (details[addr]) return;
    setDetails((d) => ({ ...d, [addr]: 'loading' }));
    fetch(
      `/api/geicko/holder-detail?token=${tokenAddress}&wallet=${addr}&network=pulsechain&balance=${encodeURIComponent(balance)}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: HolderDetail) => setDetails((prev) => ({ ...prev, [addr]: d })))
      .catch(() => setDetails((prev) => ({ ...prev, [addr]: 'error' })));
  };

  // Auto-load the next page when the sentinel scrolls into view (infinite
  // scroll), with the button below as the accessible fallback.
  //
  // Every hook lives ABOVE the early returns. With hooks below them, the
  // loading→loaded transition changes the hook count between renders and React
  // throws "Rendered more hooks than during the previous render" — which is
  // exactly what took this tab down when the expand state was first added.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (isLoadingHolders) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <LoaderThree />
          <p className="text-[var(--text-muted)] text-xs mt-2">Loading holders...</p>
        </div>
      </div>
    );
  }

  if (holders.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center text-[var(--text-muted)]">
          <div className="text-xl mb-1">👥</div>
          <div className="text-xs">No holders found</div>
        </div>
      </div>
    );
  }

  const decimals = tokenInfo?.decimals ? Number(tokenInfo.decimals) : 18;
  const totalSupply = tokenInfo?.total_supply ? Number(tokenInfo.total_supply) : 0;

  // Holders accumulate in the parent and are lazily fetched a page at a time, so
  // render everything loaded so far; the footer/sentinel pulls the next page.
  const startIndex = 0;
  const visibleHolders = holders;

  return (
    <div className="space-y-1.5">
      {/* Holder Stats Cards */}
      <div className="grid grid-cols-3 gap-1">
        {/* Total Holders */}
        <div className="border border-[var(--line-strong)] px-2 py-1.5">
          <div className="text-sm text-center justify-center uppercase tracking-wider text-cyan-500">
            Total Holders
          </div>
          <div className="text-sm font-medium text-center justify-center text-[var(--text)]">
            {holderStats.totalHolders ? fmtNum(holderStats.totalHolders) : '—'}
          </div>
        </div>

        {/* LP Addresses */}
        <div className="border border-[var(--line-strong)] px-2 py-1.5">
          <div className="text-sm text-center justify-center uppercase tracking-wider text-cyan-500">
            LP Addresses
          </div>
          <div className="text-sm font-medium text-center justify-center text-[var(--text)]">{holderStats.lpCount}</div>
        </div>

        {/* Contracts */}
        <div className="border border-[var(--line-strong)] px-2 py-1.5">
          <div className="text-sm text-center justify-center uppercase tracking-wider text-cyan-500">
            Contracts
          </div>
          <div className="text-sm font-medium text-center justify-center text-[var(--text)]">
            {holderStats.contractCount}
          </div>
        </div>
      </div>

      {/* Holders list header */}
      <div className="text-center">
        <p className="text-[12px] text-cyan-500 uppercase tracking-wider">
          Showing top {holders.length} holders{hasMore ? ' — scroll for more' : ''}
          {canExpand ? ' · tap a row for its trade record' : ''}
        </p>
      </div>

      {/* Holders Table */}
      <div className="border border-[var(--line-strong)] overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--line-strong)] bg-[var(--surface)]">
          <div className="flex-[0.6] min-w-[30px]">#</div>
          <div className="flex-[1.5] min-w-[90px]">Address & Tags</div>
          <div className="flex-[1.6] min-w-[64px]">Balance</div>
          <div className="flex-[1.3] min-w-[52px]" title="Estimated wallet value from native coin, wrapped native, core majors and pegged stablecoins">Wallet $</div>
          <div className="flex-[1.1] min-w-[48px]">% Total</div>
          <div className="flex-[0.8] min-w-[64px]">View</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-[var(--line)]">
          {visibleHolders.map((holder, i) => {
            const globalIndex = startIndex + i + 1;
            const balance = Number(holder.value) / Math.pow(10, decimals);
            const percentage = totalSupply > 0 ? (Number(holder.value) / totalSupply) * 100 : 0;
            const formattedAddress = holder.address
              ? holder.address.slice(-4)
              : 'Unknown';
            const addrLower = (holder.address || '').toLowerCase();
            const isLpHolder = lpAddressSet.has(addrLower);
            const isBurn = isBurnAddress(holder.address);
            const expandable = canExpand && !!holder.address && !isBurn;
            const isOpen = expanded === addrLower;

            return (
              <React.Fragment key={holder.address || i}>
              <div
                onClick={expandable ? () => toggleExpand(holder, balance) : undefined}
                className={`flex items-center px-2 py-1 text-sm hover:bg-[var(--surface)] transition-colors ${
                  expandable ? 'cursor-pointer' : ''
                } ${isOpen ? 'bg-[var(--surface)]' : ''}`}
              >
                {/* Rank (with the expand cue folded in) */}
                <div className="flex-[0.6] min-w-[30px] flex items-center gap-1 text-[var(--text)] font-medium">
                  {expandable && (
                    <span
                      aria-hidden
                      className={`inline-block text-[9px] text-[var(--text-faint)] transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    >
                      ▶
                    </span>
                  )}
                  {globalIndex}
                </div>

                {/* Address & Tags */}
                <div className="flex-[1.5] min-w-[90px] flex items-center gap-1 truncate">
                  <span className="text-[var(--text)] font-mono truncate text-left">
                    {formattedAddress}
                  </span>
                  <div className="flex items-center gap-0.5 flex-wrap">
                    {isLpHolder && (
                      <span className="px-1 py-0.5 text-[11px] font-bold text-blue-300">
                        LP
                      </span>
                    )}
                    {holder.isContract && (
                      <span className="px-1 py-0.5 text-[9px] bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                        {holder.isVerified ? 'Verified' : 'Contract'}
                      </span>
                    )}
                    {isBurn && (
                      <span className="px-1 py-0.5 text-[11px] font-bold text-red-500">
                        Burn
                      </span>
                    )}
                  </div>
                </div>

                {/* Balance */}
                <div className="flex-[1.6] min-w-[64px] text-[var(--text)] truncate font-semibold">
                  {fmtAmount(Math.floor(balance))}
                </div>

                {/* Estimated wallet value (core + stablecoins). '—' while its
                    page of values is still loading; '$0' once known to be empty. */}
                <div className="flex-[1.3] min-w-[52px] font-semibold">
                  {(() => {
                    const v = holderValues[addrLower];
                    if (!v) return <span className="text-[var(--text-faint)]">—</span>;
                    return (
                      <span className={v.usd > 0 ? 'text-emerald-400' : 'text-[var(--text-muted)]'} title={`$${v.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })} — native $${v.native.toFixed(0)} · core $${v.core.toFixed(0)} · stables $${v.stable.toFixed(0)}`}>
                        {fmtUsd(v.usd)}
                      </span>
                    );
                  })()}
                </div>

                {/* Percentage */}
                <div className="flex-[1.1] min-w-[48px] text-[var(--text)] font-semibold">
                  {percentage.toFixed(1)}%
                </div>

                {/* View / Save Buttons */}
                <div
                  className="flex-[0.8] min-w-[64px] flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {holder.address && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewHolder(holder.address);
                        }}
                        className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded border border-blue-500/30 transition-colors"
                      >
                        View
                      </button>
                      <AddToGroupButton
                        address={holder.address}
                        source="holder"
                        chain="pulsechain"
                        context={{
                          tokenSymbol: tokenInfo?.symbol,
                          tokenName: tokenInfo?.name,
                          rank: globalIndex,
                        }}
                        size={15}
                      />
                    </>
                  )}
                </div>
              </div>

              {isOpen && (
                <HolderDetailPanel
                  detail={details[addrLower]}
                  clusters={holder.isContract ? null : clusters}
                  addrLower={addrLower}
                  tokenSymbol={tokenInfo?.symbol ?? 'token'}
                  origin={origins[addrLower]}
                  onTrace={() => traceOrigin(addrLower)}
                />
              )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Load-more footer + infinite-scroll sentinel */}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-between px-2 py-1.5 border-t border-[var(--line)] bg-[var(--surface)]"
          >
            <div className="text-xs text-[var(--text-muted)] font-medium">
              {holders.length} loaded
            </div>
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="px-3 py-0.5 text-xs font-medium bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-60 text-[var(--text)] rounded border border-cyan-400/40 transition-colors"
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── the expanded row ─────────────────── */

function Cell({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div
        className={`text-[12px] font-bold tabular-nums ${
          tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-red-400' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[9px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

function HolderDetailPanel({
  detail, clusters, addrLower, tokenSymbol, origin, onTrace,
}: {
  detail: DetailState | undefined;
  /** Null hides the cluster slot entirely (contracts aren't wallets). */
  clusters: ClustersState | null;
  addrLower: string;
  tokenSymbol: string;
  origin: OriginState | undefined;
  onTrace: () => void;
}) {
  if (!detail || detail === 'loading') {
    return (
      <div className="px-3 py-2.5 text-[11px] text-[var(--text-muted)] bg-[var(--surface)]/60">
        Reading this wallet&apos;s PulseX record…
      </div>
    );
  }
  if (detail === 'error') {
    return (
      <div className="px-3 py-2.5 text-[11px] text-red-400 bg-[var(--surface)]/60">
        Couldn&apos;t load the trade record — the subgraph didn&apos;t answer. Collapse and retry.
      </div>
    );
  }
  if (!detail.supported) {
    return (
      <div className="px-3 py-2.5 text-[11px] text-[var(--text-muted)] bg-[var(--surface)]/60">
        Per-holder trade history is PulseChain-only for now.
      </div>
    );
  }

  const t = detail.trades;
  const pnl = detail.pnl;
  const lp = detail.lp;
  const clusterHit = clusters && clusters.status === 'done'
    ? clusters.byWallet.get(shortAddr(addrLower)) ?? null
    : null;

  if (!detail.hasData) {
    return (
      <div className="px-3 py-2.5 bg-[var(--surface)]/60 space-y-1">
        <div className="text-[11px] text-[var(--text-muted)]">
          No PulseX swaps or liquidity from this wallet on {tokenSymbol}&apos;s pools — the tokens
          arrived by transfer, from another venue, or before the pools existed.
        </div>
        <OriginSection origin={origin} onTrace={onTrace} tokenSymbol={tokenSymbol} />
        <ClusterLine clusters={clusters} hit={clusterHit} />
      </div>
    );
  }

  return (
    <div className="px-2 py-2 bg-[var(--surface)]/60 space-y-1.5">
      {/* trading record */}
      {t && t.swaps > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            <Cell label="Buys" value={`${fmtNum(t.buyCount)} · ${fmtUsd(t.buyUsd)}`} sub={`${fmtAmount(Math.floor(t.buyTokens))} ${tokenSymbol}`} />
            <Cell label="Sells" value={`${fmtNum(t.sellCount)} · ${fmtUsd(t.sellUsd)}`} sub={`${fmtAmount(Math.floor(t.sellTokens))} ${tokenSymbol}`} />
            <Cell label="Biggest buy" value={t.biggestBuy ? fmtUsd(t.biggestBuy.usd) : '—'} sub={t.biggestBuy ? fmtDate(t.biggestBuy.ts) : undefined} />
            <Cell label="Biggest sell" value={t.biggestSell ? fmtUsd(t.biggestSell.usd) : '—'} sub={t.biggestSell ? fmtDate(t.biggestSell.ts) : undefined} />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
            <Cell label="First buy" value={fmtDate(t.firstBuyTs)} />
            <Cell label="Last buy" value={fmtDate(t.lastBuyTs)} />
            <Cell label="Last sell" value={fmtDate(t.lastSellTs)} />
            {pnl && (
              <>
                <Cell label="Realized PnL" value={fmtPnl(pnl.realizedUsd)} tone={pnl.realizedUsd >= 0 ? 'up' : 'down'} />
                <Cell
                  label="Unrealized"
                  value={pnl.unrealizedUsd != null ? fmtPnl(pnl.unrealizedUsd) : '—'}
                  sub={pnl.avgCostUsd != null ? `avg cost $${pnl.avgCostUsd.toPrecision(3)}` : undefined}
                  tone={pnl.unrealizedUsd != null ? (pnl.unrealizedUsd >= 0 ? 'up' : 'down') : undefined}
                />
                <Cell label="Net PnL" value={fmtPnl(pnl.netUsd)} tone={pnl.netUsd >= 0 ? 'up' : 'down'} />
              </>
            )}
          </div>
          {pnl && !pnl.basisComplete && (
            <div className="text-[9.5px] text-amber-400/90">
              Partial: this wallet also moved {tokenSymbol} outside PulseX swaps (transfers or other
              venues), so PnL only covers what traded here.
            </div>
          )}
        </>
      ) : (
        <div className="text-[11px] text-[var(--text-muted)]">
          No swaps from this wallet on {tokenSymbol}&apos;s PulseX pools.
        </div>
      )}

      {/* liquidity */}
      {lp && lp.everProvided ? (
        <div className="rounded border border-blue-500/30 bg-blue-500/5 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-blue-300">
            Liquidity provider {lp.isProvider ? '· active' : '· exited'}
          </div>
          <div className="mt-0.5 space-y-0.5">
            {lp.positions.map((p) => (
              <div key={p.pair} className="flex flex-wrap items-baseline gap-x-2 text-[11px] tabular-nums">
                <span className="font-semibold text-[var(--text)]">{p.label}</span>
                {p.active ? (
                  <span className="text-emerald-400">{fmtUsd(p.valueUsd)} · {p.sharePct.toFixed(2)}% of pool</span>
                ) : (
                  <span className="text-[var(--text-muted)]">exited</span>
                )}
                <span className="text-[var(--text-faint)]">
                  {p.adds} add{p.adds === 1 ? '' : 's'} {fmtUsd(p.addedUsd)}
                  {p.removes > 0 && ` · ${p.removes} remove${p.removes === 1 ? '' : 's'} ${fmtUsd(p.removedUsd)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-[var(--text-faint)]">
          No liquidity provided on {tokenSymbol}&apos;s pools from this wallet.
        </div>
      )}

      <OriginSection origin={origin} onTrace={onTrace} tokenSymbol={tokenSymbol} />

      <ClusterLine clusters={clusters} hit={clusterHit} />

      {detail.note && <div className="text-[9px] text-[var(--text-faint)]">{detail.note}</div>}
    </div>
  );
}

function ClusterLine({
  clusters, hit,
}: {
  clusters: ClustersState | null;
  hit: { funder: string; label: string | null; count: number } | null;
}) {
  if (!clusters) return null;
  if (clusters.status === 'loading') {
    return <div className="text-[10px] text-[var(--text-faint)]">Checking funding clusters among the top holders…</div>;
  }
  if (clusters.status === 'error') {
    return <div className="text-[10px] text-[var(--text-faint)]">Cluster check unavailable right now.</div>;
  }
  return hit ? (
    <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10.5px] text-amber-300">
      In a funding cluster: shares funder {hit.funder}
      {hit.label ? ` (${hit.label})` : ''} with {hit.count - 1} other top holder{hit.count === 2 ? '' : 's'}.
    </div>
  ) : (
    <div className="text-[10px] text-[var(--text-faint)]">
      Not in any shared-funder cluster among the analyzed top holders.
    </div>
  );
}

/* ─────────────────── where transferred tokens came from ─────────────────── */

/**
 * The transfer-origin trace: on demand rather than on expand, because it walks
 * Blockscout and the subgraphs across several hops and can take tens of
 * seconds cold. The result is a tree of senders ending, where the chain
 * allows, at the original on-market buy.
 */
function OriginSection({
  origin, onTrace, tokenSymbol,
}: { origin: OriginState | undefined; onTrace: () => void; tokenSymbol: string }) {
  if (!origin) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onTrace(); }}
        className="inline-flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10.5px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
      >
        Trace where transferred tokens came from →
      </button>
    );
  }
  if (origin === 'loading') {
    return (
      <div className="text-[10.5px] text-[var(--text-muted)]">
        Walking inbound transfers back to their source — up to ~45s on a cold wallet…
      </div>
    );
  }
  if (origin === 'error' || !origin.supported || !origin.hasData) {
    return (
      <div className="text-[10.5px] text-[var(--text-faint)]">
        Couldn&apos;t trace right now — the explorer didn&apos;t answer. Collapse and retry.
      </div>
    );
  }

  return <TransferOriginFlow origin={origin} tokenSymbol={tokenSymbol} />;
}
