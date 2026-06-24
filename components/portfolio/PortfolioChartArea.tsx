'use client';

// The recharts-powered body of PortfolioChart, split into its own module so it
// can be lazy-loaded via next/dynamic. recharts is ~160 kB; keeping it here
// means it only downloads once the portfolio actually has enough history to
// draw a chart, not on every portfolio page load.

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PortfolioHistoryPoint } from '@/lib/stores/portfolioStore';
import { fmtUsd } from '@/lib/format';

type Range = '24h' | '7d' | '30d' | 'all';

const fmtRangeTick = (ts: number, range: Range) => {
  const d = new Date(ts);
  if (range === '24h') {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (range === '7d' || range === '30d') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

const fmtFullTs = (ts: number) =>
  new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function PortfolioChartArea({
  data,
  range,
}: {
  data: PortfolioHistoryPoint[];
  range: Range;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="portfolio-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="ts"
          tickFormatter={(ts: number) => fmtRangeTick(ts, range)}
          stroke="rgba(255,255,255,0.3)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => fmtUsd(v)}
          stroke="rgba(255,255,255,0.3)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          width={55}
        />
        <Tooltip
          cursor={{ stroke: 'rgba(251, 146, 60, 0.4)', strokeWidth: 1 }}
          contentStyle={{
            background: '#0C2340',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            fontSize: 12,
            padding: '6px 10px',
          }}
          labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
          labelFormatter={(ts: number) => fmtFullTs(ts)}
          formatter={(v: number) => [fmtUsd(v), 'Value']}
        />
        <Area
          type="monotone"
          dataKey="totalUsd"
          stroke="#fb923c"
          strokeWidth={2}
          fill="url(#portfolio-area)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
