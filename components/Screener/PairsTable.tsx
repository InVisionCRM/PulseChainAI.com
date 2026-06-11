'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { IconStar, IconStarFilled, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import type { ScreenerRow, ScreenerWindow } from '@/lib/screener/types';
import type { SortKey } from '@/lib/screener/db';
import { dexLogo, fmtAge, fmtNum, fmtPct, fmtPrice, fmtUsd, pctClass } from './format';
import type { ScreenerWatchlist } from './watchlist';

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
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-carbon-raised font-plexmono text-[10px] text-carbon-muted">
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
        <span className="rounded border border-carbon-line2 px-1 font-plexmono text-[9px] uppercase text-carbon-dim">{row.label}</span>
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
    <div className="max-h-[calc(100vh-150px)] overflow-auto rounded-md border border-carbon-line">
      <table className="w-full min-w-[1120px] border-collapse font-plex text-[13px]">
        <thead className="sticky top-0 z-10 bg-carbon-surface">
          <tr className="text-[11px] uppercase tracking-wider text-carbon-dim">
            {HEADERS.map((h) => {
              const active = h.sort !== null && sort === h.sort;
              const windowCol = ['m5', 'h1', 'h6', 'h24'].includes(h.key) && h.key === window;
              return (
                <th
                  key={h.key}
                  onClick={h.sort ? () => onSort(h.sort!) : undefined}
                  className={`whitespace-nowrap px-3 py-2.5 font-medium ${h.align === 'right' ? 'text-right' : 'text-left'} ${
                    h.sort ? 'cursor-pointer select-none hover:text-carbon-text' : ''
                  } ${active || (windowCol && !sort) ? 'text-carbon-gold' : ''}`}
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
                className="cursor-pointer border-t border-carbon-line transition-colors hover:bg-carbon-surface"
              >
                <td className="w-8 px-2 py-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      watchlist.toggleRow(row);
                    }}
                    className={`transition-colors ${starred ? 'text-carbon-gold' : 'text-carbon-dim hover:text-carbon-gold'}`}
                    aria-label={starred ? 'Remove from watchlist' : 'Add to watchlist'}
                  >
                    {starred ? <IconStarFilled className="h-3.5 w-3.5" /> : <IconStar className="h-3.5 w-3.5" />}
                  </button>
                </td>
                <td className="px-3 py-2 font-plexmono text-[11px] text-carbon-dim">#{i + 1}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <DexBadge row={row} />
                    <TokenLogo row={row} />
                    <span className="font-medium text-carbon-text">{row.baseSymbol ?? '?'}</span>
                    <span className="text-carbon-dim">/{row.quoteSymbol ?? '?'}</span>
                    {row.chainId === 'ethereum' ? (
                      <span className="rounded-sm border border-carbon-line2 px-1 py-px font-plexmono text-[9px] uppercase text-carbon-muted">ETH</span>
                    ) : null}
                    {row.gold ? (
                      <span className="rounded-sm bg-carbon-gold px-1 py-px text-[9px] font-semibold text-black">GOLD</span>
                    ) : null}
                    <span className="hidden max-w-[180px] truncate text-carbon-dim lg:inline">{row.baseName}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-plexmono text-carbon-gold">{fmtUsd(row.marketCap)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-plexmono text-carbon-text">{fmtPrice(row.priceUsd)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-plexmono text-carbon-muted">{fmtAge(row.pairCreatedAt)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-plexmono text-carbon-text">{fmtNum(row.txns[window])}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-plexmono text-carbon-text">{fmtUsd(row.vol[window])}</td>
                {(['m5', 'h1', 'h6', 'h24'] as const).map((w) => (
                  <td key={w} className={`whitespace-nowrap px-3 py-2 text-right font-plexmono ${pctClass(row.chg[w])}`}>
                    {fmtPct(row.chg[w])}
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right font-plexmono text-carbon-text">{fmtUsd(row.liquidityUsd)}</td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={HEADERS.length} className="px-3 py-12 text-center text-sm text-carbon-dim">
                {loading ? 'Loading pairs…' : emptyHint}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
