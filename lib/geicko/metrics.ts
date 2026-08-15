// The metric catalogue the card builder picks from.
//
// Every entry reads a figure the eleven fixed cards already compute, so nothing
// here fetches or derives anything new — it just names each one, says which
// source it needs (so the builder can hide what a chain can't answer) and
// renders it as a tile. A metric whose figure hasn't arrived returns MISSING
// rather than a zero, exactly as the fixed cards do.

import { ACCENT, MISSING, UP, DOWN, compact, money, nf, price, signedPct } from '@/lib/shareCards/paint';
import type { ChainKey, SourceKey, TokenShareData } from '@/lib/geicko/shareCard';
import { sourceSupported } from '@/lib/geicko/shareCard';

export interface MetricValue {
  value: string;
  sub?: string;
  accent?: string;
}

export interface MetricDef {
  id: string;
  /** Chip text in the builder, and the tile's label on the card. */
  label: string;
  group: 'price' | 'size' | 'supply' | 'holders' | 'history' | 'flow';
  /** Only offered when this source answers for the chain. */
  needs?: SourceKey;
  read: (d: TokenShareData) => MetricValue;
}

const dash = (): MetricValue => ({ value: MISSING });
const pct = (n: number | null | undefined, dp = 1) =>
  n == null || !Number.isFinite(n) ? MISSING : `${n.toFixed(dp)}%`;
const usd = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? MISSING : money(n);
const cnt = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? MISSING : nf(n);
const tone = (n: number | null | undefined) => (n == null ? undefined : n >= 0 ? UP : DOWN);

export const METRICS: MetricDef[] = [
  /* ── price ─────────────────────────────────────────────────────────────── */
  { id: 'price', label: 'Price', group: 'price',
    read: (d) => ({ value: d.priceUsd == null ? MISSING : price(d.priceUsd), sub: 'live', accent: ACCENT.amber }) },
  { id: 'chg24', label: '24h change', group: 'price',
    read: (d) => ({ value: d.change.h24 == null ? MISSING : signedPct(d.change.h24), sub: 'last 24 hours', accent: tone(d.change.h24) }) },
  { id: 'chg6', label: '6h change', group: 'price',
    read: (d) => ({ value: d.change.h6 == null ? MISSING : signedPct(d.change.h6), sub: 'last 6 hours', accent: tone(d.change.h6) }) },
  { id: 'chg1', label: '1h change', group: 'price',
    read: (d) => ({ value: d.change.h1 == null ? MISSING : signedPct(d.change.h1), sub: 'last hour', accent: tone(d.change.h1) }) },
  { id: 'chg5m', label: '5m change', group: 'price',
    read: (d) => ({ value: d.change.m5 == null ? MISSING : signedPct(d.change.m5), sub: 'last 5 minutes', accent: tone(d.change.m5) }) },

  /* ── size ──────────────────────────────────────────────────────────────── */
  { id: 'mcap', label: 'Market cap', group: 'size',
    read: (d) => ({ value: usd(d.marketCap ?? d.fdv), sub: d.marketCap == null && d.fdv != null ? 'fully diluted' : 'circulating', accent: ACCENT.amber }) },
  { id: 'fdv', label: 'Fully diluted', group: 'size',
    read: (d) => ({ value: usd(d.fdv), sub: 'at total supply' }) },
  { id: 'vol24', label: '24h volume', group: 'size',
    read: (d) => ({ value: usd(d.volume.h24), sub: 'across every pool' }) },
  { id: 'vol6', label: '6h volume', group: 'size',
    read: (d) => ({ value: usd(d.volume.h6), sub: 'last 6 hours' }) },
  { id: 'volrate', label: 'Volume an hour', group: 'size',
    read: (d) => ({ value: d.volume.h24 == null ? MISSING : money(d.volume.h24 / 24), sub: '24h average' }) },
  { id: 'liq', label: 'Liquidity', group: 'size',
    read: (d) => ({ value: usd(d.liquidityUsd), sub: d.pairCount ? `across ${nf(d.pairCount)} pools` : 'pooled' }) },
  { id: 'liqmc', label: 'Liquidity vs cap', group: 'size',
    read: (d) => {
      const mc = d.marketCap ?? d.fdv;
      if (d.liquidityUsd == null || !mc) return dash();
      return { value: `${((d.liquidityUsd / mc) * 100).toFixed(1)}%`, sub: 'of market cap is pooled' };
    } },
  { id: 'turnover', label: 'Turnover', group: 'size',
    read: (d) => {
      if (d.volume.h24 == null || !d.liquidityUsd) return dash();
      return { value: `${(d.volume.h24 / d.liquidityUsd).toFixed(2)}×`, sub: '24h volume over liquidity' };
    } },
  { id: 'pools', label: 'Pools', group: 'size',
    read: (d) => ({ value: cnt(d.pairCount), sub: 'holding liquidity' }) },
  { id: 'toppool', label: 'Deepest pool', group: 'size',
    read: (d) => d.topPair ? { value: d.topPair.label, sub: `on ${d.topPair.dexName}` } : dash() },

  /* ── supply ────────────────────────────────────────────────────────────── */
  { id: 'supply', label: 'Total supply', group: 'supply',
    read: (d) => ({ value: d.totalSupply == null ? MISSING : compact(d.totalSupply), sub: d.symbol }) },
  { id: 'burned', label: 'Burned', group: 'supply',
    read: (d) => ({ value: d.burnedTokens == null ? MISSING : compact(d.burnedTokens), sub: `${pct(d.burnedPct)} of supply`, accent: ACCENT.red }) },
  { id: 'circulating', label: 'Circulating', group: 'supply',
    read: (d) => {
      if (d.totalSupply == null) return dash();
      const c = d.burnedTokens == null ? d.totalSupply : Math.max(0, d.totalSupply - d.burnedTokens);
      return { value: compact(c), sub: 'supply less the burn' };
    } },
  { id: 'age', label: 'Age', group: 'supply',
    read: (d) => ({ value: d.ageDays == null ? MISSING : `${nf(d.ageDays)} days`, sub: d.creationDate ? `since ${d.creationDate}` : 'on chain' }) },
  { id: 'renounced', label: 'Ownership', group: 'supply',
    read: (d) => ({
      value: d.renounced == null ? MISSING : d.renounced ? 'Renounced' : 'Owned',
      sub: d.renounced == null ? 'not reported' : d.renounced ? 'no owner key' : 'an owner key exists',
      accent: d.renounced == null ? undefined : d.renounced ? UP : ACCENT.amber,
    }) },
  { id: 'dev', label: 'Dev holds', group: 'supply',
    read: (d) => ({ value: pct(d.devHoldingPct, 2), sub: 'of total supply', accent: d.devHoldingPct != null && d.devHoldingPct >= 5 ? ACCENT.red : undefined }) },

  /* ── holders ───────────────────────────────────────────────────────────── */
  { id: 'holders', label: 'Holders', group: 'holders',
    read: (d) => ({ value: cnt(d.holders), sub: 'addresses with a balance', accent: ACCENT.magenta }) },
  { id: 'top10', label: 'Top 10 hold', group: 'holders',
    read: (d) => ({ value: pct(d.supplyHeld?.top10 ?? null), sub: 'excl. pools and burns', accent: ACCENT.red }) },
  { id: 'top20', label: 'Top 20 hold', group: 'holders',
    read: (d) => ({ value: pct(d.supplyHeld?.top20 ?? null), sub: 'excl. pools and burns' }) },
  { id: 'top50', label: 'Top 50 hold', group: 'holders',
    read: (d) => ({ value: pct(d.supplyHeld?.top50 ?? null), sub: 'excl. pools and burns', accent: ACCENT.amber }) },
  { id: 'contracts', label: 'In contracts', group: 'holders',
    read: (d) => ({ value: pct(d.contractHeldPct), sub: 'of supply sits in contracts' }) },
  { id: 'whales', label: 'Whales', group: 'holders', needs: 'leagues',
    read: (d) => {
      const b = d.leagues?.bands?.find((x) => x.index === 1);
      return b ? { value: `${nf(b.count)}${b.exact ? '' : '+'}`, sub: 'hold 1% of supply or more', accent: ACCENT.magenta } : dash();
    } },
  { id: 'sharks', label: 'Sharks', group: 'holders', needs: 'leagues',
    read: (d) => {
      const b = d.leagues?.bands?.find((x) => x.index === 2);
      return b ? { value: `${nf(b.count)}${b.exact ? '' : '+'}`, sub: 'hold 0.1% or more' } : dash();
    } },

  /* ── history ───────────────────────────────────────────────────────────── */
  { id: 'lifetime', label: 'Lifetime volume', group: 'history', needs: 'volume',
    read: (d) => d.volumeAll?.allTime ? { value: money(d.volumeAll.allTime.volumeUsd), sub: 'traded since launch', accent: ACCENT.amber } : dash() },
  { id: 'swaps', label: 'Swaps', group: 'history', needs: 'volume',
    read: (d) => d.volumeAll?.allTime ? { value: nf(d.volumeAll.allTime.txns), sub: 'trades all time' } : dash() },
  { id: 'daystrading', label: 'Days trading', group: 'history', needs: 'volume',
    read: (d) => d.volumeAll?.allTime ? { value: nf(d.volumeAll.allTime.days), sub: 'with a pool open' } : dash() },
  { id: 'bestday', label: 'Best day', group: 'history', needs: 'volume',
    read: (d) => {
      const b = d.volumeAll?.allTime?.bestDay;
      if (!b) return dash();
      return {
        value: money(b.volumeUsd),
        sub: new Date(b.date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        accent: ACCENT.amber,
      };
    } },
  { id: 'poolcount', label: 'Pools all time', group: 'history', needs: 'volume',
    read: (d) => d.volumeAll?.pairTotals ? { value: nf(d.volumeAll.pairTotals.count), sub: 'have ever traded it' } : dash() },
  { id: 'diamond', label: 'First buyers holding', group: 'history', needs: 'forensics',
    read: (d) => {
      const known = (d.forensics?.buyers ?? []).filter((b) => b.stillHolds !== null);
      if (!known.length) return dash();
      const holding = known.filter((b) => b.stillHolds).length;
      return { value: `${holding} of ${known.length}`, sub: 'day-one buyers still here', accent: UP };
    } },
  { id: 'launchliq', label: 'Liquidity at launch', group: 'history', needs: 'forensics',
    read: (d) => d.forensics?.initialLiquidityUsd != null
      ? { value: money(d.forensics.initialLiquidityUsd), sub: 'the first mint' }
      : dash() },

  /* ── flow ──────────────────────────────────────────────────────────────── */
  { id: 'buysell', label: 'Buy vs sell', group: 'flow', needs: 'pressure',
    read: (d) => {
      const p = d.pressure?.h24;
      if (!p || (p.buyUsd <= 0 && p.sellUsd <= 0)) return dash();
      const up = p.buyUsd >= p.sellUsd;
      const ratio = up ? p.buyUsd / Math.max(p.sellUsd, 1e-9) : p.sellUsd / Math.max(p.buyUsd, 1e-9);
      return {
        value: `${ratio.toFixed(2)}×`,
        sub: up ? 'more buying, 24h' : 'more selling, 24h',
        accent: up ? UP : DOWN,
      };
    } },
  { id: 'buyusd', label: 'Bought', group: 'flow', needs: 'pressure',
    read: (d) => d.pressure?.h24 ? { value: money(d.pressure.h24.buyUsd), sub: `${nf(d.pressure.h24.buyCount)} buys, 24h`, accent: UP } : dash() },
  { id: 'sellusd', label: 'Sold', group: 'flow', needs: 'pressure',
    read: (d) => d.pressure?.h24 ? { value: money(d.pressure.h24.sellUsd), sub: `${nf(d.pressure.h24.sellCount)} sells, 24h`, accent: DOWN } : dash() },
  { id: 'added', label: 'Wallets added', group: 'flow', needs: 'deltas',
    read: (d) => d.deltas ? { value: nf(d.deltas.added), sub: 'grew their position, 24h', accent: UP } : dash() },
  { id: 'trimmed', label: 'Wallets trimmed', group: 'flow', needs: 'deltas',
    read: (d) => d.deltas ? { value: nf(d.deltas.trimmed), sub: 'cut their position, 24h', accent: DOWN } : dash() },
  { id: 'netflow', label: 'Net position', group: 'flow', needs: 'deltas',
    read: (d) => {
      if (!d.deltas) return dash();
      const net = d.deltas.addedTokens - d.deltas.trimmedTokens;
      return {
        value: `${net >= 0 ? '+' : '−'}${compact(Math.abs(net))}`,
        sub: `${d.symbol}, net across 24h`,
        accent: net >= 0 ? UP : DOWN,
      };
    } },
];

export const METRIC_BY_ID = new Map(METRICS.map((m) => [m.id, m]));

/** The metrics worth offering for a chain — the rest have no source there. */
export function metricsForChain(chain: ChainKey): MetricDef[] {
  return METRICS.filter((m) => !m.needs || sourceSupported(m.needs, chain));
}

/** Which sources a chosen set of metrics needs fetched. */
export function sourcesFor(ids: string[]): SourceKey[] {
  const out = new Set<SourceKey>();
  for (const id of ids) {
    const n = METRIC_BY_ID.get(id)?.needs;
    if (n) out.add(n);
  }
  return [...out];
}

export const METRIC_GROUPS: { key: MetricDef['group']; label: string }[] = [
  { key: 'price', label: 'Price' },
  { key: 'size', label: 'Size' },
  { key: 'supply', label: 'Supply' },
  { key: 'holders', label: 'Holders' },
  { key: 'history', label: 'History' },
  { key: 'flow', label: 'Flow' },
];
