'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  IconX,
  IconBrandTwitter,
  IconBrandTelegram,
  IconBrandDiscord,
  IconBrandReddit,
  IconBrandGithub,
  IconWorld,
  IconExternalLink,
  IconAlertTriangle,
  IconChartCandle,
  IconChartLine,
  IconShield,
  IconRobot,
  IconArrowsExchange,
  IconChartBubble,
} from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { useOutsideClick } from '@/hooks/use-outside-click';
import { useInsightsStore } from '@/lib/stores/insightsStore';
import type { ChainId, PortfolioToken } from '@/services';
import { WRAPPED_NATIVE } from '@/services';
import { pulsechainTokenUrl } from '@/lib/pulsechainExplorer';
import { fmtUsd, fmtPrice, fmtAmount, fmtNum } from '@/lib/format';

// TokenAIChat is heavy (pulls the whole geicko chat stack). Lazy-load
// only when the user opens the AI tab.
const TokenAIChat = dynamic(() => import('@/components/TokenAIChat'), {
  ssr: false,
  loading: () => (
    <div className="text-center py-8 text-sm text-[var(--text-muted)]">
      Loading AI assistant…
    </div>
  ),
});

// The native candle chart pulls in lightweight-charts — lazy-load it only
// when the Chart tab is opened.
const CandleChart = dynamic(() => import('@/components/portfolio/CandleChart'), {
  ssr: false,
  loading: () => <div className="h-[460px] rounded-lg bg-[var(--surface)] animate-pulse" />,
});

// Holder bubble map pulls in a canvas force-sim — lazy-load with the tab.
const BubbleMap = dynamic(() => import('@/components/portfolio/BubbleMap'), {
  ssr: false,
  loading: () => <div className="h-[520px] rounded-lg bg-[var(--surface)] animate-pulse" />,
});

// Chain marks overlaid as a small logo badge on the token icon (matches
// WalletCard / WatchlistPanel) instead of a text pill. Assets live in public/.
const CHAIN_LOGO: Record<ChainId, string> = {
  ethereum: '/ethlogo.svg',
  pulsechain: '/LogoVector.svg',
};

const CHAIN_NAME: Record<ChainId, string> = {
  ethereum: 'Ethereum',
  pulsechain: 'PulseChain',
};

interface Social {
  type: string;
  url: string;
}

interface Website {
  label: string;
  url: string;
}

interface PairSummary {
  pairAddress: string;
  dexId: string;
  url: string;
  baseSymbol: string;
  quoteSymbol: string;
  liquidityUsd: number | null;
  volume24h: number | null;
  txns24h: number | null;
  priceUsd: number | null;
  priceChange24h: number | null;
  fdv: number | null;
}

interface Insights {
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
  topPairs: PairSummary[];
  creatorAddress: string | null;
  isPumpTires: boolean;
  ownershipRenounced: boolean | null;
}

type TabId = 'overview' | 'chart' | 'liquidity' | 'bubblemap' | 'chat';

const SOCIAL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  twitter: IconBrandTwitter,
  x: IconBrandTwitter,
  telegram: IconBrandTelegram,
  discord: IconBrandDiscord,
  reddit: IconBrandReddit,
  github: IconBrandGithub,
};

// Rendered once at the portfolio page level. Reads its open/close state
// from the insightsStore so any WalletCard row can trigger it without
// prop-drilling. Portals to document.body so the fixed overlay can't be
// trapped or clipped by an ancestor's containing block (e.g. a WalletCard's
// backdrop-blur-xl + overflow-hidden).
export function TokenInsightsCard() {
  const token = useInsightsStore((s) => s.activeToken);
  const onClose = useInsightsStore((s) => s.closeInsights);
  const ref = useRef<HTMLDivElement>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabId>('overview');

  useOutsideClick(ref, () => {
    if (token) onClose();
  });

  // Reset tab when the open token changes.
  useEffect(() => {
    setTab('overview');
  }, [token?.address, token?.chain]);

  useEffect(() => {
    if (!token) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', onKey);
    };
  }, [token, onClose]);

  useEffect(() => {
    if (!token) {
      setInsights(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch('/api/portfolio/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: token.address, chain: token.chain }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setInsights(d?.insights ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {token && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--app-bg)] backdrop-blur-sm z-[90]"
          />
          <div className="fixed inset-0 z-[100] grid place-items-center p-4 pointer-events-none">
            <motion.div
              ref={ref}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--app-bg)] shadow-2xl pointer-events-auto"
              style={{
                boxShadow:
                  '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(168, 85, 247, 0.12) inset',
              }}
            >
              <CardHeader
                token={token}
                insights={insights}
                onClose={onClose}
              />
              <TabBar active={tab} onChange={setTab} chain={token.chain} />
              <CardBody
                token={token}
                insights={insights}
                loading={loading}
                tab={tab}
              />
              <CardFooter token={token} />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function CardHeader({
  token,
  insights,
  onClose,
}: {
  token: PortfolioToken;
  insights: Insights | null;
  onClose: () => void;
}) {
  const headerImg = insights?.headerImageUrl;
  const iconImg = insights?.iconImageUrl || token.logoURI;

  return (
    <div className="relative">
      {headerImg && (
        <div className="h-32 w-full overflow-hidden">
          <img
            src={headerImg}
            alt=""
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0F1A2E]/30 to-[#0F1A2E]" />
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 z-10 h-8 w-8 grid place-items-center rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)]"
        aria-label="Close insights"
        title="Close (Esc)"
      >
        <IconX className="h-4 w-4" />
      </button>

      <div className={`px-6 ${headerImg ? '-mt-12 relative' : 'pt-6'}`}>
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="h-16 w-16 rounded-2xl bg-[var(--surface-2)] border border-[var(--line-strong)] overflow-hidden grid place-items-center">
              {iconImg ? (
                <img
                  src={iconImg}
                  alt={token.symbol}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[var(--text-muted)] font-semibold text-sm">
                  {token.symbol.slice(0, 3).toUpperCase()}
                </span>
              )}
            </div>
            <span
              title={CHAIN_NAME[token.chain]}
              className={`absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full overflow-hidden flex items-center justify-center ring-2 ring-[#0F1A2E] ${
                token.chain === 'ethereum' ? 'bg-white' : 'bg-[var(--surface-2)]'
              }`}
            >
              <img
                src={CHAIN_LOGO[token.chain]}
                alt={CHAIN_NAME[token.chain]}
                className="h-full w-full object-contain p-0.5"
              />
            </span>
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-2xl font-bold text-[var(--text)] truncate">
                {token.symbol}
              </h2>
              {token.isNative && (
                <span
                  className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded border"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    borderColor: 'rgba(245, 158, 11, 0.6)',
                    color: '#fde68a',
                  }}
                >
                  Native
                </span>
              )}
              {insights?.isPumpTires && (
                <span
                  className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded border"
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    borderColor: 'rgba(34, 197, 94, 0.5)',
                    color: '#bbf7d0',
                  }}
                  title="Created via pump.tires — supply is fixed and ownership is renounced by default"
                >
                  Pump.tires
                </span>
              )}
              {insights?.ownershipRenounced === false && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded border"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderColor: 'rgba(239, 68, 68, 0.55)',
                    color: '#fecaca',
                  }}
                >
                  <IconAlertTriangle className="h-3 w-3" />
                  Owner active
                </span>
              )}
            </div>
            <div className="text-[var(--text-muted)] text-sm truncate">{token.name}</div>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-xl font-semibold text-[var(--text)] tabular-nums">
                {token.priceUsd != null
                  ? fmtPrice(token.priceUsd)
                  : <span className="text-[var(--text-faint)]">—</span>}
              </span>
              {token.priceChange24h != null && (
                <span
                  className={
                    'text-sm font-semibold tabular-nums ' +
                    ((token.priceChange24h ?? 0) >= 0
                      ? 'text-[var(--up)]'
                      : 'text-red-400')
                  }
                >
                  {(token.priceChange24h ?? 0) >= 0 ? '+' : ''}
                  {(token.priceChange24h ?? 0).toFixed(2)}% · 24h
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBar({
  active,
  onChange,
  chain,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  chain: ChainId;
}) {
  const tabs: { id: TabId; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', Icon: IconShield },
    { id: 'chart', label: 'Chart', Icon: IconChartLine },
    { id: 'liquidity', label: 'Liquidity', Icon: IconChartCandle },
    { id: 'bubblemap', label: 'Bubble Map', Icon: IconChartBubble },
    { id: 'chat', label: 'AI Chat', Icon: IconRobot },
  ];
  return (
    <div className="flex items-center gap-1 px-4 pt-3 border-b border-[var(--line)]">
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors"
            style={
              isActive
                ? {
                    borderColor: '#a855f7',
                    color: '#fff',
                  }
                : {
                    borderColor: 'transparent',
                    color: 'rgba(255, 255, 255, 0.5)',
                  }
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function CardBody({
  token,
  insights,
  loading,
  tab,
}: {
  token: PortfolioToken;
  insights: Insights | null;
  loading: boolean;
  tab: TabId;
}) {
  return (
    <div className="px-6 py-5 min-h-[200px]">
      {tab === 'overview' && (
        <OverviewTab token={token} insights={insights} loading={loading} />
      )}
      {tab === 'chart' && (
        <ChartTab token={token} insights={insights} />
      )}
      {tab === 'liquidity' && (
        <LiquidityTab insights={insights} loading={loading} />
      )}
      {tab === 'bubblemap' && <BubbleMapTab token={token} />}
      {tab === 'chat' && <ChatTab token={token} />}
    </div>
  );
}

function OverviewTab({
  token,
  insights,
  loading,
}: {
  token: PortfolioToken;
  insights: Insights | null;
  loading: boolean;
}) {
  return (
    <div className="space-y-5">
      {insights?.description && (
        <p className="text-sm leading-relaxed text-[var(--text-muted)] line-clamp-5">
          {insights.description}
        </p>
      )}
      <StatsGrid token={token} insights={insights} loading={loading} />
      <ActionsRow token={token} insights={insights} />
      <LinksRow insights={insights} loading={loading} />
    </div>
  );
}

function LiquidityTab({
  insights,
  loading,
}: {
  insights: Insights | null;
  loading: boolean;
}) {
  if (loading && !insights) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-14 rounded-lg bg-[var(--surface)] animate-pulse"
          />
        ))}
      </div>
    );
  }
  const pairs = insights?.topPairs ?? [];
  if (pairs.length === 0) {
    return (
      <div className="text-sm text-[var(--text-faint)] text-center py-8">
        No DEX pools indexed for this token on DexScreener.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-faint)] mb-1">
        Top pools by liquidity
      </div>
      {pairs.map((p, i) => (
        <a
          key={p.pairAddress}
          href={p.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface)] px-3 py-2.5 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--text-faint)] text-xs tabular-nums w-4 text-right">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">
                  {p.baseSymbol}
                </span>
                <span className="text-[var(--text-faint)] text-xs">/</span>
                <span className="text-sm font-semibold text-[var(--text)]">
                  {p.quoteSymbol}
                </span>
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--line)] text-[var(--text-muted)] capitalize">
                  {p.dexId}
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-faint)] mt-0.5 tabular-nums">
                Vol 24h{' '}
                <span className="text-[var(--text-muted)] font-semibold">
                  {fmtUsd(p.volume24h) ?? '—'}
                </span>
                {' · '}Txns{' '}
                <span className="text-[var(--text-muted)] font-semibold">
                  {fmtNum(p.txns24h)}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold text-[var(--text)] tabular-nums">
              {fmtUsd(p.liquidityUsd) ?? '—'}
            </div>
            {p.priceChange24h != null && (
              <div
                className={
                  'text-[11px] font-semibold tabular-nums ' +
                  (p.priceChange24h >= 0 ? 'text-[var(--up)]' : 'text-red-400')
                }
              >
                {p.priceChange24h >= 0 ? '+' : ''}
                {p.priceChange24h.toFixed(2)}%
              </div>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}

function ChartTab({
  token,
  insights,
}: {
  token: PortfolioToken;
  insights: Insights | null;
}) {
  // Native GeckoTerminal candles first; CandleChart auto-falls back to the
  // DexScreener embed (using this pair) when no native OHLC is available.
  const pairAddress = insights?.topPairs?.[0]?.pairAddress ?? null;
  return <CandleChart token={token} pairAddress={pairAddress} />;
}

function BubbleMapTab({ token }: { token: PortfolioToken }) {
  // Holders are an ERC-20 concept — native coins map to their wrapped contract.
  const addr = token.isNative ? WRAPPED_NATIVE[token.chain] : token.address;
  return (
    <div className="space-y-3">
      <BubbleMap token={addr} chain={token.chain} symbol={token.symbol} />
      {token.chain === 'ethereum' && (
        // Bubblemaps supports Ethereum (not PulseChain) — offer their richer map
        // as a free complement on the chains they cover.
        <a
          href={`https://v2.bubblemaps.io/map?address=${addr}&chain=eth`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--line)] text-xs text-[var(--text)] transition-colors"
        >
          <IconExternalLink className="h-3.5 w-3.5" />
          Open in Bubblemaps
        </a>
      )}
    </div>
  );
}

function ChatTab({ token }: { token: PortfolioToken }) {
  // TokenAIChat already does its own fetching for contract + token info +
  // dex data given a contractAddress. The PulseChain version is what we
  // mostly have data for; on Ethereum it'll degrade to general questions.
  return (
    <div className="h-[420px] -mx-2 rounded-lg overflow-hidden border border-[var(--line)] bg-[var(--surface-2)]">
      <TokenAIChat
        key={`${token.chain}:${token.address}`}
        contractAddress={token.address}
        compact
        className="h-full"
      />
    </div>
  );
}

function StatsGrid({
  token,
  insights,
  loading,
}: {
  token: PortfolioToken;
  insights: Insights | null;
  loading: boolean;
}) {
  const cells: Array<{ label: string; value: string | null }> = [
    {
      label: 'Your balance',
      value: fmtAmount(token.balanceFormatted) + ' ' + token.symbol,
    },
    {
      label: 'Your value',
      value: fmtUsd(token.valueUsd ?? null),
    },
    {
      label: 'Market cap',
      value: fmtUsd(insights?.marketCap ?? null),
    },
    {
      label: 'FDV',
      value: fmtUsd(insights?.fdv ?? null),
    },
    {
      label: 'Liquidity',
      value: fmtUsd(insights?.liquidityUsd ?? null),
    },
    {
      label: 'Total supply',
      value: fmtAmount(insights?.totalSupply ?? null),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
        >
          <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-faint)]">
            {cell.label}
          </div>
          <div className="text-sm font-semibold text-[var(--text)] tabular-nums mt-0.5">
            {loading && cell.value == null ? (
              <span className="inline-block h-3 w-16 rounded bg-[var(--surface-2)] animate-pulse" />
            ) : (
              cell.value ?? <span className="text-[var(--text-faint)]">—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Quick outbound actions for a token: chart, explorer, swap. Native coins use
// their wrapped equivalent so the links resolve to a real contract.
function ActionsRow({
  token,
  insights,
}: {
  token: PortfolioToken;
  insights: Insights | null;
}) {
  const addr = token.isNative ? WRAPPED_NATIVE[token.chain] : token.address;
  const chainSlug = token.chain === 'ethereum' ? 'ethereum' : 'pulsechain';
  const actions: Array<{
    label: string;
    href: string;
    Icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      label: 'DexScreener',
      href: insights?.primaryPairUrl ?? `https://dexscreener.com/${chainSlug}/${addr}`,
      Icon: IconChartLine,
    },
    {
      label: token.chain === 'ethereum' ? 'Etherscan' : 'Otterscan',
      href:
        token.chain === 'ethereum'
          ? `https://etherscan.io/token/${addr}`
          : pulsechainTokenUrl(addr),
      Icon: IconExternalLink,
    },
    {
      label: 'Swap',
      href:
        token.chain === 'ethereum'
          ? `https://app.uniswap.org/#/swap?outputCurrency=${addr}`
          : `https://app.pulsex.com/swap?outputCurrency=${addr}`,
      Icon: IconArrowsExchange,
    },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--line)] text-xs text-[var(--text)] hover:text-[var(--text)] transition-colors"
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </a>
      ))}
    </div>
  );
}

function LinksRow({
  insights,
  loading,
}: {
  insights: Insights | null;
  loading: boolean;
}) {
  if (loading && !insights) {
    return (
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-8 w-20 rounded-full bg-[var(--surface)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const hasSocials = (insights?.socials.length ?? 0) > 0;
  const hasWebsites = (insights?.websites.length ?? 0) > 0;
  if (!hasSocials && !hasWebsites) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {insights?.websites.map((w) => (
        <a
          key={`w-${w.url}`}
          href={w.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--line)] text-xs text-[var(--text)] hover:text-[var(--text)] transition-colors"
        >
          <IconWorld className="h-3.5 w-3.5" />
          {w.label}
        </a>
      ))}
      {insights?.socials.map((s) => {
        const Icon = SOCIAL_ICON[s.type.toLowerCase()] || IconExternalLink;
        return (
          <a
            key={`s-${s.url}`}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--line)] text-xs text-[var(--text)] hover:text-[var(--text)] transition-colors capitalize"
          >
            <Icon className="h-3.5 w-3.5" />
            {s.type === 'x' ? 'twitter' : s.type}
          </a>
        );
      })}
    </div>
  );
}

function CardFooter({ token }: { token: PortfolioToken }) {
  return (
    <div className="px-6 pb-6 pt-1">
      <Link
        href={`/geicko?address=${token.address}`}
        className="block w-full text-center px-4 py-3 rounded-xl text-sm font-semibold text-[var(--text)] transition-colors"
        style={{
          background:
            'linear-gradient(135deg, rgba(168, 85, 247, 0.85) 0%, rgba(126, 34, 206, 0.85) 100%)',
          boxShadow:
            '0 8px 24px rgba(126, 34, 206, 0.35), 0 0 0 1px rgba(192, 132, 252, 0.4) inset',
        }}
      >
        Open full analyzer in geicko →
      </Link>
    </div>
  );
}
