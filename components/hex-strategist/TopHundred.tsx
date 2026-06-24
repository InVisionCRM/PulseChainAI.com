'use client';

// HEX "Top 100" leaderboards. A sub-tab per board; each fetches
// /api/hex/leaderboards?board=… and renders the columns relevant to it.
// Rows are clickable — they open a drill-down with the staker's stake history
// and HEX activity. Each row can copy its address or add it to the portfolio.

import { useEffect, useMemo, useState } from 'react';
import {
  IconRefresh, IconExternalLink, IconTrophy, IconCopy, IconCheck,
  IconCirclePlus, IconX,
} from '@tabler/icons-react';
import { type Network, type Rates, loadRates } from '@/lib/hex/strategistData';
import { BOARDS, type BoardKey, type LeaderRow } from '@/lib/hex/leaderboards';
import { fmtHex, fmtTShares, fmtDuration, fmtHexDate, HEX_ADDRESS } from '@/lib/hex/hexDay';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import { HexStakes } from '@/components/portfolio/HexStakes';
import { ActivityFeed } from '@/components/portfolio/ActivityFeed';

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
    { header: 'Overdue', align: 'right', accent: true, render: (r) => days(r.daysLate) },
    { header: 'Length', align: 'right', render: (r) => (r.committedDays != null ? fmtDuration(r.committedDays) : '—') },
    { header: 'Principal', align: 'right', render: (r) => hx(r.principalHex) },
    { header: 'Due', align: 'right', render: (r) => (r.endDay != null ? fmtHexDate(r.endDay) : '—') },
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
  const [rates, setRates] = useState<Rates | null>(null);
  const [detail, setDetail] = useState<string | null>(null); // address being inspected

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

  // Rates power the stake drill-down (USD + yield estimates). Best-effort.
  useEffect(() => {
    let alive = true;
    loadRates(net).then((r) => alive && setRates(r)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [net]);

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
        <span>{active.blurb} · tap a row for stake details.</span>
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
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                <th className="px-3 py-2 text-left font-semibold">#</th>
                <th className="px-3 py-2 text-left font-semibold">Address</th>
                {cols.map((c) => (
                  <th key={c.header} className={`px-3 py-2 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {c.header}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.rank}-${r.stakeId ?? r.address}`}
                  onClick={() => setDetail(r.address)}
                  className="cursor-pointer border-b border-[var(--line-soft)] last:border-0 hover:bg-[var(--surface-2)]"
                >
                  <td className="px-3 py-2 tabular-nums text-[var(--text-faint)]">{r.rank}</td>
                  <td className="px-3 py-2">
                    <a
                      href={addrUrl(net, r.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
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
                  <td className="px-3 py-2">
                    <RowActions address={r.address} net={net} />
                  </td>
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

      {detail && (
        <StakeDetailModal address={detail} net={net} rates={rates} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

// Copy address + add-to-portfolio, with transient confirmation. stopPropagation
// so these never trigger the row's drill-down.
function RowActions({ address, net }: { address: string; net: Network }) {
  const addWallet = usePortfolioStore((s) => s.addWallet);
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }, () => {});
  };
  const add = (e: React.MouseEvent) => {
    e.stopPropagation();
    addWallet(address, undefined, [net]);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" onClick={copy} title="Copy address" className="text-[var(--text-faint)] hover:text-[var(--text)]">
        {copied ? <IconCheck className="h-4 w-4 text-[var(--up)]" /> : <IconCopy className="h-4 w-4" />}
      </button>
      <button type="button" onClick={add} title="Add to portfolio" className="text-[var(--text-faint)] hover:text-amber-300">
        {added ? <IconCheck className="h-4 w-4 text-[var(--up)]" /> : <IconCirclePlus className="h-4 w-4" />}
      </button>
    </div>
  );
}

// Drill-down: the staker's stake history + their HEX activity.
function StakeDetailModal({ address, net, rates, onClose }: { address: string; net: Network; rates: Rates | null; onClose: () => void }) {
  const [tab, setTab] = useState<'stakes' | 'activity'>('stakes');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[var(--line)] bg-[var(--panel)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] p-3">
          <div className="flex items-center gap-2">
            <a
              href={addrUrl(net, address)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-sm text-[var(--text)] hover:text-amber-300"
            >
              {shortAddr(address)}
              <IconExternalLink className="h-3.5 w-3.5 text-[var(--text-faint)]" />
            </a>
            <RowActions address={address} net={net} />
          </div>
          <button type="button" onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text)]">
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 pt-3">
          <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
            <button
              onClick={() => setTab('stakes')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${tab === 'stakes' ? 'bg-[var(--surface-2)] text-amber-300' : 'text-[var(--text-muted)]'}`}
            >
              Stake history
            </button>
            <button
              onClick={() => setTab('activity')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${tab === 'activity' ? 'bg-[var(--surface-2)] text-amber-300' : 'text-[var(--text-muted)]'}`}
            >
              HEX activity
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === 'stakes' ? (
            <HexStakes address={address} hexUsd={rates?.priceUsd ?? null} payoutPerTShare={rates?.dailyPayoutPerTShare ?? null} />
          ) : (
            <ActivityFeed walletAddress={address} chains={[net]} tokenAddress={HEX_ADDRESS} />
          )}
        </div>
      </div>
    </div>
  );
}
