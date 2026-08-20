'use client';

// The wall itself: every rescue, in whatever order the reader wants it.
//
// Sorting is client-side on purpose. The whole list is already in the page —
// the server sends it so the figures survive JavaScript being off and so link
// previews have something to read — and re-fetching it to reorder rows we
// already hold would be slower and worse.
//
// "Claimed first" is the sort worth having and the reason this exists: it is
// the only view that answers "did any of this actually reach anybody?".

import { useMemo, useState } from 'react';
import { IconArrowsSort } from '@tabler/icons-react';
import { RescueStakeCard } from './RescueStakeCard';
import type { Rescue } from '@/lib/hex/rescueFeed';

type SortKey = 'newest' | 'claimable' | 'penalty' | 'claimed' | 'oldest';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'claimable', label: 'Most saved' },
  { key: 'penalty', label: 'Worst hit' },
  { key: 'claimed', label: 'Claimed' },
  { key: 'oldest', label: 'Oldest' },
];

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
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const out = [...rescues];
    switch (sort) {
      case 'claimable':
        out.sort((a, b) => desc(a.claimableHex, b.claimableHex));
        break;
      case 'penalty':
        out.sort((a, b) => desc(a.penaltyHex, b.penaltyHex));
        break;
      case 'claimed':
        // Claimed first, most recently claimed at the top; everything else
        // keeps newest-first behind them.
        out.sort(
          (a, b) =>
            Number(b.claimed === true) - Number(a.claimed === true) ||
            desc(a.claimedAt, b.claimedAt) ||
            desc(a.timestamp, b.timestamp),
        );
        break;
      case 'oldest':
        out.sort((a, b) => a.timestamp - b.timestamp);
        break;
      default:
        out.sort((a, b) => desc(a.timestamp, b.timestamp));
    }
    return out;
  }, [rescues, sort]);

  const shown = showAll ? sorted : sorted.slice(0, cardLimit);

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <IconArrowsSort className="h-3.5 w-3.5 text-[var(--text-faint)]" aria-hidden="true" />
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSort(s.key)}
            aria-pressed={sort === s.key}
            className={`font-poppins rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              sort === s.key
                ? 'border-[var(--text-faint)] bg-[var(--surface-3)] text-[var(--text)]'
                : 'border-[var(--line)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

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
            : `Show all ${sorted.length.toLocaleString()} rescues`}
        </button>
      )}
    </>
  );
}
