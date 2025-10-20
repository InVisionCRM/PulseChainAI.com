import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://api.scan.pulsechain.com/api/v2';

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = (searchParams.get('address') || '').toLowerCase();
    const days = Math.max(1, Math.min(365, Number(searchParams.get('days') || '30')));
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const limit = 1000;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffIso = cutoffDate.toISOString();

    const out: any[] = [];
    let nextParams: Record<string, string> | undefined = undefined;
    for (let i = 0; i < 200; i++) {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (nextParams) Object.entries(nextParams).forEach(([k, v]) => qs.set(k, String(v)));
      const data = await fetchJson(`${BASE}/tokens/${address}/transfers?${qs.toString()}`);
      const items: any[] = Array.isArray(data?.items) ? data.items : [];
      if (items.length === 0) break;
      const lastTs = items[items.length - 1]?.timestamp;
      out.push(...items.filter((t: any) => t?.timestamp && new Date(t.timestamp).toISOString() >= cutoffIso));
      if (!data?.next_page_params || (lastTs && new Date(lastTs).toISOString() < cutoffIso)) break;
      nextParams = data.next_page_params as Record<string, string>;
    }

    // O(n) metric
    const sent = new Map<string, number>();
    const received = new Map<string, number>();
    for (const t of out) {
      const f = t?.from?.hash?.toLowerCase();
      const to = t?.to?.hash?.toLowerCase();
      if (f) sent.set(f, (sent.get(f) || 0) + 1);
      if (to) received.set(to, (received.get(to) || 0) + 1);
    }
    let newHolders = 0, lostHolders = 0;
    const all = new Set<string>([...sent.keys(), ...received.keys()]);
    for (const a of all) {
      const s = sent.get(a) || 0;
      const r = received.get(a) || 0;
      if (r > 0 && s === 0) newHolders++;
      if (s > 0 && r === 0) lostHolders++;
    }

    const resp = NextResponse.json({
      success: true,
      address,
      days,
      newHolders,
      lostHolders,
      netChange: newHolders - lostHolders,
    });
    resp.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return resp;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}


