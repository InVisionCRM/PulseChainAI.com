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
  // Robinhood-chain dexes, names as GeckoTerminal's dex registry gives them.
  'uniswap-v2': 'Uniswap v2',
  'uniswap-v3': 'Uniswap v3',
  'uniswap-v4': 'Uniswap v4',
  'sushiswap-v3': 'SushiSwap v3',
  'pancakeswap-v2': 'PancakeSwap v2',
  'pancakeswap-v3': 'PancakeSwap v3',
  'pons-dot-family': 'Pons',
  'pons-v2-dex': 'Pons v2',
  'uniswap-pools-trade': 'Uniswap Pools',
  'up-v3': 'UP v3',
  'ekubo-v3': 'Ekubo',
  'ramses-v3': 'Ramses',
  robinswap: 'RobinSwap',
  hoodit: 'Hoodit',
  bankr: 'Bankr',
  virtuals: 'Virtuals',
  clanker: 'Clanker',
};

export function dexName(dexId: string | null): string {
  if (!dexId) return '—';
  if (DEX_NAMES[dexId]) return DEX_NAMES[dexId];
  return dexId
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * DexScreener dex slugs verified (by fetching them) to serve real artwork.
 *
 * The allowlist exists because dd.dexscreener.com answers HTTP 200 for ANY id —
 * an unknown dex gets a generic "?" placeholder image, not a 404 — so an <img>
 * onError fallback never fires. That's what filled the Robinhood screener with
 * question marks, and it turns out `pulsex-v2` was serving the same placeholder
 * on PulseChain. Only slugs known to have art get a URL; everything else
 * returns null and the caller draws a letter badge instead.
 */
const DEX_ART_SLUGS = new Set([
  'pulsex', 'uniswap', 'sushiswap', 'pancakeswap', 'ekubo', 'ramses',
  'robinswap', '9mm', '9inch',
]);

/** Ids whose brand doesn't fall out of a version-suffix strip. */
const DEX_LOGO_ALIASES: Record<string, string> = {
  'uniswap-pools-trade': 'uniswap',
};

export function dexLogo(dexId: string): string | null {
  // Versioned ids ("pulsex-v2", "uniswap-v4", "9mm-v3") wear the brand's art.
  const slug =
    DEX_LOGO_ALIASES[dexId] ??
    (DEX_ART_SLUGS.has(dexId) ? dexId : dexId.replace(/-v\d+$/, ''));
  return DEX_ART_SLUGS.has(slug)
    ? `https://dd.dexscreener.com/ds-data/dexes/${slug}.png`
    : null;
}

/** Deterministic accent for a letter badge, so each dex keeps its colour. */
const BADGE_HUES = [16, 200, 265, 330, 45, 150];
export function dexBadgeHue(dexId: string): number {
  let h = 0;
  for (let i = 0; i < dexId.length; i++) h = (h * 31 + dexId.charCodeAt(i)) >>> 0;
  return BADGE_HUES[h % BADGE_HUES.length];
}
