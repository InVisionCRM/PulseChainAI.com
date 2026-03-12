import { sql } from './connection';
import { ensureTokenProfileCustomTable } from './tokenProfileCustom';

export interface GoldBadgeRow {
  id: number;
  token_address: string;
  display_order: number;
  symbol: string | null;
  name: string | null;
  created_at: Date;
}

export type GoldBadgeWithLogo = { token_address: string; display_order: number; symbol: string | null; name: string | null; logo_url: string | null };

export async function ensureGoldBadgesTable(): Promise<void> {
  if (typeof window !== 'undefined' || !sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS gold_badges (
      id SERIAL PRIMARY KEY,
      token_address VARCHAR(42) UNIQUE NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      symbol VARCHAR(32),
      name VARCHAR(128),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_gold_badges_display_order ON gold_badges(display_order)
  `.catch(() => {});
}

export async function getGoldBadges(): Promise<{ token_address: string; display_order: number; symbol: string | null; name: string | null }[]> {
  if (typeof window !== 'undefined' || !sql) return [];
  await ensureGoldBadgesTable();
  const rows = await sql<GoldBadgeRow[]>`
    SELECT token_address, display_order, symbol, name
    FROM gold_badges
    ORDER BY display_order ASC, id ASC
  `;
  return rows.map((r) => ({
    token_address: r.token_address,
    display_order: r.display_order,
    symbol: r.symbol ?? null,
    name: r.name ?? null,
  }));
}

/** Returns gold badges with logo_url from token_profile_custom (for admin list). */
export async function getGoldBadgesWithLogo(): Promise<GoldBadgeWithLogo[]> {
  if (typeof window !== 'undefined' || !sql) return [];
  await ensureGoldBadgesTable();
  await ensureTokenProfileCustomTable();
  const rows = await sql<{ token_address: string; display_order: number; symbol: string | null; name: string | null; logo_url: string | null }[]>`
    SELECT g.token_address, g.display_order, g.symbol, g.name, p.logo_url
    FROM gold_badges g
    LEFT JOIN token_profile_custom p ON g.token_address = p.token_address
    ORDER BY g.display_order ASC, g.id ASC
  `;
  return rows.map((r) => ({
    token_address: r.token_address,
    display_order: r.display_order,
    symbol: r.symbol ?? null,
    name: r.name ?? null,
    logo_url: r.logo_url ?? null,
  }));
}

export async function addGoldBadge(
  tokenAddress: string,
  displayOrder?: number,
  symbol?: string | null,
  name?: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window !== 'undefined' || !sql) return { ok: false, error: 'Database not available' };
  const addr = tokenAddress.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return { ok: false, error: 'Invalid token address' };
  await ensureGoldBadgesTable();
  let order: number;
  if (displayOrder != null) {
    order = displayOrder;
  } else {
    const r = await sql`SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM gold_badges`;
    order = Number((r[0] as { next: number })?.next ?? 1);
  }
  await sql`
    INSERT INTO gold_badges (token_address, display_order, symbol, name)
    VALUES (${addr}, ${order}, ${symbol ?? null}, ${name ?? null})
    ON CONFLICT (token_address) DO UPDATE SET display_order = ${order}, symbol = COALESCE(EXCLUDED.symbol, gold_badges.symbol), name = COALESCE(EXCLUDED.name, gold_badges.name)
  `;
  return { ok: true };
}

export async function removeGoldBadge(tokenAddress: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof window !== 'undefined' || !sql) return { ok: false, error: 'Database not available' };
  const addr = tokenAddress.trim();
  await ensureGoldBadgesTable();
  await sql`DELETE FROM gold_badges WHERE token_address = ${addr}`;
  return { ok: true };
}

export async function reorderGoldBadges(orderedAddresses: string[]): Promise<{ ok: boolean; error?: string }> {
  if (typeof window !== 'undefined' || !sql) return { ok: false, error: 'Database not available' };
  await ensureGoldBadgesTable();
  for (let i = 0; i < orderedAddresses.length; i++) {
    const addr = orderedAddresses[i].trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) continue;
    await sql`UPDATE gold_badges SET display_order = ${i + 1} WHERE token_address = ${addr}`;
  }
  return { ok: true };
}
