'use client';

import React from 'react';
import StickyBanner from '@/components/ui/sticky-banner';
import Screener from '@/components/Screener/Screener';
import { WatchlistPanel } from '@/components/portfolio/WatchlistPanel';

export default function Home(): React.JSX.Element {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0C2340] via-[#0d2a4d] to-[#0C2340]">
      <StickyBanner />
      <section id="tokentable" className="mx-auto w-full max-w-[1600px] px-3 py-4 md:px-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
          <Screener />
          <WatchlistPanel />
        </div>
      </section>
    </div>
  );
}
