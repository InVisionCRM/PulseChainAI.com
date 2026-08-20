// Hourly keeper: freezes HEX stakes that are bleeding out.
//
// A matured HEX stake loses 1/700th of itself per day past a 14-day grace
// period until somebody calls `stakeGoodAccounting` on it. Anyone may make that
// call for anyone, and it moves no money to the caller, so this route does it
// for whoever needs it. The HEX remains the staker's, collectable whenever they
// end the stake themselves — nothing here can take it.
//
// Why the work is BOUNDED per run rather than draining the backlog in one go:
// a serverless invocation has a wall clock, and each stake costs a handful of
// round trips (resolve the index, estimate, broadcast). So this takes a bite,
// reports what it did, and leaves the rest for the next hour. About 23 stakes
// a day go past grace on PulseChain, so the steady state is covered many times
// over and the backlog drains between the gaps — which is why this runs hourly
// rather than daily. It is still bounded per run, so a large backlog costs the
// same per hour as a small one; only the number of hours changes.
//
// Without HEX_RESCUE_PRIVATE_KEY set this runs as a dry run and reports what it
// would have done, which is also what makes it safe to deploy before the key
// exists.
//
// Bounded to MAX_PER_RUN for propagation as much as for cost — see that
// constant. A run that queues more than the network will carry does not rescue
// more stakes, it wedges the ones it queued.
//
// Self-heals a run that never confirmed. PulseChain's base fee moves fast
// enough that a batch can go stale before the first transaction mines, wedging
// every nonce behind it (nonces are strictly ordered) — see the
// MAX_FEE_MULTIPLE note in rescueWallet.ts for a real instance of this. If the
// keeper's mined and pending nonces differ, this run REPLACES the stuck ones
// (signs starting at the mined nonce) with fresh, currently-priced work,
// rather than queuing more transactions behind ones that may never land.

import { NextRequest, NextResponse } from 'next/server';
import {
  defaultMinPrincipalHex,
  defaultMinHexPerMgas,
  findRescueCandidates,
  resolveStake,
  goodAccountingCalldata,
  messageForStake,
} from '@/lib/hex/rescue';
import { loadKeeper, signAndSend, checkNonce, waitForInFlight, MAX_IN_FLIGHT } from '@/lib/hex/rescueWallet';
import { estimateGas, getBaseFee, getGasPrice, getPendingBids, type PendingBid } from '@/lib/portfolio/evmRpc';
import { HEX_ADDRESS, LATE_PENALTY_SCALE_DAYS } from '@/lib/hex/hexDay';

export const revalidate = 0;
export const maxDuration = 60;

/** Stop starting new stakes past this, leaving room to finish the one in hand
 *  and return a report rather than being killed mid-flight. */
const TIME_BUDGET_MS = 45_000;
/**
 * How many stakes one run may rescue in total.
 *
 * NOT how many it may have unconfirmed at once — that is MAX_IN_FLIGHT, and
 * the difference is the whole lesson from the wedge. A run that queues 200
 * transactions at once does not rescue 200 stakes: geth carries and relays a
 * limited number per account (16 by default), so the tail is accepted by one
 * node, never announced to peers, and sits unmined at any price. 81 queued at
 * once is what wedged this keeper.
 *
 * So the run works in WAVES of MAX_IN_FLIGHT, waiting for each to confirm
 * before starting the next, up to this many in total. In practice TIME_BUDGET_MS
 * ends the run long before 200 on a single serverless invocation — the cap is
 * there so a long-running or more frequent schedule is not the thing that
 * limits it.
 */
const MAX_PER_RUN = 200;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const keeper = loadKeeper();
  const dryRun = !keeper;

  try {
    // Same pricing basis signAndSend actually uses, so the reported cost
    // matches what was really paid rather than a legacy-only guess.
    const displayPrice = (await getBaseFee('pulsechain')) ?? (await getGasPrice('pulsechain'));
    // Read explicitly rather than leaning on the library default, so the value
    // actually used can be reported below — otherwise there is no way to tell
    // from the outside whether a change to HEX_RESCUE_MIN_HEX reached this
    // deployment, and a Vercel env var only takes effect after a redeploy.
    const minPrincipalHex = defaultMinPrincipalHex();
    // Same reason as the principal floor: read explicitly so the value actually
    // in force is visible in the report rather than inferred.
    const minHexPerMgas = defaultMinHexPerMgas();
    const candidates = await findRescueCandidates('pulsechain', {
      minDaysPastGrace: 1,
      minPrincipalHex,
      minHexPerMgas,
      limit: MAX_PER_RUN * 3, // most resolve to "already settled" and cost nothing
    });

    let nonce: number | null = null;
    let pendingNonce = 0;
    let stuckFromPriorRun = 0;
    let pendingBids = new Map<number, PendingBid>();
    /** Mined nonce at the start of the current wave — the in-flight baseline. */
    let startedAtNonce = 0;
    let waves = 1;
    /** True when a wave did not confirm inside the budget, so the run stopped
     *  early on purpose rather than running out of candidates. */
    let waitedOut = false;
    if (keeper) {
      const status = await checkNonce('pulsechain', keeper.address);
      if (!status) return NextResponse.json({ error: 'could not read keeper nonce' }, { status: 503 });
      nonce = status.mined; // always resume from mined, not pending — see header
      pendingNonce = status.pending;
      stuckFromPriorRun = status.stuck;
      startedAtNonce = status.mined;
      // Read once what is queued, so replacements bid against the real price
      // rather than escalating blindly against their own previous runs.
      if (status.stuck > 0) pendingBids = await getPendingBids('pulsechain', keeper.address);
    }

    const rescued: { stakeId: string; hex: number; hash?: string; gas: string }[] = [];
    const problems: { stakeId: string; reason: string }[] = [];
    let totalGas = 0n;
    let hexFrozen = 0;
    let bleedStopped = 0;
    let attempted = 0;

    for (const c of candidates) {
      if (attempted >= MAX_PER_RUN || Date.now() - started > TIME_BUDGET_MS) break;

      // The chain decides, not the indexer — it may be blocks behind.
      const resolved = await resolveStake('pulsechain', c.stakerAddr, c.stakeId);
      if (!resolved) continue; // already ended or good-accounted: no work, no gas

      // One wave at a time. Past the in-flight bound this waits for the
      // outstanding transactions to confirm rather than queueing behind them.
      if (nonce != null && keeper && nonce - startedAtNonce >= MAX_IN_FLIGHT) {
        const status = await waitForInFlight(
          'pulsechain', keeper.address, MAX_IN_FLIGHT, started + TIME_BUDGET_MS,
        );
        if (!status) break; // cannot read the nonce: stop rather than guess
        if (status.stuck >= MAX_IN_FLIGHT) {
          waitedOut = true;
          break; // the wave did not clear inside the budget — leave it for the next run
        }
        nonce = status.mined;
        pendingNonce = status.pending;
        startedAtNonce = status.mined;
        waves++;
      }

      attempted++;
      const data = goodAccountingCalldata(c.stakerAddr, resolved.index, c.stakeId, messageForStake(c.stakeId, c.principalHex));

      if (dryRun) {
        const est = await estimateGas('pulsechain', { from: HEX_ADDRESS, to: HEX_ADDRESS, data });
        if (!est) continue;
        totalGas += est;
        hexFrozen += c.principalHex * (1 - c.penaltyFraction);
        bleedStopped += c.penaltyFraction >= 1 ? 0 : c.principalHex / LATE_PENALTY_SCALE_DAYS;
        rescued.push({ stakeId: c.stakeId, hex: Math.round(c.principalHex), gas: est.toString() });
        continue;
      }

      const out = await signAndSend({
        keeper: keeper!, chain: 'pulsechain', to: HEX_ADDRESS, data, nonce: nonce!,
        // Below the pending count means something unconfirmed is already on
        // this nonce and has to be outbid.
        replacing: nonce! < pendingNonce,
        // What is actually queued there, so a replacement bids one step above
        // it. Without this it can only escalate blindly, which ratchets the
        // price against its own previous runs — see PRICE_BUMP_NUM.
        predecessor: pendingBids.get(nonce!),
      });
      if (out.status === 'sent') {
        nonce!++;
        totalGas += out.gasLimit;
        hexFrozen += c.principalHex * (1 - c.penaltyFraction);
        bleedStopped += c.penaltyFraction >= 1 ? 0 : c.principalHex / LATE_PENALTY_SCALE_DAYS;
        rescued.push({ stakeId: c.stakeId, hex: Math.round(c.principalHex), hash: out.hash, gas: out.gasLimit.toString() });
      } else if (out.status === 'settled') {
        nonce!++;
      } else if (out.status === 'skipped') {
        // Expected and uninteresting: the stake got settled between the
        // subgraph read and now.
      } else {
        problems.push({ stakeId: c.stakeId, reason: out.reason });
        // A hard failure is nearly always the nonce or an empty float, and both
        // break every send after it. Stop and report.
        break;
      }
    }

    const costPls = displayPrice ? Number(totalGas * displayPrice) / 1e18 : null;
    return NextResponse.json({
      success: problems.length === 0,
      dryRun,
      keeper: keeper?.address ?? null,
      minPrincipalHex,
      minHexPerMgas,
      stuckFromPriorRun,
      // How the run was paced, and why it ended. Without these a short run
      // reads the same whether it ran out of candidates, ran out of clock, or
      // was waiting for a wave to confirm.
      waves,
      maxInFlight: MAX_IN_FLIGHT,
      maxPerRun: MAX_PER_RUN,
      stoppedWaitingForConfirmations: waitedOut,
      candidates: candidates.length,
      rescued: rescued.length,
      hexFrozen: Math.round(hexFrozen),
      bleedStoppedPerDay: Math.round(bleedStopped),
      gasUsed: totalGas.toString(),
      costPls: costPls != null ? Number(costPls.toFixed(2)) : null,
      stakes: rescued,
      problems,
      elapsedMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'hex rescue failed',
        elapsedMs: Date.now() - started,
      },
      { status: 500 },
    );
  }
}
