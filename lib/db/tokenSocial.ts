// Community comments + 👍/👎 ratings for a token on the geicko page.
//
// Keyed by (chain, token_address) so the same address on PulseChain vs
// Robinhood keeps separate threads. No auth: a display name is free text and
// votes are de-duplicated by a hashed IP (never the raw address) plus the
// caller's own browser. Content is stored raw and rendered as PLAIN TEXT by the
// UI (React escapes), so there is no HTML/JS injection surface here.

import { createHash } from 'crypto';
import { sql } from './connection';

export const NAME_MAX = 30;
export const BODY_MAX = 150;
const COMMENT_COOLDOWN_MS = 15_000; // anti-flood: min gap between a poster's comments
const VOTE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h between votes from one IP per token
const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;
const CHAINS = new Set(['pulsechain', 'ethereum', 'robinhood']);

export interface TokenComment {
  id: number;
  name: string;
  body: string;
  createdAt: string; // ISO
}
export interface RatingCounts {
  up: number;
  down: number;
}

/** sha256(ip + salt) — we store this, never the raw IP. */
export function hashIp(ip: string): string {
  const salt = process.env.COMMENT_IP_SALT || process.env.GOLD_ADMIN_SECRET || 'geicko-social';
  return createHash('sha256').update(`${ip}|${salt}`).digest('hex').slice(0, 64);
}

function normChain(chain: string): string | null {
  const c = (chain || '').toLowerCase();
  return CHAINS.has(c) ? c : null;
}
function normAddr(token: string): string | null {
  const t = (token || '').trim().toLowerCase();
  return ADDR_RX.test(t) ? t : null;
}
// Strip control chars, collapse runs of whitespace, trim, hard-cap length.
function clean(s: string, max: number): string {
  return (s || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

let ensured = false;
async function ensureTables(): Promise<void> {
  if (typeof window !== 'undefined' || !sql) return;
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS token_comments (
      id            BIGSERIAL PRIMARY KEY,
      chain         VARCHAR(16)  NOT NULL,
      token_address VARCHAR(42)  NOT NULL,
      name          VARCHAR(40)  NOT NULL,
      body          VARCHAR(200) NOT NULL,
      ip_hash       VARCHAR(64)  NOT NULL,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_token_comments_lookup
    ON token_comments (chain, token_address, created_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS token_votes (
      chain         VARCHAR(16) NOT NULL,
      token_address VARCHAR(42) NOT NULL,
      ip_hash       VARCHAR(64) NOT NULL,
      vote          SMALLINT    NOT NULL,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (chain, token_address, ip_hash)
    )
  `;
  ensured = true;
}

export async function listComments(
  chain: string,
  token: string,
  limit = 25,
  offset = 0,
): Promise<{ comments: TokenComment[]; hasMore: boolean } | null> {
  if (!sql) return null;
  const c = normChain(chain);
  const t = normAddr(token);
  if (!c || !t) return { comments: [], hasMore: false };
  await ensureTables();
  const lim = Math.min(Math.max(1, limit), 50);
  const off = Math.max(0, offset);
  const rows = await sql<{ id: number; name: string; body: string; created_at: string }[]>`
    SELECT id, name, body, created_at
    FROM token_comments
    WHERE chain = ${c} AND token_address = ${t}
    ORDER BY created_at DESC
    LIMIT ${lim + 1} OFFSET ${off}
  `;
  const hasMore = rows.length > lim;
  const comments = rows.slice(0, lim).map((r) => ({
    id: Number(r.id),
    name: r.name,
    body: r.body,
    createdAt: new Date(r.created_at).toISOString(),
  }));
  return { comments, hasMore };
}

export async function addComment(
  chain: string,
  token: string,
  name: string,
  body: string,
  ipHash: string,
): Promise<{ ok: true; comment: TokenComment } | { ok: false; error: string; status: number }> {
  if (!sql) return { ok: false, error: 'Comments are unavailable right now.', status: 503 };
  const c = normChain(chain);
  const t = normAddr(token);
  if (!c || !t) return { ok: false, error: 'Invalid token.', status: 400 };
  const cleanBody = clean(body, BODY_MAX);
  if (!cleanBody) return { ok: false, error: 'Say something first.', status: 400 };
  const cleanName = clean(name, NAME_MAX) || 'Anon';
  await ensureTables();

  // Per-IP flood guard (compare against a JS-computed threshold; neon can't
  // bind a parameter inside a SQL interval literal).
  const since = new Date(Date.now() - COMMENT_COOLDOWN_MS).toISOString();
  const recent = await sql<{ created_at: string }[]>`
    SELECT created_at FROM token_comments
    WHERE ip_hash = ${ipHash} AND created_at > ${since}::timestamptz
    LIMIT 1
  `;
  if (recent.length > 0) {
    return { ok: false, error: "You're posting too fast — give it a few seconds.", status: 429 };
  }

  const rows = await sql<{ id: number; name: string; body: string; created_at: string }[]>`
    INSERT INTO token_comments (chain, token_address, name, body, ip_hash)
    VALUES (${c}, ${t}, ${cleanName}, ${cleanBody}, ${ipHash})
    RETURNING id, name, body, created_at
  `;
  const r = rows[0];
  return {
    ok: true,
    comment: { id: Number(r.id), name: r.name, body: r.body, createdAt: new Date(r.created_at).toISOString() },
  };
}

export async function deleteComment(id: number): Promise<boolean> {
  if (!sql || !Number.isFinite(id)) return false;
  await ensureTables();
  const rows = await sql<{ id: number }[]>`
    DELETE FROM token_comments WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

export async function getRatings(chain: string, token: string): Promise<RatingCounts | null> {
  if (!sql) return null;
  const c = normChain(chain);
  const t = normAddr(token);
  if (!c || !t) return { up: 0, down: 0 };
  await ensureTables();
  const rows = await sql<{ up: number; down: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE vote = 1)  AS up,
      COUNT(*) FILTER (WHERE vote = -1) AS down
    FROM token_votes
    WHERE chain = ${c} AND token_address = ${t}
  `;
  return { up: Number(rows[0]?.up ?? 0), down: Number(rows[0]?.down ?? 0) };
}

/** The caller's current vote for this token (0 = hasn't voted), by hashed IP. */
export async function getUserVote(chain: string, token: string, ipHash: string): Promise<1 | -1 | 0> {
  if (!sql) return 0;
  const c = normChain(chain);
  const t = normAddr(token);
  if (!c || !t) return 0;
  await ensureTables();
  const rows = await sql<{ vote: number }[]>`
    SELECT vote FROM token_votes
    WHERE chain = ${c} AND token_address = ${t} AND ip_hash = ${ipHash}
  `;
  const v = rows[0]?.vote;
  return v === 1 ? 1 : v === -1 ? -1 : 0;
}

export async function castVote(
  chain: string,
  token: string,
  ipHash: string,
  vote: 1 | -1,
): Promise<
  | { ok: true; counts: RatingCounts; yourVote: 1 | -1 }
  | { ok: false; error: string; status: number; counts?: RatingCounts; yourVote?: 1 | -1 }
> {
  if (!sql) return { ok: false, error: 'Ratings are unavailable right now.', status: 503 };
  const c = normChain(chain);
  const t = normAddr(token);
  if (!c || !t) return { ok: false, error: 'Invalid token.', status: 400 };
  await ensureTables();

  const existing = await sql<{ vote: number; updated_at: string }[]>`
    SELECT vote, updated_at FROM token_votes
    WHERE chain = ${c} AND token_address = ${t} AND ip_hash = ${ipHash}
  `;
  if (existing.length > 0) {
    const age = Date.now() - new Date(existing[0].updated_at).getTime();
    if (age < VOTE_COOLDOWN_MS) {
      const counts = (await getRatings(c, t))!;
      return {
        ok: false,
        error: 'You already voted on this token today.',
        status: 429,
        counts,
        yourVote: (existing[0].vote as 1 | -1),
      };
    }
  }

  await sql`
    INSERT INTO token_votes (chain, token_address, ip_hash, vote, updated_at)
    VALUES (${c}, ${t}, ${ipHash}, ${vote}, now())
    ON CONFLICT (chain, token_address, ip_hash)
    DO UPDATE SET vote = ${vote}, updated_at = now()
  `;
  const counts = (await getRatings(c, t))!;
  return { ok: true, counts, yourVote: vote };
}
