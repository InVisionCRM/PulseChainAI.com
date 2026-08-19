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
 *   npm run hex:rescue -- --min-hex 0     # no principal floor (see below)
 *
 * Dry run is the default and --execute is the only way past it, because the
 * first thing anyone should do with a keeper is watch a full day's worth of
 * what it intends to do before it is ever allowed to sign anything.
 *
 * Defaults to a 500,000 HEX principal floor — gas cost is driven by a stake's
 * TERM, not its size (see lib/hex/rescueWallet.ts), so rescuing a 1,100 HEX
 * stake costs the same as a 3,000,000 HEX one, and the floor spends that fixed
 * cost where it recovers the most. Lower it with --min-hex once the largest
 * stakes are handled.
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
 * Loads .env / .env.local itself, via Next's own loader. Next.js reads those
 * files automatically for `next dev` / `next build` / API routes, but that is
 * a Next.js convenience, not a Node one — a plain `tsx` invocation like this
 * script never sees them, so HEX_RESCUE_PRIVATE_KEY would read as unset even
 * sitting right there in .env.local. Using Next's own loadEnvConfig (rather
 * than hand-rolling a parser or adding a dotenv dependency) keeps the same
 * file precedence Next.js uses everywhere else in this repo.
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import {
  findRescueCandidates,
  resolveStake,
  goodAccountingCalldata,
  messageForStake,
  type RescueCandidate,
} from '@/lib/hex/rescue';
import { loadKeeper, signAndSend, checkNonce } from '@/lib/hex/rescueWallet';
import { estimateGas, getBaseFee, getGasPrice } from '@/lib/portfolio/evmRpc';
import { HEX_ADDRESS, LATE_PENALTY_SCALE_DAYS } from '@/lib/hex/hexDay';

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
};
const has = (name: string) => process.argv.includes(name);

const EXECUTE = has('--execute');
const LIMIT = Number(arg('--limit') ?? 25);
const MIN_DAYS = Number(arg('--min-days') ?? 1);
const MIN_HEX = Number(arg('--min-hex') ?? 500_000);

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d });

/** HEX the stake is still losing every day, at 1/700th of principal. */
const bleedPerDay = (c: RescueCandidate) =>
  c.penaltyFraction >= 1 ? 0 : c.principalHex / LATE_PENALTY_SCALE_DAYS;

async function main() {
  console.log(EXECUTE ? '⚡ HEX rescue — EXECUTING' : '🔍 HEX rescue — dry run (add --execute to send)');
  console.log(
    `   chain: pulsechain · limit ${LIMIT} · at least ${MIN_DAYS} day(s) past grace · ` +
      `principal ≥ ${fmt(MIN_HEX)} HEX\n`,
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
  }

  const candidates = await findRescueCandidates('pulsechain', {
    minDaysPastGrace: MIN_DAYS,
    minPrincipalHex: MIN_HEX,
    limit: LIMIT * 3, // over-fetch: many resolve to "already settled" and cost nothing
  });
  console.log(`Found ${candidates.length} candidate stake(s) from the subgraph.\n`);

  let sent = 0, skipped = 0, failed = 0, totalGas = 0n, hexSaved = 0, bleedStopped = 0;

  for (const c of candidates) {
    if (sent + skipped >= LIMIT) break;

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
    });

    if (out.status === 'sent') {
      console.log(`  ✅ ${head}\n      ${out.hash}`);
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
