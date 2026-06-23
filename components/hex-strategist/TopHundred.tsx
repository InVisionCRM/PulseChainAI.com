'use client';

// HEX "Top 100" leaderboards. A sub-tab per board; each fetches
// /api/hex/leaderboards?board=… and renders the columns relevant to it.

import { useEffect, useMemo, useState } from 'react';
import { IconRefresh, IconExternalLink, IconTrophy } from '@tabler/icons-react';
import type { Network } from '@/lib/hex/strategistData';
import { BOARDS, type BoardKey, type LeaderRow } from '@/lib/hex/leaderboards';
import { fmtHex, fmtTShares, fmtDuration, fmtHexDate } from '@/lib/hex/hexDay';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';

const addrUrl = (net: Network, a: string) =>
  net === 'ethereum' ? `https://etherscan.io/address/${a}` : pulsechainAddressUrl(a);

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtWhen = (ms?: number) => (ms ? new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '—');
const hx = (n?: number) => (n == null ? '—' : `${fmtHex(n)}`);
const days = (n?: number) => (n == null ? '—' : `${Math.round(n).toLocaleString()}d`);

interface Col {
  header: string;
  align?: 'right';
  render: (r: LeaderRow) => React.ReactNode;
  accent?: boolean;
}

const COLUMNS: Record<BoardKey, Col[]> = {
  'active-amount': [
    { header: 'Principal', align: 'right', accent: true, render: (r) => hx(r.principalHex) },
    { header: 'T-Shares', align: 'right', render: (r) => fmtTShares(r.tShares ?? 0) },
    { header: 'Ends in', align: 'right', render: (r) => (r.daysToEnd != null ? fmtDuration(r.daysToEnd) : '—') },
  ],
  'completed-amount': [
    { header: 'Principal', align: 'right', accent: true, render: (r) => hx(r.principalHex) },
    { header: 'Payout', align: 'right', render: (r) => hx(r.payoutHex) },
    { header: 'Served', align: 'right', render: (r) => days(r.servedDays) },
  ],
  roi: [
    { header: 'ROI', align: 'right', accent: true, render: (r) => (r.roiPct != null ? `${r.roiPct.toFixed(0)}%` : '—') },
    { header: 'Principal', align: 'right', render: (r) => hx(r.principalHex) },
    { header: 'Payout', align: 'right', render: (r) => hx(r.payoutHex) },
    { header: 'Served', align: 'right', render: (r) => days(r.servedDays) },
  ],
  'days-late': [
    { header: 'Days late', align: 'right', accent: true, render: (r) => days(r.daysLate) },
    { header: 'Committed', align: 'right', render: (r) => days(r.committedDays) },
    { header: 'Served', align: 'right', render: (r) => days(r.servedDays) },
    { header: 'Principal', align: 'right', render: (r) => hx(r.principalHex) },
  ],
  'recent-penalties': [
    { header: 'Penalty', align: 'right', accent: true, render: (r) => hx(r.penaltyHex) },
    { header: 'Payout', align: 'right', render: (r) => hx(r.payoutHex) },
    { header: 'Served', align: 'right', render: (r) => days(r.servedDays) },
    { header: 'When', align: 'right', render: (r) => fmtWhen(r.timestamp) },
  ],
  'recent-starts': [
    { header: 'Principal', align: 'right', accent: true, render: (r) => hx(r.principalHex) },
    { header: 'Length', align: 'right', render: (r) => (r.committedDays != null ? fmtDuration(r.committedDays) : '—') },
    { header: 'When', align: 'right', render: (r) => fmtWhen(r.timestamp) },
  ],
  'recent-ends': [
    { header: 'Principal', align: 'right', accent: true, render: (r) => hx(r.principalHex) },
    { header: 'Payout', align: 'right', render: (r) => hx(r.payoutHex) },
    { header: 'Penalty', align: 'right', render: (r) => hx(r.penaltyHex) },
    { header: 'When', align: 'right', render: (r) => fmtWhen(r.timestamp) },
  ],
  holders: [
    { header: 'Total', align: 'right', accent: true, render: (r) => hx(r.totalHex) },
    { header: 'Liquid', align: 'right', render: (r) => hx(r.liquidHex) },
    { header: 'Staked', align: 'right', render: (r) => hx(r.stakedHex) },
  ],
};

export default function TopHundred({ net }: { net: Network }) {
  const [board, setBoard] = useState<BoardKey>('active-amount');
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [note, setNote] = useState<string | undefined>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setRows([]);
    fetch(`/api/hex/leaderboards?network=${net}&board=${board}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { rows: LeaderRow[]; note?: string }) => {
        if (!alive) return;
        setRows(d.rows ?? []);
        setNote(d.note);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [net, board]);

  const cols = useMemo(() => COLUMNS[board], [board]);
  const active = BOARDS.find((b) => b.key === board)!;

  return (
    <div className="space-y-3">
      {/* Board picker */}
      <div className="flex flex-wrap gap-1.5">
        {BOARDS.map((b) => (
          <button
            key={b.key}
            onClick={() => setBoard(b.key)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
              board === b.key
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-1 text-xs text-[var(--text-muted)]">
        <IconTrophy className="h-3.5 w-3.5 text-amber-400" />
        <span>{active.blurb}</span>
      </div>

      {status === 'loading' && (
        <div className="grid place-items-center py-16 text-sm text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-2"><IconRefresh className="h-4 w-4 animate-spin" /> Loading the leaderboard…</span>
        </div>
      )}
      {status === 'error' && <div className="py-12 text-center text-sm text-red-300">Couldn’t load this leaderboard.</div>}
      {status === 'ready' && rows.length === 0 && (
        <div className="py-12 text-center text-sm text-[var(--text-faint)]">No rows for {net} yet.</div>
      )}

      {status === 'ready' && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                <th className="px-3 py-2 text-left font-semibold">#</th>
                <th className="px-3 py-2 text-left font-semibold">Address</th>
                {cols.map((c) => (
                  <th key={c.header} className={`px-3 py-2 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.rank}-${r.stakeId ?? r.address}`} className="border-b border-[var(--line-soft)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-3 py-2 tabular-nums text-[var(--text-faint)]">{r.rank}</td>
                  <td className="px-3 py-2">
                    <a
                      href={addrUrl(net, r.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[var(--text)] hover:text-amber-300"
                    >
                      {r.label ? <span className="font-sans font-semibold">{r.label}</span> : shortAddr(r.address)}
                      <IconExternalLink className="h-3 w-3 text-[var(--text-faint)]" />
                    </a>
                  </td>
                  {cols.map((c) => (
                    <td
                      key={c.header}
                      className={`px-3 py-2 tabular-nums ${c.align === 'right' ? 'text-right' : 'text-left'} ${
                        c.accent ? 'font-bold text-amber-200' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
        {note ? `${note} ` : ''}HEX amounts shown in whole HEX. Data from the staking subgraph
        {board === 'holders' ? ' + on-chain holder balances' : ''}.
      </p>
    </div>
  );
}
