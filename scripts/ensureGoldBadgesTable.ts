#!/usr/bin/env tsx
/**
 * Ensures the gold_badges table exists. Loads .env from project root for DATABASE_URL/POSTGRES_URL.
 * Run: npx tsx scripts/ensureGoldBadgesTable.ts
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Load .env from project root
const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  });
}

async function main() {
  const { ensureGoldBadgesTable, getGoldBadges } = await import('../lib/db/goldBadges');
  const { ensureTokenProfileCustomTable } = await import('../lib/db/tokenProfileCustom');
  await ensureGoldBadgesTable();
  await ensureTokenProfileCustomTable();
  const list = await getGoldBadges();
  console.log('gold_badges table ready. Current rows:', list.length);
  console.log('token_profile_custom table ready.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
