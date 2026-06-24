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

/** A contract the wallet interacted with, plus the token it approved to it. */
export interface Candidate {
  contract: string;
  /** Token approved to `contract` — the likely staked asset for custom stakers. */
  approvedToken?: string;
}

/**
 * Probe a set of candidate contracts (approval spenders) for staked positions.
 * Each candidate is tried as a Synthetix / custom single-asset staker first
 * (cheap; falls back to the approved token as the staked asset when there's no
 * `stakingToken()`), then as a MasterChef. Fail-safe throughout.
 */
export async function discoverStakedPositions(
  chain: ChainId,
  user: string,
  candidates: Candidate[],
): Promise<ProtocolPosition[]> {
  // Dedupe by contract, drop the user + known infra (routers/lockers aren't farms).
  const seen = new Set<string>();
  const list: Candidate[] = [];
  for (const raw of candidates) {
    const a = raw.contract?.toLowerCase();
    if (!a || !/^0x[0-9a-f]{40}$/.test(a) || a === user.toLowerCase() || seen.has(a)) continue;
    const known = getKnownAddress(a);
    if (known && (known.category === 'router' || known.category === 'factory' || known.category === 'wrapped')) continue;
    seen.add(a);
    list.push({ contract: a, approvedToken: raw.approvedToken?.toLowerCase() });
    if (list.length >= MAX_CANDIDATES) break;
  }
  if (list.length === 0) return [];

  const out: ProtocolPosition[] = [];
  const CONC = 5;
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const { contract, approvedToken } = list[i++];
      try {
        // Must be a contract.
        const code = await getCode(chain, contract);
        if (!code || code === '0x') continue;
        const name = getKnownAddress(contract)?.label ?? undefined;

        // Synthetix / custom single-asset staker (cheap: 2 calls).
        const sr = await probeStakingRewards(chain, contract, user, name, approvedToken);
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
