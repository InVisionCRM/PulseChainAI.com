'use client';

import React from 'react';
import Link from 'next/link';
import { IconRocket, IconArrowRight } from '@tabler/icons-react';
import StickyBanner from '@/components/ui/sticky-banner';
import Screener from '@/components/Screener/Screener';
import { WatchlistPanel } from '@/components/portfolio/WatchlistPanel';
import RobinhoodTopTokens from '@/components/robinhood/RobinhoodTopTokens';

export default function Home(): React.JSX.Element {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)]">
      <StickyBanner />
      <section id="tokentable" className="mx-auto w-full max-w-[1600px] px-3 py-4 md:px-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
          <Screener />
          <WatchlistPanel />
        </div>
      </section>

      {/* Robinhood Chain — the PulseChain screener above is indexed and
          PulseChain-only, so Robinhood gets its own live section (roster from
          the Robinhood explorer, market data from DexScreener — both free). */}
      <section id="robinhood" className="mx-auto w-full max-w-[1600px] px-3 pb-10 md:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#00C805]/10 text-[#00C805]">
              <IconRocket className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Robinhood Chain</h2>
              <p className="text-[11px] text-[var(--text-faint)]">Popular tokens · ranked live by 24h volume</p>
            </div>
          </div>
          <Link
            href="/robinhood/launchpads"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text)]"
          >
            Launchpads
            <IconArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <RobinhoodTopTokens limit={12} />
      </section>
    </div>
  );
}
