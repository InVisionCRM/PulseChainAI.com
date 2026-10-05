// For each rescued stake its owner has collected: what they did with the HEX.
//
// Judged by the Whale Radar's classifier (walletEndBehavior), so the Rescue
// Wall and the radar can never disagree about the same stake. The one thing
// added here is deciding WHOSE wallet to judge, read from the stake-end
// transaction itself:
//   • the staker passed on (nearly) all the HEX it was paid, in that same
//     transaction — an HSI paying its owner. The owner's wallet is judged.
//     (Verified on 925605: 202,602.55 HEX in, the same amount out to the
//     owner. The HSI destroyed itself on ending, so "is it a contract?" read
//     no — which is why this looks at the transfers, not at code.)
//   • otherwise the staker kept it, and the staker is judged — a person's
//     wallet, or a pooled contract that acts on the HEX itself. (Verified on
//     430916: a pool took 991,231 HEX and passed on 0.5% as fees, and 921173,
//     a pool that re-staked 108,474 HEX on its own.)

import type { Rescue } from '@/lib/hex/rescueFeed';
import { walletEndBehavior } from '@/lib/hex/hexWalletBehavior';
import { SELL_WINDOW_SEC, type EndBehavior } from '@/lib/hex/whaleBehavior';
import { getTransactionReceiptLogs } from '@/lib/portfolio/evmRpc';
import { fetchStakeEnds } from '@/lib/hex/stakeEnds';
import type { FateRow } from '@/lib/db/hexRescueFates';

const NET = 'pulsechain' as const;
const HEX = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
const ZERO = '0x0000000000000000000000000000000000000000';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
/** Share of the paid-out HEX the staker must pass on in the end transaction to
 *  count as a conduit (an HSI). Fees, like 430916's 0.5%, stay far below. */
const PASS_THROUGH_SHARE = 0.99;

/** The wallet whose choices count for a stake, read from its end transaction:
 *  the recipient if the staker passed the HEX straight on, else the staker. */
async function ownerFromEndTx(staker: string, endTx: string): Promise<string> {
  const logs = await getTransactionReceiptLogs(NET, endTx);
  if (!logs) throw new Error(`no receipt for end tx ${endTx}`);
  const addr = (topic: string) => '0x' + topic.slice(26).toLowerCase();
  let paidIn = 0n;
  const passedOn = new Map<string, bigint>();
  for (const l of logs) {
    if (l.address.toLowerCase() !== HEX || l.topics[0] !== TRANSFER_TOPIC) continue;
    const [from, to, amount] = [addr(l.topics[1]), addr(l.topics[2]), BigInt(l.data)];
    if (from === ZERO && to === staker) paidIn += amount;
    if (from === staker && to !== ZERO && to !== HEX) passedOn.set(to, (passedOn.get(to) ?? 0n) + amount);
  }
  const total = [...passedOn.values()].reduce((a, b) => a + b, 0n);
  if (paidIn === 0n || Number(total) < Number(paidIn) * PASS_THROUGH_SHARE) return staker;
  return [...passedOn.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1))[0][0];
}

function rowFrom(r: Rescue, owner: string, b: EndBehavior, now: number): FateRow | null {
  if (b.outcome === 'unknown') return null; // not enough history read: try again next run
  const action =
    b.outcome === 'restaked' ? { tx: b.restakeTx ?? null, days: b.daysAfter ?? null }
      : b.outcome === 'sold' ? { tx: b.firstSellTx ?? null, days: b.daysToSell ?? null }
      : b.outcome === 'moved' ? { tx: b.firstMoveTx ?? null, days: b.daysToMove ?? null }
      : { tx: null, days: null };
  return {
    stakeId: r.stakeId,
    ownerAddr: owner,
    collectedAt: r.claimedAt!,
    collectedHex: r.claimedHex ?? 0,
    outcome: b.outcome,
    restakedHex: b.restaked ? b.restakeHex ?? null : null,
    soldHex: b.soldHex,
    movedHex: b.movedHex,
    actionTx: action.tx,
    daysToAction: action.days,
    final: now >= r.claimedAt! + SELL_WINDOW_SEC * 1000,
    checkedAt: now,
  };
}

export interface FatesRun {
  /** Rows handed to `save`. */
  saved: number;
  problems: { stakeId: string; reason: string }[];
  /** Wallets left for the next run when the clock ran out. */
  deferred: number;
}

/**
 * Work out fates for `todo` (collected rescues), one wallet at a time with
 * `concurrency` in flight, until `deadline` (unix ms). Each wallet's rows go
 * to `save` as soon as they are known, so a run cut off by the platform keeps
 * everything finished before the cut. A wallet that fails is reported and left
 * for the next run; it never stops the others.
 */
export async function computeFates(
  todo: Rescue[],
  deadline: number,
  save: (rows: FateRow[]) => Promise<unknown>,
  concurrency = 4,
): Promise<FatesRun> {
  const byStaker = new Map<string, Rescue[]>();
  for (const r of todo) byStaker.set(r.stakerAddr, [...(byStaker.get(r.stakerAddr) ?? []), r]);
  const queue = [...byStaker.entries()];
  let saved = 0;
  const problems: FatesRun['problems'] = [];
  // The end transactions, which say who was really paid.
  const ends = await fetchStakeEnds(NET, todo.map((r) => r.stakeId));

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length && Date.now() < deadline) {
        const [staker, mine] = queue.shift()!;
        try {
          // Who decides: a person's wallet covers all of their stakes in one
          // read; a conduit pays a different owner per stake.
          const jobs: { owner: string; extra: { stakeId: string; timestamp: number; principalHex: number }[]; stakes: Rescue[] }[] = [];
          const kept: Rescue[] = [];
          for (const r of mine) {
            const end = ends.get(r.stakeId);
            if (!end) { problems.push({ stakeId: r.stakeId, reason: 'end not in subgraph' }); continue; }
            const owner = await ownerFromEndTx(staker, end.tx);
            if (owner === staker) { kept.push(r); continue; }
            // The end is filed under the staker, so hand it to the owner's history.
            const at = Math.floor(r.claimedAt! / 1000);
            jobs.push({ owner, extra: [{ stakeId: r.stakeId, timestamp: at, principalHex: r.claimedHex ?? 0 }], stakes: [r] });
          }
          if (kept.length) jobs.push({ owner: staker, extra: [], stakes: kept });
          const rows: FateRow[] = [];
          for (const job of jobs) {
            // Only what happened from the first collection on matters here.
            const since = Math.min(...job.stakes.map((r) => Math.floor(r.claimedAt! / 1000)));
            const { behavior } = await walletEndBehavior(NET, job.owner, job.extra, since);
            for (const r of job.stakes) {
              const b = behavior.find((x) => x.endStakeId === r.stakeId);
              if (!b) { problems.push({ stakeId: r.stakeId, reason: 'end not in subgraph history' }); continue; }
              const row = rowFrom(r, job.owner, b, Date.now());
              if (row) rows.push(row);
            }
          }
          await save(rows);
          saved += rows.length;
        } catch (e) {
          problems.push({ stakeId: mine.map((r) => r.stakeId).join(','), reason: e instanceof Error ? e.message : String(e) });
        }
      }
    }),
  );
  return { saved, problems, deferred: queue.length };
}
