// Stakes about to start bleeding: still inside their 14-day grace, unended,
// biggest first. The other half of the wall's story — what the keeper has
// frozen is above; this is what is coming at it next, and the last window in
// which an owner can end their stake without losing anything.
//
// Server-rendered with the rest of the wall, so the countdowns are computed at
// render time; the page revalidates every minute, so they stay within a minute.

import { IconHourglassHigh, IconExternalLink } from '@tabler/icons-react';
import { HexAmount } from '@/components/hex/HexAmount';
import { fmtHex } from '@/lib/hex/hexDay';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import type { UpcomingBleeder } from '@/lib/hex/rescue';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
/** "10K", "25M" — the keeper's bounds are round numbers, so no decimals. */
const round = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n);

/** "in 3h", "in 28h", "in 2d 4h" — hours are what matter inside three days. */
function countdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'within the hour';
  if (h < 48) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d ${h % 24}h`;
}

export function UpcomingBleeders({
  stakes,
  hours,
  shown,
  keeperMinHex,
  keeperMaxHex,
  now,
}: {
  stakes: UpcomingBleeder[];
  hours: number;
  shown: number;
  keeperMinHex: number;
  keeperMaxHex: number;
  /** Render time, so every countdown on the page measures from the same instant. */
  now: number;
}) {
  const totalHex = stakes.reduce((s, x) => s + x.principalHex, 0);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="font-poppins flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          <IconHourglassHigh className="h-3.5 w-3.5" style={{ color: 'var(--viz-a)' }} /> About to start bleeding
        </div>
        <div className="font-poppins text-[11px] tabular-nums text-[var(--text-muted)]">
          {stakes.length.toLocaleString()} stakes · {fmtHex(totalHex)} HEX in the next {hours}h
        </div>
      </div>

      {stakes.length === 0 ? (
        <p className="font-poppins mt-3 text-[12px] text-[var(--text-muted)]">
          No unended stake leaves its grace period in the next {hours} hours.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--line)]">
          {stakes.slice(0, shown).map((s) => (
            <li key={s.stakeId} className="flex items-center gap-3 py-2">
              <span
                className="font-poppins w-[92px] shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-bold uppercase tracking-wider tabular-nums"
                style={{ background: 'color-mix(in srgb, var(--viz-a) 14%, transparent)', color: 'var(--viz-a)' }}
              >
                {countdown(s.bleedsAt - now)}
              </span>
              <span className="font-jost min-w-0 flex-1 truncate text-[17px] font-bold leading-none text-[var(--text)] tabular-nums">
                <HexAmount hex={s.principalHex} />
              </span>
              <span className="font-poppins hidden shrink-0 text-[11px] text-[var(--text-faint)] tabular-nums sm:inline">
                #{s.stakeId}
              </span>
              <a
                href={pulsechainAddressUrl(s.stakerAddr)}
                target="_blank"
                rel="noreferrer"
                className="font-mono inline-flex shrink-0 items-center gap-1 text-[11px] text-[var(--text-faint)] hover:text-[var(--text)]"
                aria-label={`Owner of stake ${s.stakeId}`}
              >
                {short(s.stakerAddr)} <IconExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="font-poppins mt-3 text-[11px] text-[var(--text-faint)]">
        Each owner can still end their stake with nothing lost until the countdown runs out. After that it bleeds
        1/700th a day; the keeper freezes stakes of {round(keeperMinHex)}–{round(keeperMaxHex)} HEX when the gas is
        worth it.
      </p>
    </div>
  );
}
