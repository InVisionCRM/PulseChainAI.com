"use client";
import { useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import SearchModal from "./Screener/SearchModal";
import { useScreenerWatchlist } from "./Screener/watchlist";

// Sticky top search bar (mobile). Tapping it opens the canonical pair
// SearchModal — the same one used by the Screener "Search pairs" button and the
// bottom-nav Search — instead of a separate inline search.
export const MobileSearchBar = () => {
  const watchlist = useScreenerWatchlist();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="md:hidden w-full sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search pairs"
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text-faint)]"
        >
          <IconSearch className="h-4 w-4 text-[var(--text-muted)]" />
          <span>Search pairs…</span>
        </button>
      </div>
      <SearchModal open={open} onClose={() => setOpen(false)} watchlist={watchlist} />
    </>
  );
};
