"use client";
import { useEffect, useState } from "react";
import { ArtIcon } from "@/components/ui/ArtIcon";
import SearchModal from "./Screener/SearchModal";
import { useScreenerWatchlist } from "./Screener/watchlist";

// Desktop search on the geicko page. Opens the canonical pair SearchModal —
// the same one behind the home page bar, the mobile sticky bar and the
// bottom-nav Search — instead of the inline Blockscout dropdown this used to
// run. That dropdown was the one search in the app that could not open the
// pairs modal: it predated the modal, searched a different upstream, and when
// Blockscout didn't answer it showed nothing at all. One search, one modal,
// one result shape everywhere.
export const DesktopSearchBar = ({
  bindShortcuts = true,
  neon = false,
}: {
  /** Bind "/" and Ctrl/Cmd+K. Exactly one mounted bar may own them —
   *  two listeners means two modals open on one keypress. */
  bindShortcuts?: boolean;
  /** Neon outline, for the copy that sits in the nav column. */
  neon?: boolean;
} = {}) => {
  const watchlist = useScreenerWatchlist();
  const [open, setOpen] = useState(false);

  // The same shortcuts the screener taught people: "/" and Ctrl/Cmd+K.
  useEffect(() => {
    if (!bindShortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (!typing && (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"))) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bindShortcuts]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search pairs"
        className={
          neon
            ? "flex h-8 w-full items-center gap-2 rounded-lg border border-cyan-400/40 bg-[var(--panel)] px-3 text-sm text-[var(--text-faint)] shadow-[0_0_10px_-2px_rgba(34,211,238,0.45)] transition-all hover:border-cyan-300/70 hover:text-[var(--text-muted)] hover:shadow-[0_0_14px_-1px_rgba(34,211,238,0.65)]"
            : "flex h-8 w-full items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--text-faint)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text-muted)]"
        }
      >
        <ArtIcon src="/search-icon.png" alt="" className="h-4 w-4" />
        <span className="flex-1 truncate text-left">Search pairs…</span>
        <kbd className="shrink-0 rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-faint)]">
          /
        </kbd>
      </button>
      <SearchModal open={open} onClose={() => setOpen(false)} watchlist={watchlist} />
    </>
  );
};
