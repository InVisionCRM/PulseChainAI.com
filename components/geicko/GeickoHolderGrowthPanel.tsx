import React, { useEffect, useMemo, useState } from 'react';

export interface GeickoHolderGrowthPanelProps {
  token: string;
}

interface GrowthData {
  totalHolders: number | null;
  dailyChange: number | null;
  monthlyChange: number | null;
  history: Array<{ date: string; count: number }>;
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function ChangeCard({ label, value }: { label: string; value: number | null }) {
  const color =
    value == null
      ? 'text-[var(--text-faint)]'
      : value > 0
        ? 'text-emerald-400'
        : value < 0
          ? 'text-red-400'
          : 'text-[var(--text-muted)]';
  return (
    <div className="flex-1 rounded-lg border border-[var(--line)] bg-white/[0.02] p-3 text-center">
      <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className={`mt-1 text-lg font-bold ${color}`}>
        {value == null ? '—' : signed(value)}
      </div>
    </div>
  );
}

/** Minimal dependency-free area chart. */
function AreaChart({ points }: { points: Array<{ date: string; count: number }> }) {
  const W = 600;
  const H = 180;
  const pad = { top: 8, right: 8, bottom: 8, left: 40 };
  const { path, area, min, max, ticks } = useMemo(() => {
    const counts = points.map((p) => p.count);
    const lo = Math.min(...counts);
    const hi = Math.max(...counts);
    const span = hi - lo || 1;
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;
    const x = (i: number) =>
      pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (c: number) => pad.top + innerH - ((c - lo) / span) * innerH;
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(' ');
    const areaPath = `${line} L${x(points.length - 1).toFixed(1)},${(H - pad.bottom).toFixed(1)} L${x(0).toFixed(1)},${(H - pad.bottom).toFixed(1)} Z`;
    const tickVals = [hi, lo + span / 2, lo].map((v) => ({ v, y: y(v) }));
    return { path: line, area: areaPath, min: lo, max: hi, ticks: tickVals };
  }, [points]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Holder count over time">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.left} x2={W - pad.right} y1={t.y} y2={t.y} stroke="var(--line)" strokeWidth="1" opacity="0.5" />
          <text x={pad.left - 6} y={t.y + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)">
            {Math.round(t.v)}
          </text>
        </g>
      ))}
      <defs>
        <linearGradient id="holderGrowthFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#holderGrowthFill)" />
      <path d={path} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function GeickoHolderGrowthPanel({ token }: GeickoHolderGrowthPanelProps) {
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/geicko/holder-growth?token=${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token]);

  const history = data?.history ?? [];

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>📈</span>
        <h3 className="text-sm font-semibold text-[var(--text)]">Holder Growth</h3>
      </div>

      {loading ? (
        <div className="grid h-32 place-items-center text-sm text-[var(--text-faint)]">Loading…</div>
      ) : (
        <>
          <div className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-4 text-center">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Total Holders</div>
            <div className="mt-1 text-2xl font-bold text-[var(--text)]">
              {data?.totalHolders != null ? data.totalHolders.toLocaleString() : '—'}
            </div>
          </div>

          <div className="flex gap-3">
            <ChangeCard label="Daily Change" value={data?.dailyChange ?? null} />
            <ChangeCard label="Monthly Change" value={data?.monthlyChange ?? null} />
          </div>

          {history.length >= 2 ? (
            <AreaChart points={history} />
          ) : (
            <div className="grid h-24 place-items-center text-center text-xs text-[var(--text-faint)]">
              Building holder history — the trend chart fills in over the coming days.
            </div>
          )}
        </>
      )}
    </div>
  );
}
