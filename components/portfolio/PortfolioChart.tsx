'use client';

import { useMemo, useState } from 'react';
import { IconChartLine, IconTrash } from '@tabler/icons-react';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import type { PortfolioHistoryPoint } from '@/lib/stores/portfolioStore';
import { fmtUsd } from '@/lib/format';
import PortfolioChartArea from './PortfolioChartArea';

type Range = '24h' | '7d' | '30d' | 'all';

const RANGE_MS: Record<Range, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  all: Number.POSITIVE_INFINITY,
};

const RANGE_LABEL: Record<Range, string> = {
  '24h': '24H',
  '7d': '7D',
  '30d': '30D',
  all: 'ALL',
};

export function PortfolioChart() {
  const history = usePortfolioStore((s) => s.history);
  const clearHistory = usePortfolioStore((s) => s.clearHistory);
  const [range, setRange] = useState<Range>('7d');

  const filtered = useMemo(() => {
    if (!history.length) return [] as PortfolioHistoryPoint[];
    const cutoff = Date.now() - RANGE_MS[range];
    return history.filter((p) => p.ts >= cutoff);
  }, [history, range]);

  // Need at least two points to draw a meaningful chart.
  if (history.length < 2 || filtered.length < 2) {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 text-orange-400/80 text-xs font-semibold uppercase tracking-wider mb-2">
          <IconChartLine className="h-4 w-4" />
          Portfolio value
        </div>
        <div className="text-sm text-[var(--text-faint)] py-6 text-center">
          {history.length === 0
            ? 'Refresh your wallets to start recording portfolio value over time.'
            : `Only ${history.length} snapshot${history.length === 1 ? '' : 's'} so far in this range — more appear as you check back over time (~1 per hour).`}
        </div>
      </section>
    );
  }

  const first = filtered[0].totalUsd;
  const last = filtered[filtered.length - 1].totalUsd;
  const delta = last - first;
  const deltaPct = first > 0 ? (delta / first) * 100 : 0;
  const positive = delta >= 0;

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-orange-400/80 text-xs font-semibold uppercase tracking-wider">
            <IconChartLine className="h-4 w-4" />
            Portfolio value
          </div>
          <div className="mt-1 text-2xl font-bold text-[var(--text)] tabular-nums">
            {fmtUsd(last)}
          </div>
          <div
            className="text-sm tabular-nums"
            style={{ color: positive ? '#4ade80' : '#f87171' }}
          >
            {positive ? '+' : ''}
            {fmtUsd(delta)} ({positive ? '+' : ''}
            {deltaPct.toFixed(2)}%) · {RANGE_LABEL[range]}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {(['24h', '7d', '30d', 'all'] as Range[]).map((r) => {
            const active = range === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className="px-2.5 py-1 rounded text-[11px] font-bold tracking-wide transition-colors"
                style={
                  active
                    ? {
                        backgroundColor: 'rgba(249, 115, 22, 0.3)',
                        color: '#fff',
                      }
                    : {
                        color: 'rgba(255, 255, 255, 0.5)',
                      }
                }
              >
                {RANGE_LABEL[r]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              if (confirm('Clear portfolio value history?')) clearHistory();
            }}
            className="ml-2 text-[var(--text-faint)] hover:text-red-400 transition-colors"
            title="Clear history"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
      </div>

      <PortfolioChartArea data={filtered} range={range} />
    </section>
  );
}
