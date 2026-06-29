// Shared HEX amount + branding primitives, reused across every stake surface
// (portfolio, dashboard, strategist leaderboards, bubble map).
//
// Design notes:
//  - The HEX logo (/hex-logo.svg) carries the brand magenta gradient, so placing
//    it next to the "HEX" unit gives the on-brand pop WITHOUT painting numbers
//    with a gradient. We keep the literal "HEX" word and sit the logo beside it.
//  - The logo scales with surrounding text (em-sized) so it stays aligned in
//    both small captions and large headline figures.

import { fmtHex } from '@/lib/hex/hexDay';

/** Small inline HEX logo. Sizes to the surrounding text by default. */
export function HexLogo({ className = 'h-[0.9em] w-[0.9em]' }: { className?: string }) {
  return (
    <img
      src="/hex-logo.svg"
      alt=""
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
    />
  );
}

/** The HEX unit: logo + the word "HEX", used wherever "HEX" labels an amount. */
export function HexUnit({ className, logoClassName }: { className?: string; logoClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <HexLogo className={logoClassName} />
      HEX
    </span>
  );
}

/**
 * A formatted HEX amount with the HEX logo + "HEX" unit beside it, e.g.
 * "1.5M ⬡ HEX". Pass a positive number and an optional prefix ('+', '−').
 */
export function HexAmount({
  hex,
  prefix = '',
  unit = true,
  className,
  logoClassName,
}: {
  hex: number;
  prefix?: string;
  unit?: boolean;
  className?: string;
  logoClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className ?? ''}`}>
      <span>{prefix}{fmtHex(hex)}</span>
      {unit && <HexUnit logoClassName={logoClassName} />}
    </span>
  );
}
