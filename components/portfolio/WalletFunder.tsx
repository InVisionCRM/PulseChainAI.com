'use client';

// "Funded by" strip — the original address that bootstrapped this wallet with
// its first native-coin transfer (from /api/portfolio/first-funder). Renders
// nothing until a funder is found (or on unsupported chains), so it never
// leaves an empty row.

import { useEffect, useState } from 'react';
import { IconArrowDownLeft, IconExternalLink } from '@tabler/icons-react';
import type { ChainId } from '@/services';
import type { AddressCategory } from '@/lib/gumshoe/address-labels';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';
import { CounterpartyBadge } from '@/components/portfolio/counterpartyBadge';

interface FirstFunder {
  supported: boolean;
  funder: string | null;
  label: string | null;
  category: AddressCategory | null;
  txHash: string | null;
  block: number | null;
  timestamp: number | null;
  amount: number | null;
}

const EXPLORER_ADDRESS: Record<ChainId, string> = {
  ethereum: 'https://etherscan.io/address/',
  pulsechain: 'https://scan.pulsechain.com/address/',
};
const EXPLORER_TX: Record<ChainId, string> = {
  ethereum: 'https://etherscan.io/tx/',
  pulsechain: 'https://scan.pulsechain.com/tx/',
};
const NATIVE: Record<ChainId, string> = { ethereum: 'ETH', pulsechain: 'PLS' };

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
const fmtAmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 });

export function WalletFunder({ address, chain }: { address: string; chain: ChainId }) {
  const [data, setData] = useState<FirstFunder | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    fetch('/api/portfolio/first-funder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, chain }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive) setData(j?.funder ?? null);
      })
      .catch(() => {
        if (alive) setData(null);
      });
    return () => {
      alive = false;
    };
  }, [address, chain]);

  if (!data || !data.supported || !data.funder) return null;

  const name = data.label ?? truncate(data.funder);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/10 bg-white/[0.02] px-4 py-1.5 text-[11px] text-white/45">
      <span className="inline-flex items-center gap-1 uppercase tracking-wide text-white/35">
        <IconArrowDownLeft className="h-3.5 w-3.5 text-emerald-300/70" />
        Funded by
      </span>
      <a
        href={`${EXPLORER_ADDRESS[chain]}${data.funder}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 font-medium text-white/80 hover:text-white"
      >
        {name}
        <IconExternalLink className="h-2.5 w-2.5" />
      </a>
      <CounterpartyBadge category={data.category} label={data.label} />
      {data.amount != null && data.amount > 0 && (
        <span className="text-white/35 tabular-nums">
          · {fmtAmt(data.amount)} {NATIVE[chain]}
        </span>
      )}
      {data.timestamp && (
        <a
          href={data.txHash ? `${EXPLORER_TX[chain]}${data.txHash}` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-white/35 hover:text-white/70"
        >
          · {fmtDate(data.timestamp)}
          <IconExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
      <AddToGroupButton
        address={data.funder}
        source="tx"
        chain={chain}
        context={{ direction: 'sender' }}
        size={13}
        className="text-white/30 hover:text-orange-300 transition-colors"
        title="Save funder to a group"
      />
    </div>
  );
}
