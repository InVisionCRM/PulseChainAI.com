// Shared branding for the rescue pages.
//
// One place for the lockup so the wall, the claim page and anything added later
// credit the rescue identically. Both names appear because both did it: Morbius
// runs the keeper and hosts the pages, SuperStake put its name on it.
//
// The HEX mark is reused from components/hex/HexAmount rather than re-imported
// raw — it already sizes itself to the surrounding text and carries the brand
// gradient, and every other stake surface in the app uses it.

import { HexLogo } from '@/components/hex/HexAmount';

/** "Rescued by" lockup: Morbius + SuperStake, with their marks. */
export function RescuedBy({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/90">rescued by</span>
      <span className="inline-flex items-center gap-1.5">
        <img src="/morbius-mark.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text)]">Morbius</span>
      </span>
      <span className="text-[11px] text-[var(--text-faint)]">×</span>
      <span className="inline-flex items-center gap-1.5">
        <img src="/superstake-logo.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text)]">SuperStake</span>
      </span>
    </span>
  );
}

/**
 * A big HEX hexagon bled into the corner of a panel.
 *
 * Purely decorative and marked as such: it sits behind content at low opacity
 * and must never be the only thing carrying meaning. `pointer-events-none` so
 * it can never eat a click meant for the card underneath it.
 */
export function HexWatermark({
  className = '',
  size = 'h-40 w-40',
  opacity = 'opacity-[0.06]',
}: {
  className?: string;
  size?: string;
  opacity?: string;
}) {
  return (
    <img
      src="/hex-logo.svg"
      alt=""
      aria-hidden="true"
      className={`pointer-events-none absolute select-none object-contain ${size} ${opacity} ${className}`}
    />
  );
}

/** The HEX mark at a fixed display size, for headings rather than inline text. */
export function HexMark({ className = 'h-7 w-7' }: { className?: string }) {
  return <HexLogo className={className} />;
}
