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
      {/* Search bar is the hero at the very top; the promo strip sits below it
          with clear separation so the two don't read as one cluttered block. */}
      <div className="w-full px-3 pt-3 md:px-4">
        <HomeSearchBar />
      </div>
      <div className="w-full px-3 pt-3 md:px-4">
        <AdBanner />
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
