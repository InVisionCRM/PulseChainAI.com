import type { Metadata } from 'next';
import { IconRocket, IconExternalLink } from '@tabler/icons-react';
import LaunchpadActivity from '@/components/launchpads/LaunchpadActivity';

export const metadata: Metadata = {
  title: 'PulseChain Launchpads',
  description:
    'Launchpad activity on PulseChain — PUMP.tires and other token-launch factories, ranked live by 24h volume of the tokens they’ve launched and graduated to PulseX.',
};

export default function PulsechainLaunchpadsPage() {
  return (
    <main className="min-h-screen bg-[var(--panel)] text-[var(--text)]">
      {/* Header */}
      <div className="border-b border-[var(--line)] bg-gradient-to-r from-[var(--panel)] to-[#1a0e2e] px-4 py-8 md:px-6 md:py-12">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-5xl">PulseChain Launchpads</h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-[var(--text-muted)] md:text-lg">
            Which launchpads are launching the coins people are trading. PUMP.tires and other
            factories, ranked by the live 24h volume of the tokens they&apos;ve graduated to PulseX.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <a
              href="https://pump.tires"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-4 py-2 text-sm text-purple-300 transition-colors hover:bg-purple-500/20"
            >
              <IconRocket className="h-4 w-4" />
              PUMP.tires
              <IconExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Launchpad activity
          </h2>
          <span className="text-[11px] text-[var(--text-faint)]">Live · ranked by 24h volume</span>
        </div>
        <LaunchpadActivity chain="pulsechain" />

        <p className="mt-6 text-xs leading-relaxed text-[var(--text-faint)]">
          Coins graduate from PUMP.tires to PulseX once 200M PLS of bid liquidity accumulates, at which
          point liquidity is locked and ownership renounced. Only graduated (trading) coins appear here —
          coins still on the bonding curve aren&apos;t exposed by free data sources. Not financial advice;
          always verify contracts independently.
        </p>
      </div>
    </main>
  );
}
