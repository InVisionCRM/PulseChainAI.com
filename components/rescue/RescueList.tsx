'use client';

// The wall itself: every rescue, in whatever order the reader wants it.
//
// Sorting is client-side on purpose. The whole list is already in the page —
// the server sends it so the figures survive JavaScript being off and so link
// previews have something to read — and re-fetching it to reorder rows we
// already hold would be slower and worse.
//
// The "Collected" filter is the view worth having and the reason this exists:
// it is the only one that answers "did any of this actually reach anybody?".
// The search is for the other reader — an owner who followed the note in
// their own transaction and wants their stake, not a thousand strangers'.

import { useMemo, useState } from 'react';
import { IconArrowsSort, IconSearch, IconX } from '@tabler/icons-react';
import { RescueStakeCard } from './RescueStakeCard';
import type { Rescue } from '@/lib/hex/rescueFeed';

type SortKey = 'newest' | 'claimable' | 'penalty' | 'oldest';
type FilterKey = 'all' | 'collected' | 'frozen';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'claimable', label: 'Most saved' },
  { key: 'penalty', label: 'Worst hit' },
  { key: 'oldest', label: 'Oldest' },
];

/** `claimed === null` (the lookup failed) matches neither side — an unknown
 *  must not be listed as "still frozen" any more than as "collected". */
const FILTERS: { key: FilterKey; label: string; test: (r: Rescue) => boolean }[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'collected', label: 'Collected', test: (r) => r.claimed === true },
  { key: 'frozen', label: 'Still frozen', test: (r) => r.claimed === false },
];

/** Stake ids are matched whole ("#12" must not find #1234); addresses by
 *  substring, so a pasted prefix or partial address works. */
function matches(r: Rescue, q: string): boolean {
  if (/^#?\d+$/.test(q)) return r.stakeId === q.replace('#', '');
  return r.stakerAddr.toLowerCase().includes(q);
}

/** Nulls sort last whichever way the column runs — an unpriced rescue is
 *  "unknown", and unknown at the top of a leaderboard is just noise. */
const desc = (a: number | null | undefined, b: number | null | undefined) =>
  (b ?? -Infinity) - (a ?? -Infinity);

export function RescueList({
  rescues,
  hexUsd,
  cardLimit,
}: {
  rescues: Rescue[];
  hexUsd?: number | null;
  cardLimit: number;
}) {
  const [sort, setSort] = useState<SortKey>('newest');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const q = query.trim().toLowerCase();
  const searched = useMemo(() => (q ? rescues.filter((r) => matches(r, q)) : rescues), [rescues, q]);
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, searched.filter(f.test).length])) as Record<FilterKey, number>,
    [searched],
  );

  const sorted = useMemo(() => {
    const test = FILTERS.find((f) => f.key === filter)!.test;
    const out = searched.filter(test);
    switch (sort) {
      case 'claimable':
        out.sort((a, b) => desc(a.claimableHex, b.claimableHex));
        break;
      case 'penalty':
        out.sort((a, b) => desc(a.penaltyHex, b.penaltyHex));
        break;
      case 'oldest':
        out.sort((a, b) => a.timestamp - b.timestamp);
        break;
      default:
        out.sort((a, b) => desc(a.timestamp, b.timestamp));
    }
    return out;
  }, [searched, filter, sort]);

  const shown = showAll ? sorted : sorted.slice(0, cardLimit);

  const chip = (active: boolean) =>
    `font-poppins rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
      active
        ? 'border-[var(--text-faint)] bg-[var(--surface-3)] text-[var(--text)]'
        : 'border-[var(--line)] text-[var(--text-muted)] hover:text-[var(--text)]'
    }`;

  return (
    <>
      <label className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 focus-within:border-[var(--text-faint)]">
        <IconSearch className="h-4 w-4 shrink-0 text-[var(--text-faint)]" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find your stake — wallet address or stake #"
          aria-label="Search rescues by wallet address or stake number"
          spellCheck={false}
          autoComplete="off"
          className="font-poppins w-full min-w-0 bg-transparent text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="shrink-0 text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={chip(filter === f.key)}
          >
            {f.label} <span className="tabular-nums text-[var(--text-faint)]">{counts[f.key].toLocaleString()}</span>
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-[var(--line)]" aria-hidden="true" />
        <IconArrowsSort className="h-3.5 w-3.5 text-[var(--text-faint)]" aria-hidden="true" />
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSort(s.key)}
            aria-pressed={sort === s.key}
            className={chip(sort === s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="font-poppins mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[12px] text-[var(--text-muted)]">
          {q
            ? 'No rescue by this keeper matches that address or stake number.'
            : 'Nothing in this view yet.'}
        </div>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {shown.map((r) => (
          <RescueStakeCard key={r.txHash} rescue={r} hexUsd={hexUsd} />
        ))}
      </div>

      {sorted.length > cardLimit && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="font-poppins mt-3 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-[12px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          {showAll
            ? `Show the newest ${cardLimit.toLocaleString()}`
            : `Show all ${sorted.length.toLocaleString()}`}
        </button>
      )}
    </>
  );
}
