// One rescued stake, as a tile in the wall.
//
// The card answers three things at a glance and nothing else: how much HEX
// this stake still holds, how much of it survived, and whether its owner has
// come for it. Everything smaller — principal, interest, penalty, addresses —
// sits in one quiet footer strip, because a card where every figure shouts is
// a card where nothing is read.
//
// The number is the design: Jost at 30px carrying the HEX figure, Poppins for
// every label, a donut that sweeps once to the survival share, and the brand
// gradient only as a hairline on the collected state. No paragraph anywhere.
//
// The survival share is printed as text beside the ring as well as drawn in
// it, so the color is never the only thing saying whether this went well.

import Link from 'next/link';
import { IconExternalLink, IconSnowflake, IconCheck } from '@tabler/icons-react';
import { HexAmount } from '@/components/hex/HexAmount';
import { fmtUsdShort, fmtHexDate, HEX_LAUNCH_TS } from '@/lib/hex/hexDay';
import { pulsechainTxUrl, pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import { SavedRing } from '@/components/rescue/RescueDashboard';
import type { Rescue } from '@/lib/hex/rescueFeed';

const tsToHexDay = (ms: number) => Math.floor((ms / 1000 - HEX_LAUNCH_TS) / 86400);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const n0 = (n: number | null | undefined) => Math.round(n ?? 0).toLocaleString();

export function RescueStakeCard({ rescue, hexUsd }: { rescue: Rescue; hexUsd?: number | null }) {
  const gross = (rescue.principalHex ?? 0) + (rescue.payoutHex ?? 0);
  // Share of the whole return that survived to the freeze. Bounded because a
  // fully-bled stake would otherwise push the ring past a full turn.
  const savedFrac = gross > 0 ? Math.max(0, Math.min(1, 1 - (rescue.penaltyHex ?? 0) / gross)) : 1;
  const usd = (hex: number | null | undefined) =>
    hexUsd != null && hex != null ? fmtUsdShort(hex * hexUsd) : null;
  const headline = rescue.claimed ? rescue.claimedHex ?? rescue.claimableHex : rescue.claimableHex;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--text-faint)]">
      {/* A collected stake earns the brand hairline — it is the outcome the
          whole wall exists to produce. */}
      {rescue.claimed && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
          style={{ background: 'linear-gradient(90deg, #ff9e00, #ff2e7e)' }}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/rescued/${rescue.stakeId}`}
          className="font-jost text-[15px] font-bold tracking-tight text-[var(--text)] transition-colors hover:text-[var(--viz-a)]"
        >
          #{rescue.stakeId}
        </Link>
        {rescue.claimed ? (
          <span
            className="font-poppins inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: 'color-mix(in srgb, var(--viz-gain) 16%, transparent)', color: 'var(--viz-gain)' }}
          >
            <IconCheck className="h-3 w-3" /> Collected
          </span>
        ) : (
          <span className="font-poppins inline-flex items-center gap-1 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
            <IconSnowflake className="h-3 w-3" /> Frozen
          </span>
        )}
      </div>

      {/* The headline: what this stake is worth, and how much of it survived. */}
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            {rescue.claimed ? 'Collected by owner' : 'Still claimable'}
          </div>
          <div className="font-jost mt-0.5 text-[30px] font-bold leading-none tracking-tight text-[var(--text)] tabular-nums">
            <HexAmount hex={headline ?? 0} />
          </div>
          {usd(headline) && (
            <div className="font-poppins mt-1 text-[12px] tabular-nums text-[var(--text-muted)]">{usd(headline)}</div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <SavedRing frac={savedFrac} />
          <span className="font-poppins mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
            saved
          </span>
        </div>
      </div>

      {/* Everything else, one quiet strip. */}
      <div className="font-poppins mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line)] pt-2.5 text-[11px] text-[var(--text-faint)]">
        <span className="tabular-nums">
          Principal <span className="text-[var(--text-muted)]">{n0(rescue.principalHex)}</span>
        </span>
        <span className="tabular-nums">
          Interest <span className="text-[var(--text-muted)]">{n0(rescue.payoutHex)}</span>
        </span>
        <span className="tabular-nums">
          Penalty <span style={{ color: 'var(--viz-loss)' }}>−{n0(rescue.penaltyHex)}</span>
        </span>
        {!rescue.claimed && rescue.bleedPerDay != null && (
          <span className="tabular-nums">
            Was losing <span className="text-[var(--text-muted)]">{n0(rescue.bleedPerDay)}/day</span>
          </span>
        )}
        {rescue.claimed && rescue.daysToClaim != null && (
          <span className="tabular-nums">
            Claimed{' '}
            <span className="text-[var(--text-muted)]">
              {rescue.daysToClaim < 1
                ? `${Math.max(1, Math.round(rescue.daysToClaim * 24))}h`
                : `${rescue.daysToClaim.toFixed(rescue.daysToClaim < 10 ? 1 : 0)}d`}{' '}
              after
            </span>
          </span>
        )}
      </div>

      <div className="font-poppins mt-1.5 flex items-center justify-between gap-3 text-[11px] text-[var(--text-faint)]">
        <span className="tabular-nums">
          {rescue.timestamp > 0 ? `frozen ${fmtHexDate(tsToHexDay(rescue.timestamp))}` : ''}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <a
            href={pulsechainAddressUrl(rescue.stakerAddr)}
            target="_blank"
            rel="noreferrer"
            className="font-mono hover:text-[var(--text)]"
          >
            {short(rescue.stakerAddr)}
          </a>
          <a
            href={pulsechainTxUrl(rescue.txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-[var(--text)]"
            aria-label={`Proof of the rescue of stake ${rescue.stakeId}`}
          >
            proof <IconExternalLink className="h-3 w-3" />
          </a>
        </span>
      </div>
    </div>
  );
}
