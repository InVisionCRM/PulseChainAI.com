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
  getBaseFee,
  getPriorityFee,
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

/**
 * How far above the CURRENT base fee a transaction's cap is allowed to sit.
 * PulseChain's base fee is genuinely volatile — measured moving from 951,909
 * to 1,037,045 gwei (about +9%) in the few minutes a 25-transaction batch took
 * to sign and broadcast, and a batch of legacy transactions signed at that
 * moment's price went stale before the FIRST one mined: the chain's base fee
 * had already climbed past what nonce 0 was willing to pay, which blocked
 * every transaction queued behind it (nonces are strictly ordered) until the
 * fee later drifted back down. 3x is generous on purpose — gas here is cheap
 * enough in dollar terms (observed low hundredths of a cent per transaction)
 * that overpaying by 3x is still nothing, while a stuck queue is a real
 * problem: it costs no gas (an unmined transaction never debits the account)
 * but it silently stalls every rescue behind it for as long as the fee stays
 * above the stale cap.
 */
const MAX_FEE_MULTIPLE = 3n;

/** Refuse to send if the network is asking more than this, independent of the
 *  multiple above — a circuit breaker against a genuine fee spike draining the
 *  float, not a fine-tuned bid. */
const MAX_FEE_PER_GAS_WEI = 10_000_000_000_000_000n; // 10,000,000 gwei

/**
 * Replacing a stuck nonce is a different, harder problem than sending a new one,
 * and getting it wrong is what "replacement transaction underpriced" means.
 *
 * A node only accepts a replacement if it beats the transaction already sitting
 * at that nonce on BOTH fee fields by ~10%. The catch is that the stuck ones
 * here are legacy (type 0), and a legacy transaction's single `gasPrice` counts
 * as its fee cap AND its priority fee. Measured on the real stuck queue: the
 * transaction at nonce 21 was priced at 891,078 gwei, so a replacement had to
 * offer a TIP above 891,078 gwei — while a normal type-2 send tips 0.097 gwei,
 * which is what the pool suggests and is nine million times too small. The cap
 * was fine; the tip was the whole problem.
 *
 * So a replacement bids its tip EQUAL to its cap. That beats any legacy
 * predecessor priced below the cap on both fields at once, without needing to
 * know what the predecessor actually paid — which cannot be discovered here
 * anyway: Blockscout only lists mined transactions, and `txpool_content` is
 * disabled on the public pool (both checked).
 *
 * Because tip == cap, a replacement really does pay the full cap rather than
 * base fee, so it costs the multiple below rather than ~1x. That is the price
 * of getting unstuck, it applies only to replacements, and it is cents.
 */
const REPLACE_FEE_MULTIPLE = 4n;
/** Each retry doubles the bid; bounded, and still under the circuit breaker. */
const REPLACE_ATTEMPTS = 4;

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
  /**
   * True when this nonce already has an unconfirmed transaction on it. Changes
   * how the bid is built — see REPLACE_FEE_MULTIPLE. Callers get this from
   * `checkNonce`: any nonce below `pending` is a replacement.
   */
  replacing?: boolean;
}): Promise<SendOutcome> {
  const { keeper, chain, to, data, nonce, gasBufferPct = 120, replacing = false } = args;

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

  // EIP-1559 (type 2), not legacy. A legacy transaction's price is a single
  // number fixed forever at signing time, and PulseChain's base fee moves fast
  // enough — see MAX_FEE_MULTIPLE above — that a legacy price can go stale
  // before the very first transaction in a batch is even mined, wedging every
  // nonce behind it. A type-2 cap of baseFee * MAX_FEE_MULTIPLE survives that
  // drift instead of betting the whole queue on the fee never moving.
  const baseFee = await getBaseFee(chain);
  const priorityFee = await getPriorityFee(chain);
  let maxFeePerGas: bigint;
  let maxPriorityFeePerGas: bigint;
  let txType: 0 | 2;

  if (baseFee != null) {
    if (replacing) {
      // Tip == cap, so the bid beats a legacy predecessor on both fee fields at
      // once. See REPLACE_FEE_MULTIPLE for why the tip is the field that
      // actually matters here.
      maxFeePerGas = baseFee * REPLACE_FEE_MULTIPLE;
      maxPriorityFeePerGas = maxFeePerGas;
    } else {
      maxFeePerGas = baseFee * MAX_FEE_MULTIPLE + priorityFee;
      maxPriorityFeePerGas = priorityFee;
    }
    txType = 2;
  } else {
    // No baseFeePerGas on this chain's blocks — not EIP-1559. Fall back to a
    // legacy price rather than refuse to run.
    const legacyPrice = await getGasPrice(chain);
    if (legacyPrice == null) return { status: 'failed', reason: 'could not read gas price' };
    maxFeePerGas = legacyPrice;
    maxPriorityFeePerGas = legacyPrice;
    txType = 0;
  }

  // The circuit breaker is checked inside the bid loop below rather than here,
  // so it also catches a raised bid rather than only the opening one.

  const tx: UnsignedTransaction =
    txType === 2
      ? {
          to,
          nonce,
          gasLimit,
          maxFeePerGas,
          maxPriorityFeePerGas,
          data,
          value: 0,
          chainId: CHAIN_IDS[chain as 'pulsechain' | 'ethereum'],
          type: 2,
        }
      : {
          to,
          nonce,
          gasLimit,
          gasPrice: maxFeePerGas,
          data,
          value: 0,
          chainId: CHAIN_IDS[chain as 'pulsechain' | 'ethereum'],
        };

  // Sign and send, raising the bid if the node says it is not enough.
  //
  // The retry exists because what a replacement must beat cannot be read from
  // anywhere: the stuck transaction's price is not in Blockscout (it lists only
  // mined ones) and `txpool_content` is disabled on the public pool. Rather
  // than guess, this discovers the threshold empirically — bid, and if the node
  // rejects it as underpriced, double and try again. Bounded, and every attempt
  // still passes under the circuit breaker.
  //
  // Only replacements retry. A brand-new nonce has nothing to outbid, so an
  // "underpriced" answer there is about the base fee rather than a predecessor,
  // and doubling would just overpay.
  const attempts = replacing ? REPLACE_ATTEMPTS : 1;
  let lastError = 'not sent';

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (maxFeePerGas > MAX_FEE_PER_GAS_WEI) {
      return { status: 'skipped', reason: `fee cap ${maxFeePerGas} above the circuit breaker` };
    }

    const bid: UnsignedTransaction =
      txType === 2
        ? { ...tx, maxFeePerGas, maxPriorityFeePerGas }
        : { ...tx, gasPrice: maxFeePerGas };

    const signature = new SigningKey(keeper.privateKey).signDigest(keccak256(serialize(bid)));
    const res = await sendRawTransaction(chain, serialize(bid, signature));

    if ('hash' in res) return { status: 'sent', hash: res.hash, gasLimit };
    if ('settled' in res) return { status: 'settled', reason: res.reason };

    lastError = res.error;
    if (!/underpriced|fee too low|replacement/i.test(res.error)) break; // not a pricing problem
    maxFeePerGas *= 2n;
    if (txType === 2) maxPriorityFeePerGas = maxFeePerGas;
  }

  return { status: 'failed', reason: lastError };
}

/** Next usable nonce, counting anything already sitting in the mempool. */
export async function nextNonce(chain: ChainId, address: string): Promise<number | null> {
  return getTransactionCount(chain, address, 'pending');
}

export interface NonceStatus {
  /** The last nonce actually mined + 1 — the first slot with nothing confirmed. */
  mined: number;
  /** Counting anything already sitting in the mempool, ours or not. */
  pending: number;
  /** pending - mined: transactions WE sent that never confirmed. */
  stuck: number;
}

/**
 * Where a keeper's nonce actually stands, and whether anything is stuck.
 *
 * A gap between `mined` and `pending` means a previous run's transactions are
 * sitting unconfirmed — see the MAX_FEE_MULTIPLE note above for why that
 * happens on this chain. Signing more work on top of `pending` in that state
 * doesn't help: those new transactions just queue up BEHIND the stuck ones,
 * since nonces are strictly ordered, and confirm nothing until the stuck ones
 * do. The only way out is to REPLACE the stuck nonces with a transaction the
 * network is willing to include now, which is why callers should start
 * signing from `mined`, not `pending`, whenever `stuck > 0`.
 */
export async function checkNonce(chain: ChainId, address: string): Promise<NonceStatus | null> {
  const mined = await getTransactionCount(chain, address, 'latest');
  const pending = await getTransactionCount(chain, address, 'pending');
  if (mined == null || pending == null) return null;
  return { mined, pending, stuck: Math.max(0, pending - mined) };
}
