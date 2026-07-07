// GET /api/geicko/holder-growth?token=0x..
//
// Total holders now, plus daily/monthly change and a history series. Blockscout
// only exposes the *current* holder count, so we snapshot it into Postgres once
// per UTC day (opportunistically, on view — no cron needed) and the history
// builds forward from the first time a token is viewed. Past counts can't be
// backfilled, so the chart starts sparse and fills in over time. Degrades to
// "current count only" when no database is configured.

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';
import { blockscoutJson } from '@/lib/blockscout';

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;

const utcDate = (d: Date) => d.toISOString().slice(0, 10);
const asDateStr = (v: unknown) =>
  v instanceof Date ? utcDate(v) : String(v).slice(0, 10);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS holder_snapshots (
      token_address text NOT NULL,
      snapshot_date date NOT NULL,
      holders_count integer NOT NULL,
      PRIMARY KEY (token_address, snapshot_date)
    )`;
}

export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get('token') || '').toLowerCase();
  if (!ADDRESS_RX.test(token)) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  const meta = await blockscoutJson(`/tokens/${token}`, { revalidateSeconds: 120 });
  const totalHolders =
    meta?.holders != null
      ? Number(meta.holders)
      : meta?.holders_count != null
        ? Number(meta.holders_count)
        : null;

  let history: Array<{ date: string; count: number }> = [];
  let dailyChange: number | null = null;
  let monthlyChange: number | null = null;
  let persisted = false;

  if (sql && totalHolders != null && Number.isFinite(totalHolders)) {
    try {
      await ensureTable();
      const today = utcDate(new Date());
      await sql`
        INSERT INTO holder_snapshots (token_address, snapshot_date, holders_count)
        VALUES (${token}, ${today}, ${totalHolders})
        ON CONFLICT (token_address, snapshot_date)
        DO UPDATE SET holders_count = EXCLUDED.holders_count`;

      const rows = await sql`
        SELECT snapshot_date, holders_count
        FROM holder_snapshots
        WHERE token_address = ${token}
        ORDER BY snapshot_date ASC`;
      history = rows.map((r: any) => ({
        date: asDateStr(r.snapshot_date),
        count: Number(r.holders_count),
      }));
      persisted = true;

      // Deltas from stored history (null until enough days exist).
      const byDate = new Map(history.map((h) => [h.date, h.count]));
      const daysAgo = (n: number) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - n);
        return utcDate(d);
      };
      const yesterday = byDate.get(daysAgo(1));
      if (yesterday != null) dailyChange = totalHolders - yesterday;

      // Nearest snapshot on or before 30 days ago.
      const cutoff = daysAgo(30);
      const older = history.filter((h) => h.date <= cutoff);
      if (older.length > 0) {
        monthlyChange = totalHolders - older[older.length - 1].count;
      }
    } catch (e) {
      console.error('holder-growth snapshot failed:', e);
    }
  }

  return NextResponse.json(
    { token, totalHolders, dailyChange, monthlyChange, history, persisted },
    { headers: { 'Cache-Control': 'public, s-maxage=120' } },
  );
}
