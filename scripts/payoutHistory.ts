// One-time rebuild of the payout ledger: for each of the last 365 closed HEX
// days, what the day paid its stakers and how much of that was inflation,
// early-end penalties, late penalties, and the keeper's rescues.
//
// Closed days are on-chain fact and never change, so they are computed once and
// committed as lib/hex/payoutHistory.json; the payout-days cron records every
// day after it. Same calculator for both (lib/hex/payoutDays.ts), and every day
// is reconciled to the heart against the contract before it is written.
//
//   npm run hex:payout-history

import { writeFileSync } from 'fs';
import path from 'path';
import { HEX_LAUNCH_TS } from '@/lib/hex/hexDay';
import { readPayoutDays } from '@/lib/hex/payoutDays';
import { fetchPayoutData } from '@/lib/hex/roadToZero';
import { KEEPER_ADDRESS } from '@/lib/hex/rescueFeed';
import { getBlockTimestamp, getFinalizedBlockNumber } from '@/lib/portfolio/evmRpc';

const OUT = path.join(process.cwd(), 'lib/hex/payoutHistory.json');
const DAYS = 365;

/** First block mined at or after `ts` (unix seconds), by binary search. */
async function firstBlockAtOrAfter(ts: number, head: number): Promise<number> {
  let lo = 0;
  let hi = head;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const t = await getBlockTimestamp('pulsechain', mid);
    if (t == null) throw new Error(`No node returned block ${mid}`);
    if (t >= ts) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

(async () => {
  const started = Date.now();
  const head = await getFinalizedBlockNumber('pulsechain');
  const lastClosed = (await fetchPayoutData()).dayPayout.length - 1;
  const first = lastClosed - DAYS + 1;
  // The day before `first` is closed by the first staking transaction of day
  // `first`, so its DailyDataUpdate is at or after that day's first block.
  const fromBlock = await firstBlockAtOrAfter(HEX_LAUNCH_TS + first * 86_400, head);
  console.log(`days ${first}–${lastClosed}, blocks ${fromBlock}–${head}`);

  const days = await readPayoutDays(first - 1, fromBlock, head);
  days.forEach((d, i) => {
    if (d.day !== first + i) throw new Error(`Expected day ${first + i}, got ${d.day}`);
  });
  if (!days.length) throw new Error('No closed days found');

  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    keeper: KEEPER_ADDRESS,
    days,
  }));
  const last = days[days.length - 1];
  console.log(`wrote ${days.length} days (${days[0].day}–${last.day}), every one reconciled with the contract, in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
