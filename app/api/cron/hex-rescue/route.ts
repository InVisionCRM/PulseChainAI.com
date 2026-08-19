// Daily keeper: freezes HEX stakes that are bleeding out.
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
// reports what it did, and leaves the rest for tomorrow. About 23 stakes a day
// go past grace on PulseChain, so the steady state fits comfortably; the
// initial backlog is better cleared from a terminal with
// `npm run hex:rescue -- --execute --limit 200`, which has no time limit.
//
// Without HEX_RESCUE_PRIVATE_KEY set this runs as a dry run and reports what it
// would have done, which is also what makes it safe to deploy before the key
// exists.
//
// Self-heals a run that never confirmed. PulseChain's base fee moves fast
// enough that a batch can go stale before the first transaction mines, wedging
// every nonce behind it (nonces are strictly ordered) — see the
// MAX_FEE_MULTIPLE note in rescueWallet.ts for a real instance of this. If the
// keeper's mined and pending nonces differ, this run REPLACES the stuck ones
// (signs starting at the mined nonce) with fresh, currently-priced work,
// rather than queuing more transactions behind ones that may never land.

import { NextRequest, NextResponse } from 'next/server';
import { findRescueCandidates, resolveStake, goodAccountingCalldata, messageForStake } from '@/lib/hex/rescue';
import { loadKeeper, signAndSend, checkNonce } from '@/lib/hex/rescueWallet';
import { estimateGas, getBaseFee, getGasPrice } from '@/lib/portfolio/evmRpc';
import { HEX_ADDRESS, LATE_PENALTY_SCALE_DAYS } from '@/lib/hex/hexDay';

export const revalidate = 0;
export const maxDuration = 60;

/** Stop starting new stakes past this, leaving room to finish the one in hand
 *  and return a report rather than being killed mid-flight. */
const TIME_BUDGET_MS = 45_000;
/** Also cap by count, so a fast day cannot quietly spend the whole float. */
const MAX_PER_RUN = 20;

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
    const candidates = await findRescueCandidates('pulsechain', {
      minDaysPastGrace: 1,
      limit: MAX_PER_RUN * 3, // most resolve to "already settled" and cost nothing
    });

    let nonce: number | null = null;
    let pendingNonce = 0;
    let stuckFromPriorRun = 0;
    if (keeper) {
      const status = await checkNonce('pulsechain', keeper.address);
      if (!status) return NextResponse.json({ error: 'could not read keeper nonce' }, { status: 503 });
      nonce = status.mined; // always resume from mined, not pending — see header
      pendingNonce = status.pending;
      stuckFromPriorRun = status.stuck;
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
      stuckFromPriorRun,
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
