'use client';

import React from 'react';
import StickyBanner from '@/components/ui/sticky-banner';
import Screener from '@/components/Screener/Screener';

export default function Home(): React.JSX.Element {
  return (
    <div className="min-h-screen w-full bg-carbon-bg">
      <StickyBanner />
      <section id="tokentable" className="w-full">
        <Screener />
      </section>
    </div>
  );
}
