// Shared live-rate loading for the HEX Strategist (Designer + Doctor). Pulls
// current rates and a trailing-30-day payout average from /api/hex-proxy
// (hexdailystats.com) — the same source the legacy dashboard uses.

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

/** Pull the network-appropriate live rate fields out of the livedata blob. */
function pickLive(live: Record<string, unknown>, net: Network) {
  if (net === 'pulsechain') {
    return {
      tShareRateHex: num(live.tshareRateHEX_Pulsechain),
      payout: num(live.payoutPerTshare_Pulsechain),
      tSharePriceUsd: num(live.tsharePrice_Pulsechain),
      priceUsd: num(live.pricePulseX ?? live.price_Pulsechain),
      stakedHex: num(live.stakedHEX_Pulsechain),
      circulatingHex: num(live.circulatingHEX_Pulsechain),
    };
  }
  return {
    tShareRateHex: num(live.tshareRateHEX),
    payout: num(live.payoutPerTshare),
    tSharePriceUsd: num(live.tsharePrice),
    priceUsd: num(live.price),
    stakedHex: num(live.stakedHEX),
    circulatingHex: num(live.circulatingHEX),
  };
}

const rowPayout = (r: Record<string, unknown>) => num(r.payoutPerTshare ?? r.payoutPerTshare_Pulsechain);
const rowTSharePrice = (r: Record<string, unknown>) => num(r.tsharePrice ?? r.tsharePrice_Pulsechain);

export async function loadRates(net: Network): Promise<Rates> {
  const dailyEndpoint = net === 'pulsechain' ? 'fulldatapulsechain' : 'fulldata';
  const [liveRes, dailyRes] = await Promise.all([
    fetch('/api/hex-proxy?endpoint=livedata'),
    fetch(`/api/hex-proxy?endpoint=${dailyEndpoint}`),
  ]);
  if (!liveRes.ok) throw new Error('Failed to load live HEX rates');
  const live = (await liveRes.json()) as Record<string, unknown>;
  const picked = pickLive(live, net);

  // Daily series → trailing 30-day average payout + 30-day trends. hexdailystats
  // returns newest-first; guard for either ordering by sorting on currentDay.
  let daily: Record<string, unknown>[] = [];
  if (dailyRes.ok) {
    const d = await dailyRes.json();
    daily = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
    daily = [...daily].sort((a, b) => num(b.currentDay) - num(a.currentDay));
  }

  const recent = daily.slice(0, 30);
  const payoutVals = recent.map(rowPayout).filter((v) => v > 0);
  const avgPayout = payoutVals.length ? payoutVals.reduce((s, v) => s + v, 0) / payoutVals.length : picked.payout;

  const trend = (cur: number, key: 'payout' | 'tprice'): number | null => {
    const older = daily[30];
    if (!older) return null;
    const prev = key === 'payout' ? rowPayout(older) : rowTSharePrice(older);
    if (!prev || !cur) return null;
    return (cur - prev) / prev;
  };

  return {
    tShareRateHex: picked.tShareRateHex,
    dailyPayoutPerTShare: avgPayout || picked.payout,
    priceUsd: picked.priceUsd,
    tSharePriceUsd: picked.tSharePriceUsd,
    stakedHex: picked.stakedHex,
    circulatingHex: picked.circulatingHex,
    payoutTrend: trend(avgPayout || picked.payout, 'payout'),
    tSharePriceTrend: trend(picked.tSharePriceUsd, 'tprice'),
  };
}
