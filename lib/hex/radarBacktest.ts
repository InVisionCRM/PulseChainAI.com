// Backtest for the Whale Radar's behavioral sell/re-stake signal.
//
// The Radar predicts whether a wallet will re-stake after a stake ends, from
// that wallet's *own* history (how often past ends were followed by a new
// stake within RESTAKE_WINDOW). This file checks whether that signal actually
// holds up: for every historical stake-end we reconstruct the prediction we
// would have made *at that moment* (using only the wallet's earlier ends) and
// compare it to what the wallet really did next. Pure — no I/O.

const RESTAKE_WINDOW_SEC = 14 * 86_400;

export interface TimedEvent {
  addr: string; // lowercased staker address
  ts: number; // unix seconds
}

export interface BacktestResult {
  /** Ends we could both predict (had prior history) and observe (not censored). */
  scored: number;
  /** Ends skipped because the wallet had no prior end to learn from. */
  unknown: number;
  /** Ends skipped because their re-stake window extends past our data. */
  censored: number;
  /** Actual re-stake frequency among scored ends — the naive base rate. */
  baseRestakeRate: number;
  /** Fraction of directional calls that matched the real outcome. */
  accuracy: number;
  /** Accuracy minus always guessing the majority class — the signal's edge. */
  lift: number;
  restakeCalls: number;
  /** Of "will re-stake" calls, the share that actually re-staked. */
  restakePrecision: number;
  sellCalls: number;
  /** Of "will sell" calls, the share that actually did NOT re-stake. */
  sellPrecision: number;
}

const EMPTY: BacktestResult = {
  scored: 0, unknown: 0, censored: 0, baseRestakeRate: 0, accuracy: 0, lift: 0,
  restakeCalls: 0, restakePrecision: 0, sellCalls: 0, sellPrecision: 0,
};

const groupSortedAsc = (evs: TimedEvent[]): Map<string, number[]> => {
  const m = new Map<string, number[]>();
  for (const e of evs) {
    const list = m.get(e.addr);
    if (list) list.push(e.ts);
    else m.set(e.addr, [e.ts]);
  }
  for (const list of m.values()) list.sort((a, b) => a - b);
  return m;
};

/** Did `addr` start a new stake within the re-stake window after `ts`? */
const restakedAfter = (starts: number[] | undefined, ts: number): boolean =>
  !!starts && starts.some((s) => s > ts && s <= ts + RESTAKE_WINDOW_SEC);

/**
 * Replay the signal over historical ends. `ends` and `starts` are flat event
 * lists (most-recent-first is fine; we sort). We only score an end when its full
 * re-stake window falls inside the span our `starts` cover, so an unobserved
 * re-stake can't masquerade as a "sell".
 */
export function backtestRadar(ends: TimedEvent[], starts: TimedEvent[]): BacktestResult {
  if (!ends.length || !starts.length) return EMPTY;

  const startsByAddr = groupSortedAsc(starts);
  const endsByAddr = groupSortedAsc(ends);
  const startTimes = starts.map((s) => s.ts);
  const minStartTs = Math.min(...startTimes);
  const maxStartTs = Math.max(...startTimes);

  let scored = 0, unknown = 0, censored = 0, restakedTotal = 0, correct = 0;
  let restakeCalls = 0, restakeHits = 0, sellCalls = 0, sellHits = 0;

  for (const [addr, addrEnds] of endsByAddr) {
    const addrStarts = startsByAddr.get(addr);
    for (const t of addrEnds) {
      // Observability: we must be able to see a re-stake in [t, t+window].
      if (t < minStartTs || t + RESTAKE_WINDOW_SEC > maxStartTs) {
        censored++;
        continue;
      }
      // Prediction from prior ends only (strictly before this one).
      const prior = addrEnds.filter((e) => e < t);
      if (prior.length === 0) {
        unknown++;
        continue;
      }
      const priorRestakes = prior.filter((e) => restakedAfter(addrStarts, e)).length;
      const predRate = priorRestakes / prior.length;
      const predictRestake = predRate >= 0.5;

      const actualRestake = restakedAfter(addrStarts, t);
      scored++;
      if (actualRestake) restakedTotal++;
      if (predictRestake === actualRestake) correct++;
      if (predictRestake) {
        restakeCalls++;
        if (actualRestake) restakeHits++;
      } else {
        sellCalls++;
        if (!actualRestake) sellHits++;
      }
    }
  }

  if (scored === 0) return { ...EMPTY, unknown, censored };

  const baseRestakeRate = restakedTotal / scored;
  const accuracy = correct / scored;
  const majority = Math.max(baseRestakeRate, 1 - baseRestakeRate);

  return {
    scored,
    unknown,
    censored,
    baseRestakeRate,
    accuracy,
    lift: accuracy - majority,
    restakeCalls,
    restakePrecision: restakeCalls ? restakeHits / restakeCalls : 0,
    sellCalls,
    sellPrecision: sellCalls ? sellHits / sellCalls : 0,
  };
}
