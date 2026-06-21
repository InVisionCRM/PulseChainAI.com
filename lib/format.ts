// Canonical number formatting for the whole app. One source of truth so every
// surface (portfolio, watchlist, screener, traces) shows numbers the same way.
//
// Three rules:
//   • Prices  → fmtPrice: 2 decimals at/above $1; below $1 we show ~4
//     significant figures, and for tiny prices we collapse the long run of
//     leading zeros into a subscript ($0.0₅4134) — the DexScreener/GeckoTerminal
//     convention used "everywhere else", so we never print a wall of zeros.
//   • Values & token amounts → fmtUsd / fmtAmount: whole numbers up to 99,999,
//     then compact with up to 2 decimals — 100k, 104.56k, 1.25m, 3.2b, 1.05t.
//   • Anything below 1 keeps up to 2 decimals so small balances still register.

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
const subscript = (n: number): string =>
  String(n)
    .split('')
    .map((d) => SUBSCRIPTS[parseInt(d, 10)])
    .join('');

const PLACEHOLDER = '—';

/** Drop trailing zeros (and a dangling dot) from a fixed-decimal string. */
function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/**
 * Core compact magnitude (no sign, no currency):
 *   < 1            → up to 2 decimals  (0.47, 0.5)
 *   1 … 99,999     → whole, grouped    (1,234 · 99,999)
 *   ≥ 100,000      → k / m / b / t, up to 2 decimals  (100k · 104.56k · 1.25m)
 */
function compact(abs: number): string {
  if (abs < 1) return trimZeros(abs.toFixed(2)) || '0';
  // Round to whole first so the 99,999 → 100k boundary is clean.
  const whole = Math.round(abs);
  if (whole < 100_000) return whole.toLocaleString('en-US');
  if (abs >= 1e12) return trimZeros((abs / 1e12).toFixed(2)) + 't';
  if (abs >= 1e9) return trimZeros((abs / 1e9).toFixed(2)) + 'b';
  if (abs >= 1e6) return trimZeros((abs / 1e6).toFixed(2)) + 'm';
  return trimZeros((abs / 1e3).toFixed(2)) + 'k';
}

/** Compact token / generic amount: 1,234 · 2.86m · 0.47. */
export function fmtAmount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return PLACEHOLDER;
  if (n === 0) return '0';
  return (n < 0 ? '-' : '') + compact(Math.abs(n));
}

/** Compact USD value: $1,234 · $104.56k · $1.25m · $0.05. */
export function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return PLACEHOLDER;
  if (n === 0) return '$0';
  return (n < 0 ? '-$' : '$') + compact(Math.abs(n));
}

/** Number with grouping, compacted past 99,999. Counts, tx totals, etc. */
export function fmtNum(n: number | null | undefined): string {
  return fmtAmount(n);
}

/** USD price, DexScreener-style. Subscript zeros for tiny prices. */
export function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return PLACEHOLDER;
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  // $1 and up: standard two-decimal price with grouping.
  if (abs >= 1) {
    return `${sign}$${abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  // Below $1: count leading zeros after the decimal point.
  const zeros = -Math.floor(Math.log10(abs)) - 1;
  if (zeros < 4) {
    // Few zeros — just show ~4 significant figures ($0.05234, $0.001234).
    return `${sign}$${parseFloat(abs.toPrecision(4))}`;
  }
  // Many zeros — collapse them into a subscript ($0.0₅4134).
  const digits = trimZeros(Math.round(abs * 10 ** (zeros + 4)).toString());
  return `${sign}$0.0${subscript(zeros)}${digits}`;
}

/** Signed percentage, two decimals: +4.20% / -1.10%. */
export function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return PLACEHOLDER;
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

/** Tailwind colour class for a percentage change. */
export function pctClass(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return 'text-[var(--text-faint)]';
  return n > 0 ? 'text-[var(--up)]' : 'text-red-400';
}
