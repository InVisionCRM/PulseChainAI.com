'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { IconStar, IconStarFilled, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import type { ScreenerRow, ScreenerWindow } from '@/lib/screener/types';
import type { SortKey } from '@/lib/screener/db';
import { dexLogo, fmtAge, fmtNum, fmtPct, fmtPrice, fmtUsd, pctClass } from './format';
import type { ScreenerWatchlist } from './watchlist';
import { ChainLogo } from '@/components/ui/ChainLogo';

// Token names are clamped to 15 characters (then ellipsised) so a long name
// can't push the metric columns around.
const clampName = (n: string | null | undefined) =>
  n && n.length > 15 ? `${n.slice(0, 15)}…` : n;

interface Props {
  rows: ScreenerRow[];
  window: ScreenerWindow;
  loading: boolean;
  sort: SortKey | null;
  dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  watchlist: ScreenerWatchlist;
  emptyHint: string;
}

function TokenLogo({ row }: { row: ScreenerRow }) {
  const [failed, setFailed] = React.useState(false);
  if (!row.imageUrl || failed) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70">
        {(row.baseSymbol ?? '?').charAt(0)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.imageUrl} alt="" className="h-6 w-6 shrink-0 rounded-full" onError={() => setFailed(true)} loading="lazy" />
  );
}

function DexBadge({ row }: { row: ScreenerRow }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <div className="flex shrink-0 items-center gap-1">
      {row.dexId && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dexLogo(row.dexId)} alt={row.dexId} className="h-4 w-4 rounded-full" onError={() => setFailed(true)} loading="lazy" />
      ) : null}
      {row.label ? (
        <span className="rounded border border-white/20 px-1 text-[9px] uppercase text-white/50">{row.label}</span>
      ) : null}
    </div>
  );
}

const HEADERS: { key: string; label: string; align: 'left' | 'right'; sort: SortKey | null }[] = [
  { key: 'star', label: '', align: 'left', sort: null },
  { key: 'rank', label: '#', align: 'left', sort: null },
  { key: 'token', label: 'Token', align: 'left', sort: null },
  { key: 'mcap', label: 'MCAP', align: 'right', sort: 'mcap' },
  { key: 'price', label: 'Price', align: 'right', sort: 'price' },
  { key: 'age', label: 'Age', align: 'right', sort: 'age' },
  { key: 'txns', label: 'Txns', align: 'right', sort: 'txns' },
  { key: 'volume', label: 'Volume', align: 'right', sort: 'volume' },
  { key: 'm5', label: '5M', align: 'right', sort: 'm5' },
  { key: 'h1', label: '1H', align: 'right', sort: 'h1' },
  { key: 'h6', label: '6H', align: 'right', sort: 'h6' },
  { key: 'h24', label: '24H', align: 'right', sort: 'h24' },
  { key: 'liq', label: 'Liquidity', align: 'right', sort: 'liq' },
];

export default function PairsTable({ rows, window, loading, sort, dir, onSort, watchlist, emptyHint }: Props) {
  const router = useRouter();

  return (
    <div className="max-h-[calc(100vh-150px)] overflow-auto rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl">
      <table className="w-full min-w-[1120px] border-collapse text-[13px]">
        <thead className="sticky top-0 z-30 bg-[#0d2a4d]/95 backdrop-blur-xl">
          <tr className="text-[11px] uppercase tracking-wider text-white/50">
            {HEADERS.map((h) => {
              const active = h.sort !== null && sort === h.sort;
              const windowCol = ['m5', 'h1', 'h6', 'h24'].includes(h.key) && h.key === window;
              // The identity block (star · rank · token) is frozen to the left so
              // it stays visible while the metric columns scroll horizontally.
              const frozen =
                h.key === 'star'
                  ? 'sticky left-0 z-30 w-9 bg-[#0d2a4d]'
                  : h.key === 'rank'
                    ? 'sticky left-9 z-30 w-12 bg-[#0d2a4d]'
                    : h.key === 'token'
                      ? 'sticky left-[84px] z-30 bg-[#0d2a4d] shadow-[6px_0_8px_-6px_rgba(0,0,0,0.55)]'
                      : '';
              return (
                <th
                  key={h.key}
                  onClick={h.sort ? () => onSort(h.sort!) : undefined}
                  className={`whitespace-nowrap px-3 py-2.5 font-semibold ${frozen} ${h.align === 'right' ? 'text-right' : 'text-left'} ${
                    h.sort ? 'cursor-pointer select-none hover:text-white' : ''
                  } ${active || (windowCol && !sort) ? 'text-orange-300' : ''}`}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {h.label}
                    {active ? (
                      dir === 'desc' ? <IconArrowDown className="h-3 w-3" /> : <IconArrowUp className="h-3 w-3" />
                    ) : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const starred = watchlist.has(row.baseAddress, row.chainId === 'ethereum' ? 'ethereum' : 'pulsechain');
            return (
              <tr
                key={`${row.chainId ?? 'pulsechain'}:${row.pairAddress}`}
                onClick={() => row.baseAddress && router.push(`/geicko?address=${row.baseAddress}`)}
                className="group cursor-pointer border-t border-white/10 transition-colors hover:bg-white/5"
              >
                <td className="sticky left-0 z-20 w-9 bg-[#0e2748] px-2 py-2 group-hover:bg-[#17314f]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      watchlist.toggleRow(row);
                    }}
                    className={`transition-colors ${starred ? 'text-orange-400' : 'text-white/30 hover:text-orange-400'}`}
                    aria-label={starred ? 'Remove from watchlist' : 'Add to watchlist'}
                  >
                    {starred ? <IconStarFilled className="h-3.5 w-3.5" /> : <IconStar className="h-3.5 w-3.5" />}
                  </button>
                </td>
                <td className="sticky left-9 z-20 w-12 bg-[#0e2748] px-2 py-2 text-[11px] text-white/40 tabular-nums group-hover:bg-[#17314f]">#{i + 1}</td>
                <td className="sticky left-[84px] z-20 bg-[#0e2748] px-3 py-2 shadow-[6px_0_8px_-6px_rgba(0,0,0,0.55)] group-hover:bg-[#17314f]">
                  <div className="flex items-center gap-2">
                    <DexBadge row={row} />
                    <TokenLogo row={row} />
                    <span className="font-semibold text-white">{row.baseSymbol ?? '?'}</span>
                    <span className="text-white/40">/{row.quoteSymbol ?? '?'}</span>
                    {row.chainId === 'ethereum' ? (
                      <ChainLogo chain="ethereum" size={14} />
                    ) : null}
                    {row.gold ? (
                      <span className="rounded-sm bg-yellow-500 px-1 py-px text-[9px] font-bold text-black">GOLD</span>
                    ) : null}
                    <span className="hidden max-w-[180px] truncate text-white/40 lg:inline">{clampName(row.baseName)}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-orange-300 tabular-nums">{fmtUsd(row.marketCap)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-white tabular-nums">{fmtPrice(row.priceUsd)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-white/60 tabular-nums">{fmtAge(row.pairCreatedAt)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-white tabular-nums">{fmtNum(row.txns[window])}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-white tabular-nums">{fmtUsd(row.vol[window])}</td>
                {(['m5', 'h1', 'h6', 'h24'] as const).map((w) => (
                  <td key={w} className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${pctClass(row.chg[w])}`}>
                    {fmtPct(row.chg[w])}
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right text-white tabular-nums">{fmtUsd(row.liquidityUsd)}</td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={HEADERS.length} className="px-3 py-12 text-center text-sm text-white/40">
                {loading ? 'Loading pairs…' : emptyHint}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
