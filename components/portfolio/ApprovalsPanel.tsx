'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  IconShieldHalf,
  IconExternalLink,
  IconRefresh,
  IconInfoCircle,
} from '@tabler/icons-react';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';
import type { ChainId } from '@/services';
import { ChainLogo } from '@/components/ui/ChainLogo';
import { fmtNum } from '@/lib/format';

const CHAIN_ID_NUM: Record<ChainId, number> = {
  ethereum: 1,
  pulsechain: 369,
};

const CHAIN_PILL: Record<ChainId, CSSProperties> = {
  ethereum: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.5)',
    color: '#c7d2fe',
  },
  pulsechain: {
    backgroundColor: 'rgba(217, 70, 239, 0.15)',
    borderColor: 'rgba(217, 70, 239, 0.5)',
    color: '#f5d0fe',
  },
};

const CHAIN_LABEL: Record<ChainId, string> = {
  ethereum: 'ETH',
  pulsechain: 'PLS',
};

interface Approval {
  token: {
    address: string;
    symbol: string | null;
    name: string | null;
    logoURI: string | null;
  };
  spender: string;
  spenderName: string | null;
  amount: string;
  isUnlimited: boolean;
  updatedAt: number;
  txHash: string;
}

const truncate = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;

const fmtRelative = (ts: number) => {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

const fmtAmount = (raw: string, decimals: number) => {
  try {
    const big = BigInt(raw);
    if (big === 0n) return '0';
    const divisor = 10n ** BigInt(decimals);
    if (big < divisor) {
      return `~${(Number(big) / Number(divisor)).toPrecision(2)}`;
    }
    const whole = big / divisor;
    return fmtNum(Number(whole));
  } catch {
    return raw;
  }
};

const revokeUrl = (walletAddr: string, chain: ChainId) =>
  `https://revoke.cash/address/${walletAddr}?chainId=${CHAIN_ID_NUM[chain]}`;

interface Props {
  walletAddress: string;
  chains: ChainId[];
}

export function ApprovalsPanel({ walletAddress, chains }: Props) {
  const [open, setOpen] = useState(false);
  const [chain, setChain] = useState<ChainId>(chains[0] || 'pulsechain');
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchApprovals = useCallback(
    async (targetChain: ChainId) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/portfolio/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: walletAddress, chain: targetChain }),
        });
        if (!res.ok) {
          setError(`Failed to load approvals (${res.status})`);
          setApprovals([]);
          return;
        }
        const data = await res.json();
        setApprovals(Array.isArray(data?.approvals) ? data.approvals : []);
        setLoaded(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load approvals',
        );
      } finally {
        setLoading(false);
      }
    },
    [walletAddress],
  );

  // Auto-load on first open so the user doesn't have to click twice
  useEffect(() => {
    if (open && !loaded && !loading) {
      void fetchApprovals(chain);
    }
  }, [open, loaded, loading, fetchApprovals, chain]);

  const onChainChange = (next: ChainId) => {
    setChain(next);
    setLoaded(false);
    setApprovals([]);
    void fetchApprovals(next);
  };

  return (
    <section className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-[var(--surface)] transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold text-[var(--text-muted)]">
          <IconShieldHalf className="h-4 w-4 text-amber-400/80" />
          Token approvals
          {loaded && approvals.length > 0 && (
            <span
              className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                borderColor: 'rgba(245, 158, 11, 0.5)',
                color: '#fde68a',
              }}
            >
              {approvals.length}
            </span>
          )}
        </span>
        <span className="text-xs text-[var(--text-faint)]">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {chains.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChainChange(c)}
                  className="px-2 py-0.5 rounded-full border text-[10px] uppercase font-bold tracking-wide"
                  style={
                    c === chain
                      ? CHAIN_PILL[c]
                      : {
                          backgroundColor: 'transparent',
                          borderColor: 'rgba(255,255,255,0.15)',
                          color: 'rgba(255,255,255,0.4)',
                        }
                  }
                >
                  <ChainLogo chain={c} size={16} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={revokeUrl(walletAddress, chain)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#fecaca',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                }}
                title="Open this wallet on revoke.cash to revoke approvals"
              >
                Revoke on revoke.cash
                <IconExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={() => void fetchApprovals(chain)}
                disabled={loading}
                className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-40"
                title="Refresh"
              >
                <IconRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {error ? (
            <div className="text-xs text-red-300 px-3 py-2 rounded border border-red-500/40 bg-red-500/10">
              {error}
            </div>
          ) : loading && approvals.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-[var(--surface)] animate-pulse" />
              ))}
            </div>
          ) : approvals.length === 0 ? (
            <div className="text-xs text-[var(--text-faint)] py-4 text-center flex items-center justify-center gap-1.5">
              <IconInfoCircle className="h-3.5 w-3.5" />
              No active token approvals on {CHAIN_LABEL[chain]} for this wallet.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                    <th className="px-2 py-1.5 font-semibold">Token</th>
                    <th className="px-2 py-1.5 font-semibold">Spender</th>
                    <th className="px-2 py-1.5 font-semibold text-right">Allowance</th>
                    <th className="px-2 py-1.5 font-semibold text-right">Updated</th>
                    <th className="px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.map((a) => (
                    <ApprovalRow
                      key={`${a.token.address}:${a.spender}`}
                      approval={a}
                      chain={chain}
                      walletAddress={walletAddress}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ApprovalRow({
  approval,
  chain,
  walletAddress,
}: {
  approval: Approval;
  chain: ChainId;
  walletAddress: string;
}) {
  const sym = approval.token.symbol || '???';
  const name = approval.token.name || 'Unknown token';
  const spenderLabel = approval.spenderName || truncate(approval.spender);

  return (
    <tr className="border-t border-[var(--line-soft)] hover:bg-[var(--surface)]">
      <td className="px-2 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center overflow-hidden shrink-0">
            {approval.token.logoURI ? (
              <img
                src={approval.token.logoURI}
                alt={sym}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="text-[8px] text-[var(--text)] font-semibold">
                {sym.slice(0, 3).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[var(--text)] font-semibold truncate">{sym}</div>
            <div className="text-[10px] text-[var(--text-faint)] truncate">{name}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="min-w-0">
            <div className="text-[var(--text)] truncate">{spenderLabel}</div>
            <div className="text-[10px] text-[var(--text-faint)] truncate font-mono">
              {truncate(approval.spender)}
            </div>
          </div>
          <AddToGroupButton
            address={approval.spender}
            source="approval"
            chain={chain}
            context={{ spenderName: approval.spenderName ?? undefined, tokenSymbol: sym }}
            size={14}
            className="shrink-0 text-[var(--text-faint)] hover:text-orange-300 transition-colors"
          />
        </div>
      </td>
      <td className="px-2 py-2 text-right">
        {approval.isUnlimited ? (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderColor: 'rgba(239, 68, 68, 0.5)',
              color: '#fecaca',
            }}
          >
            Unlimited
          </span>
        ) : (
          <span className="text-[var(--text)] tabular-nums">
            {fmtAmount(approval.amount, 18)}
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-right text-[var(--text-faint)]">
        {fmtRelative(approval.updatedAt)}
      </td>
      <td className="px-2 py-2 text-right">
        <a
          href={revokeUrl(walletAddress, chain)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-red-300 hover:text-red-200 font-semibold"
          title="Open revoke.cash to revoke this approval"
        >
          Revoke
          <IconExternalLink className="h-3 w-3" />
        </a>
      </td>
    </tr>
  );
}
