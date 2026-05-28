'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import {
  IconChevronDown,
  IconCopy,
  IconRefresh,
  IconTrash,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { usePortfolio } from '@/hooks/usePortfolio';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import { ApprovalsPanel } from '@/components/portfolio/ApprovalsPanel';
import type { ChainId, LpUnderlying, PortfolioToken, PortfolioWallet } from '@/services';

const CHAIN_LABEL: Record<ChainId, string> = {
  ethereum: 'ETH',
  pulsechain: 'PLS',
};

const CHAIN_COLOR: Record<ChainId, string> = {
  ethereum: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40',
  pulsechain: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40',
};

// Inline styles bypass any Tailwind JIT gaps for these specific RGBs
// (we hit one with text-cyan-50 earlier and don't want to rediscover it
// for the chain-filter pills).
const CHAIN_ACTIVE_STYLE: Record<ChainId, CSSProperties> = {
  ethereum: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    borderColor: 'rgba(99, 102, 241, 0.75)',
    color: '#fff',
  },
  pulsechain: {
    backgroundColor: 'rgba(217, 70, 239, 0.3)',
    borderColor: 'rgba(217, 70, 239, 0.75)',
    color: '#fff',
  },
};

const CHAIN_INACTIVE_STYLE: CSSProperties = {
  backgroundColor: 'transparent',
  borderColor: 'rgba(255, 255, 255, 0.15)',
  color: 'rgba(255, 255, 255, 0.35)',
};

const truncate = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const fmtUsd = (n: number, opts?: { compact?: boolean }) => {
  if (!Number.isFinite(n) || n === 0) return '$0.00';
  if (opts?.compact && Math.abs(n) >= 1000) {
    return `$${n.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 2 })}`;
  }
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 0.01 ? 6 : 2,
  })}`;
};

const fmtBalance = (n: number) =>
  n.toLocaleString(undefined, {
    maximumFractionDigits: n < 1 ? 6 : 4,
  });

const fmtChange = (n: number | undefined) => {
  if (n == null || !Number.isFinite(n)) return null;
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

type SortKey = 'symbol' | 'balance' | 'change' | 'price' | 'value';
type SortDir = 'asc' | 'desc';

interface Props {
  wallet: PortfolioWallet;
}

export function WalletCard({ wallet }: Props) {
  const { snapshot, tokens, totalUsd, isLoading, error, refresh } = usePortfolio(wallet.address);
  const removeWallet = usePortfolioStore((s) => s.removeWallet);

  const [expanded, setExpanded] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [activeChains, setActiveChains] = useState<Set<ChainId>>(
    () => new Set(wallet.chains),
  );
  const [copied, setCopied] = useState(false);

  const filteredTokens = useMemo(
    () => tokens.filter((t) => activeChains.has(t.chain)),
    [tokens, activeChains],
  );

  const filteredTotalUsd = useMemo(
    () => filteredTokens.reduce((sum, t) => sum + (t.valueUsd ?? 0), 0),
    [filteredTokens],
  );

  const sortedTokens = useMemo(() => {
    const copy = [...filteredTokens];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'symbol':
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case 'balance':
          cmp = a.balanceFormatted - b.balanceFormatted;
          break;
        case 'change': {
          // Missing values always sort to the bottom regardless of dir.
          const aHas = a.priceChange24h != null;
          const bHas = b.priceChange24h != null;
          if (!aHas && !bHas) cmp = 0;
          else if (!aHas) return 1;
          else if (!bHas) return -1;
          else cmp = (a.priceChange24h as number) - (b.priceChange24h as number);
          break;
        }
        case 'price': {
          const aHas = a.priceUsd != null;
          const bHas = b.priceUsd != null;
          if (!aHas && !bHas) cmp = 0;
          else if (!aHas) return 1;
          else if (!bHas) return -1;
          else cmp = (a.priceUsd as number) - (b.priceUsd as number);
          break;
        }
        case 'value':
        default: {
          const aHas = a.valueUsd != null;
          const bHas = b.valueUsd != null;
          if (!aHas && !bHas) cmp = 0;
          else if (!aHas) return 1;
          else if (!bHas) return -1;
          else cmp = (a.valueUsd as number) - (b.valueUsd as number);
          break;
        }
      }
      return cmp * dir;
    });
    return copy;
  }, [filteredTokens, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Sensible default direction per column: value/balance/change/price
      // are most useful big→small, symbol alphabetical A→Z.
      setSortDir(key === 'symbol' ? 'asc' : 'desc');
    }
  };

  const toggleChainFilter = (c: ChainId) => {
    setActiveChains((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const totalsDiffer = Math.abs(filteredTotalUsd - totalUsd) > 0.005;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 p-4 border-b border-white/10">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-2 text-white"
          aria-expanded={expanded}
        >
          <IconChevronDown
            className={`h-4 w-4 text-white/60 transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
          <span className="font-semibold">
            {wallet.label || truncate(wallet.address)}
          </span>
        </button>

        {wallet.label && (
          <span className="text-xs text-white/50 font-mono">{truncate(wallet.address)}</span>
        )}

        <button
          type="button"
          onClick={copyAddress}
          className="text-white/50 hover:text-white"
          title="Copy address"
        >
          <IconCopy className="h-4 w-4" />
        </button>
        {copied && <span className="text-xs text-green-300">Copied</span>}

        <div className="flex items-center gap-1.5">
          {wallet.chains.map((c) => {
            const active = activeChains.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleChainFilter(c)}
                aria-pressed={active}
                title={active ? `Hide ${CHAIN_LABEL[c]} tokens` : `Show ${CHAIN_LABEL[c]} tokens`}
                className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded border transition-colors hover:brightness-125"
                style={active ? CHAIN_ACTIVE_STYLE[c] : CHAIN_INACTIVE_STYLE}
              >
                {CHAIN_LABEL[c]}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-white/50 uppercase tracking-wide">Total</div>
            <div className="text-lg font-semibold text-white tabular-nums">
              {fmtUsd(filteredTotalUsd, { compact: true })}
            </div>
            {totalsDiffer && (
              <div
                className="text-[10px] uppercase tracking-wide tabular-nums"
                style={{ color: 'rgba(255, 255, 255, 0.4)' }}
              >
                of {fmtUsd(totalUsd, { compact: true })}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading}
            className="text-white/70 hover:text-white disabled:opacity-40"
            title="Refresh"
          >
            <IconRefresh
              className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={() => removeWallet(wallet.address)}
            className="text-white/40 hover:text-red-400"
            title="Remove wallet"
          >
            <IconTrash className="h-5 w-5" />
          </button>
        </div>
      </header>

      {expanded && (
        <div className="p-4 space-y-3">
          {snapshot?.errors && snapshot.errors.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 space-y-1">
              {snapshot.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2">
                  <IconAlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    <span className="font-semibold uppercase mr-1">{err.chain}</span>
                    {err.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          {isLoading && tokens.length === 0 ? (
            <SkeletonRows />
          ) : tokens.length === 0 ? (
            <div className="text-sm text-white/50 text-center py-8">
              {snapshot
                ? 'No tokens found at this address.'
                : 'Tap refresh to load this wallet.'}
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="text-sm text-white/50 text-center py-8">
              No tokens visible — toggle a chain badge above to show them.
            </div>
          ) : (
            <TokenTable
              tokens={sortedTokens}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}
          <ApprovalsPanel
            walletAddress={wallet.address}
            chains={wallet.chains}
          />
        </div>
      )}
    </section>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-10 rounded bg-white/5 animate-pulse"
        />
      ))}
    </div>
  );
}

function TokenTable({
  tokens,
  sortKey,
  sortDir,
  onSort,
}: {
  tokens: PortfolioToken[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const [expandedLp, setExpandedLp] = useState<Record<string, boolean>>({});
  const toggleLp = (key: string) =>
    setExpandedLp((p) => ({ ...p, [key]: !p[key] }));

  const header = (key: SortKey, label: string, align: 'left' | 'right') => (
    <SortButton
      active={sortKey === key}
      dir={sortDir}
      align={align}
      onClick={() => onSort(key)}
    >
      {label}
    </SortButton>
  );

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-white/50 border-b border-white/10">
            <th className="font-semibold px-2 py-2 w-8 text-right">#</th>
            <th className="font-semibold px-2 py-2">{header('symbol', 'Token', 'left')}</th>
            <th className="font-semibold px-2 py-2 text-right">{header('balance', 'Balance', 'right')}</th>
            <th className="font-semibold px-2 py-2 text-right">{header('change', '24h', 'right')}</th>
            <th className="font-semibold px-2 py-2 text-right">{header('price', 'Price', 'right')}</th>
            <th className="font-semibold px-2 py-2 text-right">{header('value', 'Value', 'right')}</th>
          </tr>
        </thead>
        <tbody>
          {tokens.flatMap((t, i) => {
            const key = `${t.chain}:${t.address}`;
            const isExpanded = !!expandedLp[key];
            const rows: React.ReactNode[] = [
              <tr
                key={key}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="px-2 py-2 text-white/40 tabular-nums text-right">{i + 1}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TokenIcon token={t} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white truncate">{t.symbol}</span>
                        <span
                          className={`text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded border ${CHAIN_COLOR[t.chain]}`}
                        >
                          {CHAIN_LABEL[t.chain]}
                        </span>
                        {t.isNative && (
                          <span className="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/40">
                            Native
                          </span>
                        )}
                        {t.isLp && (
                          <button
                            type="button"
                            onClick={() => toggleLp(key)}
                            className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-200 border border-cyan-500/40 hover:bg-cyan-500/25"
                            aria-expanded={isExpanded}
                            title={isExpanded ? 'Hide breakdown' : 'Show LP breakdown'}
                          >
                            LP
                            <IconChevronDown
                              className={`h-3 w-3 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                            />
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-white/50 truncate">{t.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 text-right text-white tabular-nums">
                  {fmtBalance(t.balanceFormatted)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {(() => {
                    const txt = fmtChange(t.priceChange24h);
                    if (!txt) return <span className="text-white/30">—</span>;
                    const positive = (t.priceChange24h ?? 0) >= 0;
                    return (
                      <span className={positive ? 'text-green-400' : 'text-red-400'}>{txt}</span>
                    );
                  })()}
                </td>
                <td className="px-2 py-2 text-right text-white/80 tabular-nums">
                  {t.priceUsd != null ? fmtUsd(t.priceUsd) : <span className="text-white/30">—</span>}
                </td>
                <td className="px-2 py-2 text-right text-white font-semibold tabular-nums">
                  {t.valueUsd != null ? fmtUsd(t.valueUsd) : <span className="text-white/30">—</span>}
                </td>
              </tr>,
            ];

            if (t.isLp && t.lp && isExpanded) {
              for (const side of t.lp.sides) {
                rows.push(
                  <LpSideRow
                    key={`${key}:${side.address}`}
                    side={side}
                    chain={t.chain}
                  />,
                );
              }
              if (t.lp.totalLiquidityUsd != null) {
                rows.push(
                  <tr key={`${key}:meta`} className="border-b border-white/5 bg-cyan-500/5">
                    <td />
                    <td colSpan={5} className="px-2 py-1.5 text-[11px] text-cyan-200/80">
                      Pool TVL{' '}
                      <span className="font-semibold">
                        {fmtUsd(t.lp.totalLiquidityUsd, { compact: true })}
                      </span>
                      {' · '}Your share{' '}
                      <span className="font-semibold">
                        {(t.lp.userShare * 100).toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}
                        %
                      </span>
                    </td>
                  </tr>,
                );
              }
            }

            return rows;
          })}
        </tbody>
      </table>
    </div>
  );
}

function LpSideRow({ side, chain }: { side: LpUnderlying; chain: ChainId }) {
  return (
    <tr className="border-b border-white/5 bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors">
      <td />
      <td className="px-2 py-2 pl-6">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-cyan-300/70 text-xs">↳</div>
          <SideIcon side={side} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-white truncate">{side.symbol}</span>
              <span
                className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/50"
                style={{ color: '#cffafe' }}
              >
                {side.weightPct.toFixed(1)}%
              </span>
            </div>
            <div className="text-[11px] text-white/50 truncate">{side.name}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2 text-right text-white/85 tabular-nums">
        {side.amountFormatted.toLocaleString(undefined, {
          maximumFractionDigits: side.amountFormatted < 1 ? 6 : 4,
        })}
      </td>
      <td className="px-2 py-2 text-right text-white/30">—</td>
      <td className="px-2 py-2 text-right text-white/75 tabular-nums">
        {side.priceUsd != null ? fmtUsd(side.priceUsd) : <span className="text-white/30">—</span>}
      </td>
      <td className="px-2 py-2 text-right text-white tabular-nums">
        {side.valueUsd != null ? fmtUsd(side.valueUsd) : <span className="text-white/30">—</span>}
      </td>
    </tr>
  );
}

function SideIcon({ side }: { side: LpUnderlying }) {
  return (
    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
      {side.logoURI ? (
        <img
          src={side.logoURI}
          alt={side.symbol}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <span className="text-[9px] text-white font-semibold">
          {side.symbol.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function SortButton({
  active,
  dir,
  align,
  onClick,
  children,
}: {
  active: boolean;
  dir: SortDir;
  align: 'left' | 'right';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const arrow = !active ? '' : dir === 'desc' ? ' ↓' : ' ↑';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-0.5 hover:text-white transition-colors ${
        active ? 'text-white' : 'text-white/50'
      }`}
      style={{ width: align === 'right' ? 'auto' : undefined }}
    >
      {align === 'left' ? (
        <>
          {children}
          {arrow && <span className="ml-0.5">{arrow.trim()}</span>}
        </>
      ) : (
        <>
          {children}
          {arrow && <span className="ml-0.5">{arrow.trim()}</span>}
        </>
      )}
    </button>
  );
}

function TokenIcon({ token }: { token: PortfolioToken }) {
  return (
    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
      {token.logoURI ? (
        <img
          src={token.logoURI}
          alt={token.symbol}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <span className="text-[10px] text-white/60 font-semibold">
          {token.symbol.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
}
