'use client';

// Choose the token on the other side of a comparison.
//
// Search runs through our own /api/search, so it finds tokens on every chain we
// support and works the same way for both sides of the card.

import { useEffect, useMemo, useState } from 'react';
import { IconSearch, IconX } from '@tabler/icons-react';
import { MAX_SIDES, WINDOWS, searchTokens, type SearchHit, type WindowDays } from '@/lib/geicko/compare';
import { SHARE_GRAD } from './ShareCardModal';

export interface ComparePickerProps {
  /** The token already on screen — never offered as one of its own rivals. */
  selfAddress: string;
  selfSymbol: string;
  /** Results on this chain rank first; two tokens often share a ticker. */
  selfChain: string;
  /** The rivals, in pick order. The token on screen is always the first side. */
  picked: SearchHit[];
  onChange: (next: SearchHit[]) => void;
  windowDays: WindowDays;
  onWindow: (d: WindowDays) => void;
}

const money = (n: number | null) =>
  n == null ? '—'
    : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M`
      : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k`
        : `$${n.toFixed(0)}`;

export default function ComparePicker({
  selfAddress, selfSymbol, selfChain, picked, onChange, windowDays, onWindow,
}: ComparePickerProps) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const self = selfAddress.toLowerCase();
  // The token on screen counts as one of the four.
  const full = picked.length >= MAX_SIDES - 1;
  const taken = useMemo(
    () => new Set([self, ...picked.map((p) => p.baseAddress.toLowerCase())]),
    [self, picked],
  );

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      const found = await searchTokens(term, selfChain);
      if (!alive) return;
      setHits(found.filter((h) => !taken.has(h.baseAddress?.toLowerCase())));
      setBusy(false);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, taken, selfChain]);

  return (
    <div className="mb-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text)]">
          {selfSymbol}
          <span className="ml-1 text-[10px] font-normal text-[var(--text-faint)]">on screen</span>
        </span>
        {picked.map((h) => (
          <span
            key={h.baseAddress}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-2 pr-1.5 text-[11px] font-bold text-[var(--text)]"
          >
            {h.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={h.imageUrl} alt="" className="h-4 w-4 rounded-full" />
            )}
            {h.baseSymbol}
            <button
              type="button"
              onClick={() => onChange(picked.filter((x) => x.baseAddress !== h.baseAddress))}
              aria-label={`Remove ${h.baseSymbol}`}
              className="rounded p-0.5 text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              <IconX className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {!full && (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
            <IconSearch className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={picked.length ? 'Add another token…' : `Compare ${selfSymbol} against…`}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
            />
            {busy && <span className="text-[10px] text-[var(--text-faint)]">…</span>}
          </div>
          {hits.length > 0 && (
            <ul className="max-h-[20vh] space-y-1 overflow-y-auto overscroll-contain">
              {hits.map((h) => (
                <li key={h.baseAddress}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...picked, h]);
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
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                      {h.chain}
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
      {full && (
        <p className="px-1 text-[11px] text-[var(--text-faint)]">
          Four tokens is the most a card stays readable with.
        </p>
      )}

      <div className="flex items-center gap-2 border-t border-[var(--line)] pt-2">
        <span className="w-[68px] shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-faint)]">
          Window
        </span>
        <div className="flex gap-1.5">
          {WINDOWS.map((d) => {
            const on = d === windowDays;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onWindow(d)}
                aria-pressed={on}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  on ? 'border-transparent text-white' : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface)]'
                }`}
                style={on ? { background: SHARE_GRAD } : undefined}
              >
                {d}d
              </button>
            );
          })}
        </div>
        <span className="text-[10px] text-[var(--text-faint)]">for the chart cards</span>
      </div>
    </div>
  );
}
