// Finding — and stopping — HEX stakes that are bleeding out.
//
// A HEX stake that has served its full term stops earning, but it does not stop
// LOSING. Fourteen days after the end day the late-end penalty starts, and it
// takes the whole stake at a rate of 1/700th per day: gross * daysPastGrace/700.
// Stakers who forget, lose their keys, or simply die leave stakes bleeding for
// years. Measured on PulseChain, of the stakes that matured in the last ~400
// days, 17.8% are still sitting there unended, and they burn ~21k HEX a day.
//
// The rescue is possible because of one asymmetry in the contract:
//
//   stakeGoodAccounting(address stakerAddr, uint256 stakeIndex, uint40 stakeId)
//   stakeEnd(uint256 stakeIndex, uint40 stakeId)
//
// `stakeGoodAccounting` takes the staker's ADDRESS and has no caller check —
// anybody may call it for anybody. `stakeEnd` reads `stakeLists[msg.sender]` and
// does `_mint(msg.sender, stakeReturn)`, so only the owner can end a stake, and
// the proceeds go to whoever calls it. That is why this file can rescue a
// stranger's stake but can never finish it for them: good-accounting FREEZES the
// payout and penalty as of today, and the staker still collects, whenever they
// like, by ending it themselves.
//
// Good-accounting is therefore purely a gift. It moves no money to the caller —
// the function emits an event, folds the penalty into the global pool and
// updates the stake — so a key that can only call this can only ever do people
// a favour with its own gas.
//
// `findRescueCandidates` applies a principal floor. Gas cost is driven by a
// stake's TERM, not its size (see below), so rescuing a 1,100 HEX stake costs
// the same as rescuing a 3,000,000 HEX one — the floor exists to spend that
// fixed cost where it recovers the most, and to keep the number of
// transactions a single run signs from growing unbounded.
//
// The floor is meant to be turned down as the backlog is worked through, so it
// is a setting rather than a constant: `HEX_RESCUE_MIN_HEX` in the environment
// moves it everywhere (script and nightly cron alike) with no code change, and
// `--min-hex` overrides it for a single run. See `defaultMinPrincipalHex`.
//
// Two facts shape the mechanics, both verified against the deployed contract:
//
//   • `stakeIndex` is NOT stable and is not in the subgraph. `_stakeRemove` is
//     swap-and-pop, so ending any stake in a wallet moves that wallet's last
//     stake into the freed slot. The index has to be resolved on chain
//     immediately before the call and can never be cached. The contract does
//     guard it — `require(stakeIdParam == stRef.stakeId)` — so a stale index
//     reverts rather than good-accounting the wrong stake.
//
//   • Gas scales with the stake's TERM, not its size, because the payout is
//     summed across the stake's daily data. Measured: ~2,900-3,300 gas per day
//     staked — 449k gas for a 135-day stake, 6.75M for a 2,400-day one. Batches
//     must be sized by gas, not by count.

import { ethCall } from '@/lib/portfolio/evmRpc';
import { hexSubgraphQuery, type HexNet } from './subgraph';
import { readRescueCandidates, dbAvailable, getSyncState } from '@/lib/db/hexLockedStakes';
import { HEX_ADDRESS, LATE_PENALTY_GRACE_DAYS, LATE_PENALTY_SCALE_DAYS, currentHexDay, heartsToHex } from './hexDay';
import type { ChainId } from '@/services';

/** Selectors, computed from the signatures in the verified HEX ABI. */
export const SEL = {
  stakeCount: '0x33060d90', // stakeCount(address)
  stakeLists: '0x2607443b', // stakeLists(address,uint256)
  stakeGoodAccounting: '0x65cf71b2', // stakeGoodAccounting(address,uint256,uint40)
} as const;

const pad = (hex: string) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');
const word = (hex: string, i: number) => hex.replace(/^0x/, '').slice(i * 64, i * 64 + 64);
const num = (hex: string, i: number) => Number(BigInt('0x' + word(hex, i)));

/** HEX lives at the same address on both chains (PulseChain forked the state). */
const chainOf = (net: HexNet): ChainId => (net === 'ethereum' ? 'ethereum' : 'pulsechain');

/** Where the floor lands when nothing overrides it. */
export const MIN_PRINCIPAL_HEX_FALLBACK = 100_000;

/**
 * The principal floor, in HEX, from `HEX_RESCUE_MIN_HEX` or the fallback.
 *
 * Read at call time rather than at module load so a process can change it
 * (the verification script does), and so a serverless invocation always sees
 * the current value rather than one baked in when the module was first
 * imported.
 *
 * `0` is a legitimate setting — it means "no floor, sweep everything" — so it
 * has to survive the validation below rather than being treated as unset. Only
 * a missing, unparseable or negative value falls back.
 */
export function defaultMinPrincipalHex(): number {
  const raw = (process.env.HEX_RESCUE_MIN_HEX ?? '').trim();
  if (!raw) return MIN_PRINCIPAL_HEX_FALLBACK;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : MIN_PRINCIPAL_HEX_FALLBACK;
}

export interface RescueCandidate {
  stakeId: string;
  stakerAddr: string;
  principalHex: number;
  endDay: number;
  stakedDays: number;
  /** Days past the 14-day grace — 0 while still inside it. */
  daysBleeding: number;
  /** Share of gross (0-1) the late penalty has already taken. */
  penaltyFraction: number;
  /** HEX protected per unit of gas — what the candidate list is sorted by. */
  hexPerGas: number;
}

/**
 * Stakes that have matured and are still bleeding, best value first.
 *
 * Read from the `hex_locked_stakes` mirror, which is the only source that can
 * answer this. A subgraph `stakeStart` carries no "has this ended" flag, so
 * finding open stakes there means fetching everything and subtracting the ends
 * locally — and every bounded page window of that is a biased sample. Measured,
 * all three obvious orderings failed: by end day it drops the oldest and
 * therefore largest stakes (lowering the floor made the total HEX protected go
 * DOWN, which is impossible); by principal it fills with whales who ended their
 * own stakes and returns nothing; by stake id it spends the budget on the very
 * first stakes ever made. The mirror holds ONLY locked stakes, so the question
 * is a single indexed query over the complete set.
 *
 * The mirror is still not trusted as the final word — `resolveStake` re-reads
 * the chain before a single unit of gas is spent, because a stake ended two
 * minutes ago is still "locked" to a mirror that syncs on a cron.
 *
 * `minDaysPastGrace` defaults to 1 rather than 0 on purpose. Good-accounting a
 * stake the day it matures is harmless, but ~76% of stakers end their own stakes
 * and would never have needed us; waiting until the grace period has actually
 * lapsed skips all of them and costs the stragglers 1/700th — about 0.14% — of
 * their gross. That is six times less gas for the same practical outcome.
 */
/**
 * Why the mirror could not answer, in the words of whoever has to fix it.
 *
 * The three causes need three different actions and used to share one message,
 * which cost an evening: a `tsx` run reported "no database, or the initial fill
 * has not finished" while DATABASE_URL sat in .env the whole time — the real
 * fault was import order (see scripts/loadEnv.ts). A diagnostic that cannot
 * tell "not configured" from "not finished" sends you looking in the wrong
 * place, so this asks the database itself before saying anything.
 */
async function describeMirrorGap(net: HexNet): Promise<string> {
  if (!dbAvailable()) {
    return (
      'no database connection. DATABASE_URL / POSTGRES_URL was not set at the ' +
      'moment lib/db/connection.ts was first imported. In a tsx script that ' +
      "means import order, not a missing value — `import './loadEnv'` has to be " +
      'the FIRST import, because ES imports are evaluated before any statement ' +
      'in the file. On Vercel it means the variable is genuinely unset for this ' +
      'environment.'
    );
  }

  let state: Awaited<ReturnType<typeof getSyncState>>;
  try {
    state = await getSyncState(net);
  } catch (err) {
    // An unreachable database is not an unfilled one, and saying so saves
    // someone re-running a sync that was never the problem.
    return `could not read hex_sync_state: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (!state) {
    return (
      `the hex_locked_stakes mirror has never run for ${net} (no hex_sync_state ` +
      'row). Call GET /api/cron/hex-stake-sync until it reports ready:true — the ' +
      'initial fill is ~950k stakes and takes many time-boxed runs.'
    );
  }
  if (!state.ready) {
    const pct =
      state.latestStakeId > 0
        ? ` — ${((state.lastStakeId / state.latestStakeId) * 100).toFixed(1)}% ` +
          `(stake ${state.lastStakeId.toLocaleString()} of ${state.latestStakeId.toLocaleString()})`
        : '';
    return (
      `the mirror is still filling: phase "${state.phase}"${pct}. Keep calling ` +
      'GET /api/cron/hex-stake-sync until ready:true.' +
      (state.lastError ? ` Last sync error: ${state.lastError}` : '')
    );
  }
  // ready, yet the read still refused — the only remaining path is a throw the
  // reader swallowed, so say that rather than inventing a cause.
  return 'the mirror reports ready but returned no result. Check the database logs.';
}

export async function findRescueCandidates(
  net: HexNet,
  opts: { minDaysPastGrace?: number; limit?: number; minPrincipalHex?: number } = {},
): Promise<RescueCandidate[]> {
  const {
    minDaysPastGrace = 1,
    limit = 500,
    minPrincipalHex = defaultMinPrincipalHex(),
  } = opts;
  const today = currentHexDay();
  const newestEnd = today - LATE_PENALTY_GRACE_DAYS - minDaysPastGrace;
  // Hearts are HEX's smallest unit, 1e8 to a HEX — the inverse of heartsToHex.
  const minHearts = Math.round(minPrincipalHex * 1e8);

  const rows = await readRescueCandidates(net, {
    maturedBefore: newestEnd,
    minHearts: String(minHearts),
    limit: Math.max(limit * 2, 200),
  });

  if (rows === null) {
    // Deliberately fatal rather than falling back. There is no second source
    // that can answer this correctly — see the note above — and a partial
    // answer here reads exactly like a complete one while quietly leaving
    // people's stakes bleeding.
    throw new Error(`hex-rescue: ${await describeMirrorGap(net)}`);
  }
  if (rows.length === 0) return [];

  // The mirror does not store a stake's TERM, and gas depends on it, so the
  // shortlist is enriched from the subgraph — a couple of `stakeId_in` queries
  // over a few hundred ids, which is a very different thing from sweeping the
  // whole history through it.
  const terms = new Map<string, number>();
  const ids = rows.map((r) => r.stakeId);
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
    try {
      const d = await hexSubgraphQuery<{ stakeStarts: { stakeId: string; stakedDays: string }[] }>(
        net,
        `{ stakeStarts(first: 1000, where: { stakeId_in: [${chunk}] }) { stakeId stakedDays } }`,
      );
      for (const s of d.stakeStarts ?? []) terms.set(String(s.stakeId), Number(s.stakedDays));
    } catch {
      /* a term we could not read just ranks last — see below */
    }
  }

  return rows
    .map((r) => {
      const principalHex = heartsToHex(r.stakedHearts);
      // No term means no honest gas estimate, so it ranks last rather than
      // being given an invented one. `resolveStake` still prices it properly
      // if a run ever reaches it.
      const stakedDays = terms.get(r.stakeId) ?? 0;
      const daysBleeding = Math.max(0, today - r.endDay - LATE_PENALTY_GRACE_DAYS);
      return {
        stakeId: r.stakeId,
        stakerAddr: r.stakerAddr,
        principalHex,
        endDay: r.endDay,
        stakedDays,
        daysBleeding,
        penaltyFraction: Math.min(1, daysBleeding / LATE_PENALTY_SCALE_DAYS),
        hexPerGas: stakedDays > 0 ? principalHex / estimateGasForTerm(stakedDays) : 0,
      };
    })
    // Best value first: HEX still at risk per unit of gas it costs to save.
    //
    // Sorting by size alone would be the obvious move and it is the wrong one,
    // because gas tracks a stake's TERM rather than its size. A 5M HEX stake
    // with a 90-day term costs ~360k gas to freeze; a 500k HEX stake with a
    // 1,782-day term costs ~5.9M. The first protects ten times the HEX for a
    // sixteenth of the gas.
    .sort((a, b) => b.hexPerGas - a.hexPerGas)
    .slice(0, limit);
}
export interface ResolvedStake {
  /** Current index in the staker's stake list. Valid only right now. */
  index: number;
  stakedDays: number;
  lockedDay: number;
  /** 0 means still locked — the only state good-accounting accepts. */
  unlockedDay: number;
}

/**
 * Find a stake's CURRENT index by reading the staker's list on chain.
 *
 * Returns null when the stake is gone (ended) or already unlocked
 * (good-accounted) — both mean there is nothing to do and no gas to spend.
 */
export async function resolveStake(
  net: HexNet,
  stakerAddr: string,
  stakeId: string,
): Promise<ResolvedStake | null> {
  const chain = chainOf(net);
  const countHex = await ethCall(chain, HEX_ADDRESS, SEL.stakeCount + pad(stakerAddr));
  if (!countHex) return null;
  const count = Number(BigInt(countHex));
  const want = BigInt(stakeId);

  for (let i = 0; i < count; i++) {
    const raw = await ethCall(chain, HEX_ADDRESS, SEL.stakeLists + pad(stakerAddr) + pad(i.toString(16)));
    if (!raw) continue;
    // stakeId, stakedHearts, stakeShares, lockedDay, stakedDays, unlockedDay, isAutoStake
    if (BigInt('0x' + word(raw, 0)) !== want) continue;
    const unlockedDay = num(raw, 5);
    if (unlockedDay !== 0) return null; // already good-accounted or ended
    return { index: i, lockedDay: num(raw, 3), stakedDays: num(raw, 4), unlockedDay };
  }
  return null;
}

/**
 * Where a rescued staker is sent to find out what happened.
 *
 * This domain, not superstake.win, for one reason: this repo deploys here, so
 * the page can be guaranteed to exist. The URL is written into an immutable
 * transaction — a link that 404s is a broken promise that can never be edited
 * — so it points at the only host whose routes this codebase controls. The
 * message and the page are still SuperStake-branded.
 */
export const RESCUE_URL_BASE = 'scan.morbius.io/rescued';

/** Compact so it reads like a number a human would say, and costs less gas. */
function shortHex(hex: number): string {
  if (hex >= 1e9) return `${(hex / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (hex >= 1e6) return `${(hex / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (hex >= 1e3) return `${Math.round(hex / 1e3)}k`;
  return String(Math.round(hex));
}

/**
 * Messages left in the transaction's calldata.
 *
 * Solidity's ABI decoder ignores trailing bytes after a call's arguments, so a
 * note can ride along on the transaction and show up in the explorer's input
 * data. Verified against the deployed contract: appending 56 bytes to a real
 * `stakeGoodAccounting` call changed the gas estimate from 574,489 to 575,572 —
 * about 19 gas a byte, or a hundred-thousandth of a cent. A longer message with
 * an amount and a link runs ~120 bytes, so about 2,000 gas — still nothing
 * against the 200k-900k the call itself costs.
 *
 * Every message carries three things, and each earns its bytes:
 *
 *   • THE AMOUNT. "your stake" is abstract; "3.36M HEX" is their money. It is
 *     the single most persuasive thing we can say, and it happens to be true.
 *   • THE LINK. Without it the note is a joke nobody can act on. With it, the
 *     person who lost track of a stake has a way back to it — which is the
 *     entire point of doing any of this.
 *   • WHO. Attribution to SuperStake, so the rescue is traceable to somebody
 *     rather than looking like a stranger poking at their wallet.
 *
 * Kept warm rather than smug, and never overstated. Whoever reads this forgot
 * about a stake, lost a key, or died; the joke is on the situation, never on
 * them. Nothing here claims we gave them anything — we stopped a loss, and the
 * HEX was always theirs.
 */
/** Both names, because both did it. Kept short — it is on every transaction. */
const SIGNED_BY = 'Morbius x SuperStake.win';

const MESSAGE_TEMPLATES = [
  (amt: string, url: string) => `${amt} HEX of yours was bleeding out. we stopped the clock. still yours: ${url} -- ${SIGNED_BY}`,
  (amt: string, url: string) => `found ${amt} HEX of yours dying in public. froze it. come get it: ${url} -- ${SIGNED_BY}`,
  (amt: string, url: string) => `you left ${amt} HEX in the oven. we turned it off. still yours: ${url} -- ${SIGNED_BY}`,
  (amt: string, url: string) => `${amt} HEX was quietly disappearing. not anymore. it's yours: ${url} -- ${SIGNED_BY}`,
  (amt: string, url: string) => `somebody had to press the button on ${amt} HEX of yours. it was us: ${url} -- ${SIGNED_BY}`,
  (amt: string, url: string) => `${amt} HEX, saved from itself. no charge, no catch, still yours: ${url} -- ${SIGNED_BY}`,
] as const;

/** For tests and docs — a rendered sample of each template. */
export const RESCUE_MESSAGES = MESSAGE_TEMPLATES.map((t) => t('3.36M', `${RESCUE_URL_BASE}/945449`));

/** Deterministic per stake, so a retry of the same stake carries the same note. */
export function messageForStake(stakeId: string, principalHex?: number): string {
  let h = 0;
  for (const ch of stakeId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const template = MESSAGE_TEMPLATES[h % MESSAGE_TEMPLATES.length];
  return template(shortHex(principalHex ?? 0), `${RESCUE_URL_BASE}/${stakeId}`);
}

/** Calldata for `stakeGoodAccounting`, with the note appended. */
export function goodAccountingCalldata(
  stakerAddr: string,
  index: number,
  stakeId: string,
  message?: string,
): string {
  const args = pad(stakerAddr) + pad(index.toString(16)) + pad(BigInt(stakeId).toString(16));
  const note = message ? Buffer.from(message, 'utf8').toString('hex') : '';
  return SEL.stakeGoodAccounting + args + note;
}

/** Rough gas from the stake's term — see the header note on why term drives it. */
export const estimateGasForTerm = (stakedDays: number) => Math.round(stakedDays * 3300) + 60_000;
