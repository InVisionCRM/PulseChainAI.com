"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArtIcon } from "@/components/ui/ArtIcon";
import { NavigationDrawer } from "./NavigationDrawer";
import SearchModal from "./Screener/SearchModal";
import WatchlistModal from "./WatchlistModal";
import { useScreenerWatchlist } from "./Screener/watchlist";

type NavItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  external?: boolean;
  isAction?: boolean;
};

export const MobileBottomNav = () => {
  const pathname = usePathname();
  const watchlist = useScreenerWatchlist();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);

  const navItems: NavItem[] = [
    {
      label: "Home",
      href: "/",
      icon: <ArtIcon src="/home-icon.png" alt="Home" />,
    },
    {
      label: "Search",
      onClick: () => setIsSearchOpen(true),
      icon: <ArtIcon src="/search-icon.png" alt="Search" />,
      isAction: true,
    },
    {
      label: "Portfolio",
      href: "/portfolio",
      icon: <ArtIcon src="/wallet-icon.png" alt="Portfolio" />,
    },
    {
      // "SuperStake" measured wider than its column and truncated at 360 and
      // 390px; the logo beside it already carries the brand.
      label: "Stake",
      href: "/superstake",
      icon: <ArtIcon src="/superstake-logo.png" alt="SuperStake" />,
    },
    {
      label: "Watchlist",
      onClick: () => setIsWatchlistOpen(true),
      icon: <ArtIcon src="/watchlist-eye.png" alt="Watchlist" mask />,
      isAction: true,
    },
  ];

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--panel)] border-t border-[var(--line)] backdrop-blur-xl">
        {/* Six equal columns. Left to size themselves, the labels needed 436px
            against a 390px phone and pushed "More" clean off the right edge —
            rendered, clickable in the DOM, and unreachable with a thumb. */}
        <div className="grid grid-cols-6 items-center h-16 px-1">
          {navItems.map((item) => {
            const isActive = item.href ? pathname === item.href : false;
            const content = (
              <div
                className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "text-orange-500"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {item.icon}
                <span className="max-w-full truncate text-[11px] font-medium">{item.label}</span>
              </div>
            );

            // Handle action buttons (like swap) differently
            if (item.isAction && item.onClick) {
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="flex min-w-0 justify-center"
                >
                  {content}
                </button>
              );
            }

            if (item.external) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 justify-center"
                >
                  {content}
                </a>
              );
            }

            return (
              <Link key={item.label} href={item.href} className="flex min-w-0 justify-center">
                {content}
              </Link>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex w-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <ArtIcon src="/more-icon.png" alt="More" />
            <span className="max-w-full truncate text-[11px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Navigation Drawer */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {/* Search Modal — same component used by the Screener "Search pairs" bar */}
      <SearchModal
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        watchlist={watchlist}
      />

      {/* Watchlist Modal — bottom sheet listing starred tokens */}
      <WatchlistModal
        open={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
      />
    </>
  );
};
