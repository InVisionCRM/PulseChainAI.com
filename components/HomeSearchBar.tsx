'use client';

// Prominent token search at the top of the home page. Reuses the screener's
// SearchModal (tokens / pairs / address paste). A clean orange-tinted border
// (no animation) keeps it easy to spot without being distracting.

import React, { useState } from 'react';
import { ArtIcon } from '@/components/ui/ArtIcon';
import SearchModal from '@/components/Screener/SearchModal';
import { useScreenerWatchlist } from '@/components/Screener/watchlist';

export default function HomeSearchBar() {
  const [open, setOpen] = useState(false);
  const watchlist = useScreenerWatchlist();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search tokens"
        className="flex w-full items-center gap-3 rounded-xl border border-orange-500/40 bg-[var(--surface-2)] px-4 py-3.5 text-left transition-colors hover:border-orange-500/70 hover:bg-[var(--surface-3)]"
      >
        <ArtIcon src="/search-icon.png" alt="" className="h-5 w-5" />
        <span className="flex-1 truncate text-sm font-medium text-[var(--text-muted)] sm:text-base">
          Search any token, pair, or paste an address…
        </span>
        <kbd className="hidden shrink-0 rounded border border-[var(--line)] bg-[var(--panel)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-faint)] sm:inline-block">
          /
        </kbd>
      </button>

      <SearchModal open={open} onClose={() => setOpen(false)} watchlist={watchlist} />
    </>
  );
}
