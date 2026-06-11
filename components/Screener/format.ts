/** Display formatters for screener values. */

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

function subscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUBSCRIPTS[parseInt(d, 10)])
    .join('');
}

/** $0.0₅4134-style price formatting (DexScreener convention). */
export function fmtPrice(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '—';
  if (p === 0) return '$0';
  if (p >= 100) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (p >= 0.001) {
    return `$${parseFloat(p.toPrecision(4))}`;
  }
  const zeros = Math.floor(-Math.log10(p));
  if (zeros < 4) return `$${parseFloat(p.toPrecision(4))}`;
  const digits = Math.round(p * 10 ** (zeros + 4)).toString();
  return `$0.0${subscript(zeros)}${digits}`;
}

/** Compact USD: $4.9M, $124K, $957. */
export function fmtUsd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${trim((n / 1e9).toFixed(1))}B`;
  if (abs >= 1e6) return `$${trim((n / 1e6).toFixed(1))}M`;
  if (abs >= 1e3) return `$${trim((n / 1e3).toFixed(1))}K`;
  return `$${n.toFixed(0)}`;
}

function trim(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

export function fmtNum(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

export function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export function pctClass(n: number | null): string {
  if (n === null || !Number.isFinite(n) || n === 0) return 'text-white/40';
  return n > 0 ? 'text-green-400' : 'text-red-400';
}

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
