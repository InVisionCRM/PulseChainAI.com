import { NextRequest, NextResponse } from 'next/server';
import { PULSEX_SUBGRAPHS, gql, num } from '@/lib/geicko/pulsex';
import { cached } from '@/lib/geicko/serverCache';

// Per-wallet LP position analytics for a PulseX (V2-style) pair: fees earned
// (isolated from impermanent loss) + net P&L since the wallet first provided
// liquidity. PulseChain only — the PulseX subgraph doesn't index other chains,
// and V2 stores no per-position fee ledger, so everything here is reconstructed
// from the wallet's mints/burns and the pool's reserve history.
//
// Fee math (the "√k growth" method): a V2 pool's fees are never paid out — they
// accrue inside the reserves, so each LP token slowly redeems for more. The
// quantity R = √(reserve0·reserve1) / totalSupply rises ONLY from swap fees
// (other people adding/removing liquidity scales reserves and supply together,
// leaving R unchanged). So for a wallet holding L LP tokens over an interval,
// the fees it earned, in geometric-mean liquidity units, is L·ΔR. Summing over
// every interval the wallet held (segmented at each of its own add/removes) and
// valuing the total at the current USD-per-unit gives "fees earned". This
// cleanly separates fees from impermanent loss and from the protocol fee cut.
//
// Attribution (verified against the live subgraph): a wallet's adds are its
// `mints` where to = wallet; its removes are its `burns` where sender = wallet.

export const revalidate = 0;
export const maxDuration = 30;

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;

interface LiqEvent {
  t: number;
  type: 'add' | 'remove';
  liquidity: number;
  amount0: number;
  amount1: number;
  usd: number;
}

interface DayR {
  date: number;
  r: number; // √(reserve0·reserve1) / totalSupply
}

const DAY = 86400;

// Find which subgraph indexes this pair (a pair lives in exactly one of v1/v2).
async function pairOn(url: string, pair: string) {
  const d = await gql(url, `{ pair(id:"${pair}"){ reserve0 reserve1 totalSupply reserveUSD token0{ symbol } token1{ symbol } } }`);
  return d?.pair ?? null;
}

async function mintsFor(url: string, pair: string, wallet: string): Promise<any[]> {
  const d = await gql(
    url,
    `{ mints(first:1000, orderBy:timestamp, orderDirection:asc, where:{ pair:"${pair}", to:"${wallet}" }){ timestamp liquidity amount0 amount1 amountUSD } }`,
  );
  return Array.isArray(d?.mints) ? d.mints : [];
}

async function burnsFor(url: string, pair: string, wallet: string): Promise<any[]> {
  const d = await gql(
    url,
    `{ burns(first:1000, orderBy:timestamp, orderDirection:asc, where:{ pair:"${pair}", sender:"${wallet}" }){ timestamp liquidity amount0 amount1 amountUSD } }`,
  );
  return Array.isArray(d?.burns) ? d.burns : [];
}

// Daily reserve snapshots → R series (ascending), from the wallet's first event.
async function dayRs(url: string, pair: string, sinceDay: number): Promise<DayR[]> {
  const out: DayR[] = [];
  // Page in case the position spans years (1000 daily rows ≈ 2.7y per page).
  let gt = sinceDay - DAY;
  for (let page = 0; page < 6; page++) {
    const d = await gql(
      url,
      `{ pairDayDatas(first:1000, orderBy:date, orderDirection:asc, where:{ pairAddress:"${pair}", totalSupply_gt:0, date_gt:${gt} }){ date reserve0 reserve1 totalSupply } }`,
    );
    const rows: any[] = Array.isArray(d?.pairDayDatas) ? d.pairDayDatas : [];
    for (const row of rows) {
      const r0 = num(row.reserve0);
      const r1 = num(row.reserve1);
      const ts = num(row.totalSupply);
      const k = r0 * r1;
      if (ts > 0 && k > 0 && Number.isFinite(k)) out.push({ date: Number(row.date), r: Math.sqrt(k) / ts });
    }
    if (rows.length < 1000) break;
    gt = Number(rows[rows.length - 1].date);
  }
  return out;
}

async function build(pair: string, wallet: string, currentBalance: number | null) {
  // Locate the pair's subgraph.
  let url: string | null = null;
  let pairEntity: any = null;
  for (const u of PULSEX_SUBGRAPHS) {
    const p = await pairOn(u, pair);
    if (p) { url = u; pairEntity = p; break; }
  }
  if (!url || !pairEntity) return { supported: true, hasHistory: false, reason: 'pair-not-indexed' };

  const [mintRows, burnRows] = await Promise.all([mintsFor(url, pair, wallet), burnsFor(url, pair, wallet)]);

  const events: LiqEvent[] = [
    ...mintRows.map((m) => ({ t: num(m.timestamp), type: 'add' as const, liquidity: num(m.liquidity), amount0: num(m.amount0), amount1: num(m.amount1), usd: num(m.amountUSD) })),
    ...burnRows.map((b) => ({ t: num(b.timestamp), type: 'remove' as const, liquidity: num(b.liquidity), amount0: num(b.amount0), amount1: num(b.amount1), usd: num(b.amountUSD) })),
  ].sort((a, b) => a.t - b.t);

  if (events.length === 0) return { supported: true, hasHistory: false, reason: 'no-events' };

  // Current pool state → R_now and the USD value of one √k liquidity unit.
  const r0Now = num(pairEntity.reserve0);
  const r1Now = num(pairEntity.reserve1);
  const supNow = num(pairEntity.totalSupply);
  const reserveUsdNow = num(pairEntity.reserveUSD);
  const kNow = r0Now * r1Now;
  const rNow = supNow > 0 && kNow > 0 ? Math.sqrt(kNow) / supNow : 0;
  const usdPerUnit = kNow > 0 ? reserveUsdNow / Math.sqrt(kNow) : 0;

  // Reserve history since the first event → R lookup (carry-forward last known).
  const firstDay = Math.floor(events[0].t / DAY) * DAY;
  const series = await dayRs(url, pair, firstDay);
  const rAt = (t: number): number => {
    if (!series.length) return rNow;
    // last snapshot with date <= t (binary-ish walk; series is small)
    let r = series[0].r;
    for (const s of series) { if (s.date <= t) r = s.r; else break; }
    return r;
  };

  // Deposits/withdrawals + net token flows.
  let depositedUsd = 0, withdrawnUsd = 0, addCount = 0, removeCount = 0;
  let net0 = 0, net1 = 0, computedBalance = 0;
  for (const e of events) {
    if (e.type === 'add') { depositedUsd += e.usd; addCount++; net0 += e.amount0; net1 += e.amount1; computedBalance += e.liquidity; }
    else { withdrawnUsd += e.usd; removeCount++; net0 -= e.amount0; net1 -= e.amount1; computedBalance -= e.liquidity; }
  }
  computedBalance = Math.max(0, computedBalance);

  // Prefer the live on-chain LP balance the portfolio already knows; fall back
  // to the reconstructed balance. A meaningful gap means LP tokens were moved
  // wallet-to-wallet (not minted/burned) — flag the history as partial.
  const balance = currentBalance != null && currentBalance > 0 ? currentBalance : computedBalance;
  const partialHistory =
    currentBalance != null && currentBalance > 0 &&
    Math.abs(computedBalance - currentBalance) / currentBalance > 0.02;

  // Fees: walk the timeline, accumulating L·ΔR over each holding interval, then
  // the open interval from the last event to now. R is non-decreasing (fees
  // only), so clamp tiny negative snapshot noise to 0.
  let feeUnits = 0;
  let running = 0;
  for (let i = 0; i < events.length; i++) {
    running += events[i].type === 'add' ? events[i].liquidity : -events[i].liquidity;
    running = Math.max(0, running);
    const tThis = events[i].t;
    const tNext = i + 1 < events.length ? events[i + 1].t : null;
    if (running > 0) {
      const rStart = rAt(tThis);
      const rEnd = tNext != null ? rAt(tNext) : rNow;
      feeUnits += running * Math.max(0, rEnd - rStart);
    }
  }
  const feesUsd = Math.max(0, feeUnits * usdPerUnit);

  const currentValueUsd = supNow > 0 ? (balance / supNow) * reserveUsdNow : 0;
  const netPnlUsd = withdrawnUsd + currentValueUsd - depositedUsd;

  const firstProvided = events[0].t;
  const daysProviding = Math.max(0, (Date.now() / 1000 - firstProvided) / DAY);
  const feeApr = daysProviding > 0.5 && depositedUsd > 0 ? (feesUsd / depositedUsd) * (365 / daysProviding) * 100 : null;

  return {
    supported: true,
    hasHistory: true,
    partialHistory,
    pair: {
      token0: pairEntity.token0?.symbol ?? '?',
      token1: pairEntity.token1?.symbol ?? '?',
    },
    feesUsd,
    netPnlUsd,
    depositedUsd,
    withdrawnUsd,
    currentValueUsd,
    addCount,
    removeCount,
    firstProvided,
    daysProviding,
    feeApr,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = (sp.get('chain') || sp.get('network') || 'pulsechain').toLowerCase();
  const pair = (sp.get('pair') || '').toLowerCase();
  const wallet = (sp.get('wallet') || '').toLowerCase();
  const balanceRaw = sp.get('balance');
  const balance = balanceRaw != null && Number.isFinite(Number(balanceRaw)) ? Number(balanceRaw) : null;

  if (chain !== 'pulsechain') return NextResponse.json({ supported: false, chain });
  if (!ADDR_RX.test(pair) || !ADDR_RX.test(wallet)) {
    return NextResponse.json({ error: 'pair and wallet required' }, { status: 400 });
  }

  try {
    const payload = await cached(
      `lp-position:${pair}:${wallet}`,
      300_000, // 5 min
      () => build(pair, wallet, balance),
      (v) => v.supported === true, // don't cache transport failures
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=1800' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load LP position' },
      { status: 500 },
    );
  }
}
