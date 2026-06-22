'use client';

import React, { useEffect, useState } from 'react';
import type { ScreenerStats } from '@/lib/screener/types';
import { fmtNum, fmtUsd } from './format';

interface Props {
  stats: ScreenerStats | null;
  fetchedAt: number | null;
}

function Cell({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-center backdrop-blur-xl">
      <div className="truncate text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="mt-0.5 flex items-baseline justify-center gap-1.5">
        <span className="text-sm font-semibold tabular-nums text-[var(--text)]">{value}</span>
        {suffix ? <span className="text-[10px] tabular-nums text-[var(--text-faint)]">{suffix}</span> : null}
      </div>
    </div>
  );
}

export default function StatsBar({ stats, fetchedAt }: Props) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsAgo = fetchedAt ? Math.max(0, Math.floor((Date.now() - fetchedAt) / 1000)) : null;

  return (
    <div className="flex flex-wrap gap-2">
      <Cell label="24h volume" value={stats ? fmtUsd(stats.vol24) : '—'} />
      <Cell label="24h txns" value={stats ? fmtNum(stats.txns24) : '—'} />
      <Cell
        label="Latest block"
        value={stats?.block ? fmtNum(stats.block) : '—'}
        suffix={secondsAgo !== null ? `${secondsAgo}s ago` : undefined}
      />
    </div>
  );
}
