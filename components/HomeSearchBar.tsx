'use client';

// Prominent token search at the top of the home page. Reuses the screener's
// SearchModal (tokens / pairs / address paste) and wraps the trigger in a subtle
// animated gradient border so it's easy to spot.

import React, { useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import SearchModal from '@/components/Screener/SearchModal';
import { useScreenerWatchlist } from '@/components/Screener/watchlist';

export default function HomeSearchBar() {
  const [open, setOpen] = useState(false);
  const watchlist = useScreenerWatchlist();

  return (
    <>
      {/* Animated gradient border: a slow-spinning conic gradient sits behind a
          slightly-inset inner bar, so a soft light travels around the edge. */}
      <div className="relative w-full overflow-hidden rounded-xl p-[1.5px]">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[-150%] animate-[spin_6s_linear_infinite]"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(250,70,22,0.9) 40deg, rgba(250,70,22,0.15) 80deg, transparent 140deg, transparent 360deg)',
          }}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search tokens"
          className="relative flex w-full items-center gap-3 rounded-[10px] border border-[var(--line-strong)] bg-[var(--surface-2)] px-4 py-3.5 text-left transition-colors hover:border-orange-500/50 hover:bg-[var(--surface-3)]"
        >
          <IconSearch className="h-5 w-5 shrink-0 text-orange-400" />
          <span className="flex-1 truncate text-sm font-medium text-[var(--text-muted)] sm:text-base">
            Search any token, pair, or paste an address…
          </span>
          <kbd className="hidden shrink-0 rounded border border-[var(--line)] bg-[var(--panel)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-faint)] sm:inline-block">
            /
          </kbd>
        </button>
      </div>

      <SearchModal open={open} onClose={() => setOpen(false)} watchlist={watchlist} />
    </>
  );
}
