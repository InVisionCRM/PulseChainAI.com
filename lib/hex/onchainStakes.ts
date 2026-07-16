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
import type { HexNet } from './subgraph';

const RPC_URL: Record<HexNet, string> = {
  pulsechain: process.env.PULSECHAIN_RPC_URL || 'https://rpc.pulsechain.com',
  ethereum: process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com',
};

const SEL_STAKE_COUNT = '0x33060d90';
const SEL_STAKE_LISTS = '0x2607443b';

const pad32 = (hexNo0x: string) => hexNo0x.padStart(64, '0');
const addrArg = (addr: string) => pad32(addr.toLowerCase().replace(/^0x/, ''));
const uintArg = (n: number) => pad32(n.toString(16));

async function ethCall(net: HexNet, data: string): Promise<string> {
  const res = await fetch(RPC_URL[net], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: HEX_ADDRESS, data }, 'latest'] }),
  });
  if (!res.ok) throw new Error(`${net} RPC HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`${net} RPC: ${j.error.message || 'eth_call error'}`);
  return j.result as string;
}

export interface OnChainStake {
  index: number;
  stakeId: string;
  principalHex: number;
  lockedDay: number;
  stakedDays: number;
  /** 0 while locked/active; non-zero once good-accounting (or end) set it. */
  unlockedDay: number;
  isAutoStake: boolean;
}

/** Read every stake currently in a staker's on-chain stakeList. */
export async function fetchOnChainStakes(net: HexNet, stakerAddr: string): Promise<OnChainStake[]> {
  const count = Number(BigInt(await ethCall(net, SEL_STAKE_COUNT + addrArg(stakerAddr))));
  const stakes: OnChainStake[] = [];
  for (let i = 0; i < count; i++) {
    const r = (await ethCall(net, SEL_STAKE_LISTS + addrArg(stakerAddr) + uintArg(i))).replace(/^0x/, '');
    const word = (k: number) => r.slice(k * 64, k * 64 + 64);
    stakes.push({
      index: i,
      stakeId: BigInt('0x' + word(0)).toString(),
      principalHex: Number(BigInt('0x' + word(1))) / 1e8,
      lockedDay: Number(BigInt('0x' + word(3))),
      stakedDays: Number(BigInt('0x' + word(4))),
      unlockedDay: Number(BigInt('0x' + word(5))),
      isAutoStake: BigInt('0x' + word(6)) !== 0n,
    });
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
