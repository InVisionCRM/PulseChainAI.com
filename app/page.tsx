'use client';

import React from 'react';
import AdBanner from '@/components/ads/AdBanner';
import HomeSearchBar from '@/components/HomeSearchBar';
import Screener from '@/components/Screener/Screener';
import { WatchlistPanel } from '@/components/portfolio/WatchlistPanel';
import { TokenInsightsCard } from '@/components/portfolio/TokenInsightsCard';

export default function Home(): React.JSX.Element {
  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)]">
      {/* Promo strip is the first thing on the page and stays pinned there.
          It sticks to the top of <main>, which is the scroll container on
          desktop (the layout is md:h-screen / md:overflow-hidden) and to the
          viewport on mobile — either way it lands just under the ticker bar
          rather than over it. The background is fully opaque on purpose:
          the screener rows ghosted through it as they scrolled under —
          measured at 390px, a bright bubble tile bled through a 90% tint
          even with a backdrop blur. z-40 clears page content but stays
          below the mobile search bar (z-50) and the ticker's chain menu
          (z-60). The screener table's own sticky header is scoped to its
          overflow-auto box, so the two never fight. */}
      <div className="sticky top-0 z-40 w-full border-b border-[var(--line)] bg-[var(--app-bg)] px-3 py-2 shadow-[0_8px_16px_-12px_rgba(0,0,0,0.8)] md:px-4">
        <AdBanner />
      </div>
      {/* Search bar is the hero of the page body, directly under the strip. */}
      <div className="w-full px-3 pt-3 md:px-4">
        <HomeSearchBar />
      </div>
      {/* Screener uses the full width — the watchlist now lives in the left
          nav column on desktop, so it only renders inline here on mobile. */}
      <section id="tokentable" className="w-full px-3 py-3 md:px-4">
        <Screener />
        <div className="mt-3 md:hidden">
          <WatchlistPanel />
        </div>
      </section>
      {/* Host for the token insights modal that a watchlist row opens. Without
          this mounted, clicking a watchlist token on the home page set the
          insights store but nothing rendered — so "nothing happened". The card
          portals to <body> and renders null until a token is active. */}
      <TokenInsightsCard />
    </div>
  );
}
