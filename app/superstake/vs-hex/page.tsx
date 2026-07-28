'use client';

import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import VsHexTool from '@/components/superstake/VsHexTool';

export default function SuperStakeVsHexPage() {
  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)]">
      <div className="mx-auto w-full max-w-5xl px-3 py-5 md:px-6">
        <Link
          href="/superstake"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
        >
          <IconArrowLeft className="h-3.5 w-3.5" /> SuperStake
        </Link>

        <header className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-orange-400/80">
            the head-to-head · same dollars, same day
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text)] md:text-3xl">
            Stake HEX, or hold pSSH?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
            The same dollars, in on the same day. A fresh native HEX stake versus buying pSSH and
            holding it — replayed against the on-chain record: real HEX payouts, real share rates,
            and reflections funded by actual pSSH volume. Both sides are counted in HEX, so this is
            a comparison of the two structures rather than a bet on the HEX price.
          </p>
        </header>

        <VsHexTool />
      </div>
    </div>
  );
}
