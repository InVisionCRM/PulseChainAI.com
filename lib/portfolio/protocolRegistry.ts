// Custodial-farm registry + generic MasterChef scanner.
//
// MasterChef-style farms hold your LP for you, so the deposit never shows up in
// your wallet — the only way to find it is to ask the farm. The ABI is shared
// across virtually every Sushi/Pancake fork, so ONE scanner reads them all; we
// only need each farm's MasterChef address (a short curated list, not every
// pool). Add new farms by dropping their contract in FARMS below — no code.

import { ethCall } from './evmRpc';
import { SEL, callData, encUint, toBig, toAddr, decomposeV2, type ProtocolPosition } from './positions';
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

/** Scan one MasterChef for the user's staked positions. Fail-safe → []. */
async function scanFarm(farm: FarmContract, user: string): Promise<ProtocolPosition[]> {
  const lenHex = await ethCall(farm.chain, farm.address, MASTERCHEF.poolLength);
  const poolLength = Number(toBig(lenHex));
  if (!poolLength || poolLength > 5000) return [];

  const n = Math.min(poolLength, MAX_POOLS);
  const userArg = user.toLowerCase().replace(/^0x/, '');
  const lpField = farm.lpField ?? 0;
  const out: ProtocolPosition[] = [];

  // Bounded concurrency over pools.
  const CONC = 8;
  let i = 0;
  async function worker() {
    while (i < n) {
      const pid = i++;
      const amtHex = await ethCall(farm.chain, farm.address, callData(MASTERCHEF.userInfo, encUint(BigInt(pid)), userArg));
      const amount = toBig(amtHex); // userInfo.amount is the first word
      if (amount <= 0n) continue;
      const poolHex = await ethCall(farm.chain, farm.address, callData(MASTERCHEF.poolInfo, encUint(BigInt(pid))));
      if (!poolHex || poolHex === '0x') continue;
      const body = poolHex.replace(/^0x/, '');
      const lpToken = toAddr('0x' + body.slice(lpField * 64, lpField * 64 + 64));
      if (!lpToken) continue;
      // Value the staked LP by decomposing the staked amount.
      const dec = await decomposeV2(farm.chain, lpToken, amount);
      out.push(
        dec
          ? { kind: 'farm', address: lpToken, symbol: dec.symbol, protocol: farm.name, note: 'Staked LP', underlying: dec.underlying }
          : { kind: 'farm', address: lpToken, symbol: 'LP', protocol: farm.name, note: 'Staked', underlying: [] },
      );
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  return out;
}

/** Scan every registered farm on a chain for the user. */
export async function scanFarms(chain: ChainId, user: string): Promise<ProtocolPosition[]> {
  const farms = FARMS.filter((f) => f.chain === chain);
  if (farms.length === 0) return [];
  const results = await Promise.all(farms.map((f) => scanFarm(f, user).catch(() => [] as ProtocolPosition[])));
  return results.flat();
}
