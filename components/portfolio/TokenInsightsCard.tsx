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
} from '@tabler/icons-react';
import { useOutsideClick } from '@/hooks/use-outside-click';
import { useInsightsStore } from '@/lib/stores/insightsStore';
import type { ChainId, PortfolioToken } from '@/services';

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
  creatorAddress: string | null;
  isPumpTires: boolean;
  ownershipRenounced: boolean | null;
}

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

  useOutsideClick(ref, () => {
    if (token) onClose();
  });

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
              <CardBody token={token} insights={insights} loading={loading} />
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

function CardBody({
  token,
  insights,
  loading,
}: {
  token: PortfolioToken;
  insights: Insights | null;
  loading: boolean;
}) {
  return (
    <div className="px-6 py-5 space-y-5">
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
