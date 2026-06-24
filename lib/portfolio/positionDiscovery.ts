// Footprint-based discovery of custodial positions — NO address registry.
//
// Custodial farms/stakers hold your deposit, so they're invisible to a balance
// scan. But to stake you first had to APPROVE the farm for your LP/stake token,
// so the farm contract appears as a spender in your approvals. We take those
// spender contracts as candidates and probe each with the generic staking
// engines; whatever the wallet actually has a balance in shows up. This finds
// farms the wallet really uses, with zero curated addresses.

import { getCode } from './evmRpc';
import { probeMasterChef, probeStakingRewards } from './protocolRegistry';
import { getKnownAddress } from '@/lib/gumshoe/address-labels';
import type { ProtocolPosition } from './positions';
import type { ChainId } from '@/services';

const MAX_CANDIDATES = 40;

/**
 * Probe a set of candidate contracts (e.g. approval spenders) for staked
 * positions. Each candidate is tried as a Synthetix staker first (cheap) and
 * then as a MasterChef. Fail-safe throughout.
 */
export async function discoverStakedPositions(
  chain: ChainId,
  user: string,
  candidates: string[],
): Promise<ProtocolPosition[]> {
  // Dedupe, drop the user + known infra (routers/lockers/etc. aren't farms).
  const seen = new Set<string>();
  const list: string[] = [];
  for (const raw of candidates) {
    const a = raw.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(a) || a === user.toLowerCase() || seen.has(a)) continue;
    const known = getKnownAddress(a);
    if (known && (known.category === 'router' || known.category === 'factory' || known.category === 'wrapped')) continue;
    seen.add(a);
    list.push(a);
    if (list.length >= MAX_CANDIDATES) break;
  }
  if (list.length === 0) return [];

  const out: ProtocolPosition[] = [];
  const CONC = 5;
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const contract = list[i++];
      try {
        // Must be a contract.
        const code = await getCode(chain, contract);
        if (!code || code === '0x') continue;
        const name = getKnownAddress(contract)?.label ?? undefined;

        // Synthetix-style staker (cheap: 2 calls).
        const sr = await probeStakingRewards(chain, contract, user, name);
        if (sr) { out.push(sr); continue; }

        // MasterChef (poolLength resolves only on real chefs → bounded).
        const mc = await probeMasterChef(chain, contract, user, name, 0, 100);
        if (mc.length) out.push(...mc);
      } catch {
        /* skip candidate */
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  return out;
}
