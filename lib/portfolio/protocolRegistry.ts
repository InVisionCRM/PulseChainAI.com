// Custodial-farm registry + generic MasterChef scanner.
//
// MasterChef-style farms hold your LP for you, so the deposit never shows up in
// your wallet — the only way to find it is to ask the farm. The ABI is shared
// across virtually every Sushi/Pancake fork, so ONE scanner reads them all; we
// only need each farm's MasterChef address (a short curated list, not every
// pool). Add new farms by dropping their contract in FARMS below — no code.

import { ethCall } from './evmRpc';
import { callData, encUint, toBig, toAddr, erc20Meta, fmt, decomposeV2, type ProtocolPosition } from './positions';
import type { ChainId } from '@/services';

export interface FarmContract {
  name: string;
  address: string;
  chain: ChainId;
  /** poolInfo word index (0-based) holding the staked LP token. Default 0. */
  lpField?: number;
}

// Seed list — extend freely. Addresses should be the MasterChef/Chef contract.
// NOTE: these need on-chain verification; the scanner fails safe (skips a farm)
// if an address doesn't expose the MasterChef ABI, so a wrong entry can't break
// the portfolio — it just yields nothing.
export const FARMS: FarmContract[] = [
  // Example shape (commented until verified on-chain):
  // { name: 'PulseX Farm', address: '0x…', chain: 'pulsechain' },
];

const MASTERCHEF = {
  poolLength: '0x081e3eda',
  poolInfo: '0x1526fe27', // poolInfo(uint256)
  userInfo: '0x93f1a40b', // userInfo(uint256,address)
};

const MAX_POOLS = 200; // bound the scan per farm

// Synthetix StakingRewards / single-asset staker ABI (covers most non-MasterChef
// farms and single-asset stakers — the contract tracks the staked balance).
const STAKING = {
  balanceOf: '0x70a08231', // balanceOf(address) → staked amount
  stakingToken: '0x72f702f3',
};

/**
 * Probe a contract for MasterChef-style staked positions. Fail-safe → [].
 * Generic — works on any Sushi/Pancake fork without an address list.
 */
export async function probeMasterChef(
  chain: ChainId,
  contract: string,
  user: string,
  name?: string,
  lpField = 0,
  maxPools = MAX_POOLS,
): Promise<ProtocolPosition[]> {
  const lenHex = await ethCall(chain, contract, MASTERCHEF.poolLength);
  const poolLength = Number(toBig(lenHex));
  if (!poolLength || poolLength > 5000) return [];

  const n = Math.min(poolLength, maxPools);
  const userArg = user.toLowerCase().replace(/^0x/, '');
  const out: ProtocolPosition[] = [];
  const CONC = 8;
  let i = 0;
  async function worker() {
    while (i < n) {
      const pid = i++;
      const amtHex = await ethCall(chain, contract, callData(MASTERCHEF.userInfo, encUint(BigInt(pid)), userArg));
      const amount = toBig(amtHex); // userInfo.amount is the first word
      if (amount <= 0n) continue;
      const poolHex = await ethCall(chain, contract, callData(MASTERCHEF.poolInfo, encUint(BigInt(pid))));
      if (!poolHex || poolHex === '0x') continue;
      const body = poolHex.replace(/^0x/, '');
      const lpToken = toAddr('0x' + body.slice(lpField * 64, lpField * 64 + 64));
      if (!lpToken) continue;
      const dec = await decomposeV2(chain, lpToken, amount);
      out.push(
        dec
          ? { kind: 'farm', address: lpToken, symbol: dec.symbol, protocol: name, note: 'Staked LP', underlying: dec.underlying }
          : { kind: 'farm', address: lpToken, symbol: 'LP', protocol: name, note: 'Staked', underlying: [] },
      );
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  return out;
}

/**
 * Probe a contract for a Synthetix StakingRewards-style position: `balanceOf`
 * is the user's staked amount and `stakingToken()` identifies what's staked.
 *
 * Many PulseChain stakers (e.g. pTGC) are custom single-asset stakers that
 * track `balanceOf(user)` but expose no `stakingToken()` view. For those we
 * fall back to `approvedToken` — the token the user approved *to this very
 * contract* is, by construction, what they staked here. Returns null if the
 * contract isn't a staker or the user has nothing in it.
 */
export async function probeStakingRewards(
  chain: ChainId,
  contract: string,
  user: string,
  name?: string,
  approvedToken?: string,
): Promise<ProtocolPosition | null> {
  let stakingToken = toAddr(await ethCall(chain, contract, STAKING.stakingToken));
  if (!stakingToken) {
    // No stakingToken() — fall back to the token the user approved to this contract.
    if (!approvedToken || !/^0x[0-9a-f]{40}$/.test(approvedToken.toLowerCase())) return null;
    stakingToken = approvedToken.toLowerCase();
  }
  const staked = toBig(await ethCall(chain, contract, callData(STAKING.balanceOf, user.toLowerCase().replace(/^0x/, ''))));
  if (staked <= 0n) return null;
  const dec = await decomposeV2(chain, stakingToken, staked);
  if (dec) return { kind: 'farm', address: stakingToken, symbol: dec.symbol, protocol: name, note: 'Staked LP', underlying: dec.underlying };
  const m = await erc20Meta(chain, stakingToken);
  return {
    kind: 'staking',
    address: stakingToken,
    symbol: m.symbol,
    protocol: name,
    note: 'Staked',
    underlying: [{ address: stakingToken, symbol: m.symbol, decimals: m.decimals, amount: fmt(staked, m.decimals) }],
  };
}

/** Scan every registered farm on a chain for the user (optional fast-path). */
export async function scanFarms(chain: ChainId, user: string): Promise<ProtocolPosition[]> {
  const farms = FARMS.filter((f) => f.chain === chain);
  if (farms.length === 0) return [];
  const results = await Promise.all(
    farms.map((f) => probeMasterChef(f.chain, f.address, user, f.name, f.lpField).catch(() => [] as ProtocolPosition[])),
  );
  return results.flat();
}
