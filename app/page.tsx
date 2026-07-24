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
      {/* Search + promo ad, tight to the top — no wasted vertical space. */}
      <div className="w-full space-y-2 px-3 pt-3 md:px-4">
        <HomeSearchBar />
        <AdBanner />
      </div>
      {/* Full-width work area: screener + watchlist rail, minimal gutters. */}
      <section id="tokentable" className="w-full px-3 py-3 md:px-4">
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[1fr_300px]">
          <Screener />
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
