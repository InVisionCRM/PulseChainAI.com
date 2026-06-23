'use client';

// DeBank-style wallet activity feed: a timeline of decoded transactions with
// in/out token flows, protocol labels, gas, status, chain badges, and scam
// filtering. Fetches /api/portfolio/history per chain on mount and merges the
// streams by timestamp; "Load more" advances each chain's cursor.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  IconRefresh,
  IconExternalLink,
  IconHistory,
  IconAlertTriangle,
  IconChevronDown,
  IconCopy,
  IconCheck,
} from '@tabler/icons-react';
import type {
  ChainId,
  TokenFlow,
  TxActionType,
  WalletTransaction,
  WalletHistoryResponse,
} from '@/services';
import { pulsechainTxUrl, pulsechainAddressUrl, PULSECHAIN_EXPLORER_NAME } from '@/lib/pulsechainExplorer';
import { ChainLogo } from '@/components/ui/ChainLogo';
import { getKnownAddress, getKnownAddressLabel } from '@/lib/gumshoe/address-labels';
import { CounterpartyBadge } from '@/components/portfolio/counterpartyBadge';
import { fmtUsd, fmtAmount } from '@/lib/format';

interface Props {
  walletAddress: string;
  chains: ChainId[];
  /** When set, only show transactions that move this token (e.g. HEX-only). */
  tokenAddress?: string;
}

// Per-chain pagination cursor as returned by the route (opaque Blockscout
// page params for both the tx spine and the transfer sweep).
type Cursor = WalletHistoryResponse['nextCursor'];

const CHAIN_LOGO: Record<ChainId, string> = {
  ethereum: '/ethlogo.svg',
  pulsechain: '/LogoVector.svg',
};
const CHAIN_NAME: Record<ChainId, string> = {
  ethereum: 'Ethereum',
  pulsechain: 'PulseChain',
};
const NATIVE_SYMBOL: Record<ChainId, string> = {
  ethereum: 'ETH',
  pulsechain: 'PLS',
};
// PulseChain → Otterscan-on-IPFS (see lib/pulsechainExplorer); Ethereum → Etherscan.
const EXPLORER_TX: Record<ChainId, (h: string) => string> = {
  pulsechain: pulsechainTxUrl,
  ethereum: (h) => `https://etherscan.io/tx/${h}`,
};
const EXPLORER_NAME: Record<ChainId, string> = {
  pulsechain: PULSECHAIN_EXPLORER_NAME,
  ethereum: 'Etherscan',
};
const EXPLORER_ADDR: Record<ChainId, (a: string) => string> = {
  pulsechain: pulsechainAddressUrl,
  ethereum: (a) => `https://etherscan.io/address/${a}`,
};

// DexScreener slug per chain — used for its token-image CDN, which covers
// almost any token that has a tradeable pair (lowercase-address friendly).
const DS_CHAIN: Record<ChainId, string> = {
  pulsechain: 'pulsechain',
  ethereum: 'ethereum',
};

// Ordered list of logo URLs to try for a flow's token, best hint first. The
// dot only shows the symbol fallback once every candidate has failed, so any
// listed token with a known image gets an icon — not just the ones Blockscout
// happened to return an icon_url for.
function logoCandidates(flow: TokenFlow, chain: ChainId): string[] {
  // Native gas coin (PLS / ETH) has no ERC-20 contract — use the chain logo.
  if (flow.isNative) return [CHAIN_LOGO[chain]];
  const out: string[] = [];
  if (flow.logoURI) out.push(flow.logoURI);
  const addr = flow.tokenAddress?.toLowerCase();
  if (addr && /^0x[0-9a-f]{40}$/.test(addr)) {
    out.push(`https://dd.dexscreener.com/ds-data/tokens/${DS_CHAIN[chain]}/${addr}.png`);
    if (chain === 'pulsechain') {
      out.push(`https://tokens.app.pulsex.com/images/tokens/${addr}.png`);
    }
  }
  return out;
}

export const ACTION_META: Record<TxActionType, { label: string; glyph: string; color: string }> = {
  swap: { label: 'Swap', glyph: '⇄', color: '#8b5cf6' },
  send: { label: 'Send', glyph: '↑', color: '#fb7185' },
  receive: { label: 'Receive', glyph: '↓', color: '#34d399' },
  approve: { label: 'Approve', glyph: '✓', color: '#fbbf24' },
  add_lp: { label: 'Add LP', glyph: '◆', color: '#38bdf8' },
  remove_lp: { label: 'Remove LP', glyph: '◇', color: '#38bdf8' },
  stake: { label: 'Stake', glyph: '◆', color: '#38bdf8' },
  unstake: { label: 'Unstake', glyph: '◇', color: '#38bdf8' },
  claim: { label: 'Claim', glyph: '✦', color: '#34d399' },
  wrap: { label: 'Wrap', glyph: '⟳', color: '#38bdf8' },
  unwrap: { label: 'Unwrap', glyph: '⟳', color: '#38bdf8' },
  contract: { label: 'Contract', glyph: '•', color: '#a1a1aa' },
};

const FILTERS: { key: string; label: string; actions: TxActionType[] | null }[] = [
  { key: 'all', label: 'All', actions: null },
  { key: 'swaps', label: 'Swaps', actions: ['swap', 'wrap', 'unwrap'] },
  { key: 'transfers', label: 'Transfers', actions: ['send', 'receive'] },
  { key: 'approvals', label: 'Approvals', actions: ['approve'] },
  // LP add/remove + stake/unstake/claim used to live behind a "Staking" chip
  // here, but that conflated PulseX liquidity moves with actual HEX stakes.
  // Real HEX stakes now have their own wallet-card "Staking" tab (HexStakes);
  // these txns still appear under "All".
  { key: 'liquidity', label: 'Liquidity', actions: ['add_lp', 'remove_lp'] },
];
const FILTER_SETS: Record<string, Set<TxActionType> | null> = Object.fromEntries(
  FILTERS.map((f) => [f.key, f.actions ? new Set(f.actions) : null]),
);

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const fmtClock = (ts: number) =>
  new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const dateKey = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function titleFor(t: WalletTransaction): string {
  const on = t.protocol?.name ? ` on ${t.protocol.name}` : '';
  const cp =
    t.counterpartyLabel ||
    getKnownAddressLabel(t.counterparty) ||
    (t.counterparty ? truncate(t.counterparty) : 'unknown');
  switch (t.action) {
    case 'swap':
      return `Swapped${on}`;
    case 'send':
      return `Sent to ${cp}`;
    case 'receive':
      return `Received from ${cp}`;
    case 'approve':
      return `Approved${t.protocol?.name ? ` · ${t.protocol.name}` : cp ? ` · ${cp}` : ''}`;
    case 'add_lp':
      return `Added liquidity${on}`;
    case 'remove_lp':
      return `Removed liquidity${on}`;
    case 'stake':
      return `Staked${on}`;
    case 'unstake':
      return `Unstaked${on}`;
    case 'claim':
      return `Claimed rewards${on}`;
    case 'wrap':
      return 'Wrapped';
    case 'unwrap':
      return 'Unwrapped';
    default:
      return `Contract interaction${t.counterpartyLabel ? ` · ${cp}` : ''}`;
  }
}

const rowKey = (t: WalletTransaction) => `${t.chain}:${t.hash}`;

export function ActivityFeed({ walletAddress, chains, tokenAddress }: Props) {
  const chainsKey = chains.join(',');
  const tokenFilter = tokenAddress?.toLowerCase();

  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [cursors, setCursors] = useState<Record<string, Cursor>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [typeFilter, setTypeFilter] = useState('all');
  const [hideScam, setHideScam] = useState(true);
  const [activeChains, setActiveChains] = useState<Set<ChainId>>(() => new Set(chains));

  const fetchChain = useCallback(
    async (chain: ChainId, cursor: Cursor | undefined): Promise<WalletHistoryResponse | null> => {
      const res = await fetch('/api/portfolio/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress, chain, cursor }),
      });
      if (!res.ok) throw new Error(`(${res.status})`);
      return (await res.json()) as WalletHistoryResponse;
    },
    [walletAddress],
  );

  const mergeSort = (rows: WalletTransaction[]) => {
    const seen = new Set<string>();
    const out: WalletTransaction[] = [];
    for (const t of rows) {
      const k = rowKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out.sort((a, b) => b.timestamp - a.timestamp);
  };

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        chains.map((c) => fetchChain(c, undefined).catch(() => null)),
      );
      const merged: WalletTransaction[] = [];
      const cur: Record<string, Cursor> = {};
      results.forEach((r, i) => {
        const c = chains[i];
        if (r) {
          merged.push(...r.items);
          cur[c] = r.nextCursor;
        } else {
          cur[c] = null;
        }
      });
      setCursors(cur);
      setTxns(mergeSort(merged));
      if (results.every((r) => r === null)) {
        setError('Couldn’t reach explorer. Retry?');
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchChain, chainsKey]);

  useEffect(() => {
    if (!loaded && !loading) void loadInitial();
  }, [loaded, loading, loadInitial]);

  const hasMore = useMemo(
    () => Object.values(cursors).some((c) => c != null),
    [cursors],
  );

  const loadMore = useCallback(async () => {
    const entries = Object.entries(cursors).filter(([, c]) => c != null) as [ChainId, Cursor][];
    if (entries.length === 0) return;
    setLoadingMore(true);
    try {
      const results = await Promise.all(
        entries.map(([c, cur]) => fetchChain(c, cur ?? undefined).catch(() => null)),
      );
      const add: WalletTransaction[] = [];
      const nextCur: Record<string, Cursor> = { ...cursors };
      results.forEach((r, i) => {
        const c = entries[i][0];
        if (r) {
          add.push(...r.items);
          nextCur[c] = r.nextCursor;
        } else {
          nextCur[c] = null;
        }
      });
      setCursors(nextCur);
      setTxns((prev) => mergeSort([...prev, ...add]));
    } finally {
      setLoadingMore(false);
    }
  }, [cursors, fetchChain]);

  const refresh = useCallback(() => {
    setLoaded(false);
    setTxns([]);
    setCursors({});
  }, []);

  const toggleChain = (c: ChainId) =>
    setActiveChains((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const visible = useMemo(() => {
    const set = FILTER_SETS[typeFilter];
    return txns.filter((t) => {
      if (hideScam && t.isScam) return false;
      if (!activeChains.has(t.chain)) return false;
      if (set && !set.has(t.action)) return false;
      // Restrict to transactions that move the requested token (e.g. HEX).
      if (tokenFilter && !t.flows.some((f) => f.tokenAddress?.toLowerCase() === tokenFilter)) return false;
      return true;
    });
  }, [txns, hideScam, activeChains, typeFilter, tokenFilter]);

  const groups = useMemo(() => {
    const m = new Map<string, WalletTransaction[]>();
    for (const t of visible) {
      const k = dateKey(t.timestamp);
      const list = m.get(k);
      if (list) list.push(t);
      else m.set(k, [t]);
    }
    return [...m.entries()];
  }, [visible]);

  const scamCount = useMemo(() => txns.filter((t) => t.isScam).length, [txns]);

  return (
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTypeFilter(f.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                typeFilter === f.key
                  ? 'bg-[var(--surface)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {chains.length > 1 &&
          chains.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleChain(c)}
              aria-pressed={activeChains.has(c)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] uppercase font-bold tracking-wide transition-colors"
              style={
                activeChains.has(c)
                  ? { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'transparent', color: '#fff' }
                  : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)' }
              }
            >
              <ChainLogo chain={c} size={16} />
            </button>
          ))}

        <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] cursor-pointer select-none">
          Hide scam{scamCount > 0 ? ` (${scamCount})` : ''}
          <button
            type="button"
            role="switch"
            aria-checked={hideScam}
            onClick={() => setHideScam((v) => !v)}
            className="relative h-[18px] w-8 rounded-full transition-colors"
            style={{ backgroundColor: hideScam ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.15)' }}
          >
            <span
              className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all"
              style={{ left: hideScam ? '16px' : '2px' }}
            />
          </button>
        </label>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-40"
          title="Refresh"
        >
          <IconRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* body */}
      {error ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <span className="flex items-center gap-1.5">
            <IconAlertTriangle className="h-3.5 w-3.5" />
            {error}
          </span>
          <button
            type="button"
            onClick={refresh}
            className="rounded-md border border-[var(--line-strong)] px-2.5 py-1 font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            Retry
          </button>
        </div>
      ) : loading && txns.length === 0 ? (
        <SkeletonRows />
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-[var(--text-faint)]">
          <IconHistory className="h-6 w-6 text-[var(--text-faint)]" />
          {txns.length === 0
            ? 'No activity found for this wallet yet.'
            : 'No transactions match the current filters.'}
        </div>
      ) : (
        <div>
          {groups.map(([label, rows]) => (
            <div key={label}>
              <div className="px-1 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
                {label}
              </div>
              {rows.map((t) => (
                <TimelineRow key={rowKey(t)} tx={t} />
              ))}
            </div>
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] py-2.5 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface)] disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more ↓'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineRow({ tx }: { tx: WalletTransaction }) {
  const meta = ACTION_META[tx.action];
  const failed = tx.status === 'failed';
  const native = NATIVE_SYMBOL[tx.chain];
  const known = getKnownAddress(tx.counterparty);
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative pl-12 ${tx.isScam ? 'opacity-50' : ''}`}>
      {/* rail */}
      <span className="absolute left-[26px] top-0 bottom-0 w-px bg-[var(--surface-2)]" />
      <span
        className="absolute left-[19px] top-[18px] h-3.5 w-3.5 rounded-full ring-4 ring-[#0e1117]"
        style={{ background: meta.color }}
      />
      <span className="absolute left-2 top-[38px] w-7 text-center text-[9px] tabular-nums text-[var(--text-faint)]">
        {fmtClock(tx.timestamp)}
      </span>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 border-t border-[var(--line-soft)] py-3 text-left"
      >
        {/* action glyph + chain badge */}
        <div className="relative shrink-0">
          <div
            className="grid h-9 w-9 place-items-center rounded-xl text-base font-bold"
            style={{
              color: meta.color,
              background: `${meta.color}22`,
              border: `1px solid ${meta.color}55`,
            }}
          >
            {meta.glyph}
          </div>
          <span
            title={CHAIN_NAME[tx.chain]}
            className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center overflow-hidden rounded-full ring-2 ring-[#0e1117]"
            style={{ background: tx.chain === 'ethereum' ? '#fff' : '#0b1f3a' }}
          >
            <img src={CHAIN_LOGO[tx.chain]} alt="" className="h-full w-full object-contain p-[1px]" />
          </span>
        </div>

        {/* meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: meta.color, background: `${meta.color}22` }}
            >
              {meta.label}
            </span>
            <span className="truncate text-sm font-semibold text-[var(--text)]">{titleFor(tx)}</span>
            <CounterpartyBadge category={known?.category} label={known?.label} />
            {tx.isScam && (
              <span className="rounded border border-red-400/40 bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-300">
                Scam
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-faint)]">
            {tx.method && <span className="font-mono">{tx.method.replace(/\(.*$/, '')}</span>}
            <span className={failed ? 'font-semibold text-red-300' : 'text-[var(--up)]'}>
              {failed ? '✗ Failed' : '✓ Success'}
            </span>
            {tx.gasFeeNative != null && tx.gasFeeNative > 0 && (
              <span>⛽ {fmtAmount(tx.gasFeeNative)} {native}</span>
            )}
            <span className="inline-flex items-center gap-0.5 text-[var(--text-muted)]">
              {open ? 'Hide details' : 'Details'}
              <IconChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </span>
          </div>
        </div>

        {/* token flows */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          {tx.flows.length === 0 ? (
            <span className="text-xs text-[var(--text-muted)]">no balance change</span>
          ) : (
            tx.flows.map((f, i) => <FlowChip key={i} flow={f} chain={tx.chain} />)
          )}
        </div>
      </button>

      {open && <TxDetail tx={tx} />}
    </div>
  );
}

// Expanded on-chain detail panel: full timestamp, tx hash, from/to counterparty,
// method, status, protocol, gas (native + USD), and every token flow with its
// contract address — each with copy buttons and explorer links.
function TxDetail({ tx }: { tx: WalletTransaction }) {
  const native = NATIVE_SYMBOL[tx.chain];
  const fullDate = new Date(tx.timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const cpLabel =
    tx.counterpartyLabel || getKnownAddressLabel(tx.counterparty) || null;
  const statusLabel =
    tx.status === 'failed' ? 'Failed' : tx.status === 'pending' ? 'Pending' : 'Success';

  return (
    <div className="mb-3 ml-1 space-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-[11px]">
      <DetailRow label="Time">
        <span className="text-[var(--text)] tabular-nums">{fullDate}</span>
      </DetailRow>

      <DetailRow label="Tx hash">
        <AddrLine value={tx.hash} href={EXPLORER_TX[tx.chain](tx.hash)} />
      </DetailRow>

      {tx.counterparty && (
        <DetailRow label={tx.action === 'send' ? 'To' : tx.action === 'receive' ? 'From' : 'Interacted with'}>
          <div className="flex flex-col gap-0.5">
            {cpLabel && <span className="font-semibold text-[var(--text)]">{cpLabel}</span>}
            <AddrLine value={tx.counterparty} href={EXPLORER_ADDR[tx.chain](tx.counterparty)} />
          </div>
        </DetailRow>
      )}

      {tx.method && (
        <DetailRow label="Method">
          <span className="break-all font-mono text-[var(--text)]">{tx.method}</span>
        </DetailRow>
      )}

      {tx.protocol?.name && (
        <DetailRow label="Protocol">
          <span className="text-[var(--text)]">
            {tx.protocol.name}
            {tx.protocol.kind ? <span className="text-[var(--text-muted)]"> · {tx.protocol.kind}</span> : null}
          </span>
        </DetailRow>
      )}

      <DetailRow label="Status">
        <span className={tx.status === 'failed' ? 'font-semibold text-red-300' : 'text-[var(--up)]'}>
          {statusLabel}
        </span>
      </DetailRow>

      {tx.gasFeeNative != null && tx.gasFeeNative > 0 && (
        <DetailRow label="Gas fee">
          <span className="text-[var(--text)] tabular-nums">
            {fmtAmount(tx.gasFeeNative)} {native}
            {tx.gasFeeUsd != null && (
              <span className="text-[var(--text-muted)]"> · {fmtUsd(tx.gasFeeUsd)}</span>
            )}
          </span>
        </DetailRow>
      )}

      {tx.flows.length > 0 && (
        <div className="border-t border-[var(--line-soft)] pt-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
            Token transfers ({tx.flows.length})
          </div>
          <div className="space-y-1.5">
            {tx.flows.map((f, i) => (
              <FlowDetail key={i} flow={f} chain={tx.chain} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FlowDetail({ flow, chain }: { flow: TokenFlow; chain: ChainId }) {
  const color = flow.isLp ? '#7dd3fc' : flow.direction === 'in' ? '#6ee7b7' : '#fda4af';
  const sign = flow.direction === 'in' ? '+' : '−';
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <TokenDot flow={flow} chain={chain} />
        <div className="min-w-0">
          <div className="truncate text-[var(--text)]">
            {flow.name || flow.symbol}
            <span className="text-[var(--text-muted)]"> · {flow.symbol}</span>
          </div>
          {!flow.isNative && flow.tokenAddress && (
            <AddrLine value={flow.tokenAddress} href={EXPLORER_ADDR[chain](flow.tokenAddress)} />
          )}
        </div>
      </div>
      <div className="shrink-0 text-right tabular-nums" style={{ color }}>
        <div className="font-semibold">
          {sign}
          {fmtAmount(flow.amountFormatted)} {flow.symbol}
        </div>
        {flow.valueUsd != null && (
          <div className="text-[10px] font-normal text-[var(--text-muted)]">{fmtUsd(flow.valueUsd)}</div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// Monospaced address/hash with a copy button and an explorer link.
function AddrLine({ value, href }: { value: string; href: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="break-all font-mono text-[var(--text-muted)]">{value}</span>
      <button
        type="button"
        onClick={copy}
        title="Copy"
        className="shrink-0 text-[var(--text-faint)] hover:text-[var(--text)]"
      >
        {copied ? <IconCheck className="h-3 w-3 text-[var(--up)]" /> : <IconCopy className="h-3 w-3" />}
      </button>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in explorer"
        className="shrink-0 text-[var(--text-faint)] hover:text-[var(--text)]"
      >
        <IconExternalLink className="h-3 w-3" />
      </a>
    </span>
  );
}

function FlowChip({ flow, chain }: { flow: TokenFlow; chain: ChainId }) {
  const usd = flow.valueUsd != null ? fmtUsd(flow.valueUsd) : null;
  const color = flow.isLp
    ? '#7dd3fc'
    : flow.direction === 'in'
      ? '#6ee7b7'
      : '#fda4af';
  const sign = flow.direction === 'in' ? '+' : '−';
  return (
    <div className="flex items-center justify-end gap-1.5 text-[13px] font-semibold" style={{ color }}>
      {usd && <span className="text-[11px] font-normal text-[var(--text-muted)]">{usd}</span>}
      <span className="tabular-nums">
        {sign}
        {fmtAmount(flow.amountFormatted)} {flow.symbol}
      </span>
      <TokenDot flow={flow} chain={chain} />
    </div>
  );
}

function TokenDot({ flow, chain }: { flow: TokenFlow; chain: ChainId }) {
  const candidates = useMemo(() => logoCandidates(flow, chain), [flow, chain]);
  // Advance through candidate URLs on each load error; fall back to the
  // symbol initials only after every source has failed.
  const [idx, setIdx] = useState(0);
  const src = candidates[idx];
  return (
    <span className="grid h-[18px] w-[18px] place-items-center overflow-hidden rounded-full bg-[var(--surface-2)] text-[8px] font-bold text-[var(--text-muted)]">
      {src ? (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        flow.symbol.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--surface)] animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/5 rounded bg-[var(--surface)] animate-pulse" />
            <div className="h-2.5 w-1/4 rounded bg-[var(--surface)] animate-pulse" />
          </div>
          <div className="h-3 w-20 rounded bg-[var(--surface)] animate-pulse" />
        </div>
      ))}
    </div>
  );
}
