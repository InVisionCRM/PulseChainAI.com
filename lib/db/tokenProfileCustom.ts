import { sql } from './connection';

export type CustomLink = { label: string; url: string };

export interface TokenProfileCustomRow {
  token_address: string;
  description: string | null;
  logo_url: string | null;
  custom_links: CustomLink[] | null;
  updated_at: Date;
}

export async function ensureTokenProfileCustomTable(): Promise<void> {
  if (typeof window !== 'undefined' || !sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS token_profile_custom (
      token_address VARCHAR(42) PRIMARY KEY,
      description TEXT,
      logo_url VARCHAR(512),
      custom_links JSONB,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

export async function getTokenProfileCustom(
  tokenAddress: string
): Promise<{ description: string | null; logo_url: string | null; custom_links: CustomLink[] } | null> {
  if (typeof window !== 'undefined' || !sql) return null;
  const addr = tokenAddress.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
  await ensureTokenProfileCustomTable();
  const rows = await sql<TokenProfileCustomRow[]>`
    SELECT token_address, description, logo_url, custom_links, updated_at
    FROM token_profile_custom
    WHERE token_address = ${addr}
  `;
  const row = rows[0];
  if (!row) return null;
  const links = row.custom_links;
  const custom_links = Array.isArray(links)
    ? links.map((l: unknown) => (l && typeof l === 'object' && 'label' in l && 'url' in l ? { label: String((l as CustomLink).label), url: String((l as CustomLink).url) } : { label: '', url: '' })).filter((l) => l.label || l.url)
    : [];
  return {
    description: row.description ?? null,
    logo_url: row.logo_url ?? null,
    custom_links,
  };
}

export async function setTokenProfileCustom(
  tokenAddress: string,
  data: { description?: string | null; logo_url?: string | null; custom_links?: CustomLink[] | null }
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window !== 'undefined' || !sql) return { ok: false, error: 'Database not available' };
  const addr = tokenAddress.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return { ok: false, error: 'Invalid token address' };
  await ensureTokenProfileCustomTable();
  const description = data.description !== undefined ? (data.description || null) : undefined;
  const logo_url = data.logo_url !== undefined ? (data.logo_url || null) : undefined;
  const custom_links = data.custom_links !== undefined ? (Array.isArray(data.custom_links) ? data.custom_links.filter((l) => l && (l.label || l.url)) : null) : undefined;
  if (description === undefined && logo_url === undefined && custom_links === undefined) {
    return { ok: true };
  }
  const existing = await getTokenProfileCustom(addr);
  const payload = description !== undefined ? (description || null) : (existing?.description ?? null);
  const payloadLogo = logo_url !== undefined ? (logo_url || null) : (existing?.logo_url ?? null);
  const payloadLinks = custom_links !== undefined ? custom_links : (existing?.custom_links ?? []);
  await sql`
    INSERT INTO token_profile_custom (token_address, description, logo_url, custom_links, updated_at)
    VALUES (${addr}, ${payload}, ${payloadLogo}, ${JSON.stringify(payloadLinks)}, CURRENT_TIMESTAMP)
    ON CONFLICT (token_address) DO UPDATE SET
      description = EXCLUDED.description,
      logo_url = EXCLUDED.logo_url,
      custom_links = EXCLUDED.custom_links,
      updated_at = CURRENT_TIMESTAMP
  `;
  return { ok: true };
}
