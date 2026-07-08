'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BridgeFlowsView,
  type BridgeFlow,
  type BridgeTotals,
} from '@/components/geicko/BridgeFlowsView';

export interface PortfolioBridgeFlowsProps {
  /** Wallet addresses to aggregate bridge flows across. */
  wallets: string[];
  /** When true, render bare (no outer card/title) for use inside a wallet tab. */
  embedded?: boolean;
}

type Flow = BridgeFlow & { wallet?: string };
interface WalletBridge {
  totals: BridgeTotals;
  flows: Flow[];
}

export function PortfolioBridgeFlows({ wallets, embedded }: PortfolioBridgeFlowsProps) {
  const [data, setData] = useState<WalletBridge | null>(null);
  const [loading, setLoading] = useState(false);

  const key = useMemo(
    () => wallets.map((w) => w.toLowerCase()).sort().join(','),
    [wallets],
  );

  useEffect(() => {
    if (!key) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    const addrs = key.split(',');
    Promise.all(
      addrs.map((w) =>
        fetch(`/api/portfolio/bridge?wallet=${w}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d: WalletBridge | null) =>
            d ? d.flows.map((f) => ({ ...f, wallet: w })) : [],
          )
          .catch(() => [] as Flow[]),
      ),
    )
      .then((lists) => {
        if (!alive) return;
        const flows = lists.flat().sort((a, b) => (a.date < b.date ? 1 : -1));
        const inflow = flows.filter((f) => f.direction === 'in');
        const outflow = flows.filter((f) => f.direction === 'out');
        const sum = (arr: Flow[]) => arr.reduce((s, f) => s + f.usd, 0);
        setData({
          totals: {
            inflowUsd: sum(inflow),
            outflowUsd: sum(outflow),
            netUsd: sum(inflow) - sum(outflow),
            inflowCount: inflow.length,
            outflowCount: outflow.length,
          },
          flows,
        });
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [key]);

  if (wallets.length === 0) return null;

  const content = (
    <BridgeFlowsView
      loading={loading}
      totals={data?.totals}
      flows={data?.flows ?? []}
      emptyText="No bridge activity found for this wallet."
    />
  );

  if (embedded) return content;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl p-5 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text)]">Bridge Inflows &amp; Outflows</h2>
      {content}
    </div>
  );
}
