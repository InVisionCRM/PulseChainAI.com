// Brings hex_rescues (lib/db/hexRescues.ts) up to the newest finalized block.
//
// A keeper rescue is a HEX StakeGoodAccounting event whose senderAddr — the
// third indexed topic, msg.sender — is the keeper. So the chain lists them
// directly: no walk of the keeper's explorer history, which on 2026-10-06 took
// ~146 s for 194 pages AND missed rescues in block 27,724,540, a block the
// explorer marks "lost consensus" while all three RPC nodes agree it is
// canonical (hash 0x81fcfdeb…).
//
// Measured the same day: event logs for all 10,609 rescues in 6.1 s, their
// transactions + receipts in under 10 s. After the first run each sync reads
// only the blocks since the last one.
//
// Only finalized blocks are stored, so a reorg can never leave a phantom
// rescue on the wall; a new rescue appears ~13 minutes after it is mined.
// Every failure throws: the caller renders nothing rather than a short wall.

import { ensureSchema } from '@/lib/db/hexLockedStakes';
import { insertRescues, readSyncedTo, saveSyncedTo, type RescueRow } from '@/lib/db/hexRescues';
import { ethGetLogs, getFinalizedBlockNumber, getTransactionsWithReceipts, type RpcLog } from '@/lib/portfolio/evmRpc';
import { HEX_ADDRESS } from './hexDay';
import { KEEPER_ADDRESS, decodeRescueCalldata } from './rescueFeed';
import type { HexNet } from './subgraph';

/** keccak256("StakeGoodAccounting(uint256,uint256,address,uint40,address)") */
const STAKE_GOOD_ACCOUNTING_TOPIC = '0xd824970a2cf19cc2b630c87ce5b00f67301cac3ac60513d027c7a39129f93b46';

/** Block of the keeper's first rescue. Verified 2026-10-06: no keeper
 *  StakeGoodAccounting event in blocks 26,000,000–27,329,825. */
const KEEPER_START_BLOCK = 27_329_826;

/** eth_getLogs span every pool node accepts (g4mm4 caps at 10,000 blocks). */
const LOG_SPAN = 10_000;
const LOG_WORKERS = 8;
/** Rows per INSERT: the first sync writes every rescue at once. */
const INSERT_CHUNK = 2_000;

const U72 = (1n << 72n) - 1n;
const topicAddr = (t: string) => `0x${t.slice(-40)}`.toLowerCase();

let schemaReady: Promise<void> | null = null;

export async function syncRescues(net: HexNet): Promise<void> {
  if (net !== 'pulsechain') throw new Error(`Rescues are only recorded on PulseChain, not ${net}`);
  schemaReady ??= ensureSchema();
  await schemaReady;

  const to = await getFinalizedBlockNumber('pulsechain');
  const done = await readSyncedTo(net);
  const from = done == null ? KEEPER_START_BLOCK : done + 1;
  if (from > to) return;

  // Built here, not at module load: rescueFeed imports this module, so its
  // KEEPER_ADDRESS is not initialised yet while this file is being loaded.
  const keeperTopic = `0x${'0'.repeat(24)}${KEEPER_ADDRESS.slice(2)}`;
  const spans: [number, number][] = [];
  for (let f = from; f <= to; f += LOG_SPAN) spans.push([f, Math.min(to, f + LOG_SPAN - 1)]);
  const logs: RpcLog[] = [];
  const worker = async () => {
    for (let s = spans.shift(); s; s = spans.shift()) {
      const got = await ethGetLogs('pulsechain', {
        address: HEX_ADDRESS,
        fromBlock: s[0],
        toBlock: s[1],
        topics: [STAKE_GOOD_ACCOUNTING_TOPIC, null, null, keeperTopic],
      });
      if (!got) throw new Error(`No node returned keeper rescue logs for blocks ${s[0]}–${s[1]}`);
      logs.push(...got);
    }
  };
  await Promise.all(Array.from({ length: LOG_WORKERS }, worker));

  const looked = await getTransactionsWithReceipts('pulsechain', [...new Set(logs.map((l) => l.transactionHash.toLowerCase()))]);

  const rows: RescueRow[] = logs.map((l) => {
    const hash = l.transactionHash.toLowerCase();
    const { tx, receipt } = looked.get(hash)!;
    // Logs only come from successful transactions; anything else is a bad answer.
    if (receipt.status !== '0x1') throw new Error(`Rescue ${hash} has a log but receipt status ${receipt.status}`);
    const stakeId = BigInt(l.topics[2]).toString();
    // The note rides in the calldata of a direct call to HEX.
    let message: string | null = null;
    if (tx.to?.toLowerCase() === HEX_ADDRESS.toLowerCase()) {
      const call = decodeRescueCalldata(tx.input);
      if (call && call.stakeId !== stakeId) throw new Error(`Rescue ${hash}: calldata stake ${call.stakeId} ≠ event stake ${stakeId}`);
      message = call?.message ?? null;
    }
    // data0 = timestamp | stakedHearts << 40 | stakeShares << 112 | payout << 184; data1 = penalty.
    const d0 = BigInt(l.data.slice(0, 66));
    const d1 = BigInt(`0x${l.data.slice(66, 130)}`);
    return {
      txHash: hash,
      logIndex: Number.parseInt(l.logIndex, 16),
      blockNumber: Number.parseInt(l.blockNumber, 16),
      minedAt: Number(d0 & ((1n << 40n) - 1n)) * 1000,
      stakeId,
      stakerAddr: topicAddr(l.topics[1]),
      principalHearts: (d0 >> 40n) & U72,
      payoutHearts: (d0 >> 184n) & U72,
      penaltyHearts: d1 & U72,
      message,
      feeWei: BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice),
    };
  });

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) await insertRescues(net, rows.slice(i, i + INSERT_CHUNK));
  // Only after every row is in: a failure above leaves the range to be read again.
  await saveSyncedTo(net, to);
}
