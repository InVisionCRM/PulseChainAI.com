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
 *   npm run hex:rescue -- --min-days 30 # only stakes 30+ days past grace
 *
 * Dry run is the default and --execute is the only way past it, because the
 * first thing anyone should do with a keeper is watch a full day's worth of
 * what it intends to do before it is ever allowed to sign anything.
 */

import {
  findRescueCandidates,
  resolveStake,
  goodAccountingCalldata,
  messageForStake,
  type RescueCandidate,
} from '@/lib/hex/rescue';
import { loadKeeper, signAndSend, nextNonce } from '@/lib/hex/rescueWallet';
import { estimateGas, getGasPrice } from '@/lib/portfolio/evmRpc';
import { HEX_ADDRESS, LATE_PENALTY_SCALE_DAYS } from '@/lib/hex/hexDay';

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
};
const has = (name: string) => process.argv.includes(name);

const EXECUTE = has('--execute');
const LIMIT = Number(arg('--limit') ?? 25);
const MIN_DAYS = Number(arg('--min-days') ?? 1);

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d });

/** HEX the stake is still losing every day, at 1/700th of principal. */
const bleedPerDay = (c: RescueCandidate) =>
  c.penaltyFraction >= 1 ? 0 : c.principalHex / LATE_PENALTY_SCALE_DAYS;

async function main() {
  console.log(EXECUTE ? '⚡ HEX rescue — EXECUTING' : '🔍 HEX rescue — dry run (add --execute to send)');
  console.log(`   chain: pulsechain · limit ${LIMIT} · at least ${MIN_DAYS} day(s) past grace\n`);

  const keeper = loadKeeper();
  if (EXECUTE && !keeper) {
    console.error('❌ --execute needs HEX_RESCUE_PRIVATE_KEY in the environment.');
    process.exit(1);
  }
  console.log(keeper ? `   keeper: ${keeper.address}` : '   keeper: (no key loaded — dry run only)');

  const gasPrice = await getGasPrice('pulsechain');
  console.log(`   gas price: ${gasPrice ? fmt(Number(gasPrice) / 1e9) + ' gwei' : 'unknown'}\n`);

  const candidates = await findRescueCandidates('pulsechain', {
    minDaysPastGrace: MIN_DAYS,
    limit: LIMIT * 3, // over-fetch: many resolve to "already settled" and cost nothing
  });
  console.log(`Found ${candidates.length} candidate stake(s) from the subgraph.\n`);

  let sent = 0, skipped = 0, failed = 0, totalGas = 0n, hexSaved = 0, bleedStopped = 0;
  let nonce = EXECUTE && keeper ? await nextNonce('pulsechain', keeper.address) : null;
  if (EXECUTE && nonce == null) {
    console.error('❌ could not read the keeper nonce; aborting.');
    process.exit(1);
  }

  for (const c of candidates) {
    if (sent + skipped >= LIMIT) break;

    // The chain, not the indexer, decides whether there is work to do.
    const resolved = await resolveStake('pulsechain', c.stakerAddr, c.stakeId);
    if (!resolved) continue; // already ended or good-accounted — not even a skip

    const message = messageForStake(c.stakeId);
    const data = goodAccountingCalldata(c.stakerAddr, resolved.index, c.stakeId, message);

    const est = await estimateGas('pulsechain', { from: keeper?.address ?? HEX_ADDRESS, to: HEX_ADDRESS, data });
    const costPls = est && gasPrice ? Number(est * gasPrice) / 1e18 : null;

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
      console.log(`      idx ${resolved.index} · ${fmt(Number(est))} gas${costPls != null ? ` · ${fmt(costPls, 1)} PLS` : ''}`);
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

  const costPls = gasPrice ? Number(totalGas * gasPrice) / 1e18 : 0;
  console.log(`\n${EXECUTE ? 'Sent' : 'Would send'}: ${sent} · skipped: ${skipped} · failed: ${failed}`);
  console.log(`Gas: ${fmt(Number(totalGas))} (${fmt(costPls, 2)} PLS)`);
  console.log(`HEX frozen before further loss: ${fmt(hexSaved)}`);
  console.log(`Daily bleed stopped: ${fmt(bleedStopped)} HEX/day`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
