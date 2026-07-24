'use client';

import React from 'react';
import AdBanner from '@/components/ads/AdBanner';
import HomeSearchBar from '@/components/HomeSearchBar';
import Screener from '@/components/Screener/Screener';
import { WatchlistPanel } from '@/components/portfolio/WatchlistPanel';
import { TokenInsightsCard } from '@/components/portfolio/TokenInsightsCard';

export default function Home(): React.JSX.Element {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)]">
      {/* Prominent token search — top of the home page. */}
      <div className="mx-auto w-full max-w-[1600px] px-3 pt-4 md:px-6">
        <HomeSearchBar />
      </div>
      {/* Promo ad slot — replaces the old sticky banner at the top of home. */}
      <div className="mx-auto w-full max-w-[1600px] px-3 pt-3 md:px-6">
        <AdBanner />
      </div>
      <section id="tokentable" className="mx-auto w-full max-w-[1600px] px-3 py-4 md:px-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
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
