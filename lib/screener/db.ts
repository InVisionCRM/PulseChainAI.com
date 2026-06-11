/**
 * Screener persistence (Neon Postgres). One wide table holds the pair
 * universe + latest DexScreener market snapshot; a tiny meta table holds
 * scan cursors. All addresses are stored lowercase.
 *
 * `listed` semantics: NULL = never enriched, FALSE = unknown to DexScreener
 * (dead/unlisted pair, excluded from the screener), TRUE = live.
 */

import { neon } from '@neondatabase/serverless';
import type { DiscoveredPair } from './logs';
import type { MarketRow } from './dexscreener';
import type { ScreenerTab, ScreenerWindow, DexInfo } from './types';

type Sql = ReturnType<typeof neon>;

let _sql: Sql | null = null;
function sql(): Sql {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL (or POSTGRES_URL) is not set');
  _sql = neon(url);
  return _sql;
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const q = sql();
      await q.query(`
        CREATE TABLE IF NOT EXISTS screener_pairs (
          pair_address    TEXT PRIMARY KEY,
          factory         TEXT NOT NULL,
          amm             TEXT NOT NULL,
          created_block   BIGINT NOT NULL,
          dex_id          TEXT,
          label           TEXT,
          base_address    TEXT,
          base_symbol     TEXT,
          base_name       TEXT,
          quote_address   TEXT,
          quote_symbol    TEXT,
          image_url       TEXT,
          price_usd       DOUBLE PRECISION,
          market_cap      DOUBLE PRECISION,
          fdv             DOUBLE PRECISION,
          liquidity_usd   DOUBLE PRECISION,
          pair_created_at TIMESTAMPTZ,
          txns_m5 INTEGER, txns_h1 INTEGER, txns_h6 INTEGER, txns_h24 INTEGER,
          vol_m5 DOUBLE PRECISION, vol_h1 DOUBLE PRECISION, vol_h6 DOUBLE PRECISION, vol_h24 DOUBLE PRECISION,
          chg_m5 DOUBLE PRECISION, chg_h1 DOUBLE PRECISION, chg_h6 DOUBLE PRECISION, chg_h24 DOUBLE PRECISION,
          listed          BOOLEAN,
          updated_at      TIMESTAMPTZ
        )`);
      await q.query(
        `CREATE INDEX IF NOT EXISTS idx_sp_listed_vol24 ON screener_pairs (vol_h24 DESC NULLS LAST) WHERE listed`,
      );
      await q.query(
        `CREATE INDEX IF NOT EXISTS idx_sp_created_at ON screener_pairs (pair_created_at DESC NULLS LAST) WHERE listed`,
      );
      await q.query(`CREATE INDEX IF NOT EXISTS idx_sp_base ON screener_pairs (base_address)`);
      await q.query(
        `CREATE INDEX IF NOT EXISTS idx_sp_refresh ON screener_pairs (updated_at ASC NULLS FIRST) WHERE listed`,
      );
      await q.query(
        `CREATE INDEX IF NOT EXISTS idx_sp_unenriched ON screener_pairs (created_block DESC) WHERE listed IS NULL`,
      );
      await q.query(
        `CREATE TABLE IF NOT EXISTS screener_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
      );
    })();
  }
  return schemaReady;
}

export async function getMeta(key: string): Promise<string | null> {
  const rows = (await sql().query(`SELECT value FROM screener_meta WHERE key = $1`, [key])) as {
    value: string;
  }[];
  return rows[0]?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await sql().query(
    `INSERT INTO screener_meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}

/** Insert newly discovered pairs; existing rows are left untouched. */
export async function insertDiscovered(pairs: DiscoveredPair[]): Promise<number> {
  if (pairs.length === 0) return 0;
  const params: unknown[] = [];
  const tuples = pairs.map((p, i) => {
    params.push(p.pairAddress, p.factory, p.amm, p.createdBlock);
    const o = i * 4;
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4})`;
  });
  const rows = (await sql().query(
    `INSERT INTO screener_pairs (pair_address, factory, amm, created_block)
     VALUES ${tuples.join(',')}
     ON CONFLICT (pair_address) DO NOTHING
     RETURNING pair_address`,
    params,
  )) as unknown[];
  return rows.length;
}

const MARKET_COLS = 23;

/** Apply a DexScreener snapshot to existing rows and mark them listed. */
export async function applyMarket(rows: MarketRow[]): Promise<void> {
  if (rows.length === 0) return;
  const params: unknown[] = [];
  const tuples = rows.map((r, i) => {
    params.push(
      r.pairAddress, r.dexId, r.label, r.baseAddress, r.baseSymbol, r.baseName,
      r.quoteAddress, r.quoteSymbol, r.imageUrl, r.priceUsd, r.marketCap, r.fdv,
      r.liquidityUsd, r.pairCreatedAt, r.txnsM5, r.txnsH1, r.txnsH6, r.txnsH24,
      r.volM5, r.volH1, r.volH6, r.volH24, r.chgM5, r.chgH1, r.chgH6, r.chgH24,
    );
    const o = i * (MARKET_COLS + 3);
    return `(${Array.from({ length: MARKET_COLS + 3 }, (_, j) => `$${o + j + 1}`).join(',')})`;
  });
  await sql().query(
    `UPDATE screener_pairs AS p SET
       dex_id = v.dex_id, label = v.label,
       base_address = v.base_address, base_symbol = v.base_symbol, base_name = v.base_name,
       quote_address = v.quote_address, quote_symbol = v.quote_symbol,
       image_url = v.image_url,
       price_usd = v.price_usd::float8, market_cap = v.market_cap::float8, fdv = v.fdv::float8,
       liquidity_usd = v.liquidity_usd::float8, pair_created_at = v.pair_created_at::timestamptz,
       txns_m5 = v.txns_m5::int, txns_h1 = v.txns_h1::int, txns_h6 = v.txns_h6::int, txns_h24 = v.txns_h24::int,
       vol_m5 = v.vol_m5::float8, vol_h1 = v.vol_h1::float8, vol_h6 = v.vol_h6::float8, vol_h24 = v.vol_h24::float8,
       chg_m5 = v.chg_m5::float8, chg_h1 = v.chg_h1::float8, chg_h6 = v.chg_h6::float8, chg_h24 = v.chg_h24::float8,
       listed = TRUE, updated_at = now()
     FROM (VALUES ${tuples.join(',')}) AS v(
       pair_address, dex_id, label, base_address, base_symbol, base_name,
       quote_address, quote_symbol, image_url, price_usd, market_cap, fdv,
       liquidity_usd, pair_created_at, txns_m5, txns_h1, txns_h6, txns_h24,
       vol_m5, vol_h1, vol_h6, vol_h24, chg_m5, chg_h1, chg_h6, chg_h24)
     WHERE p.pair_address = v.pair_address`,
    params,
  );
}

/** Pairs DexScreener returned nothing for: mark unlisted so they stop cycling. */
export async function markUnlisted(addresses: string[]): Promise<void> {
  if (addresses.length === 0) return;
  await sql().query(
    `UPDATE screener_pairs SET listed = FALSE, updated_at = now() WHERE pair_address = ANY($1)`,
    [addresses],
  );
}

/**
 * Addresses to refresh this cycle, by priority:
 * never-enriched (newest first), then live pairs by staleness,
 * then a small daily re-check of unlisted pairs (they can gain liquidity later).
 */
export async function refreshTargets(limit: number): Promise<string[]> {
  const newCap = Math.floor(limit * 0.2);
  const recheckCap = Math.floor(limit * 0.1);
  const activeCap = limit - newCap - recheckCap;
  const rows = (await sql().query(
    `(SELECT pair_address FROM screener_pairs WHERE listed IS NULL
       ORDER BY created_block DESC LIMIT $1)
     UNION ALL
     (SELECT pair_address FROM screener_pairs
       WHERE listed AND (liquidity_usd >= 500 OR txns_h24 > 0)
       ORDER BY updated_at ASC NULLS FIRST LIMIT $2)
     UNION ALL
     (SELECT pair_address FROM screener_pairs
       WHERE listed = FALSE AND updated_at < now() - interval '24 hours'
       ORDER BY updated_at ASC LIMIT $3)`,
    [newCap, activeCap, recheckCap],
  )) as { pair_address: string }[];
  return rows.map((r) => r.pair_address);
}

export async function countUnenriched(): Promise<number> {
  const rows = (await sql().query(
    `SELECT count(*)::int AS n FROM screener_pairs WHERE listed IS NULL`,
  )) as { n: number }[];
  return rows[0]?.n ?? 0;
}

/* ----------------------------- read side ------------------------------ */

const WINDOW_COLS: Record<ScreenerWindow, { txns: string; vol: string; chg: string }> = {
  m5: { txns: 'txns_m5', vol: 'vol_m5', chg: 'chg_m5' },
  h1: { txns: 'txns_h1', vol: 'vol_h1', chg: 'chg_h1' },
  h6: { txns: 'txns_h6', vol: 'vol_h6', chg: 'chg_h6' },
  h24: { txns: 'txns_h24', vol: 'vol_h24', chg: 'chg_h24' },
};

/** Liquidity floor for ranked tabs — keeps dust pairs out of the table. */
const LIQ_FLOOR = 100;

/** Columns a user may explicitly rank by (window-dependent keys resolve per request). */
export const SORT_KEYS = ['mcap', 'price', 'age', 'txns', 'volume', 'm5', 'h1', 'h6', 'h24', 'liq'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

function sortColumn(key: SortKey, w: { txns: string; vol: string }): string {
  switch (key) {
    case 'mcap': return 'coalesce(market_cap, fdv)';
    case 'price': return 'price_usd';
    case 'age': return 'pair_created_at';
    case 'txns': return w.txns;
    case 'volume': return w.vol;
    case 'm5': return 'chg_m5';
    case 'h1': return 'chg_h1';
    case 'h6': return 'chg_h6';
    case 'h24': return 'chg_h24';
    case 'liq': return 'liquidity_usd';
  }
}

export interface ListFilters {
  minLiq: number | null;
  minVol24: number | null;
  /** Pair age bounds in hours. */
  minAgeH: number | null;
  maxAgeH: number | null;
}

export interface ListParams {
  tab: ScreenerTab;
  window: ScreenerWindow;
  dexId: string | null;
  page: number;
  pageSize: number;
  goldAddresses: string[]; // ordered, lowercase base-token addresses
  sort: SortKey | null;
  dir: 'asc' | 'desc';
  filters: ListFilters;
}

export interface DbScreenerRow {
  pair_address: string;
  dex_id: string | null;
  label: string | null;
  base_address: string | null;
  base_symbol: string | null;
  base_name: string | null;
  quote_symbol: string | null;
  image_url: string | null;
  price_usd: number | null;
  market_cap: number | null;
  fdv: number | null;
  liquidity_usd: number | null;
  pair_created_at: string | null;
  txns_m5: number | null; txns_h1: number | null; txns_h6: number | null; txns_h24: number | null;
  vol_m5: number | null; vol_h1: number | null; vol_h6: number | null; vol_h24: number | null;
  chg_m5: number | null; chg_h1: number | null; chg_h6: number | null; chg_h24: number | null;
}

export async function listPairs(p: ListParams): Promise<DbScreenerRow[]> {
  const w = WINDOW_COLS[p.window];
  const params: unknown[] = [];
  const where: string[] = ['listed', `liquidity_usd >= ${LIQ_FLOOR}`];

  if (p.dexId) {
    params.push(p.dexId);
    where.push(`dex_id = $${params.length}`);
  }

  const f = p.filters;
  if (f.minLiq !== null) {
    params.push(f.minLiq);
    where.push(`liquidity_usd >= $${params.length}`);
  }
  if (f.minVol24 !== null) {
    params.push(f.minVol24);
    where.push(`vol_h24 >= $${params.length}`);
  }
  if (f.minAgeH !== null) {
    params.push(f.minAgeH);
    where.push(`pair_created_at <= now() - $${params.length} * interval '1 hour'`);
  }
  if (f.maxAgeH !== null) {
    params.push(f.maxAgeH);
    where.push(`pair_created_at >= now() - $${params.length} * interval '1 hour'`);
  }

  let order: string;
  switch (p.tab) {
    case 'trending':
      order = `(ln(1 + greatest(${w.vol}, 0)) + 1.5 * ln(1 + greatest(${w.txns}, 0))) DESC NULLS LAST`;
      break;
    case 'top':
      order = `${w.vol} DESC NULLS LAST`;
      break;
    case 'gainers':
      where.push(`liquidity_usd >= 1000`, `${w.txns} >= 5`);
      order = `${w.chg} DESC NULLS LAST`;
      break;
    case 'new':
      order = `pair_created_at DESC NULLS LAST`;
      break;
    case 'gold': {
      params.push(p.goldAddresses);
      where.push(`base_address = ANY($${params.length})`);
      order = `array_position($${params.length}::text[], base_address), vol_h24 DESC NULLS LAST`;
      break;
    }
  }

  // An explicit column sort overrides the tab's ranking.
  if (p.sort) {
    order = `${sortColumn(p.sort, w)} ${p.dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`;
  }

  params.push(p.pageSize, p.page * p.pageSize);
  const rows = await sql().query(
    `SELECT pair_address, dex_id, label, base_address, base_symbol, base_name,
            quote_symbol, image_url, price_usd, market_cap, fdv, liquidity_usd,
            pair_created_at,
            txns_m5, txns_h1, txns_h6, txns_h24,
            vol_m5, vol_h1, vol_h6, vol_h24,
            chg_m5, chg_h1, chg_h6, chg_h24
     FROM screener_pairs
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows as DbScreenerRow[];
}

export async function chainStats(): Promise<{ vol24: number; txns24: number; pairs: number }> {
  const rows = (await sql().query(
    `SELECT coalesce(sum(vol_h24), 0)::float8 AS vol24,
            coalesce(sum(txns_h24), 0)::int AS txns24,
            count(*)::int AS pairs
     FROM screener_pairs WHERE listed`,
  )) as { vol24: number; txns24: number; pairs: number }[];
  return rows[0] ?? { vol24: 0, txns24: 0, pairs: 0 };
}

export async function listDexes(): Promise<DexInfo[]> {
  const rows = (await sql().query(
    `SELECT dex_id, count(*)::int AS pairs
     FROM screener_pairs
     WHERE listed AND dex_id IS NOT NULL AND liquidity_usd >= ${LIQ_FLOOR}
     GROUP BY dex_id
     ORDER BY sum(vol_h24) DESC NULLS LAST
     LIMIT 20`,
  )) as { dex_id: string; pairs: number }[];
  return rows.map((r) => ({ dexId: r.dex_id, pairs: r.pairs }));
}
