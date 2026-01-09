/**
 * Utility functions for Geicko token analyzer
 * Formatting helpers for addresses, numbers, dates, and labels
 */

// Constants
export const PUMP_TIRES_CREATOR = '0x6538A83a81d855B965983161AF6a83e616D16fD5';

/**
 * Normalizes a label by splitting on dashes/underscores and capitalizing each word
 * @example normalizeLabel('hello-world') => 'Hello World'
 */
export const normalizeLabel = (value?: string | null): string => {
  if (!value) return '';
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

/**
 * Formats a chain name with proper capitalization
 * @example formatChainLabel('pulsechain') => 'PulseChain'
 */
export const formatChainLabel = (value?: string | null): string => {
  if (!value) return 'PulseChain';
  const normalized = value.toLowerCase();
  if (normalized === 'pulsechain') return 'PulseChain';
  return normalizeLabel(value);
};

/**
 * Formats a DEX name with version suffixes
 * @example formatDexLabel('pulsex-v3') => 'PulseX V3'
 */
export const formatDexLabel = (value?: string | null): string => {
  if (!value) return 'PulseX';
  const normalized = value.toLowerCase();
  if (normalized.includes('pulsex')) {
    if (normalized.includes('v3')) return 'PulseX V3';
    if (normalized.includes('v2')) return 'PulseX V2';
    return 'PulseX';
  }
  return normalizeLabel(value);
};

/**
 * Formats a website URL for display (removes protocol, www, trailing slashes)
 * @example formatWebsiteDisplay('https://www.example.com/path/') => 'example.com/path'
 */
export const formatWebsiteDisplay = (url?: string | null): string => {
  if (!url) return '';
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/$/, '') : '';
    return `${host}${path}`;
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
};

/**
 * Formats market cap value with appropriate suffix (B/M/k) and MCAP label
 * @example formatMarketCapLabel(1500000) => '$1.50M MCAP'
 */
export const formatMarketCapLabel = (value?: number): string => {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return 'MCAP N/A';
  const abs = Math.abs(v);
  const billions = abs / 1_000_000_000;
  const millions = abs / 1_000_000;
  if (billions >= 1 || millions >= 1000) return `$${(v / 1_000_000_000).toFixed(2)}B MCAP`;
  if (millions >= 1) return `$${(v / 1_000_000).toFixed(2)}M MCAP`;
  if (abs >= 1_000) return `$${Math.round(v / 1_000)}k MCAP`;
  return `$${Math.round(v).toLocaleString()} MCAP`;
};

/**
 * Truncates an Ethereum address to show first 6 and last 4 characters
 * @example truncateAddress('0x1234...7890') => '0x1234...7890'
 */
export const truncateAddress = (value: string): string => `${value.slice(0, 6)}...${value.slice(-4)}`;

/**
 * Formats LP holder address showing only last 4 characters
 * @example formatLpHolderAddress('0x1234567890') => '...7890'
 */
export const formatLpHolderAddress = (value?: string): string => (value ? `...${value.slice(-4)}` : 'Unknown');

/**
 * Formats currency value with compact notation (B/M/K)
 * @example formatCurrencyCompact(1500000) => '$1.50M'
 */
export const formatCurrencyCompact = (value?: number | null, options: Intl.NumberFormatOptions = {}): string => {
  if (!Number.isFinite(value ?? NaN)) return '—';
  const num = Number(value);
  if (Math.abs(num) >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toLocaleString('en-US', { maximumFractionDigits: 2, ...options })}`;
};

/**
 * Formats number value with compact notation (B/M/K) without currency symbol
 * @example formatNumberCompact(1500000) => '1.50M'
 */
export const formatNumberCompact = (value?: number | null): string => {
  if (!Number.isFinite(value ?? NaN)) return '—';
  const num = Number(value);
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

/**
 * Checks if an address is a burn address (dead, 000, 0369, etc.)
 * @example isBurnAddress('0x000000000000000000000000000000000000dead') => true
 */
export const isBurnAddress = (addr?: string): boolean => {
  const lower = (addr || '').toLowerCase();
  return (
    lower.endsWith('dead') ||
    lower.endsWith('0dead') ||
    lower.endsWith('000') ||
    lower.endsWith('0369') ||
    lower.endsWith('000369')
  );
};

/**
 * Formats percentage change with sign
 * @example formatPercentChange(5.25) => '+5.25%'
 */
export const formatPercentChange = (value?: number | null): string => {
  if (!Number.isFinite(value ?? NaN)) return '0.00%';
  const num = Number(value);
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

/**
 * Formats a date in UTC timezone with readable format
 * @example formatDateUTC('2023-01-15T10:30:00Z') => 'Jan 15, 2023, 10:30 AM'
 */
export const formatDateUTC = (value: string | number | Date): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Formats number with abbreviated suffixes (b/m/k) - lowercase version
 * @example formatAbbrev(1500000) => '1.5m'
 */
export const formatAbbrev = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}b`;
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    // If millions >= 1000, show as billions instead
    if (millions >= 1000) return `${sign}${(millions / 1000).toFixed(1)}b`;
    return `${sign}${millions.toFixed(1)}m`;
  }
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
};
