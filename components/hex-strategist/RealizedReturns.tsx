'use client';

// Realized returns by stake length — what HEX stakers ACTUALLY earned, from real
// ended stakes (net of penalties), bucketed by committed length. Grounds the
// Designer's theoretical projection in reality. Data from /api/hex/realized-apy.

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { IconRefresh, IconChartHistogram } from '@tabler/icons-react';
import type { Network } from '@/lib/hex/strategistData';
import type { ApyBucket } from '@/lib/hex/realizedApy';

export default function RealizedReturns({ net }: { net: Network }) {
  const [buckets, setBuckets] = useState<ApyBucket[] | null>(null);
  const [sample, setSample] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading');

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    fetch(`/api/hex/realized-apy?network=${net}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { buckets: ApyBucket[]; sample: number }) => {
        if (!alive) return;
        setBuckets(d.buckets);
        setSample(d.sample);
        setStatus(d.buckets.length ? 'ready' : 'empty');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [net]);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
        <IconChartHistogram className="h-4 w-4 text-emerald-400" /> Realized returns by length
      </div>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        What stakers <span className="text-[var(--text)]">actually earned</span> — net of penalties — by the term they
        committed to. The reality check on the projection above.
      </p>

      {status === 'loading' && (
        <div className="grid place-items-center py-10 text-sm text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-2"><IconRefresh className="h-4 w-4 animate-spin" /> Crunching ended stakes…</span>
        </div>
      )}
      {status === 'error' && <div className="py-8 text-center text-sm text-red-300">Couldn’t load realized returns.</div>}
      {status === 'empty' && (
        <div className="py-8 text-center text-sm text-[var(--text-faint)]">Not enough ended-stake history yet for {net}.</div>
      )}

      {status === 'ready' && buckets && (
        <>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${v}%`} width={44} />
                <Tooltip
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, _n, p) => [
                    `${v.toFixed(1)}% median APY`,
                    `${p.payload.count} stakes · ${(p.payload.earlyRate * 100).toFixed(0)}% ended early`,
                  ]}
                />
                <Bar dataKey="medianApyPct" radius={[3, 3, 0, 0]}>
                  {buckets.map((b) => (
                    <Cell key={b.label} fill={b.medianApyPct >= 0 ? '#34d399' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
            Median annualized return on principal, net of penalties, from {sample.toLocaleString()} recent ended stakes on{' '}
            {net}. Bars show the median (robust to outliers); hover for sample size and how many in each bucket ended early.
            Past results don’t predict future payouts.
          </p>
        </>
      )}
    </div>
  );
}
