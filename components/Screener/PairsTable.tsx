'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { ScreenerRow, ScreenerWindow } from '@/lib/screener/types';
import { dexLogo, fmtAge, fmtNum, fmtPct, fmtPrice, fmtUsd, pctClass } from './format';

interface Props {
  rows: ScreenerRow[];
  window: ScreenerWindow;
  loading: boolean;
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

const HEADERS: { key: string; label: string; align: 'left' | 'right' }[] = [
  { key: 'rank', label: '#', align: 'left' },
  { key: 'token', label: 'Token', align: 'left' },
  { key: 'mcap', label: 'MCAP', align: 'right' },
  { key: 'price', label: 'Price', align: 'right' },
  { key: 'age', label: 'Age', align: 'right' },
  { key: 'txns', label: 'Txns', align: 'right' },
  { key: 'volume', label: 'Volume', align: 'right' },
  { key: 'm5', label: '5M', align: 'right' },
  { key: 'h1', label: '1H', align: 'right' },
  { key: 'h6', label: '6H', align: 'right' },
  { key: 'h24', label: '24H', align: 'right' },
  { key: 'liq', label: 'Liquidity', align: 'right' },
];

export default function PairsTable({ rows, window, loading }: Props) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-md border border-carbon-line">
      <table className="w-full min-w-[1080px] border-collapse font-plex text-[13px]">
        <thead className="sticky top-0 z-10 bg-carbon-surface">
          <tr className="text-[11px] uppercase tracking-wider text-carbon-dim">
            {HEADERS.map((h) => (
              <th
                key={h.key}
                className={`whitespace-nowrap px-3 py-2.5 font-medium ${h.align === 'right' ? 'text-right' : 'text-left'} ${
                  ['m5', 'h1', 'h6', 'h24'].includes(h.key) && h.key === window ? 'text-carbon-gold' : ''
                } ${['txns', 'volume'].includes(h.key) ? 'text-carbon-muted' : ''}`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.pairAddress}
              onClick={() => row.baseAddress && router.push(`/geicko?address=${row.baseAddress}`)}
              className="cursor-pointer border-t border-carbon-line transition-colors hover:bg-carbon-surface"
            >
              <td className="px-3 py-2 font-plexmono text-[11px] text-carbon-dim">#{i + 1}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <DexBadge row={row} />
                  <TokenLogo row={row} />
                  <span className="font-medium text-carbon-text">{row.baseSymbol ?? '?'}</span>
                  <span className="text-carbon-dim">/{row.quoteSymbol ?? '?'}</span>
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
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={HEADERS.length} className="px-3 py-12 text-center text-sm text-carbon-dim">
                {loading ? 'Loading pairs…' : 'No pairs found. Run the backfill (npm run screener:backfill) to populate the universe.'}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
