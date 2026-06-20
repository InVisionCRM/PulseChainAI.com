/** Display formatters for screener values. */

// Number formatting now lives in the app-wide canonical module so prices,
// values and amounts read identically across the screener, portfolio and
// watchlist. The screener-specific helpers (age, address, dex) stay here.
export { fmtPrice, fmtUsd, fmtNum, fmtPct, pctClass } from '@/lib/format';

/** 17s / 4m / 7h / 14d / 2mo / 3y */
export function fmtAge(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(d / 365)}y`;
}

export function shortAddr(addr: string | null): string {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const DEX_NAMES: Record<string, string> = {
  pulsex: 'PulseX',
  uniswap: 'Uniswap',
  sushiswap: 'SushiSwap',
  '9mm': '9mm',
  '9inch': '9inch',
};

export function dexName(dexId: string | null): string {
  if (!dexId) return '—';
  if (DEX_NAMES[dexId]) return DEX_NAMES[dexId];
  return dexId
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function dexLogo(dexId: string): string {
  return `https://dd.dexscreener.com/ds-data/dexes/${dexId}.png`;
}
