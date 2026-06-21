'use client';

import { useMemo, useState } from 'react';
import {
  IconChevronDown,
  IconCopy,
  IconRefresh,
  IconTrash,
  IconAlertTriangle,
  IconChartHistogram,
  IconAdjustmentsHorizontal,
  IconShieldHalf,
} from '@tabler/icons-react';
import { usePortfolio } from '@/hooks/usePortfolio';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import { useInsightsStore } from '@/lib/stores/insightsStore';
import { useManageTokensStore } from '@/lib/stores/manageTokensStore';
import { ApprovalsPanel } from '@/components/portfolio/ApprovalsPanel';
import { MoveToGroupMenu } from '@/components/portfolio/MoveToGroupMenu';
import { ActivityFeed } from '@/components/portfolio/ActivityFeed';
import { WalletConnections } from '@/components/portfolio/WalletConnections';
import { WalletRelated } from '@/components/portfolio/WalletRelated';
import { WalletGraph } from '@/components/portfolio/WalletGraph';
import { WalletFundingTrace } from '@/components/portfolio/WalletFundingTrace';
import {
  applyTokenVisibility,
  autoHiddenForReview,
} from '@/lib/portfolio/tokenVisibility';
import type { ChainId, LpUnderlying, PortfolioToken, PortfolioWallet } from '@/services';
import { fmtUsd, fmtAmount, fmtPrice, fmtPct, pctClass } from '@/lib/format';

// Real chain marks. Used as the small badge on token icons (DeBank / Zapper /
// Zerion convention) and as the wallet-header chain-filter toggles — full
// colour when that chain is active, greyscale when it isn't. Assets in public/.
const CHAIN_LOGO: Record<ChainId, string> = {
  ethereum: '/ethlogo.svg',
  pulsechain: '/LogoVector.svg',
};

const CHAIN_NAME: Record<ChainId, string> = {
  ethereum: 'Ethereum',
  pulsechain: 'PulseChain',
};

const truncate = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

// Token names are clamped to 15 characters (then ellipsised) so a long name
// can't blow out the row layout.
const clampName = (n: string | null | undefined) =>
  n && n.length > 15 ? `${n.slice(0, 15)}…` : n;

type SortKey = 'symbol' | 'balance' | 'change' | 'price' | 'value';
type SortDir = 'asc' | 'desc';

// Wallet contents are grouped into labeled sections. Only categories that
// actually hold something render a header — empty ones (e.g. Staked/Farm,
// which have no detector yet) are omitted entirely. Adding a category later
// is: extend the union, add a CATEGORY_ORDER row, and teach categorize() the
// signal — the section then appears on its own.
type WalletCategory = 'tokens' | 'lp' | 'staked' | 'farm';

const CATEGORY_ORDER: { key: WalletCategory; label: string; accent: string }[] = [
  { key: 'tokens', label: 'Tokens', accent: 'rgba(255,255,255,0.6)' },
  { key: 'lp', label: 'LP', accent: '#67e8f9' }, // cyan-300, matches LP rows
  { key: 'staked', label: 'Staked', accent: '#c4b5fd' }, // violet-300
  { key: 'farm', label: 'Farm', accent: '#86efac' }, // green-300
];

function categorize(t: PortfolioToken): WalletCategory {
  if (t.isLp) return 'lp';
  // Staked / farm positions aren't detected yet. When a detector lands,
  // branch here (e.g. `if (t.isStaked) return 'staked'`) and the matching
  // section starts rendering automatically.
  return 'tokens';
}

interface Props {
  wallet: PortfolioWallet;
}

export function WalletCard({ wallet }: Props) {
  const { snapshot, tokens, totalUsd, isLoading, error, refresh } = usePortfolio(wallet.address);
  const removeWallet = usePortfolioStore((s) => s.removeWallet);

  const [expanded, setExpanded] = useState(true);
  const [view, setView] = useState<'tokens' | 'activity' | 'connections' | 'funding'>('tokens');
  const [connView, setConnView] = useState<'list' | 'graph'>('list');
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [activeChains, setActiveChains] = useState<Set<ChainId>>(
    () => new Set(wallet.chains),
  );
  const [copied, setCopied] = useState(false);
  const openInsights = useInsightsStore((s) => s.openInsights);

  const tokenSettings = usePortfolioStore(
    (s) => s.walletTokenSettings[wallet.address.toLowerCase()],
  );
  const openManageTokens = useManageTokensStore((s) => s.openForWallet);

  const effectiveSettings = tokenSettings ?? {
    hidden: [],
    forced: [],
    hideDust: true,
    dustThresholdUsd: 1,
    seenInitialReview: false,
  };

  // First filter to active chains, then apply per-wallet visibility (manual
  // hidden/forced + dust + spam heuristic). The Manage Tokens modal sees the
  // full pre-visibility list so users can un-hide things.
  const chainFiltered = useMemo(
    () => tokens.filter((t) => activeChains.has(t.chain)),
    [tokens, activeChains],
  );

  const visibility = useMemo(
    () => applyTokenVisibility(chainFiltered, effectiveSettings),
    [chainFiltered, effectiveSettings],
  );
  const filteredTokens = visibility.visible;
  const hiddenForChain = visibility.hidden;

  // "Tokens hidden by default that the user hasn't reviewed yet" — drives
  // the call-to-review banner when a freshly added wallet auto-hides spam.
  const pendingReview = useMemo(
    () => autoHiddenForReview(chainFiltered, effectiveSettings),
    [chainFiltered, effectiveSettings],
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
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 p-4 border-b border-[var(--line)]">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-2 text-[var(--text)]"
          aria-expanded={expanded}
        >
          <IconChevronDown
            className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
          <span className="font-semibold">
            {wallet.label || truncate(wallet.address)}
          </span>
        </button>

        {wallet.label && (
          <span className="text-xs text-[var(--text-faint)] font-mono">{truncate(wallet.address)}</span>
        )}

        <button
          type="button"
          onClick={copyAddress}
          className="text-[var(--text-faint)] hover:text-[var(--text)]"
          title="Copy address"
        >
          <IconCopy className="h-4 w-4" />
        </button>
        {copied && <span className="text-xs text-[var(--up)]">Copied</span>}

        <div className="flex items-center gap-1">
          {wallet.chains.map((c) => {
            const active = activeChains.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleChainFilter(c)}
                aria-pressed={active}
                title={active ? `Hide ${CHAIN_NAME[c]} tokens` : `Show ${CHAIN_NAME[c]} tokens`}
                className={`flex items-center justify-center h-7 w-7 rounded-md border transition-all ${
                  active
                    ? 'border-[var(--line)] bg-[var(--surface)]'
                    : 'border-transparent opacity-60 grayscale hover:opacity-90'
                }`}
              >
                <img
                  src={CHAIN_LOGO[c]}
                  alt={CHAIN_NAME[c]}
                  className="h-4 w-4 object-contain"
                />
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-[var(--text-faint)] uppercase tracking-wide">Total</div>
            <div className="text-lg font-semibold text-[var(--text)] tabular-nums">
              {fmtUsd(filteredTotalUsd)}
            </div>
            {totalsDiffer && (
              <div
                className="text-[10px] uppercase tracking-wide tabular-nums"
                style={{ color: 'rgba(255, 255, 255, 0.4)' }}
              >
                of {fmtUsd(totalUsd)}
              </div>
            )}
          </div>
          <a
            href={`https://revoke.cash/address/${wallet.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-muted)] hover:text-amber-300"
            title="Check & revoke token approvals on revoke.cash"
            aria-label="Revoke approvals on revoke.cash"
          >
            <IconShieldHalf className="h-5 w-5" />
          </a>
          <button
            type="button"
            onClick={() => openManageTokens(wallet.address)}
            className="text-[var(--text-muted)] hover:text-[var(--text)] relative"
            title={
              hiddenForChain.length > 0
                ? `Manage tokens (${hiddenForChain.length} hidden)`
                : 'Manage tokens'
            }
            aria-label="Manage tokens"
          >
            <IconAdjustmentsHorizontal className="h-5 w-5" />
            {hiddenForChain.length > 0 && (
              <span
                className="absolute -top-1 -right-1 text-[9px] font-bold rounded-full px-1 leading-none py-0.5 min-w-[16px] text-center"
                style={{
                  backgroundColor: 'rgba(168, 85, 247, 0.85)',
                  color: '#fff',
                }}
              >
                {hiddenForChain.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading}
            className="text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40"
            title="Refresh"
          >
            <IconRefresh
              className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
          <MoveToGroupMenu address={wallet.address} />
          <button
            type="button"
            onClick={() => removeWallet(wallet.address)}
            className="text-[var(--text-faint)] hover:text-red-400"
            title="Remove wallet"
          >
            <IconTrash className="h-5 w-5" />
          </button>
        </div>
      </header>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* Tokens | Activity switch — Activity is the DeBank-style decoded
              transaction history; Tokens is the holdings table + approvals. */}
          <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
            <button
              type="button"
              onClick={() => setView('tokens')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                view === 'tokens' ? 'bg-[var(--surface)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Tokens
            </button>
            <button
              type="button"
              onClick={() => setView('activity')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                view === 'activity' ? 'bg-[var(--surface)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Activity
            </button>
            <button
              type="button"
              onClick={() => setView('connections')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                view === 'connections' ? 'bg-[var(--surface)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Connections
            </button>
            <button
              type="button"
              onClick={() => setView('funding')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                view === 'funding' ? 'bg-[var(--surface)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Funding
            </button>
          </div>

          {view === 'activity' ? (
            <ActivityFeed walletAddress={wallet.address} chains={wallet.chains} />
          ) : view === 'connections' ? (
            <div className="space-y-3">
              <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
                <button
                  type="button"
                  onClick={() => setConnView('list')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    connView === 'list' ? 'bg-[var(--surface)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setConnView('graph')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    connView === 'graph' ? 'bg-[var(--surface)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  Graph
                </button>
              </div>
              {connView === 'graph' ? (
                <WalletGraph walletAddress={wallet.address} chains={wallet.chains} />
              ) : (
                <>
                  <WalletConnections walletAddress={wallet.address} chains={wallet.chains} />
                  <WalletRelated walletAddress={wallet.address} chains={wallet.chains} />
                </>
              )}
            </div>
          ) : view === 'funding' ? (
            <WalletFundingTrace
              address={wallet.address}
              chain={wallet.chains.includes('pulsechain') ? 'pulsechain' : wallet.chains[0]}
            />
          ) : (
            <>
              {/* First-load: tell the user we auto-hid some tokens, give them a
                  one-click path to review. Once they open the modal we mark it
                  "seen" and stop showing this banner for this wallet. */}
              {!effectiveSettings.seenInitialReview && pendingReview.length > 0 && (
                <button
                  type="button"
                  onClick={() => openManageTokens(wallet.address)}
                  className="w-full rounded-lg border border-purple-400/40 bg-purple-500/10 px-3 py-2 text-xs text-purple-100 hover:bg-purple-500/15 transition-colors text-left flex items-center gap-2"
                >
                  <IconAdjustmentsHorizontal className="h-4 w-4 text-purple-300 shrink-0" />
                  <span>
                    Detected{' '}
                    <span className="font-semibold">
                      {pendingReview.length} token{pendingReview.length === 1 ? '' : 's'}
                    </span>{' '}
                    hidden by default (dust or likely spam).{' '}
                    <span className="underline">Review</span>
                  </span>
                </button>
              )}

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
                <div className="text-sm text-[var(--text-faint)] text-center py-8">
                  {snapshot
                    ? 'No tokens found at this address.'
                    : 'Tap refresh to load this wallet.'}
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="text-sm text-[var(--text-faint)] text-center py-8">
                  No tokens visible — toggle a chain badge above to show them.
                </div>
              ) : (
                <TokenTable
                  tokens={sortedTokens}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  onOpenInsights={openInsights}
                />
              )}
              <ApprovalsPanel
                walletAddress={wallet.address}
                chains={wallet.chains}
              />
            </>
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
          className="h-10 rounded bg-[var(--surface)] animate-pulse"
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
  onOpenInsights,
}: {
  tokens: PortfolioToken[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  onOpenInsights: (t: PortfolioToken) => void;
}) {
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

  // Partition the (already sorted) tokens into wallet categories, preserving
  // the sort order within each. Only non-empty categories become sections,
  // so a wallet holding just plain tokens shows a single "Tokens" header and
  // nothing for LP/Staked/Farm.
  const grouped: Record<WalletCategory, PortfolioToken[]> = {
    tokens: [],
    lp: [],
    staked: [],
    farm: [],
  };
  for (const t of tokens) grouped[categorize(t)].push(t);
  const sections = CATEGORY_ORDER.map((c) => ({
    ...c,
    items: grouped[c.key],
  })).filter((s) => s.items.length > 0);

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-faint)] border-b border-[var(--line)]">
            <th className="font-semibold px-2 py-2 w-8 text-right">#</th>
            <th className="font-semibold px-2 py-2">{header('symbol', 'Token', 'left')}</th>
            <th className="font-semibold px-2 py-2 text-right">{header('balance', 'Balance', 'right')}</th>
            <th className="font-semibold px-2 py-2 text-right">{header('change', '24h', 'right')}</th>
            <th className="font-semibold px-2 py-2 text-right">{header('price', 'Price', 'right')}</th>
            <th className="font-semibold px-2 py-2 text-right">{header('value', 'Value', 'right')}</th>
          </tr>
        </thead>
        <tbody>
          {sections.flatMap((section, si) => {
            const total = section.items.reduce(
              (sum, t) => sum + (t.valueUsd ?? 0),
              0,
            );
            return [
              <SectionHeaderRow
                key={`hdr:${section.key}`}
                label={section.label}
                accent={section.accent}
                count={section.items.length}
                total={total}
                isFirst={si === 0}
              />,
              ...renderTokenRows(section.items, onOpenInsights),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

// Renders the <tr> rows for one category's tokens (plus any LP underlying and
// pool-meta rows). Row numbering restarts per section. Kept as a free
// function so every section reuses identical row markup.
function renderTokenRows(
  tokens: PortfolioToken[],
  onOpenInsights: (t: PortfolioToken) => void,
): React.ReactNode[] {
  return tokens.flatMap((t, i) => {
    const key = `${t.chain}:${t.address}`;
    const rows: React.ReactNode[] = [
      <tr
        key={key}
        className="border-b border-[var(--line-soft)] hover:bg-[var(--surface)] transition-colors"
      >
        <td className="px-2 py-2 text-[var(--text-faint)] tabular-nums text-right">{i + 1}</td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <TokenIcon token={t} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--text)] truncate">{t.symbol}</span>
                {t.isLp && (
                  <span className="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-200 border border-cyan-500/40">
                    LP
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onOpenInsights(t)}
                  aria-label={`Open insights for ${t.symbol}`}
                  title={`Insights — ${t.symbol}`}
                  className="ml-auto inline-flex items-center justify-center h-6 w-6 rounded-md text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <IconChartHistogram className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-xs text-[var(--text-faint)] truncate">{clampName(t.name)}</div>
            </div>
          </div>
        </td>
        <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums">
          {fmtAmount(t.balanceFormatted)}
        </td>
        <td className="px-2 py-2 text-right tabular-nums">
          {(() => {
            const v = t.priceChange24h;
            if (v == null || !Number.isFinite(v)) return <span className="text-[var(--text-faint)]">—</span>;
            return <span className={pctClass(v)}>{fmtPct(v)}</span>;
          })()}
        </td>
        <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums">
          {t.priceUsd != null ? fmtPrice(t.priceUsd) : <span className="text-[var(--text-faint)]">—</span>}
        </td>
        <td className="px-2 py-2 text-right text-[var(--text)] font-semibold tabular-nums">
          {t.valueUsd != null ? fmtUsd(t.valueUsd) : <span className="text-[var(--text-faint)]">—</span>}
        </td>
      </tr>,
    ];

    if (t.isLp && t.lp) {
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
          <tr key={`${key}:meta`} className="border-b border-[var(--line-soft)] bg-cyan-500/5">
            <td />
            <td colSpan={5} className="px-2 py-1.5 text-[11px] text-cyan-200/80">
              Pool TVL{' '}
              <span className="font-semibold">
                {fmtUsd(t.lp.totalLiquidityUsd)}
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
  });
}

// One labeled divider row between category groups. Spans the full table
// width; the rule fills the gap between the accent-colored label (with item
// count) and the section's summed USD value.
function SectionHeaderRow({
  label,
  accent,
  count,
  total,
  isFirst,
}: {
  label: string;
  accent: string;
  count: number;
  total: number;
  isFirst: boolean;
}) {
  return (
    <tr>
      <td colSpan={6} className={`px-2 pb-1.5 ${isFirst ? 'pt-1' : 'pt-5'}`}>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] uppercase tracking-wider font-bold"
            style={{ color: accent }}
          >
            {label}
          </span>
          <span className="text-[10px] font-semibold text-[var(--text-faint)] tabular-nums">
            {count}
          </span>
          <div className="flex-1 h-px bg-[var(--surface-2)]" />
          <span className="text-[11px] tabular-nums text-[var(--text-faint)]">
            {fmtUsd(total)}
          </span>
        </div>
      </td>
    </tr>
  );
}

function LpSideRow({ side, chain }: { side: LpUnderlying; chain: ChainId }) {
  return (
    <tr className="border-b border-[var(--line-soft)] bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors">
      <td />
      <td className="px-2 py-2 pl-6">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-cyan-300/70 text-xs">↳</div>
          <SideIcon side={side} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-[var(--text)] truncate">{side.symbol}</span>
              <span
                className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/50"
                style={{ color: '#cffafe' }}
              >
                {side.weightPct.toFixed(1)}%
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-faint)] truncate">{clampName(side.name)}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2 text-right text-[var(--text-muted)] tabular-nums">
        {fmtAmount(side.amountFormatted)}
      </td>
      <td className="px-2 py-2 text-right text-[var(--text-faint)]">—</td>
      <td className="px-2 py-2 text-right text-[var(--text-muted)] tabular-nums">
        {side.priceUsd != null ? fmtPrice(side.priceUsd) : <span className="text-[var(--text-faint)]">—</span>}
      </td>
      <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums">
        {side.valueUsd != null ? fmtUsd(side.valueUsd) : <span className="text-[var(--text-faint)]">—</span>}
      </td>
    </tr>
  );
}

function SideIcon({ side }: { side: LpUnderlying }) {
  return (
    <div className="w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center overflow-hidden shrink-0">
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
        <span className="text-[9px] text-[var(--text)] font-semibold">
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
      className={`inline-flex items-center gap-0.5 hover:text-[var(--text)] transition-colors ${
        active ? 'text-[var(--text)]' : 'text-[var(--text-faint)]'
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
    <div className="relative w-8 h-8 shrink-0">
      <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center overflow-hidden">
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
          <span className="text-[10px] text-[var(--text-muted)] font-semibold">
            {token.symbol.slice(0, 3).toUpperCase()}
          </span>
        )}
      </div>
      <ChainBadge chain={token.chain} />
    </div>
  );
}

// Small chain mark overhanging the token icon's bottom-right corner. The
// ring matches the card background so the badge reads as a separate chip;
// PulseChain's pink mark sits on dark, Ethereum's diamond on white.
function ChainBadge({ chain }: { chain: ChainId }) {
  const isEth = chain === 'ethereum';
  return (
    <span
      title={CHAIN_NAME[chain]}
      className={`absolute -bottom-[3px] -right-[3px] h-3.5 w-3.5 rounded-full overflow-hidden flex items-center justify-center ring-2 ring-[#0e2747] ${
        isEth ? 'bg-white' : 'bg-[var(--surface-2)]'
      }`}
    >
      <img
        src={CHAIN_LOGO[chain]}
        alt={CHAIN_NAME[chain]}
        className="h-full w-full object-contain p-[1px]"
      />
    </span>
  );
}
