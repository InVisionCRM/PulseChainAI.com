#!/usr/bin/env tsx
//
// Definitively verify whether a HEX stake was "good-accounted" (and therefore
// whether its penalty is frozen and HEX is still claimable) instead of trusting
// the time-based "bled out" estimate.
//
// Usage:
//   npx tsx scripts/verifyGoodAccounting.ts --stake 3161
//   npx tsx scripts/verifyGoodAccounting.ts --wallet 0xabc... --network ethereum
//   npx tsx scripts/verifyGoodAccounting.ts --stake 3161,27617,597742
//
// Flags:
//   --stake <id[,id...]>   one or more stakeIds to check
//   --wallet <addr>        check every stake started by this address
//   --network <net>        pulsechain (default) | ethereum
//
// What it proves: a stakeStart with NO stakeEnd looks "active/overdue" to the
// app, which then assumes it keeps bleeding 1%/week to zero. If a
// StakeGoodAccounting event exists, the penalty was LOCKED IN on that day and
// the stake is not bleeding any further — exactly the case where stakes shown
// as "fully bled out" are actually fine.

import { hexSubgraphQuery, type HexNet } from '../lib/hex/subgraph';
import { currentHexDay, fmtHexDate } from '../lib/hex/hexDay';
import {
  fetchGoodAccountings,
  classifyMaturedStake,
  type GoodAccountingRecord,
} from '../lib/hex/goodAccounting';

interface RawStart {
  stakeId: string;
  stakerAddr: string;
  stakedHearts: string;
  stakedDays: string;
  startDay: string;
  endDay: string;
}

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  }
  return out;
}

async function startsForIds(net: HexNet, ids: string[]): Promise<RawStart[]> {
  const list = ids.map((id) => `"${id}"`).join(',');
  const d = await hexSubgraphQuery<{ stakeStarts: RawStart[] }>(
    net,
    `{ stakeStarts(where:{ stakeId_in: [${list}] }, first: 1000){ stakeId stakerAddr stakedHearts stakedDays startDay endDay } }`,
  );
  return d.stakeStarts ?? [];
}

async function startsForWallet(net: HexNet, addr: string): Promise<RawStart[]> {
  const d = await hexSubgraphQuery<{ stakeStarts: RawStart[] }>(
    net,
    `{ stakeStarts(where:{ stakerAddr: "${addr.toLowerCase()}" }, first: 1000, orderBy: startDay, orderDirection: asc){ stakeId stakerAddr stakedHearts stakedDays startDay endDay } }`,
  );
  return d.stakeStarts ?? [];
}

async function endedSet(net: HexNet, ids: string[]): Promise<Set<string>> {
  const ended = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
    const d = await hexSubgraphQuery<{ stakeEnds: { stakeId: string }[] }>(
      net,
      `{ stakeEnds(where:{ stakeId_in: [${chunk}] }, first: 1000){ stakeId } }`,
    );
    for (const e of d.stakeEnds ?? []) ended.add(String(e.stakeId));
  }
  return ended;
}

const hex = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const pct = (f: number) => `${(f * 100).toFixed(1)}%`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const net: HexNet = args.network === 'ethereum' ? 'ethereum' : 'pulsechain';
  const currentDay = currentHexDay();

  let starts: RawStart[];
  if (args.stake) {
    starts = await startsForIds(net, args.stake.split(',').map((s) => s.trim()).filter(Boolean));
  } else if (args.wallet) {
    starts = await startsForWallet(net, args.wallet);
  } else {
    console.error('Provide --stake <id[,id...]> or --wallet <address>. See header for usage.');
    process.exit(1);
  }

  if (!starts.length) {
    console.log('No matching stakeStarts found on the', net, 'subgraph.');
    return;
  }

  const ids = starts.map((s) => s.stakeId);
  const [ended, gaMap] = await Promise.all([endedSet(net, ids), fetchGoodAccountings(net, ids)]);

  console.log(`\nNetwork: ${net}   Current HEX day: ${currentDay}   Stakes checked: ${starts.length}\n`);
  for (const s of starts) {
    const endDay = Number(s.endDay);
    const ga: GoodAccountingRecord | null = gaMap.get(String(s.stakeId)) ?? null;
    const status = classifyMaturedStake({
      principalHex: Number(s.stakedHearts) / 1e8,
      endDay,
      currentDay,
      hasEnd: ended.has(String(s.stakeId)),
      ga,
    });

    const verdict =
      status.state === 'good-accounted'
        ? '✅ GOOD-ACCOUNTED (penalty frozen)'
        : status.state === 'ended'
          ? '⏹  ENDED'
          : status.state === 'bleeding'
            ? '🩸 BLEEDING (estimate only)'
            : status.state === 'matured'
              ? '⏳ MATURED, in grace'
              : '🔒 ACTIVE';

    console.log(`Stake ${s.stakeId}  —  ${verdict}`);
    console.log(`  staker        ${s.stakerAddr}`);
    console.log(`  end day       ${endDay} (${fmtHexDate(endDay)})   ${currentDay - endDay} days ago`);
    if (ga) {
      console.log(`  GA recorded   penalty ${hex(ga.penaltyHex)} HEX, payout ${hex(ga.payoutHex)} HEX, on ${new Date(ga.timestamp).toISOString().slice(0, 10)}`);
      if (status.frozenOnDay) console.log(`  frozen ~day   ${status.frozenOnDay} (penalty stopped growing here)`);
    }
    console.log(`  penalty       ${hex(status.penaltyHex)} HEX (${pct(status.penaltyFraction)})${status.confirmed ? ' [on-chain]' : ' [estimate]'}`);
    console.log(`  still claim   ${hex(status.netClaimableHex)} HEX`);
    console.log(`  note          ${status.note}\n`);
  }
}

main().catch((e) => {
  console.error('Error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
