/**
 * Stops HEX stakes bleeding out. Run with:  npm run hex:rescue
 *
 * A matured HEX stake keeps losing 1/700th of itself per day past a 14-day
 * grace period until somebody calls `stakeGoodAccounting` on it, which freezes
 * the payout and penalty where they are. Anyone may make that call for anyone —
 * see lib/hex/rescue.ts for why — so this walks the chain for stakes that are
 * bleeding and freezes them. The HEX stays the staker's, to collect whenever
 * they end the stake themselves; nothing here can take it or touch it.
 *
 *   npm run hex:rescue                  # dry run: says what it WOULD do
 *   npm run hex:rescue -- --execute     # actually sends (needs the key)
 *   npm run hex:rescue -- --limit 25
 *   npm run hex:rescue -- --min-days 30   # only stakes 30+ days past grace
 *   npm run hex:rescue -- --min-hex 0     # no principal floor, this run only
 *   npm run hex:rescue -- --execute --cancel-stuck   # unwedge a stuck queue
 *
 * Dry run is the default and --execute is the only way past it, because the
 * first thing anyone should do with a keeper is watch a full day's worth of
 * what it intends to do before it is ever allowed to sign anything.
 *
 * Applies a principal floor, because gas cost is driven by a stake's TERM and
 * not its size (see lib/hex/rescueWallet.ts) — a 1,100 HEX stake costs the same
 * to rescue as a 3,000,000 HEX one, so the floor spends that fixed cost where it
 * recovers the most. Set `HEX_RESCUE_MIN_HEX` in .env/Vercel to move it for
 * every run including the nightly cron, or pass --min-hex to override it once.
 * The run prints which of the two it used.
 *
 * Self-heals a stuck previous run. PulseChain's base fee moves fast enough
 * that a batch of transactions can go stale before the first one mines,
 * wedging the whole queue behind it (nonces are strictly ordered) — see the
 * MAX_FEE_MULTIPLE note in rescueWallet.ts for a real instance of this. If the
 * keeper's mined and pending nonces differ, that gap is prior transactions
 * that never confirmed, and this run REPLACES them (signs starting from the
 * mined nonce) with fresh, currently-priced work instead of queuing more
 * transactions behind ones that may never land.
 *
 * Loads .env / .env.local through ./loadEnv, which MUST stay the first import —
 * see the note in that file. Calling the loader below the imports instead looks
 * right and silently is not: the database module reads DATABASE_URL at module
 * scope, and module scope runs first, so the whole DB layer came up dead while
 * the lazily-read private key came up fine.
 */
import './loadEnv';

import {
  defaultMinPrincipalHex,
  findRescueCandidates,
  resolveStake,
  goodAccountingCalldata,
  messageForStake,
  type RescueCandidate,
} from '@/lib/hex/rescue';
import { loadKeeper, signAndSend, signAndCancel, checkNonce } from '@/lib/hex/rescueWallet';
import { estimateGas, getBaseFee, getGasPrice, getPendingBids, type PendingBid } from '@/lib/portfolio/evmRpc';
import { HEX_ADDRESS, LATE_PENALTY_SCALE_DAYS } from '@/lib/hex/hexDay';

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
};
const has = (name: string) => process.argv.includes(name);

const EXECUTE = has('--execute');
// Clears a wedged queue instead of rescuing: every unconfirmed nonce is
// replaced with a 21,000-gas transaction that does nothing. Nonces are strictly
// ordered, so one stuck transaction blocks every rescue behind it.
const CANCEL_STUCK = has('--cancel-stuck');
/**
 * How many transactions one run will leave unconfirmed at once.
 *
 * Deliberately under geth's default per-account allowance of 16: a node accepts
 * a burst from its own client but its peers do not, so anything past that is
 * quietly not relayed and cannot mine at any price. 81 in flight is how this
 * keeper wedged itself.
 */
const MAX_IN_FLIGHT = 12;
const LIMIT = Number(arg('--limit') ?? 25);
const MIN_DAYS = Number(arg('--min-days') ?? 1);
// Precedence: --min-hex flag (this run only) > HEX_RESCUE_MIN_HEX (everywhere,
// including the nightly cron) > the built-in fallback.
const minHexArg = arg('--min-hex');
const MIN_HEX = minHexArg != null ? Number(minHexArg) : defaultMinPrincipalHex();
const MIN_HEX_SOURCE = minHexArg != null ? '--min-hex' : process.env.HEX_RESCUE_MIN_HEX ? 'HEX_RESCUE_MIN_HEX' : 'default';

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d });

/** HEX the stake is still losing every day, at 1/700th of principal. */
const bleedPerDay = (c: RescueCandidate) =>
  c.penaltyFraction >= 1 ? 0 : c.principalHex / LATE_PENALTY_SCALE_DAYS;

/**
 * Replace every unconfirmed nonce with a transaction that does nothing.
 *
 * The escape hatch for a wedged queue. Nonces are strictly ordered, so a single
 * transaction the network will not mine blocks every rescue behind it, and the
 * stuck ones can be far more expensive than the no-ops that clear them: on the
 * live keeper they sat at 21-22 million gwei against a 652,000 gwei base fee,
 * about 55,000 PLS each, while a 21,000-gas cancel at the same price is ~500.
 *
 * Dry run by default like everything else here — it prints the bill first.
 */
async function cancelStuck(
  keeper: ReturnType<typeof loadKeeper>,
  mined: number | null,
  pending: number,
  bids: Map<number, PendingBid>,
) {
  if (!keeper || mined == null) {
    console.error('❌ --cancel-stuck needs --execute and HEX_RESCUE_PRIVATE_KEY (it reads the live nonce).');
    process.exit(1);
  }
  const stuck = pending - mined;
  if (stuck <= 0) {
    console.log('✅ nothing stuck — the keeper has no unconfirmed transactions.');
    return;
  }

  // The pending block only carries the transactions that fit in it, so a long
  // queue is only partly readable — 20 of 81 on the live keeper. The unreadable
  // ones came from the same escalation as the readable ones, so the highest
  // price we CAN see is the floor for the ones we cannot: bidding below it just
  // earns an "underpriced" answer and wastes a round trip.
  let floor: PendingBid | undefined;
  for (const b of bids.values()) if (!floor || b.cap > floor.cap) floor = b;

  console.log(`🧹 clearing ${stuck} stuck nonce(s): ${mined}–${pending - 1}`);
  if (floor) {
    console.log(
      `   ${bids.size} readable; the rest are priced from the highest of those ` +
        `(${fmt(Number(floor.cap) / 1e9)} gwei)\n`,
    );
  } else {
    console.log('   none readable — pricing them as ordinary sends\n');
  }
  let cleared = 0, failed = 0, spentPls = 0;

  for (let n = mined; n < pending; n++) {
    const known = bids.get(n);
    const prev = known ?? floor;
    const label = `nonce ${n}${known ? ` (queued at ${fmt(Number(known.cap) / 1e9)} gwei)` : ''}`;
    const out = await signAndCancel({ keeper, chain: 'pulsechain', nonce: n, predecessor: prev });

    if (out.status === 'sent') {
      cleared++;
      // 21,000 gas at whatever it took to outbid the predecessor.
      const paid = prev ? (Number(prev.cap) * 1.125 * 21_000) / 1e18 : 0;
      spentPls += paid;
      console.log(`  ✅ ${label} — ${out.hash}${out.tried ? ` · ${out.accepted}/${out.tried} nodes` : ''}`);
    } else if (out.status === 'settled') {
      cleared++;
      console.log(`  ↩️  ${label} — ${out.reason}`);
    } else {
      failed++;
      console.log(`  ⏭  ${label}\n      ${out.reason}`);
    }
  }

  console.log(`\n   cleared ${cleared}, failed ${failed}, spent about ${fmt(spentPls)} PLS`);
  console.log('   Re-run `npm run hex:rescue -- --execute` once these confirm.');
}

async function main() {
  console.log(EXECUTE ? '⚡ HEX rescue — EXECUTING' : '🔍 HEX rescue — dry run (add --execute to send)');
  console.log(
    `   chain: pulsechain · limit ${LIMIT} · at least ${MIN_DAYS} day(s) past grace · ` +
      `principal ≥ ${fmt(MIN_HEX)} HEX (${MIN_HEX_SOURCE})\n`,
  );

  const keeper = loadKeeper();
  if (EXECUTE && !keeper) {
    console.error('❌ --execute needs HEX_RESCUE_PRIVATE_KEY in the environment.');
    process.exit(1);
  }
  console.log(keeper ? `   keeper: ${keeper.address}` : '   keeper: (no key loaded — dry run only)');

  // Same pricing basis signAndSend actually uses, so the estimate here matches
  // reality — a legacy-only display would read wrong the moment the network
  // (like this one, verified live) supports EIP-1559.
  const baseFee = await getBaseFee('pulsechain');
  const displayPrice = baseFee ?? (await getGasPrice('pulsechain'));
  console.log(`   base fee: ${displayPrice ? fmt(Number(displayPrice) / 1e9) + ' gwei' : 'unknown'}\n`);

  let nonce: number | null = null;
  let pendingNonce = 0;
  let pendingBids = new Map<number, PendingBid>();
  if (EXECUTE && keeper) {
    const status = await checkNonce('pulsechain', keeper.address);
    if (!status) {
      console.error('❌ could not read the keeper nonce; aborting.');
      process.exit(1);
    }
    if (status.stuck > 0) {
      console.log(
        `⚠️  ${status.stuck} transaction(s) from a previous run never confirmed ` +
          `(nonce ${status.mined}–${status.pending - 1}). Replacing them with fresh, ` +
          `currently-priced work instead of queuing behind them.\n`,
      );
    }
    nonce = status.mined; // always resume from mined, not pending — see file header
    pendingNonce = status.pending;

    // Read what is actually queued once, rather than per transaction. Without
    // this a replacement can only escalate blindly, which is what wedged the
    // keeper at 32x the real price of gas — see PRICE_BUMP_NUM.
    pendingBids = await getPendingBids('pulsechain', keeper.address);
    if (status.stuck > 0 && pendingBids.size === 0) {
      console.log('   (could not read the queued transactions — replacements will have to escalate blindly)\n');
    }
  }

  if (CANCEL_STUCK) {
    await cancelStuck(keeper, nonce, pendingNonce, pendingBids);
    return;
  }

  const candidates = await findRescueCandidates('pulsechain', {
    minDaysPastGrace: MIN_DAYS,
    minPrincipalHex: MIN_HEX,
    limit: LIMIT * 3, // over-fetch: many resolve to "already settled" and cost nothing
  });
  console.log(`Found ${candidates.length} candidate stake(s) in the locked-stake index.\n`);

  const startNonce = nonce ?? 0;
  let sent = 0, skipped = 0, failed = 0, totalGas = 0n, hexSaved = 0, bleedStopped = 0;

  for (const c of candidates) {
    if (sent + skipped >= LIMIT) break;
    // Keep the queue short enough that the whole of it propagates. Geth carries
    // and relays a limited number of transactions per account (16 by default),
    // so a burst past that is accepted by the node you hand it to and dropped
    // by its peers — the tail then sits unmined however much it bids. Stopping
    // here costs nothing: the next run picks up where this one left off.
    if (nonce != null && nonce - startNonce >= MAX_IN_FLIGHT) {
      console.log(
        `\n⏸  ${MAX_IN_FLIGHT} transactions in flight — stopping so they can propagate and mine.\n` +
          '   Run again once they confirm.',
      );
      break;
    }

    // The chain, not the indexer, decides whether there is work to do.
    const resolved = await resolveStake('pulsechain', c.stakerAddr, c.stakeId);
    if (!resolved) continue; // already ended or good-accounted — not even a skip

    const message = messageForStake(c.stakeId, c.principalHex);
    const data = goodAccountingCalldata(c.stakerAddr, resolved.index, c.stakeId, message);

    const est = await estimateGas('pulsechain', { from: keeper?.address ?? HEX_ADDRESS, to: HEX_ADDRESS, data });
    const costPls = est && displayPrice ? Number(est * displayPrice) / 1e18 : null;

    const head =
      `stake ${c.stakeId.padStart(7)} · ${fmt(c.principalHex).padStart(11)} HEX · ` +
      `${String(c.stakedDays).padStart(4)}d term · bleeding ${String(c.daysBleeding).padStart(4)}d ` +
      `(${(c.penaltyFraction * 100).toFixed(1)}% gone)`;

    if (!est) {
      console.log(`  ⏭  ${head}\n      estimate reverted — nothing to do`);
      skipped++;
      continue;
    }

    if (!EXECUTE) {
      console.log(`  📋 ${head}`);
      console.log(`      idx ${resolved.index} · ${fmt(Number(est))} gas${costPls != null ? ` · ${fmt(costPls, 1)} PLS at base fee` : ''}`);
      console.log(`      "${message}"`);
      totalGas += est;
      sent++;
      hexSaved += c.principalHex * (1 - c.penaltyFraction);
      bleedStopped += bleedPerDay(c);
      continue;
    }

    const out = await signAndSend({
      keeper: keeper!,
      chain: 'pulsechain',
      to: HEX_ADDRESS,
      data,
      nonce: nonce!,
      // Any nonce below the pending count already has an unconfirmed
      // transaction sitting on it, so this send has to outbid it.
      replacing: nonce! < pendingNonce,
      // What is already queued at this nonce, so the replacement bids one step
      // above it rather than escalating blindly.
      predecessor: pendingBids.get(nonce!),
    });

    if (out.status === 'sent') {
      // How many nodes took it matters as much as the hash: a transaction one
      // node holds and never gossips is invisible to validators, which is what
      // wedged this keeper before — see sendRawTransaction.
      const spread = out.tried ? ` · ${out.accepted}/${out.tried} nodes` : '';
      console.log(`  ✅ ${head}\n      ${out.hash}${spread}`);
      if (out.accepted === 1 && (out.tried ?? 0) > 1) {
        console.log('      ⚠️  only one node accepted it — it may not reach a validator');
      }
      nonce!++;
      sent++;
      totalGas += out.gasLimit;
      hexSaved += c.principalHex * (1 - c.penaltyFraction);
      bleedStopped += bleedPerDay(c);
    } else if (out.status === 'settled') {
      console.log(`  ⏭  ${head}\n      already in flight: ${out.reason}`);
      nonce!++;
      skipped++;
    } else if (out.status === 'skipped') {
      console.log(`  ⏭  ${head}\n      ${out.reason}`);
      skipped++;
    } else {
      console.error(`  ❌ ${head}\n      ${out.reason}`);
      failed++;
      // A failure is usually the nonce or the float, and both poison every
      // send after it. Stop rather than burn through the list.
      break;
    }
  }

  const costPls = displayPrice ? Number(totalGas * displayPrice) / 1e18 : 0;
  console.log(`\n${EXECUTE ? 'Sent' : 'Would send'}: ${sent} · skipped: ${skipped} · failed: ${failed}`);
  console.log(`Gas: ${fmt(Number(totalGas))} (~${fmt(costPls, 2)} PLS at base fee — actual cap includes headroom)`);
  console.log(`HEX frozen before further loss: ${fmt(hexSaved)}`);
  console.log(`Daily bleed stopped: ${fmt(bleedStopped)} HEX/day`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
