"use client";

// Sidebar entry point for the AI Code Reader. Styled like the SidebarLink rows,
// but it opens the site's search instead of navigating: whatever is picked there
// (a token, a pair, a pasted contract) opens in the reader on its Code tab.

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { CodeGlyph } from './NavGlyphs';
import SearchModal from '@/components/Screener/SearchModal';
import { useScreenerWatchlist } from '@/components/Screener/watchlist';
import { cn } from '@/lib/utils';

export default function CodeReaderNavButton() {
  const watchlist = useScreenerWatchlist();
  const [open, setOpen] = useState(false);
  const active = usePathname() === '/ai-agent';
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors",
          active
            ? "bg-[var(--surface-2)] text-orange-300"
            : "text-[var(--text)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
        )}
      >
        <CodeGlyph />
        <span
          className={cn(
            "inline-block whitespace-pre text-xs md:text-sm",
            active ? "font-medium text-orange-300" : "text-[var(--text)]",
          )}
        >
          Code Reader
        </span>
      </button>
      <SearchModal open={open} onClose={() => setOpen(false)} watchlist={watchlist} forCodeReader />
    </>
  );
}
