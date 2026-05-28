'use client';

import { useEffect, useRef, useState } from 'react';
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
  IconShield,
  IconShieldCheck,
  IconShieldX,
  IconRobot,
  IconCircleCheck,
  IconCircleX,
  IconCircleMinus,
} from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { useOutsideClick } from '@/hooks/use-outside-click';
import { useInsightsStore } from '@/lib/stores/insightsStore';
import type { ChainId, PortfolioToken } from '@/services';
import type { ContractAuditResult } from '@/types';

// TokenAIChat is heavy (pulls the whole geicko chat stack). Lazy-load
// only when the user opens the AI tab.
const TokenAIChat = dynamic(() => import('@/components/TokenAIChat'), {
  ssr: false,
  loading: () => (
    <div className="text-center py-8 text-sm text-white/60">
      Loading AI assistant…
    </div>
  ),
});

const CHAIN_LABEL: Record<ChainId, string> = {
  ethereum: 'ETH',
  pulsechain: 'PLS',
};

const fmtUsd = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n) || n === 0) return null;
  if (Math.abs(n) >= 1000) {
    return `$${n.toLocaleString(undefined, {
      notation: 'compact',
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 0.01 ? 6 : 2,
  })}`;
};

const fmtCompact = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n) || n === 0) return null;
  return n.toLocaleString(undefined, {
    notation: 'compact',
    maximumFractionDigits: 2,
  });
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

interface AuditSummary {
  supported: boolean;
  reason?: string;
  contractName: string | null;
  isVerified: boolean | null;
  result: ContractAuditResult | null;
}

type TabId = 'overview' | 'liquidity' | 'audit' | 'chat';

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
// prop-drilling, and the overlay doesn't sit inside a backdrop-blur
// containing block.
export function TokenInsightsCard() {
  const token = useInsightsStore((s) => s.activeToken);
  const onClose = useInsightsStore((s) => s.closeInsights);
  const ref = useRef<HTMLDivElement>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabId>('overview');
  const [audit, setAudit] = useState<AuditSummary | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  useOutsideClick(ref, () => {
    if (token) onClose();
  });

  // Reset tab + lazy data caches when the open token changes.
  useEffect(() => {
    setTab('overview');
    setAudit(null);
  }, [token?.address, token?.chain]);

  // Lazy-fetch audit only when the user opens the Audit tab.
  useEffect(() => {
    if (!token || tab !== 'audit' || audit) return;
    let cancelled = false;
    setAuditLoading(true);
    fetch('/api/portfolio/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: token.address, chain: token.chain }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setAudit((d?.audit as AuditSummary) ?? null);
        setAuditLoading(false);
      })
      .catch(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, tab, audit]);

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

  return (
    <AnimatePresence>
      {token && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[90]"
          />
          <div className="fixed inset-0 z-[100] grid place-items-center p-4 pointer-events-none">
            <motion.div
              ref={ref}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0F1A2E] shadow-2xl pointer-events-auto"
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
                audit={audit}
                auditLoading={auditLoading}
              />
              <CardFooter token={token} />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
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
        className="absolute top-3 right-3 z-10 h-8 w-8 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Close insights"
        title="Close (Esc)"
      >
        <IconX className="h-4 w-4" />
      </button>

      <div className={`px-6 ${headerImg ? '-mt-12 relative' : 'pt-6'}`}>
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-white/10 border border-white/20 overflow-hidden grid place-items-center shrink-0">
            {iconImg ? (
              <img
                src={iconImg}
                alt={token.symbol}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white/70 font-semibold text-sm">
                {token.symbol.slice(0, 3).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-2xl font-bold text-white truncate">
                {token.symbol}
              </h2>
              <span
                className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded border"
                style={{
                  backgroundColor:
                    token.chain === 'ethereum'
                      ? 'rgba(99, 102, 241, 0.2)'
                      : 'rgba(217, 70, 239, 0.2)',
                  borderColor:
                    token.chain === 'ethereum'
                      ? 'rgba(99, 102, 241, 0.5)'
                      : 'rgba(217, 70, 239, 0.5)',
                  color: '#fff',
                }}
              >
                {CHAIN_LABEL[token.chain]}
              </span>
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
            <div className="text-white/60 text-sm truncate">{token.name}</div>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-xl font-semibold text-white tabular-nums">
                {token.priceUsd != null
                  ? fmtUsd(token.priceUsd) ?? '—'
                  : <span className="text-white/30">—</span>}
              </span>
              {token.priceChange24h != null && (
                <span
                  className={
                    'text-sm font-semibold tabular-nums ' +
                    ((token.priceChange24h ?? 0) >= 0
                      ? 'text-green-400'
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
    { id: 'liquidity', label: 'Liquidity', Icon: IconChartCandle },
    { id: 'audit', label: 'Audit', Icon: IconShieldCheck },
    { id: 'chat', label: 'AI Chat', Icon: IconRobot },
  ];
  return (
    <div className="flex items-center gap-1 px-4 pt-3 border-b border-white/10">
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
  audit,
  auditLoading,
}: {
  token: PortfolioToken;
  insights: Insights | null;
  loading: boolean;
  tab: TabId;
  audit: AuditSummary | null;
  auditLoading: boolean;
}) {
  return (
    <div className="px-6 py-5 min-h-[200px]">
      {tab === 'overview' && (
        <OverviewTab token={token} insights={insights} loading={loading} />
      )}
      {tab === 'liquidity' && (
        <LiquidityTab insights={insights} loading={loading} />
      )}
      {tab === 'audit' && (
        <AuditTab
          token={token}
          audit={audit}
          loading={auditLoading}
        />
      )}
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
        <p className="text-sm leading-relaxed text-white/75 line-clamp-5">
          {insights.description}
        </p>
      )}
      <StatsGrid token={token} insights={insights} loading={loading} />
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
            className="h-14 rounded-lg bg-white/5 animate-pulse"
          />
        ))}
      </div>
    );
  }
  const pairs = insights?.topPairs ?? [];
  if (pairs.length === 0) {
    return (
      <div className="text-sm text-white/50 text-center py-8">
        No DEX pools indexed for this token on DexScreener.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-white/40 mb-1">
        Top pools by liquidity
      </div>
      {pairs.map((p, i) => (
        <a
          key={p.pairAddress}
          href={p.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] px-3 py-2.5 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-white/40 text-xs tabular-nums w-4 text-right">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white">
                  {p.baseSymbol}
                </span>
                <span className="text-white/40 text-xs">/</span>
                <span className="text-sm font-semibold text-white/80">
                  {p.quoteSymbol}
                </span>
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 capitalize">
                  {p.dexId}
                </span>
              </div>
              <div className="text-[11px] text-white/50 mt-0.5 tabular-nums">
                Vol 24h{' '}
                <span className="text-white/70 font-semibold">
                  {fmtUsd(p.volume24h) ?? '—'}
                </span>
                {' · '}Txns{' '}
                <span className="text-white/70 font-semibold">
                  {p.txns24h != null ? p.txns24h.toLocaleString() : '—'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold text-white tabular-nums">
              {fmtUsd(p.liquidityUsd) ?? '—'}
            </div>
            {p.priceChange24h != null && (
              <div
                className={
                  'text-[11px] font-semibold tabular-nums ' +
                  (p.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400')
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

function AuditTab({
  token,
  audit,
  loading,
}: {
  token: PortfolioToken;
  audit: AuditSummary | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-lg bg-white/5 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="text-sm text-white/50 text-center py-8">
        Audit data unavailable.
      </div>
    );
  }

  if (!audit.supported) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        <div className="flex items-start gap-3">
          <IconShieldX className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-white">
              Audit not yet supported on this chain
            </div>
            <div className="mt-1 text-white/60 text-xs">
              {audit.reason || 'Try the full analyzer for a manual review.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!audit.result) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        <div className="flex items-start gap-3">
          <IconAlertTriangle className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-white">
              {audit.reason || 'Audit unavailable'}
            </div>
            {audit.contractName && (
              <div className="mt-1 text-white/60 text-xs">
                Contract: {audit.contractName}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const r = audit.result;
  // Each flag: "good" outcome should be GREEN (e.g. ownership renounced =
  // good). "Risk" outcomes are RED. Some are neutral until proven bad.
  const flags: Array<{
    label: string;
    good: boolean | null;
    note?: string;
  }> = [
    { label: 'Source verified', good: audit.isVerified ?? null },
    { label: 'Ownership renounced', good: r.ownershipRenounced },
    { label: 'Hidden owner', good: r.hiddenOwner === false ? true : r.hiddenOwner === true ? false : null },
    { label: 'Honeypot', good: r.honeypot === false ? true : false },
    { label: 'Proxy contract', good: r.proxyContract === false ? true : false },
    { label: 'Mintable', good: r.mintable === false ? true : false },
    { label: 'Transfer pausable', good: r.transferPausable === false ? true : false },
    { label: 'Trading cooldown', good: r.tradingCooldown === false ? true : false },
    { label: 'Has blacklist', good: r.hasBlacklist === false ? true : false },
    { label: 'Has whitelist', good: r.hasWhitelist === false ? true : false },
    { label: 'Buy tax', good: r.buyTax === false ? true : false },
    { label: 'Sell tax', good: r.sellTax === false ? true : false },
  ];

  return (
    <div className="space-y-4">
      {audit.contractName && (
        <div className="text-xs text-white/50">
          Contract:{' '}
          <span className="text-white/80 font-semibold">{audit.contractName}</span>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {flags.map((f) => (
          <FlagPill key={f.label} label={f.label} good={f.good} />
        ))}
      </div>
      {r.hasSuspiciousFunctions && r.suspiciousFunctions.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 text-amber-200 font-semibold text-sm">
            <IconAlertTriangle className="h-4 w-4" />
            Suspicious functions detected
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.suspiciousFunctions.slice(0, 12).map((fn) => (
              <code
                key={fn}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-100 border border-amber-500/40"
              >
                {fn}
              </code>
            ))}
            {r.suspiciousFunctions.length > 12 && (
              <span className="text-[11px] text-amber-200/70">
                +{r.suspiciousFunctions.length - 12} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FlagPill({
  label,
  good,
}: {
  label: string;
  good: boolean | null;
}) {
  const Icon =
    good === true ? IconCircleCheck : good === false ? IconCircleX : IconCircleMinus;
  const color =
    good === true
      ? 'rgba(34, 197, 94, 0.9)'
      : good === false
        ? 'rgba(239, 68, 68, 0.9)'
        : 'rgba(255, 255, 255, 0.35)';
  const bg =
    good === true
      ? 'rgba(34, 197, 94, 0.08)'
      : good === false
        ? 'rgba(239, 68, 68, 0.08)'
        : 'rgba(255, 255, 255, 0.04)';
  const border =
    good === true
      ? 'rgba(34, 197, 94, 0.3)'
      : good === false
        ? 'rgba(239, 68, 68, 0.3)'
        : 'rgba(255, 255, 255, 0.1)';
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-2.5 py-2"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}
    >
      <Icon className="h-4 w-4 shrink-0" style={{ color }} />
      <span className="text-xs font-medium text-white truncate">{label}</span>
    </div>
  );
}

function ChatTab({ token }: { token: PortfolioToken }) {
  // TokenAIChat already does its own fetching for contract + token info +
  // dex data given a contractAddress. The PulseChain version is what we
  // mostly have data for; on Ethereum it'll degrade to general questions.
  return (
    <div className="h-[420px] -mx-2 rounded-lg overflow-hidden border border-white/10 bg-black/30">
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
      value:
        token.balanceFormatted.toLocaleString(undefined, {
          maximumFractionDigits: token.balanceFormatted < 1 ? 6 : 4,
        }) + ' ' + token.symbol,
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
      value: fmtCompact(insights?.totalSupply ?? null),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
        >
          <div className="text-[10px] uppercase tracking-wide font-semibold text-white/40">
            {cell.label}
          </div>
          <div className="text-sm font-semibold text-white tabular-nums mt-0.5">
            {loading && cell.value == null ? (
              <span className="inline-block h-3 w-16 rounded bg-white/10 animate-pulse" />
            ) : (
              cell.value ?? <span className="text-white/30">—</span>
            )}
          </div>
        </div>
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
            className="h-8 w-20 rounded-full bg-white/5 animate-pulse"
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 hover:text-white transition-colors"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 hover:text-white transition-colors capitalize"
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
        className="block w-full text-center px-4 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
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
