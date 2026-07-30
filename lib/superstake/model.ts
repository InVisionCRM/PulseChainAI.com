// SuperStake (pSSH) model — the same-dollar head-to-head between opening a
// native HEX stake and holding pSSH, plus the shared types for the snapshot.
//
// The maths here is a direct port of the reference implementation the project
// published; it is deliberately kept as pure functions so the numbers can be
// checked against that page. Everything runs off `SuperStakeSnapshot`, a baked
// daily series (payout-per-T-share, share rate, pHEX/pSSH price, pSSH volume)
// indexed by HEX day — the live endpoints only refresh "today" figures, they
// are not needed to replay history.

/** HEX launch timestamp (day 1 begins here). */
export const HEX_LAUNCH_TS = 1_575_331_200;

/** Every buy/sell pays a 5.5% toll, so only 94.5% of the spend becomes pSSH. */
export const TOLL = 0.055;
/** Share of trade volume paid back to holders as HEX (reflections). */
export const REFLECTION_RATE = 0.025;

export interface SuperStakeCycle {
  /** 1-based cycle number. */
  i: number;
  /** HEX stake id. */
  id: number;
  /** HEX day the cycle opened / is scheduled to close. */
  d0: number;
  d1: number;
  ts: number;
  /** HEX principal in the stake. */
  hex: number;
  /** T-shares held by the stake. */
  tsh: number;
  /** Share of all T-shares, percent. */
  own: number;
  /** Native yield earned over the cycle, HEX. */
  nY: number;
  /** HEX paid out to holders at the end of the cycle. */
  pay: number;
  /** pSSH trade volume during the cycle, USD. */
  vol: number;
  /** Reflections funded by that volume, HEX. */
  refl: number;
  /** pHEX price at cycle open / average across the cycle, USD. */
  pH0: number;
  pHavg: number;
  /** pSSH price at cycle open, USD. */
  pS0: number;
  hexU: number;
  psshU: number;
  /** False while the cycle is still running (its figures are estimates). */
  done: boolean;
}

export interface SuperStakeSnapshot {
  meta: {
    /** Human-readable date the snapshot was taken. */
    asOf: string;
    /** HEX day the snapshot was taken. */
    today: number;
    /** pSSH circulating supply. */
    supply: number;
    burned: number;
    pHEX: number;
    pSSH: number;
    shareRate: number;
    payoutPerTshare: number;
  };
  /** Average daily pSSH volume (USD) over each trailing window, keyed by days. */
  wins: Record<string, number>;
  cycles: SuperStakeCycle[];
  series: {
    /** HEX day of the first entry in every array below. */
    d0: number;
    /** Payout per T-share, HEX. */
    P: number[];
    /** T-share (share) rate. */
    SR: number[];
    /** pHEX price, USD. */
    PH: number[];
    /** pSSH trade volume, USD. */
    VV: number[];
    /** pSSH price, USD. */
    PV: number[];
  };
}

/** HEX day -> ISO date (yyyy-mm-dd), UTC. */
export function dayToISO(day: number): string {
  return new Date((HEX_LAUNCH_TS + (day - 1) * 86_400) * 1000)
    .toISOString()
    .slice(0, 10);
}

/** ISO date (yyyy-mm-dd) -> HEX day. */
export function isoToDay(iso: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) / 1000 - HEX_LAUNCH_TS) / 86_400) + 1;
}

export interface BacktestResult {
  /** HEX day the comparison starts / ends. */
  startDay: number;
  endDay: number;
  /** Length of the run in days. */
  days: number;
  /** pHEX and pSSH price on the start day, USD. */
  pHexStart: number;
  pSshStart: number;
  /** HEX bought by the stake side, and the T-shares it earns. */
  hexAmount: number;
  tShares: number;
  /** Longer-Pays-Better multiplier applied to the stake's T-shares. */
  lpbMultiplier: number;
  /** HEX earned by opening a native stake for the whole window. */
  stakeYield: number;
  /** pSSH bought after the toll, and the share of supply it represents. */
  psshAmount: number;
  supplyShare: number;
  /** HEX received from cycle payouts / from reflections. */
  payouts: number;
  reflections: number;
  /** Total HEX earned by holding pSSH. */
  psshYield: number;
  /** Which side came out ahead, and by what multiple. */
  winner: 'pssh' | 'stake';
  ratio: number;
}

/**
 * Replay one same-dollar decision: on `startISO`, either open a native HEX
 * stake that runs to the end of the snapshot, or spend the same dollars on
 * pSSH and hold. Returns the HEX each side ends up with.
 *
 * Both sides are measured in HEX (not USD) so the answer isn't just a bet on
 * the HEX price — it isolates which structure accrues more HEX.
 */
export function backtest(
  snap: SuperStakeSnapshot,
  amountUsd: number,
  startISO: string,
): BacktestResult | null {
  const { series, cycles, meta } = snap;
  if (!(amountUsd > 0) || !startISO) return null;

  const d0 = series.d0;
  const dE = d0 + series.P.length - 1;
  // Clamp to the snapshot window; the last day has no forward run to measure.
  const ds = Math.min(Math.max(isoToDay(startISO), d0), dE - 1);
  const days = dE - ds + 1;
  const at = (arr: number[], day: number) => arr[day - d0];

  const pHexStart = at(series.PH, ds);
  const pSshStart = at(series.PV, ds);
  if (!(pHexStart > 0) || !(pSshStart > 0)) return null;

  // --- Side A: open a native HEX stake for the whole window -----------------
  const hexAmount = amountUsd / pHexStart;
  // Longer Pays Better: +1/1820 per day of term, capped at ~10 years.
  const lpbMultiplier = 1 + (Math.min(days, 3641) - 1) / 1820;
  // Bigger Pays Better adds a little on top, then share rate converts to T-shares.
  const tShares =
    (hexAmount * lpbMultiplier + (hexAmount * Math.min(hexAmount, 150e6)) / 1.5e9) /
    at(series.SR, ds);
  let payoutSum = 0;
  for (let d = ds; d <= dE; d++) payoutSum += at(series.P, d);
  const stakeYield = tShares * payoutSum;

  // --- Side B: buy pSSH (after the toll) and hold ---------------------------
  const psshAmount = (amountUsd * (1 - TOLL)) / pSshStart;
  const supplyShare = psshAmount / meta.supply;
  // Cycle payouts land at the end of each completed cycle inside the window.
  let cyclePayouts = 0;
  for (const c of cycles) {
    if (c.done && c.d1 > ds && c.d1 <= dE + 1) cyclePayouts += c.pay;
  }
  // Reflections accrue daily out of trade volume, priced in HEX on the day.
  let reflectionPool = 0;
  for (let d = ds; d <= dE; d++) {
    const ph = at(series.PH, d);
    if (ph > 0) reflectionPool += (REFLECTION_RATE * at(series.VV, d)) / ph;
  }
  const payouts = supplyShare * cyclePayouts;
  const reflections = supplyShare * reflectionPool;
  const psshYield = payouts + reflections;

  const winner: 'pssh' | 'stake' = psshYield >= stakeYield ? 'pssh' : 'stake';
  const ratio =
    winner === 'pssh'
      ? psshYield / Math.max(stakeYield, 1e-9)
      : stakeYield / Math.max(psshYield, 1e-9);

  return {
    startDay: ds,
    endDay: dE,
    days,
    pHexStart,
    pSshStart,
    hexAmount,
    tShares,
    lpbMultiplier,
    stakeYield,
    psshAmount,
    supplyShare,
    payouts,
    reflections,
    psshYield,
    winner,
    ratio,
  };
}

/** Share of each end-stake paid out to holders. */
export const HOLDER_PAYOUT_RATE = 0.01;

/** The whitepaper's minimum holding that earns HEX rewards — 5,555 pSSH. */
export const S_SHARE = 5_555;

/**
 * What a dollar buys on each side, in HEX per cycle. This is the comparison the
 * whole page exists to make, so it lives here rather than being recomputed
 * wherever it's shown.
 *
 * An S-share earns twice — its slice of the 1% end-stake payout, plus its slice
 * of the 2.5% reflections the cycle's volume funds. A T-share earns the one way.
 * Both are then divided by what the unit costs, so they land on one scale.
 */
export function hexPerDollar(c: {
  /** HEX the pool pays out to holders this cycle (the 1%). */
  poolPayout: number;
  /** Cycle length in days. */
  cycleDays: number;
  /** Average daily pSSH trade volume, USD. */
  avgVolUsd: number;
  pHex: number;
  pSsh: number;
  /** pSSH circulating supply, which fixes how many S-shares are left. */
  supply: number;
  shareRate: number;
  payoutPerTshare: number;
}): { sShare: number; tShare: number; sSharesLeft: number } {
  const sSharesLeft = c.supply / S_SHARE;
  const reflHex = c.pHex > 0 ? (REFLECTION_RATE * c.avgVolUsd * c.cycleDays) / c.pHex : 0;
  const perS = sSharesLeft > 0 ? (c.poolPayout + reflHex) / sSharesLeft : 0;
  const perT = c.payoutPerTshare * c.cycleDays;
  return {
    sShare: c.pSsh > 0 ? perS / (S_SHARE * c.pSsh) : 0,
    tShare: c.pHex > 0 ? perT / (c.shareRate * c.pHex) : 0,
    sSharesLeft,
  };
}

/** Everything one 60-day cycle needs to be scored, from live stats or a record. */
export interface CycleInputs {
  /** Length of the cycle in days. */
  days: number;
  /** pHEX / pSSH price at entry, USD. */
  pHex: number;
  pSsh: number;
  /** Average pHEX across the cycle — reflections are earned throughout, not at entry. */
  pHexAvg: number;
  shareRate: number;
  /** HEX per T-share per day, for the user's own stake. */
  payoutPerTshare: number;
  /** The SuperStake pool's own principal and the HEX it earns over the cycle. */
  poolHex: number;
  poolYieldHex: number;
  /** Total pSSH trade volume across the cycle, USD. */
  volumeUsd: number;
  /** pSSH circulating supply. */
  supply: number;
}

export interface CycleResult {
  days: number;
  pHex: number;
  pSsh: number;
  hexAmount: number;
  tShares: number;
  lpbMultiplier: number;
  stakeYield: number;
  psshAmount: number;
  supplyShare: number;
  payouts: number;
  reflections: number;
  psshYield: number;
  winner: 'pssh' | 'stake';
  ratio: number;
}

/**
 * Score one 60-day cycle: the same dollars either open a fresh native HEX stake
 * for the cycle, or buy pSSH and hold it across the cycle's end-stake.
 *
 * Unlike `backtest`, which replays from a start date to the end of the record,
 * this covers exactly one cycle — so it works identically on a finished cycle
 * (fed its realised figures) and on the cycle now running (fed today's stats as
 * a projection). Both sides are counted in HEX.
 */
export function cycleHeadToHead(amountUsd: number, c: CycleInputs): CycleResult | null {
  if (!(amountUsd > 0) || !(c.days > 0) || !(c.pHex > 0) || !(c.pSsh > 0)) return null;
  if (!(c.shareRate > 0) || !(c.supply > 0)) return null;

  // --- Side A: open a native HEX stake for the cycle -------------------------
  const hexAmount = amountUsd / c.pHex;
  const lpbMultiplier = 1 + (Math.min(c.days, 3641) - 1) / 1820;
  const tShares =
    (hexAmount * lpbMultiplier + (hexAmount * Math.min(hexAmount, 150e6)) / 1.5e9) / c.shareRate;
  const stakeYield = tShares * c.payoutPerTshare * c.days;

  // --- Side B: buy pSSH (after the toll) and hold through the end-stake ------
  const psshAmount = (amountUsd * (1 - TOLL)) / c.pSsh;
  const supplyShare = psshAmount / c.supply;
  const payouts = supplyShare * HOLDER_PAYOUT_RATE * (c.poolHex + c.poolYieldHex);
  const priceForRefl = c.pHexAvg > 0 ? c.pHexAvg : c.pHex;
  const reflections = (supplyShare * (REFLECTION_RATE * c.volumeUsd)) / priceForRefl;
  const psshYield = payouts + reflections;

  const winner: 'pssh' | 'stake' = psshYield >= stakeYield ? 'pssh' : 'stake';
  return {
    days: c.days, pHex: c.pHex, pSsh: c.pSsh,
    hexAmount, tShares, lpbMultiplier, stakeYield,
    psshAmount, supplyShare, payouts, reflections, psshYield,
    winner,
    ratio:
      winner === 'pssh'
        ? psshYield / Math.max(stakeYield, 1e-9)
        : stakeYield / Math.max(psshYield, 1e-9),
  };
}

/** Turn a finished cycle's record into inputs, so history is scored the same way. */
export function inputsFromCycle(
  snap: SuperStakeSnapshot,
  c: SuperStakeCycle,
): CycleInputs | null {
  const days = c.d1 - c.d0;
  if (!(days > 0) || !(c.tsh > 0)) return null;
  const sr = snap.series.SR[c.d0 - snap.series.d0];
  if (!(sr > 0)) return null;
  return {
    days,
    pHex: c.pH0,
    pSsh: c.pS0,
    pHexAvg: c.pHavg,
    shareRate: sr,
    // The rate this cycle actually paid, rather than today's.
    payoutPerTshare: c.nY / (c.tsh * days),
    poolHex: c.hex,
    poolYieldHex: c.nY,
    volumeUsd: c.vol,
    supply: snap.meta.supply,
  };
}

/**
 * Run the same comparison for every completed cycle, entering on that cycle's
 * own opening day with its own prices — the "replay every cycle" view.
 */
export function backtestByCycle(snap: SuperStakeSnapshot, amountUsd: number) {
  return snap.cycles
    .filter((c) => c.done)
    .map((c) => {
      const r = backtest(snap, amountUsd, dayToISO(c.d0));
      return { cycle: c, result: r };
    })
    .filter((x): x is { cycle: SuperStakeCycle; result: BacktestResult } => x.result !== null);
}
