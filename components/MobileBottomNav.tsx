"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconDots } from "@tabler/icons-react";
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
      icon: <IconHome className="h-5 w-5" />,
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
      label: "HEX",
      href: "/hex-strategist",
      icon: (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/hex-logo.svg" alt="HEX" className="h-5 w-5 object-contain" />
      ),
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
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = item.href ? pathname === item.href : false;
            const content = (
              <div
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "text-orange-500"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {item.icon}
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            );

            // Handle action buttons (like swap) differently
            if (item.isAction && item.onClick) {
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
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
                >
                  {content}
                </a>
              );
            }

            return (
              <Link key={item.label} href={item.href}>
                {content}
              </Link>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <IconDots className="h-5 w-5" />
            <span className="text-xs font-medium">More</span>
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
