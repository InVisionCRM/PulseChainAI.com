// Shared live-rate loading for the HEX Strategist (Designer + Doctor). Pulls
// current rates and a trailing-30-day payout average from /api/hex-proxy
// (hexdailystats.com). Resilient: hexdailystats' `livedata` endpoint is flaky,
// so we merge it with the newest row of the daily series (`fulldata` /
// `fulldatapulsechain`), which carries the same fields, and only fail if
// neither source yields a usable T-Share rate.

export type Network = 'ethereum' | 'pulsechain';

export interface Rates {
  tShareRateHex: number; // HEX per T-Share
  dailyPayoutPerTShare: number; // HEX/day per T-Share (trailing 30d avg)
  priceUsd: number; // USD per HEX
  tSharePriceUsd: number; // USD per T-Share
  stakedHex: number;
  circulatingHex: number;
  // 30-day trends (ratio, e.g. +0.05 = +5%)
  tSharePriceTrend: number | null;
  payoutTrend: number | null;
}

export const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

type Rec = Record<string, unknown>;

/** First non-zero value across a list of candidate keys on a record. */
function field(rec: Rec | null, keys: string[]): number {
  if (!rec) return 0;
  for (const k of keys) {
    const v = num(rec[k]);
    if (v) return v;
  }
  return 0;
}

// hexdailystats uses different key spellings between `livedata` (suffixed for
// PulseChain) and the daily rows (base names, plus `payoutPerTshareHEX`). Read
// all known variants so either source works.
function readRates(rec: Rec | null, net: Network) {
  const p = net === 'pulsechain';
  return {
    tShareRateHex: field(rec, p ? ['tshareRateHEX_Pulsechain', 'tshareRateHEX'] : ['tshareRateHEX']),
    payout: field(rec, p
      ? ['payoutPerTshare_Pulsechain', 'payoutPerTshareHEX_Pulsechain', 'payoutPerTshare', 'payoutPerTshareHEX']
      : ['payoutPerTshare', 'payoutPerTshareHEX']),
    tSharePriceUsd: field(rec, p ? ['tsharePrice_Pulsechain', 'tsharePrice'] : ['tsharePrice']),
    priceUsd: field(rec, p ? ['pricePulseX', 'price_Pulsechain', 'price'] : ['price', 'priceUV2UV3', 'priceUV3']),
    stakedHex: field(rec, p ? ['stakedHEX_Pulsechain', 'stakedHEX'] : ['stakedHEX']),
    circulatingHex: field(rec, p ? ['circulatingHEX_Pulsechain', 'circulatingHEX'] : ['circulatingHEX']),
  };
}

const rowPayout = (r: Rec, net: Network) => readRates(r, net).payout;

export async function loadRates(net: Network): Promise<Rates> {
  const dailyEndpoint = net === 'pulsechain' ? 'fulldatapulsechain' : 'fulldata';
  const [liveRes, dailyRes] = await Promise.allSettled([
    fetch('/api/hex-proxy?endpoint=livedata'),
    fetch(`/api/hex-proxy?endpoint=${dailyEndpoint}`),
  ]);

  let live: Rec | null = null;
  if (liveRes.status === 'fulfilled' && liveRes.value.ok) {
    try { live = (await liveRes.value.json()) as Rec; } catch { live = null; }
  }

  // Daily series, newest-first (guard for either ordering by sorting on currentDay).
  let daily: Rec[] = [];
  if (dailyRes.status === 'fulfilled' && dailyRes.value.ok) {
    try {
      const d = await dailyRes.value.json();
      const arr = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
      daily = [...arr].sort((a, b) => num(b.currentDay) - num(a.currentDay));
    } catch { daily = []; }
  }
  const latest = daily[0] ?? null;

  // For each field, take the first source (live → newest daily) that has it.
  const sources: (Rec | null)[] = [live, latest];
  const pick = (sel: (r: ReturnType<typeof readRates>) => number): number => {
    for (const rec of sources) {
      if (!rec) continue;
      const v = sel(readRates(rec, net));
      if (v) return v;
    }
    return 0;
  };

  const tShareRateHex = pick((r) => r.tShareRateHex);
  if (!tShareRateHex) throw new Error('Failed to load live HEX rates');

  const livePayout = pick((r) => r.payout);
  const recent = daily.slice(0, 30);
  const payoutVals = recent.map((r) => rowPayout(r, net)).filter((v) => v > 0);
  const avgPayout = payoutVals.length ? payoutVals.reduce((s, v) => s + v, 0) / payoutVals.length : livePayout;

  const priceUsd = pick((r) => r.priceUsd);
  // T-Share price isn't always present in the feed; derive it from the rate ×
  // HEX price when missing (USD/T-Share = HEX-per-T-Share × USD-per-HEX).
  const tSharePriceUsd = pick((r) => r.tSharePriceUsd) || (tShareRateHex && priceUsd ? tShareRateHex * priceUsd : 0);
  const trend = (cur: number, sel: (r: ReturnType<typeof readRates>) => number): number | null => {
    const older = daily[30];
    if (!older) return null;
    const prev = sel(readRates(older, net));
    if (!prev || !cur) return null;
    return (cur - prev) / prev;
  };

  return {
    tShareRateHex,
    dailyPayoutPerTShare: avgPayout || livePayout,
    priceUsd,
    tSharePriceUsd,
    stakedHex: pick((r) => r.stakedHex),
    circulatingHex: pick((r) => r.circulatingHex),
    payoutTrend: trend(avgPayout || livePayout, (r) => r.payout),
    tSharePriceTrend: trend(tSharePriceUsd, (r) => r.tSharePriceUsd),
  };
}
