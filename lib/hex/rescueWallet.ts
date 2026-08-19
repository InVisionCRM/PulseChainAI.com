// The keeper wallet: signs and sends good-accounting transactions.
//
// SERVER ONLY. This module reads a private key. It must never be imported from
// anything that ends up in a browser bundle.
//
// The safety story here is unusually good, and it is worth being explicit about
// why, because "an app with a hot wallet" normally deserves suspicion.
// `stakeGoodAccounting` pays its caller NOTHING — read the deployed source: it
// emits an event, folds the penalty into the global pool, and updates the
// stake. No transfer, no mint, no approval. So the worst an attacker can do
// with this key is spend its own gas doing strangers a favour.
//
// That property only holds while the key can ONLY make that one call, so this
// module enforces it rather than trusting callers: `signAndSend` refuses any
// transaction that is not addressed to the HEX contract with the
// `stakeGoodAccounting` selector, refuses any non-zero value, and refuses to
// exceed a per-transaction gas ceiling. Those checks are the actual security
// boundary — if a bug upstream ever produced different calldata, it would be
// rejected here instead of signed.

import { serialize, type UnsignedTransaction } from '@ethersproject/transactions';
import { SigningKey } from '@ethersproject/signing-key';
import { keccak256 } from '@ethersproject/keccak256';
import { computeAddress } from '@ethersproject/transactions';
import {
  estimateGas,
  getTransactionCount,
  getGasPrice,
  sendRawTransaction,
} from '@/lib/portfolio/evmRpc';
import { HEX_ADDRESS } from './hexDay';
import { SEL } from './rescue';
import type { ChainId } from '@/services';

/** PulseChain = 369, Ethereum = 1. Signed into the transaction, so a signature
 *  from this key can never be replayed onto the other chain. */
const CHAIN_IDS: Record<'pulsechain' | 'ethereum', number> = { pulsechain: 369, ethereum: 1 };

/**
 * Hard ceiling per transaction. The longest possible HEX stake is 5,555 days,
 * which measured at ~2,900-3,300 gas per staked day puts the worst legitimate
 * call around 18M. 25M leaves headroom under PulseChain's ~45M block limit
 * while still refusing anything absurd.
 */
const MAX_GAS_PER_TX = 25_000_000n;

/** Refuse to send if the network is asking more than this. Gas on PulseChain is
 *  quoted in hundreds of thousands of gwei and moves fast (observed 358k ->
 *  492k within minutes), so this is a circuit breaker against a spike draining
 *  the float, not a fine-tuned bid. */
const MAX_GAS_PRICE_WEI = 5_000_000_000_000_000n; // 5,000,000 gwei

export interface KeeperWallet {
  address: string;
  privateKey: string;
}

/**
 * Load the keeper key from the environment.
 *
 * Returns null rather than throwing when unset, so a deployment that has not
 * been given a key runs in dry-run and reports that plainly instead of crashing
 * a cron route.
 */
export function loadKeeper(): KeeperWallet | null {
  const raw = (process.env.HEX_RESCUE_PRIVATE_KEY ?? '').trim();
  if (!raw) return null;
  const pk = raw.startsWith('0x') ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error('HEX_RESCUE_PRIVATE_KEY is set but is not a 32-byte hex key');
  }
  return { address: computeAddress(pk).toLowerCase(), privateKey: pk };
}

export type SendOutcome =
  | { status: 'sent'; hash: string; gasLimit: bigint }
  | { status: 'settled'; reason: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

/**
 * Price, sign and broadcast one good-accounting call.
 *
 * The gas estimate is not just for pricing — it is the last correctness check
 * before spending anything. `stakeGoodAccounting` reverts if the stake was
 * already settled or the index has shifted, so an estimate that fails means the
 * work is already done (or the index went stale between resolving and sending)
 * and the right move is to skip, not to send and burn gas on a revert.
 */
export async function signAndSend(args: {
  keeper: KeeperWallet;
  chain: ChainId;
  to: string;
  data: string;
  nonce: number;
  /** Multiplier applied to the estimate, as a percentage. 120 = +20% headroom. */
  gasBufferPct?: number;
}): Promise<SendOutcome> {
  const { keeper, chain, to, data, nonce, gasBufferPct = 120 } = args;

  // --- the security boundary: this key signs exactly one kind of call -------
  if (to.toLowerCase() !== HEX_ADDRESS.toLowerCase()) {
    return { status: 'failed', reason: `refused: destination ${to} is not the HEX contract` };
  }
  if (!data.toLowerCase().startsWith(SEL.stakeGoodAccounting)) {
    return { status: 'failed', reason: 'refused: calldata is not stakeGoodAccounting' };
  }
  if (chain !== 'pulsechain' && chain !== 'ethereum') {
    return { status: 'failed', reason: `refused: unsupported chain ${chain}` };
  }
  // -------------------------------------------------------------------------

  const est = await estimateGas(chain, { from: keeper.address, to, data });
  if (est == null) {
    return { status: 'skipped', reason: 'estimate reverted — stake already settled or index moved' };
  }
  const gasLimit = (est * BigInt(gasBufferPct)) / 100n;
  if (gasLimit > MAX_GAS_PER_TX) {
    return { status: 'skipped', reason: `gas ${gasLimit} over the ${MAX_GAS_PER_TX} ceiling` };
  }

  const gasPrice = await getGasPrice(chain);
  if (gasPrice == null) return { status: 'failed', reason: 'could not read gas price' };
  if (gasPrice > MAX_GAS_PRICE_WEI) {
    return { status: 'skipped', reason: `gas price ${gasPrice} above the circuit breaker` };
  }

  // Legacy (type 0) rather than EIP-1559. PulseChain supports 1559, but a
  // legacy transaction is accepted by every endpoint in the pool and there is
  // nothing here worth tuning a priority fee for — this job is never in a race.
  const tx: UnsignedTransaction = {
    to,
    nonce,
    gasLimit,
    gasPrice,
    data,
    value: 0,
    chainId: CHAIN_IDS[chain as 'pulsechain' | 'ethereum'],
  };

  const signature = new SigningKey(keeper.privateKey).signDigest(keccak256(serialize(tx)));
  const signed = serialize(tx, signature);

  const res = await sendRawTransaction(chain, signed);
  if ('hash' in res) return { status: 'sent', hash: res.hash, gasLimit };
  if ('settled' in res) return { status: 'settled', reason: res.reason };
  return { status: 'failed', reason: res.error };
}

/** Next usable nonce, counting anything already sitting in the mempool. */
export async function nextNonce(chain: ChainId, address: string): Promise<number | null> {
  return getTransactionCount(chain, address, 'pending');
}
