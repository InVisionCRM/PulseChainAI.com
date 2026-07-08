'use client';

import React, { useEffect, useState } from 'react';
import { BridgeFlowsView, type BridgeFlow, type BridgeTotals } from './BridgeFlowsView';

export interface GeickoBridgeFlowsTabProps {
  token: string;
  /** Spot price in USD, used to value each transfer. */
  priceUsd: string | number | null | undefined;
}

interface BridgeData {
  totals: BridgeTotals;
  flows: BridgeFlow[];
}

export default function GeickoBridgeFlowsTab({ token, priceUsd }: GeickoBridgeFlowsTabProps) {
  const [data, setData] = useState<BridgeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    const qs = new URLSearchParams({ token });
    const p = Number(priceUsd ?? 0);
    if (p > 0) qs.set('price', p.toPrecision(8));
    fetch(`/api/geicko/bridge?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token, priceUsd]);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-4">
      <h3 className="text-base font-semibold text-[var(--text)]">Bridge Inflows &amp; Outflows</h3>
      <BridgeFlowsView
        loading={loading}
        totals={data?.totals}
        flows={data?.flows ?? []}
        emptyText="No bridge activity found for this token."
      />
    </div>
  );
}
