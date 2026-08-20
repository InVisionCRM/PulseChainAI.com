// The HEX Rescue banner — a way into /rescued from anywhere HEX is on screen.
//
// It has to earn its place on a page that is already about something else, so
// it leads with the one line that makes someone stop: matured stakes lose 1/700
// of themselves a day, and this stops it for free. The HEX gradient and mark
// tie it to the rest of the HEX surfaces rather than reading as an advert.
//
// Live numbers are passed in rather than fetched, so this stays a pure
// presentational component and the page that shows it decides whether it wants
// to pay for the data.

import Link from 'next/link';
import { IconArrowRight, IconSnowflake } from '@tabler/icons-react';
import { HEX_GRADIENT } from '@/components/hex/HexAmount';

export function RescueBanner({
  rescued,
  hexSaved,
  className = '',
}: {
  /** Stakes rescued so far. Omit to show the pitch without the numbers. */
  rescued?: number;
  /** HEX still theirs because of it. */
  hexSaved?: number;
  className?: string;
}) {
  const hasStats = rescued != null && rescued > 0;

  return (
    <Link
      href="/rescued"
      className={`group relative block overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] transition-colors hover:border-[#ff2e7e]/50 ${className}`}
    >
      {/* Brand wash. Sits under everything at low opacity so the text keeps its
          contrast in both themes rather than fighting a saturated fill. */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.13]" style={{ background: HEX_GRADIENT } } />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-black/25 to-transparent" />
      <img
        src="/hex-logo.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-8 h-40 w-40 rotate-12 select-none object-contain opacity-[0.18]"
      />

      <div className="relative flex flex-wrap items-center gap-x-5 gap-y-3 p-4 md:p-5">
        <img src="/hex-logo.svg" alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain md:h-12 md:w-12" />

        <div className="min-w-[15rem] flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff2e7e]">
            <IconSnowflake className="h-3 w-3" />
            The HEX Rescue Initiative
          </div>
          <div className="mt-1 text-base font-bold leading-snug text-[var(--text)] md:text-lg">
            A matured stake loses 1/700th a day. We stop the clock — for free.
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
            Anyone can freeze a bleeding stake for anyone, and it pays whoever does it nothing.
            So we do it for strangers, every day, with our own gas.
          </p>
        </div>

        {hasStats && (
          <div className="flex gap-5">
            <Stat label="Stakes rescued" value={rescued!.toLocaleString()} />
            {hexSaved != null && (
              <Stat label="HEX still theirs" value={Math.round(hexSaved).toLocaleString()} accent />
            )}
          </div>
        )}

        <span className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 text-xs font-bold text-[var(--text)] transition-transform group-hover:translate-x-0.5">
          See the wall
          <IconArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${accent ? 'text-emerald-400' : 'text-[var(--text)]'}`}>
        {value}
      </div>
    </div>
  );
}
