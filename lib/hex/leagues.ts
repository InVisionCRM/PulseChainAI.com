// HEX Staker Leagues — pure ladder definition + standing math. No I/O, so the
// same functions rank the leaderboard on the server and drive the "what if"
// simulator in the browser.
//
// WHY SHARE-OF-NETWORK, NOT A FIXED T-SHARE NUMBER
// A league is a slice of the *live* T-Share supply (globalInfo.stakeSharesTotal),
// not a hardcoded amount. Two reasons: it is genuinely comparative ("you hold
// 0.04% of every T-Share alive" means something; "you hold 17,000 T-Shares"
// does not), and it stays honest over time — the HEX share rate only ever goes
// up, so a fixed T-Share bar would quietly become unreachable for anyone who
// stakes later. Floors move with the network, which is also what makes the
// ladder competitive: standing still while others stake demotes you.
//
// T-SHARES ONLY COUNT WHILE THEY ARE LOCKED. HEX removes a stake's shares from
// the global total the moment it is ended OR good-accounted, so both are
// excluded everywhere here — on-chain that is `unlockedDay !== 0`, and off-chain
// it is a matching stakeEnd or stakeGoodAccounting event.

import type { LockedStake } from './lockedStakes';

export interface League {
  key: string;
  /** Ladder name. Index 0 is the top of the ladder. */
  name: string;
  /** One line of flavor — what holding this slice of the network means. */
  tagline: string;
  /** Floor, as a fraction of the network's total live T-Shares. */
  share: number;
  /** Accent color for crest, bars and text. */
  color: string;
}

/**
 * The ladder, highest first — HEX's own league names, on HEX's own decade
 * spacing (10%, 1%, 0.1% …). These names and cutoffs are the ones the community
 * already uses, so they are kept exactly rather than re-invented; the only
 * change is the denominator, which here is locked T-Shares rather than tokens.
 *
 * A decade per rung means the tiers are not evenly populated — Dolphin
 * currently holds around two thousand stakers where Shark holds under thirty.
 * That is the real shape of the distribution, and the per-tier progress bar is
 * what gives someone mid-tier something to climb.
 */
export const LEAGUES: League[] = [
  { key: 'poseidon', name: 'Poseidon', tagline: 'A tenth of every T-Share alive. The chain moves when you do.', share: 0.1, color: '#f5c451' },
  { key: 'whale', name: 'Whale', tagline: 'One full percent of the network locked behind one address.', share: 0.01, color: '#5b9dfb' },
  { key: 'shark', name: 'Shark', tagline: 'A tenth of a percent. You show up in every whale scan on the chain.', share: 0.001, color: '#9fb3c8' },
  { key: 'dolphin', name: 'Dolphin', tagline: 'Serious, long-dated conviction. The deep end of the pool.', share: 0.0001, color: '#38bdf8' },
  { key: 'squid', name: 'Squid', tagline: 'A real position, quietly compounding in the dark.', share: 0.00001, color: '#c084fc' },
  { key: 'turtle', name: 'Turtle', tagline: 'Slow, armoured, and still here. Time is the whole strategy.', share: 0.000001, color: '#34d399' },
  { key: 'crab', name: 'Crab', tagline: 'Claws in, sideways forever. Nobody shakes you out.', share: 0.0000001, color: '#fb7185' },
  { key: 'shrimp', name: 'Shrimp', tagline: 'Small, fast, and stacking. Everyone above you started here.', share: 0.00000001, color: '#fdba74' },
  { key: 'shell', name: 'Shell', tagline: 'On the board. One stake is all it takes to start climbing.', share: 0.000000001, color: '#a8a29e' },
];

export const LEAGUE_BY_KEY: Record<string, League> = Object.fromEntries(LEAGUES.map((l) => [l.key, l]));

/** The bottom rung — anything below Shrimp's floor, including nothing at all. */
export const ENTRY_LEAGUE = LEAGUES[LEAGUES.length - 1];

/** Today's T-Share floor for a league, given the network's live share total. */
export const leagueFloor = (league: League, networkTShares: number) => league.share * networkTShares;

/** The league a T-Share balance belongs to. Ladder is ordered highest first. */
export function leagueFor(tShares: number, networkTShares: number): League {
  if (!(tShares > 0) || !(networkTShares > 0)) return ENTRY_LEAGUE;
  return LEAGUES.find((l) => tShares >= leagueFloor(l, networkTShares)) ?? ENTRY_LEAGUE;
}

export interface Standing {
  tShares: number;
  networkTShares: number;
  /** Share of the network's live T-Shares, in percent. */
  sharePct: number;
  league: League;
  /** The league one rung up, or null at the top of the ladder. */
  next: League | null;
  /** The league you fall to if you drop below your floor; null at the bottom. */
  below: League | null;
  /** T-Share floor of the current league (0 for the entry tier). */
  floorTShares: number;
  /** T-Share floor of the next league up, or null at the top. */
  nextFloorTShares: number | null;
  /** T-Shares still needed for promotion, or null at the top. */
  toPromotion: number | null;
  /** T-Shares you can lose before demotion — your cushion. 0 at the bottom. */
  cushion: number;
  /** 0–100 progress through the current band toward the next floor. */
  progressPct: number;
}

/** Everything the UI needs to say where an address stands on the ladder. */
export function standingFor(tShares: number, networkTShares: number): Standing {
  const t = Math.max(0, tShares || 0);
  const league = leagueFor(t, networkTShares);
  const i = LEAGUES.indexOf(league);
  const next = i > 0 ? LEAGUES[i - 1] : null;
  const below = i < LEAGUES.length - 1 ? LEAGUES[i + 1] : null;
  const floorTShares = leagueFloor(league, networkTShares);
  const nextFloorTShares = next ? leagueFloor(next, networkTShares) : null;
  const span = nextFloorTShares != null ? nextFloorTShares - floorTShares : 0;
  return {
    tShares: t,
    networkTShares,
    sharePct: networkTShares > 0 ? (t / networkTShares) * 100 : 0,
    league,
    next,
    below,
    floorTShares,
    nextFloorTShares,
    toPromotion: nextFloorTShares != null ? Math.max(0, nextFloorTShares - t) : null,
    // At the entry tier there is nothing below, so nothing to lose.
    cushion: below ? Math.max(0, t - floorTShares) : 0,
    progressPct: span > 0 ? Math.max(0, Math.min(100, ((t - floorTShares) / span) * 100)) : t > 0 ? 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// Leaderboard aggregation
// ---------------------------------------------------------------------------

export interface LeagueRow {
  rank: number;
  address: string;
  tShares: number;
  /** Share of the network's live T-Shares, in percent. */
  sharePct: number;
  /** Locked HEX principal behind those shares. */
  principalHex: number;
  /** How many locked stakes the address is running. */
  stakes: number;
  leagueKey: string;
}

const TSHARE = 1e12;
const HEARTS = 1e8;

/**
 * Sum locked stakes per staker and rank them by T-Shares. `stakes` must already
 * have ended and good-accounted stakes removed — their shares no longer exist
 * as far as the network total is concerned.
 */
export function rankStakers(stakes: LockedStake[], networkTShares: number, limit = 250): LeagueRow[] {
  const totals = new Map<string, { t: number; hex: number; n: number }>();
  for (const s of stakes) {
    const a = s.stakerAddr.toLowerCase();
    const e = totals.get(a) ?? { t: 0, hex: 0, n: 0 };
    e.t += Number(s.stakeShares) / TSHARE;
    e.hex += Number(s.stakedHearts) / HEARTS;
    e.n += 1;
    totals.set(a, e);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1].t - a[1].t)
    .slice(0, limit)
    .map(([address, v], i) => ({
      rank: i + 1,
      address,
      tShares: v.t,
      sharePct: networkTShares > 0 ? (v.t / networkTShares) * 100 : 0,
      principalHex: v.hex,
      stakes: v.n,
      leagueKey: leagueFor(v.t, networkTShares).key,
    }));
}

/**
 * How many sampled stakers sit in each league, keyed by league. These are LOWER
 * BOUNDS, not censuses: the sample only reaches down to the largest N stakes on
 * the chain, so tiers near the bottom of the ladder are undercounted. The UI
 * labels them as such.
 */
export function leaguePopulations(tShareTotals: number[], networkTShares: number): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(LEAGUES.map((l) => [l.key, 0]));
  for (const t of tShareTotals) out[leagueFor(t, networkTShares).key] += 1;
  return out;
}
