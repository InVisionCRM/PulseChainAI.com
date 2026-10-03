// Definitive on-chain stake check — the authoritative answer to "was this stake
// ever ended?". The HEX subgraph can miss or lag a StakeEnd event, so its
// absence is NOT proof a stake is still open. The contract itself is: when a
// stake is ended, HEX *removes it* from `stakeLists[staker]` (the array element
// is deleted and the last entry swapped in). So a stakeId still present in the
// staker's on-chain list provably has never been ended; if it's gone, it was.
//
// We read the contract directly via raw eth_call (no web3 dependency):
//   stakeCount(address)            -> 0x33060d90
//   stakeLists(address, uint256)   -> 0x2607443b
// returning the StakeStore tuple
//   (uint40 stakeId, uint72 stakedHearts, uint72 stakeShares,
//    uint16 lockedDay, uint16 stakedDays, uint16 unlockedDay, bool isAutoStake)

import { HEX_ADDRESS } from './hexDay';
import { ethCall as poolEthCall } from '@/lib/portfolio/evmRpc';
import type { HexNet } from './subgraph';

const SEL_STAKE_COUNT = '0x33060d90';
const SEL_STAKE_LISTS = '0x2607443b';

const pad32 = (hexNo0x: string) => hexNo0x.padStart(64, '0');
const addrArg = (addr: string) => pad32(addr.toLowerCase().replace(/^0x/, ''));
const uintArg = (n: number) => pad32(n.toString(16));

async function ethCall(net: HexNet, data: string): Promise<string> {
  // The shared failover pool (lib/portfolio/evmRpc.ts), not one node: a single
  // dead endpoint used to fail every read here.
  const r = await poolEthCall(net, HEX_ADDRESS, data);
  if (r == null) throw new Error(`${net} RPC: every endpoint failed for eth_call`);
  return r;
}

export interface OnChainStake {
  index: number;
  stakeId: string;
  principalHex: number;
  /** T-Shares the stake minted. Still counts toward the network's live share
   *  total ONLY while `unlockedDay` is 0 — ending or good-accounting removes it. */
  tShares: number;
  lockedDay: number;
  stakedDays: number;
  /** The HEX day the stake matures (`lockedDay + stakedDays`). */
  endDay: number;
  /** 0 while locked/active; non-zero once good-accounting (or end) set it. */
  unlockedDay: number;
  isAutoStake: boolean;
}

/** How many stakeList reads to have in flight at once. A laddered staker can
 *  hold dozens of stakes, and one round trip each in series is a visible wait. */
const READ_CONCURRENCY = 10;

/** Read every stake currently in a staker's on-chain stakeList. */
export async function fetchOnChainStakes(net: HexNet, stakerAddr: string): Promise<OnChainStake[]> {
  const count = Number(BigInt(await ethCall(net, SEL_STAKE_COUNT + addrArg(stakerAddr))));
  const readOne = async (i: number): Promise<OnChainStake> => {
    const r = (await ethCall(net, SEL_STAKE_LISTS + addrArg(stakerAddr) + uintArg(i))).replace(/^0x/, '');
    const word = (k: number) => r.slice(k * 64, k * 64 + 64);
    const lockedDay = Number(BigInt('0x' + word(3)));
    const stakedDays = Number(BigInt('0x' + word(4)));
    return {
      index: i,
      stakeId: BigInt('0x' + word(0)).toString(),
      principalHex: Number(BigInt('0x' + word(1))) / 1e8,
      tShares: Number(BigInt('0x' + word(2))) / 1e12,
      lockedDay,
      stakedDays,
      endDay: lockedDay + stakedDays,
      unlockedDay: Number(BigInt('0x' + word(5))),
      isAutoStake: BigInt('0x' + word(6)) !== 0n,
    };
  };
  const stakes: OnChainStake[] = [];
  for (let i = 0; i < count; i += READ_CONCURRENCY) {
    const batch = Array.from({ length: Math.min(READ_CONCURRENCY, count - i) }, (_, k) => i + k);
    stakes.push(...(await Promise.all(batch.map(readOne))));
  }
  return stakes;
}

/**
 * The set of stakeIds still present on-chain for a staker. A matured stake whose
 * id is in this set has provably NEVER been ended (regardless of what the
 * subgraph shows); one that is absent has been ended/withdrawn.
 */
export async function onChainStakeIds(net: HexNet, stakerAddr: string): Promise<Set<string>> {
  return new Set((await fetchOnChainStakes(net, stakerAddr)).map((s) => s.stakeId));
}
