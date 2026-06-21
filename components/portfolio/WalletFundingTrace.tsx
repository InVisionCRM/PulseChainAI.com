'use client';

// Source-of-funds trace — the funding ancestry of a wallet, shown both as a
// chain diagram (origin → … → wallet) and as a list of hops. Data from
// /api/portfolio/funding-trace. Mounted on demand from the "Funded by" strip.

import { Fragment, useEffect, useState } from 'react';
import { IconRefresh, IconExternalLink, IconArrowRight } from '@tabler/icons-react';
import type { ChainId } from '@/services';
import type { AddressCategory } from '@/lib/gumshoe/address-labels';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';
import { CounterpartyBadge } from '@/components/portfolio/counterpartyBadge';
import { ChainLogo } from '@/components/ui/ChainLogo';

interface FundingEdge {
  amount: number | null;
  timestamp: number | null;
  txHash: string | null;
  block: number | null;
  // The transfer's real chain/asset (pre-fork PulseChain history is Ethereum).
  chain: ChainId;
  asset: 'ETH' | 'PLS';
  preFork: boolean;
}
interface Step {
  address: string;
  label: string | null;
  category: AddressCategory | null;
  fundedBy: FundingEdge | null;
}
interface Trace {
  supported: boolean;
  reachedOrigin: boolean;
  steps: Step[];
}

const CAT_COLOR: Partial<Record<AddressCategory, string>> = {
  exchange: '#4684b8',
  router: '#3f9d83',
  factory: '#4faa92',
  locker: '#c39a3b',
  ofac: '#c25b50',
  burn: '#6f7888',
  wrapped: '#b06ba6',
};
const WALLET_COLOR = '#7b84d4';
const SELF_COLOR = '#d9942f';

const EXPLORER_ADDRESS: Record<ChainId, string> = {
  ethereum: 'https://etherscan.io/address/',
  pulsechain: 'https://scan.pulsechain.com/address/',
};
const EXPLORER_TX: Record<ChainId, string> = {
  ethereum: 'https://etherscan.io/tx/',
  pulsechain: 'https://scan.pulsechain.com/tx/',
};

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const fmtAmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 });
function hexA(h: string, a: number) {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const nodeColor = (s: Step, isSelf: boolean) =>
  isSelf ? SELF_COLOR : (s.category && CAT_COLOR[s.category]) || WALLET_COLOR;

export function WalletFundingTrace({ address, chain }: { address: string; chain: ChainId }) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch('/api/portfolio/funding-trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, chain, maxHops: 4 }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive) {
          setTrace(j?.trace ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [address, chain]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[11px] text-[var(--text-faint)]">
        <IconRefresh className="mr-1 inline h-3.5 w-3.5 animate-spin" />
        Tracing source of funds…
      </div>
    );
  }
  if (!trace || !trace.supported || trace.steps.length < 2) {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[11px] text-[var(--text-faint)]">
        No funding ancestry found.
      </div>
    );
  }

  const steps = trace.steps;
  const reversed = [...steps].reverse(); // origin … wallet
  const origin = steps[steps.length - 1];
  // The trail crosses the PulseChain → Ethereum fork when any hop pre-dates it.
  const crossesEth = steps.some((s) => s.fundedBy?.preFork);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
        Source of funds
        <span className="ml-1 normal-case text-[var(--text-faint)]">
          · {steps.length - 1} hop{steps.length - 1 === 1 ? '' : 's'}
          {trace.reachedOrigin
            ? ` → origin: ${origin.label ?? truncate(origin.address)}`
            : ' · trail ends'}
        </span>
      </div>
      {crossesEth && (
        <div className="mb-2 flex items-center gap-1.5 rounded-md border border-indigo-400/25 bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-200/80">
          <ChainLogo chain="ethereum" size={12} />
          Trail reaches pre-fork history — those hops happened on Ethereum (ETH),
          which PulseChain inherited at the 2023 fork.
        </div>
      )}

      <div className="flex items-start gap-1 overflow-x-auto pb-1">
        {reversed.map((s, r) => {
          const isSelf = r === reversed.length - 1;
          const color = nodeColor(s, isSelf);
          const next = reversed[r + 1];
          const edge = next?.fundedBy ?? null;
          return (
            <Fragment key={`${s.address}-${r}`}>
              <div className="flex w-[90px] shrink-0 flex-col items-center text-center">
                <span
                  className="h-6 w-6 rounded-full border"
                  style={{ background: hexA(color, 0.3), borderColor: color }}
                />
                <span className="mt-1 max-w-[88px] truncate text-[10px] text-[var(--text-muted)]">
                  {isSelf ? 'This wallet' : s.label ?? truncate(s.address)}
                </span>
                {s.category && <CounterpartyBadge category={s.category} label={s.label} />}
              </div>
              {next && (
                <div className="flex shrink-0 flex-col items-center pt-1.5 text-[var(--text-faint)]">
                  <IconArrowRight className="h-3.5 w-3.5" />
                  {edge?.amount != null && (
                    <span className="mt-0.5 flex items-center gap-0.5 text-[9px] tabular-nums text-[var(--text-faint)]">
                      {fmtAmt(edge.amount)}
                      <ChainLogo chain={edge.chain} size={9} />
                    </span>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      <div className="mt-2 space-y-1">
        {steps.map((s, i) => {
          if (!s.fundedBy) return null;
          const funder = steps[i + 1];
          const fb = s.fundedBy;
          const ec = fb.chain; // chain the funding transfer really happened on
          return (
            <div key={`hop-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-faint)]">
              <span className="text-[var(--text-faint)]">{i === 0 ? 'Funded by' : '↳ then'}</span>
              <a
                href={`${EXPLORER_ADDRESS[ec]}${funder.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--text)] hover:text-[var(--text)]"
              >
                {funder.label ?? truncate(funder.address)}
              </a>
              <CounterpartyBadge category={funder.category} label={funder.label} />
              {fb.amount != null && (
                <span className="inline-flex items-center gap-1 tabular-nums text-[var(--text-muted)]">
                  · {fmtAmt(fb.amount)}
                  <ChainLogo chain={ec} size={12} />
                  <span className={fb.preFork ? 'text-indigo-300/70' : 'text-[var(--text-muted)]'}>
                    {fb.asset}
                  </span>
                </span>
              )}
              {fb.timestamp && (
                <a
                  href={fb.txHash ? `${EXPLORER_TX[ec]}${fb.txHash}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[var(--text-faint)] hover:text-[var(--text-muted)]"
                >
                  · {fmtDate(fb.timestamp)}
                  <IconExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
              <AddToGroupButton
                address={funder.address}
                source="tx"
                chain={ec}
                context={{ direction: 'sender' }}
                size={12}
                className="text-[var(--text-muted)] hover:text-orange-300 transition-colors"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
