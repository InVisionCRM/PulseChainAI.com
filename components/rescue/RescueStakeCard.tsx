// A rescued stake, drawn the way every other HEX stake in this app is drawn.
//
// Deliberately mirrors ActiveStakeCard in components/portfolio/HexStakes.tsx —
// same shell (rounded-xl, --line border, --surface fill, p-4), same "Stake #id
// + status pill" header, same 10px uppercase micro-labels over tabular figures,
// same two-column principal/secondary split, same 2px progress bar. A rescue is
// a HEX stake, so it should not look like a different product; anything that
// reads as its own visual language here is a bug, not a style.
//
// The one thing it says that a normal stake card cannot: this stake stopped
// losing value on a particular day, and here is what survived.

import Link from 'next/link';
import { IconExternalLink, IconSnowflake, IconCheck } from '@tabler/icons-react';
import { HexAmount, HexUnit } from '@/components/hex/HexAmount';
import { fmtUsdShort, fmtHexDate, HEX_LAUNCH_TS } from '@/lib/hex/hexDay';
import { pulsechainTxUrl, pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import type { Rescue } from '@/lib/hex/rescueFeed';

const tsToHexDay = (ms: number) => Math.floor((ms / 1000 - HEX_LAUNCH_TS) / 86400);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function RescueStakeCard({ rescue, hexUsd }: { rescue: Rescue; hexUsd?: number | null }) {
  const gross = (rescue.principalHex ?? 0) + (rescue.payoutHex ?? 0);
  // The share of the whole return the penalty had taken by the time we froze
  // it. Bounded because a fully-bled stake would otherwise overflow the bar.
  const burned = gross > 0 ? Math.min(1, (rescue.penaltyHex ?? 0) / gross) : 0;
  const usd = (hex: number | null | undefined) =>
    hexUsd != null && hex != null ? fmtUsdShort(hex * hexUsd) : null;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--text-faint)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={`/rescued/${rescue.stakeId}`}
          className="font-jost text-[15px] font-semibold text-[var(--text)] hover:text-emerald-400"
        >
          Stake #{rescue.stakeId}
        </Link>
        {/* Once the owner has ended the stake the freeze is history — the
            headline becomes that they got their HEX, not that we stopped the
            bleeding. Until then the frozen state is the live fact. */}
        {rescue.claimed ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <IconCheck className="h-3 w-3" />
            Collected by owner
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300">
            <IconSnowflake className="h-3 w-3" />
            Rescued · penalty frozen
          </span>
        )}
      </div>

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-poppins text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
            {/* Past tense once it has been collected: "still claimable" on a
                stake the owner already emptied is simply false. */}
            {rescue.claimed ? 'What we saved' : 'Still claimable'}
          </div>
          <HexAmount
            hex={rescue.claimableHex ?? 0}
            className="text-lg font-semibold text-emerald-400"
          />
          {usd(rescue.claimableHex) && (
            <div className="text-xs tabular-nums text-[var(--text-muted)]">{usd(rescue.claimableHex)}</div>
          )}
        </div>
        <div className="text-right">
          <div className="font-poppins text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
            Was losing
          </div>
          <div className="text-lg font-semibold tabular-nums text-[var(--text)]">
            {rescue.bleedPerDay != null ? Math.round(rescue.bleedPerDay).toLocaleString() : '—'}
          </div>
          <div className="text-xs tabular-nums text-[var(--text-muted)]">
            <HexUnit className="text-[var(--text-faint)]" /> / day
          </div>
        </div>
      </div>

      {/* How much of the return the penalty had already taken. Frozen, so it
          does not move — which is the entire point of the rescue. */}
      <div className="font-poppins mb-1.5 flex items-center justify-between text-xs">
        <span className="tabular-nums text-[var(--text-muted)]">
          {(burned * 100).toFixed(1)}% lost before we got there
        </span>
        <span className="font-semibold tabular-nums text-cyan-300">
          {(100 - burned * 100).toFixed(1)}% saved
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full" style={{ width: `${burned * 100}%`, background: '#ef4444' }} />
        <div className="h-full flex-1" style={{ background: '#06b6d4' }} />
      </div>

      {/* The ending, when there is one. Placed under the saved/lost bar
          because it is what that bar was for: the HEX it protected reached
          the person it belonged to. */}
      {rescue.claimed && rescue.claimedHex != null && (
        <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-[11px]">
          <span className="font-semibold text-emerald-400">
            {Math.round(rescue.claimedHex).toLocaleString()} HEX collected
          </span>
          {rescue.daysToClaim != null && (
            <span className="text-[var(--text-muted)]">
              {' · '}
              {rescue.daysToClaim < 1
                ? `${Math.max(1, Math.round(rescue.daysToClaim * 24))}h after the rescue`
                : `${rescue.daysToClaim.toFixed(rescue.daysToClaim < 10 ? 1 : 0)} days after the rescue`}
            </span>
          )}
          {/* The chain confirming the stake was unlocked before it ended is
              what makes this a rescue outcome rather than a coincidence. */}
          {rescue.endConfirmsRescue && (
            <span className="text-[var(--text-faint)]"> · confirmed on chain</span>
          )}
        </div>
      )}

      {/* Two fixed groups rather than one wrapping row: with everything in a
          single flex-wrap the proof link landed on its own line for some cards
          and not others, so a grid of cards had ragged footers. */}
      <div className="font-poppins mt-3 flex items-end justify-between gap-3 text-[11px] text-[var(--text-faint)]">
        <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5">
          <span className="tabular-nums">
            Principal <span className="text-[var(--text-muted)]">{Math.round(rescue.principalHex ?? 0).toLocaleString()}</span>
          </span>
          <span className="tabular-nums">
            Interest <span className="text-[var(--text-muted)]">{Math.round(rescue.payoutHex ?? 0).toLocaleString()}</span>
          </span>
          <span className="tabular-nums">
            Penalty <span className="text-red-400">−{Math.round(rescue.penaltyHex ?? 0).toLocaleString()}</span>
          </span>
          {rescue.timestamp > 0 && (
            <span className="tabular-nums">frozen {fmtHexDate(tsToHexDay(rescue.timestamp))}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
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
        </div>
      </div>
    </div>
  );
}
