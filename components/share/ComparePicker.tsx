'use client';

// Choose the token on the other side of a comparison.
//
// Search runs through our own /api/search, so it finds tokens on every chain we
// support and works the same way for both sides of the card.

import { useEffect, useMemo, useState } from 'react';
import { IconSearch, IconX } from '@tabler/icons-react';
import { searchTokens, type SearchHit } from '@/lib/geicko/compare';

export interface ComparePickerProps {
  /** The token already on screen — never offered as its own rival. */
  selfAddress: string;
  selfSymbol: string;
  picked: SearchHit | null;
  onPick: (hit: SearchHit | null) => void;
}

const money = (n: number | null) =>
  n == null ? '—'
    : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M`
      : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k`
        : `$${n.toFixed(0)}`;

export default function ComparePicker({ selfAddress, selfSymbol, picked, onPick }: ComparePickerProps) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const self = selfAddress.toLowerCase();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      const found = await searchTokens(term);
      if (!alive) return;
      setHits(found.filter((h) => h.baseAddress?.toLowerCase() !== self));
      setBusy(false);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, self]);

  const label = useMemo(
    () => (picked ? `${selfSymbol} vs ${picked.baseSymbol}` : null),
    [picked, selfSymbol],
  );

  return (
    <div className="mb-2 space-y-2">
      {picked ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
          {picked.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picked.imageUrl} alt="" className="h-6 w-6 rounded-full" />
          )}
          <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-[var(--text)]">{label}</span>
          <span className="text-[11px] text-[var(--text-faint)]">{picked.chain}</span>
          <button
            type="button"
            onClick={() => onPick(null)}
            aria-label="Clear the comparison"
            className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
            <IconSearch className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Compare ${selfSymbol} against…`}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
            />
            {busy && <span className="text-[10px] text-[var(--text-faint)]">…</span>}
          </div>
          {hits.length > 0 && (
            <ul className="max-h-[22vh] space-y-1 overflow-y-auto overscroll-contain">
              {hits.map((h) => (
                <li key={h.baseAddress}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(h);
                      setQ('');
                      setHits([]);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--surface)]"
                  >
                    {h.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.imageUrl} alt="" className="h-5 w-5 rounded-full" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-[var(--text)]">
                      {h.baseSymbol}
                      <span className="ml-1.5 font-normal text-[var(--text-faint)]">{h.baseName}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{money(h.marketCap)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && !busy && hits.length === 0 && (
            <p className="px-1 text-[11px] text-[var(--text-faint)]">Nothing found for that.</p>
          )}
        </>
      )}
    </div>
  );
}
