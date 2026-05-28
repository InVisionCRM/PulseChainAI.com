'use client';

import { useMemo, useState } from 'react';
import {
  IconChevronDown,
  IconCopy,
  IconRefresh,
  IconTrash,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { usePortfolio } from '@/hooks/usePortfolio';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import type { ChainId, LpUnderlying, PortfolioToken, PortfolioWallet } from '@/services';

const CHAIN_LABEL: Record<ChainId, string> = {
  ethereum: 'ETH',
  pulsechain: 'PLS',
};

const CHAIN_COLOR: Record<ChainId, string> = {
  ethereum: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40',
  pulsechain: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40',
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

type SortKey = 'value' | 'balance' | 'change';

interface Props {
  wallet: PortfolioWallet;
}

export function WalletCard({ wallet }: Props) {
  const { snapshot, tokens, totalUsd, isLoading, error, refresh } = usePortfolio(wallet.address);
  const removeWallet = usePortfolioStore((s) => s.removeWallet);

  const [expanded, setExpanded] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [copied, setCopied] = useState(false);

  const sortedTokens = useMemo(() => {
    const copy = [...tokens];
    copy.sort((a, b) => {
      if (sortKey === 'balance') return b.balanceFormatted - a.balanceFormatted;
      if (sortKey === 'change') {
        return (b.priceChange24h ?? -Infinity) - (a.priceChange24h ?? -Infinity);
      }
      return (b.valueUsd ?? 0) - (a.valueUsd ?? 0);
    });
    return copy;
  }, [tokens, sortKey]);

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
          {wallet.chains.map((c) => (
            <span
              key={c}
              className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded border ${CHAIN_COLOR[c]}`}
            >
              {CHAIN_LABEL[c]}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-white/50 uppercase tracking-wide">Total</div>
            <div className="text-lg font-semibold text-white tabular-nums">
              {fmtUsd(totalUsd, { compact: true })}
            </div>
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
          ) : (
            <TokenTable
              tokens={sortedTokens}
              sortKey={sortKey}
              onSortChange={setSortKey}
            />
          )}
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
  onSortChange,
}: {
  tokens: PortfolioToken[];
  sortKey: SortKey;
  onSortChange: (k: SortKey) => void;
}) {
  const [expandedLp, setExpandedLp] = useState<Record<string, boolean>>({});
  const toggleLp = (key: string) =>
    setExpandedLp((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-white/50 border-b border-white/10">
            <th className="font-semibold px-2 py-2 w-8 text-right">#</th>
            <th className="font-semibold px-2 py-2">Token</th>
            <th className="font-semibold px-2 py-2 text-right">Balance</th>
            <th className="font-semibold px-2 py-2 text-right">
              <SortButton active={sortKey === 'change'} onClick={() => onSortChange('change')}>
                24h
              </SortButton>
            </th>
            <th className="font-semibold px-2 py-2 text-right">Price</th>
            <th className="font-semibold px-2 py-2 text-right">
              <SortButton active={sortKey === 'value'} onClick={() => onSortChange('value')}>
                Value
              </SortButton>
            </th>
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
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hover:text-white transition-colors ${active ? 'text-white' : ''}`}
    >
      {children}
      {active && ' ↓'}
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
