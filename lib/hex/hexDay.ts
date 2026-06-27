// HEX day + amount helpers. HEX numbers every day from launch
// (2019-12-03 00:00 UTC = day 0 start). PulseChain HEX (pHEX) inherited the
// same epoch at the fork, so identical math applies on both chains.

export const HEX_ADDRESS = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
export const HEX_LAUNCH_TS = 1575331200; // unix seconds — HEX day 0 start (UTC)
const DAY = 86400;

export function isHexAddress(addr?: string | null): boolean {
  return !!addr && addr.trim().toLowerCase() === HEX_ADDRESS;
}

export function hexDayToDate(day: number): Date {
  return new Date((HEX_LAUNCH_TS + day * DAY) * 1000);
}

/** Today's HEX day — deterministic, the same `(now - launch) / 1 day` the
 * contract uses. Reliable even when the subgraph's globalInfo is missing/0. */
export function currentHexDay(): number {
  return Math.floor((Date.now() / 1000 - HEX_LAUNCH_TS) / DAY);
}

export const heartsToHex = (hearts: string | number) => Number(hearts) / 1e8;
export const sharesToTShares = (shares: string | number) => Number(shares) / 1e12;

/** 0–1 progress through a stake's committed term. */
export function stakeProgress(startDay: number, stakedDays: number, currentDay: number): number {
  if (stakedDays <= 0) return 0;
  return Math.max(0, Math.min(1, (currentDay - startDay) / stakedDays));
}

// HEX late-end penalty constants (mirror HEX.sol). A matured stake left unended
// is penalty-free for a 14-day grace period; after that its total return
// (principal + interest) bleeds away linearly over 700 days, hitting zero
// 714 days past the maturity (end) day.
export const LATE_PENALTY_GRACE_DAYS = 14;
export const LATE_PENALTY_SCALE_DAYS = 700;

export interface LatePenaltyStatus {
  /** Past the 14-day grace period — penalties are actively accruing. */
  isBleeding: boolean;
  /** Whole days since the stake matured (end day). */
  daysPastMaturity: number;
  /** Whole days past the end of the 14-day grace period. */
  daysPastGrace: number;
  /** 0–1 fraction of the stake's total return already lost to penalty. */
  fraction: number;
  /** Estimated penalty accrued so far, in HEX. */
  penaltyHex: number;
  /** Days remaining until the stake is fully depleted (return → 0). */
  daysUntilDepleted: number;
  /** True once the entire return has bled out (700 days past grace). */
  fullyDepleted: boolean;
}

/**
 * Late-end penalty status for a matured HEX stake left unended.
 * Mirrors HEX.sol `_calcLatePenalty`: penalty = stakeReturn × daysPastGrace / 700.
 *
 * @param endDay      the stake's maturity HEX day
 * @param currentDay  today's HEX day
 * @param stakeReturn principal + interest at maturity (HEX) — the amount that bleeds
 */
export function latePenaltyStatus(endDay: number, currentDay: number, stakeReturn: number): LatePenaltyStatus {
  const graceEndDay = endDay + LATE_PENALTY_GRACE_DAYS;
  const daysPastMaturity = Math.max(0, currentDay - endDay);
  const daysPastGrace = Math.max(0, currentDay - graceEndDay);
  const fraction = Math.min(1, daysPastGrace / LATE_PENALTY_SCALE_DAYS);
  const penaltyHex = Math.max(0, stakeReturn) * fraction;
  return {
    isBleeding: daysPastGrace > 0,
    daysPastMaturity,
    daysPastGrace,
    fraction,
    penaltyHex,
    daysUntilDepleted: Math.max(0, LATE_PENALTY_SCALE_DAYS - daysPastGrace),
    fullyDepleted: daysPastGrace >= LATE_PENALTY_SCALE_DAYS,
  };
}

export function fmtDuration(days: number): string {
  if (!Number.isFinite(days) || days < 0) return '—';
  const total = Math.round(days);
  const y = Math.floor(total / 365);
  const rem = total - y * 365;
  const m = Math.floor(rem / 30);
  const d = rem - m * 30;
  const parts: string[] = [];
  if (y) parts.push(`${y}y`);
  if (m) parts.push(`${m}mo`);
  if (d || !parts.length) parts.push(`${d}d`);
  return parts.join(' ');
}

export function fmtHex(hex: number): string {
  if (!Number.isFinite(hex)) return '—';
  if (hex >= 1e9) return `${(hex / 1e9).toFixed(2)}B`;
  if (hex >= 1e6) return `${(hex / 1e6).toFixed(2)}M`;
  if (hex >= 1e3) return `${(hex / 1e3).toFixed(1)}K`;
  return hex.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** T-Shares, rolling up to B-Shares at 1000 T. */
export function fmtTShares(t: number): string {
  if (!Number.isFinite(t)) return '—';
  if (t >= 1000) return `${(t / 1000).toFixed(2)}B`;
  if (t >= 1) return t.toFixed(2);
  return t.toFixed(3);
}

const DATE_FMT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
export const fmtHexDate = (day: number) => hexDayToDate(day).toLocaleDateString(undefined, DATE_FMT);

export function fmtUsdShort(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}
