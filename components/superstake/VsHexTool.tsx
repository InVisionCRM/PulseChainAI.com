'use client';

// Same dollars, same day: open a native HEX stake, or buy pSSH and hold.
// Both outcomes are measured in HEX so the answer isn't just a bet on the HEX
// price — it isolates which structure accrues more HEX over the window.

import { useEffect, useMemo, useState } from 'react';
import {
  backtest,
  backtestByCycle,
  dayToISO,
  type SuperStakeSnapshot,
} from '@/lib/superstake/model';

const AMOUNT_CHIPS = [1_000, 10_000, 50_000, 100_000];
const RANGE_CHIPS: { label: string; days: number }[] = [
  { label: '60d', days: 60 },
  { label: '180d', days: 180 },
  { label: '1y', days: 365 },
  { label: '2y', days: 730 },
  { label: 'launch', days: 0 },
];

const fmtHex = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(1);
const fmtUsd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : `$${n.toFixed(2)}`;

export default function VsHexTool() {
  const [snap, setSnap] = useState<SuperStakeSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [amount, setAmount] = useState(10_000);
  const [startISO, setStartISO] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/superstake/snapshot')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: SuperStakeSnapshot) => {
        if (!alive) return;
        setSnap(d);
        // Default to a one-year run, the most legible single view.
        const lastDay = d.series.d0 + d.series.P.length - 1;
        setStartISO(dayToISO(Math.max(d.series.d0, lastDay - 364)));
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, []);

  const bounds = useMemo(() => {
    if (!snap) return null;
    const first = snap.series.d0;
    const last = snap.series.d0 + snap.series.P.length - 1;
    return { minISO: dayToISO(first), maxISO: dayToISO(last - 1), first, last };
  }, [snap]);

  const result = useMemo(
    () => (snap && startISO ? backtest(snap, amount, startISO) : null),
    [snap, amount, startISO],
  );
  const perCycle = useMemo(
    () => (snap ? backtestByCycle(snap, amount) : []),
    [snap, amount],
  );

  const setRange = (days: number) => {
    if (!bounds) return;
    setStartISO(days === 0 ? bounds.minISO : dayToISO(Math.max(bounds.first, bounds.last - days + 1)));
  };

  if (status === 'loading') {
    return <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-faint)]">Loading cycle history…</div>;
  }
  if (status === 'error' || !snap || !bounds) {
    return <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center text-sm text-red-200">Couldn&apos;t load the SuperStake history.</div>;
  }

  const psshWins = perCycle.filter((c) => c.result.winner === 'pssh').length;

  return (
    <div className="space-y-4">
      {/* ---- Controls ---- */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Amount</span>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2">
              <span className="text-[var(--text-faint)]">$</span>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
                className="w-full bg-transparent text-sm font-semibold tabular-nums text-[var(--text)] outline-none"
              />
            </div>
          </label>
          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Entry date</span>
            <input
              type="date"
              value={startISO}
              min={bounds.minISO}
              max={bounds.maxISO}
              onChange={(e) => e.target.value && setStartISO(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {AMOUNT_CHIPS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(a)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                amount === a
                  ? 'border-orange-500/60 bg-orange-500/15 text-orange-300'
                  : 'border-[var(--line)] text-[var(--text-faint)] hover:text-[var(--text)]'
              }`}
            >
              {a >= 1000 ? `$${a / 1000}k` : `$${a}`}
            </button>
          ))}
          <span className="mx-1 w-px self-stretch bg-[var(--line)]" />
          {RANGE_CHIPS.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRange(r.days)}
              className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Verdict ---- */}
      {result && (
        <div className="grid gap-3 md:grid-cols-2">
          <Side
            title="Stake HEX"
            sub={`native ${result.days}-day stake · +${Math.round((result.lpbMultiplier - 1) * 100)}% longer-pays-better`}
            hex={result.stakeYield}
            won={result.winner === 'stake'}
            detail={`${fmtHex(result.hexAmount)} HEX staked · ${result.tShares.toFixed(2)} T-shares`}
          />
          <Side
            title="Hold pSSH"
            sub="after the 5.5% toll · payouts + reflections"
            hex={result.psshYield}
            won={result.winner === 'pssh'}
            accent
            detail={`${fmtHex(result.payouts)} payouts + ${fmtHex(result.reflections)} reflections`}
          />
          <div className="md:col-span-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">
            From <b className="text-[var(--text)]">{dayToISO(result.startDay)}</b> over{' '}
            <b className="text-[var(--text)]">{result.days} days</b> — pHEX ${result.pHexStart.toFixed(5)}, pSSH $
            {result.pSshStart.toFixed(6)} at entry.{' '}
            <b className={result.winner === 'pssh' ? 'text-orange-300' : 'text-[var(--text)]'}>
              {result.winner === 'pssh' ? 'pSSH' : 'The stake'} came out ahead by {result.ratio.toFixed(2)}×
            </b>{' '}
            in HEX terms.
          </div>
        </div>
      )}

      {/* ---- Every completed cycle at its own prices ---- */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Every completed cycle, entered on its own opening day
          </h3>
          <span className="text-xs text-[var(--text-faint)]">
            pSSH ahead in <b className="text-orange-300">{psshWins}</b> of {perCycle.length}
          </span>
        </div>
        <p className="mb-3 text-xs text-[var(--text-faint)]">
          Same {fmtUsd(amount)} in on each cycle&apos;s opening day, at that day&apos;s prices, held to the end of the record.
        </p>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                <th className="px-2 py-1.5 font-semibold">Cycle</th>
                <th className="px-2 py-1.5 font-semibold">Opened</th>
                <th className="px-2 py-1.5 text-right font-semibold">Stake</th>
                <th className="px-2 py-1.5 text-right font-semibold">pSSH</th>
                <th className="px-2 py-1.5 text-right font-semibold">Winner</th>
              </tr>
            </thead>
            <tbody>
              {perCycle.map(({ cycle, result: r }) => (
                <tr key={cycle.i} className="border-t border-[var(--line)]">
                  <td className="px-2 py-1.5 tabular-nums text-[var(--text-muted)]">#{cycle.i}</td>
                  <td className="px-2 py-1.5 tabular-nums text-[var(--text-muted)]">{dayToISO(cycle.d0)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-[var(--text)]">{fmtHex(r.stakeYield)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-[var(--text)]">{fmtHex(r.psshYield)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <span className={`text-xs font-bold ${r.winner === 'pssh' ? 'text-orange-300' : 'text-[var(--text-muted)]'}`}>
                      {r.winner === 'pssh' ? 'pSSH' : 'stake'} {r.ratio.toFixed(2)}×
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
        Replayed from a fixed on-chain record — HEX payouts, share rates, pHEX/pSSH prices and pSSH
        volume per day, snapshotted <b className="text-[var(--text-muted)]">{snap.meta.asOf}</b>. Both
        sides are measured in HEX, so this compares the two structures, not a HEX price call. Past
        cycles are not a forecast.
      </p>
    </div>
  );
}

function Side({
  title, sub, hex, won, detail, accent,
}: { title: string; sub: string; hex: number; won: boolean; detail: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        won ? 'border-orange-500/50 bg-orange-500/[0.07]' : 'border-[var(--line)] bg-[var(--surface)]'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-[var(--text)]">{title}</h3>
        {won && (
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            ahead
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--text-faint)]">{sub}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${accent ? 'text-orange-300' : 'text-[var(--text)]'}`}>
        +{fmtHex(hex)} <span className="text-sm font-semibold text-[var(--text-muted)]">HEX</span>
      </div>
      <div className="mt-1 text-[11px] tabular-nums text-[var(--text-faint)]">{detail}</div>
    </div>
  );
}
