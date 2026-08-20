// The keeper wallet: signs and sends good-accounting transactions.
//
// SERVER ONLY. This module reads a private key. It must never be imported from
// anything that ends up in a browser bundle.
//
// What this key is allowed to sign is enforced here rather than trusted to
// callers, and there are exactly TWO shapes:
//
//   1. `stakeGoodAccounting` addressed to the HEX contract, zero value, under a
//      per-transaction gas ceiling — `signAndSend` refuses anything else.
//   2. A no-op that clears the sender's own stuck nonce: zero value, addressed
//      to the keeper itself, no calldata, 21,000 gas — `signAndCancel` refuses
//      anything else.
//
// Neither can move another account's funds, and `stakeGoodAccounting` pays its
// caller nothing (read the deployed source: it emits an event, folds the
// penalty into the global pool, updates the stake — no transfer, no mint, no
// approval). Those refusals are the actual security boundary: if a bug upstream
// ever produced different calldata, it would be rejected here instead of
// signed.
//
// Deliberately no claim in the UI about what a stolen key could or could not
// do. This module started out signing one shape and now signs two; a promise
// that drifts out of date is worse than no promise.

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
  getPendingBids,
  type PendingBid,
} from '@/lib/portfolio/evmRpc';
import { HEX_ADDRESS } from './hexDay';
import { SEL } from './rescue';
import type { ChainId } from '@/services';

/** PulseChain = 369, Ethereum = 1. Signed into the transaction, so a signature
 *  from this key can never be replayed onto the other chain. */
const CHAIN_IDS: Record<'pulsechain' | 'ethereum', number> = { pulsechain: 369, ethereum: 1 };

/**
 * How many transactions one run may leave unconfirmed at once.
 *
 * Geth carries and relays a limited number of transactions per account (16 by
 * default). Past that, the node you hand them to accepts them from its own
 * client and never announces them to peers, so they cannot mine at any price —
 * the keeper wedged 81 transactions that existed on exactly one node, priced at
 * 34x the base fee and going nowhere.
 *
 * Both the script and the nightly cron import this rather than each keeping
 * their own number. They did keep their own, the script was lowered and the
 * cron was not, and an unattended run at 03:00 UTC would have reproduced the
 * whole thing.
 */
export const MAX_IN_FLIGHT = 12;

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

/**
 * Refuse to send if the network is genuinely asking too much — a circuit
 * breaker against a fee spike draining the float, not a fine-tuned bid.
 *
 * TWO THINGS WERE WRONG WITH THE FIRST VERSION OF THIS.
 *
 * It compared the fee CAP, and the cap carries 3× headroom for base-fee drift
 * (see MAX_FEE_MULTIPLE) rather than being what the transaction pays. EIP-1559
 * charges base fee + tip and refunds the rest, so testing the cap tripped the
 * breaker at a third of the price it was supposed to be guarding. Measured on
 * the live keeper: base fee 3,825,030 gwei produced a cap of 11,475,090 gwei,
 * the breaker refused it — and the rescue it refused would have cost 1,870 PLS,
 * about 2.4 US cents. That is not a spike, that is a Tuesday on PulseChain,
 * where the base fee swung 6× within an hour (635,127 gwei measured shortly
 * after). So the ceiling now applies to the EFFECTIVE price.
 *
 * And it was a hardcoded constant on a chain whose fees move like that, so the
 * only way past a stalled sweep was a code change. It is now an env var, the
 * same as the principal floor.
 *
 * The default is ~40× the normal cost of a rescue and still refuses a genuine
 * runaway: at 25,000,000 gwei an average 488,929-gas rescue costs about
 * 12,223 PLS (~$0.16 at $0.00001276), against ~$0.004 at a normal base fee.
 * Because the cap is at most 3× the effective price, bounding one bounds the
 * other.
 */
const MAX_EFFECTIVE_GWEI_FALLBACK = 25_000_000n;

export function maxEffectiveFeeWei(): bigint {
  const raw = (process.env.HEX_RESCUE_MAX_GWEI ?? '').trim();
  if (raw) {
    try {
      const n = BigInt(raw);
      if (n > 0n) return n * 1_000_000_000n;
    } catch {
      /* unparseable — fall through to the default rather than run uncapped */
    }
  }
  return MAX_EFFECTIVE_GWEI_FALLBACK * 1_000_000_000n;
}

const gwei = (wei: bigint) => (Number(wei) / 1e9).toLocaleString('en-US', { maximumFractionDigits: 0 });

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

/**
 * How much a replacement must beat its predecessor by. Geth's pool wants 10%
 * (`--txpool.pricebump`); 12.5% is that plus enough margin to survive integer
 * truncation, and it is deliberately the SMALLEST step that works.
 *
 * Blind escalation is what made this necessary. When the predecessor's price
 * could not be read, a replacement bid 4x the base fee with tip == cap, and
 * doubled on every "underpriced" answer. Each run therefore bid against a
 * predecessor a previous run had already doubled, so the price ratcheted while
 * the queue stayed stuck. Measured on the live keeper: 81 transactions wedged
 * at nonce 333 priced at 21-22 MILLION gwei against a 652,000 gwei base fee —
 * 32x the real cost of gas, reserving about 4.5M PLS of a 4.37M PLS balance.
 * Since tip == cap means EIP-1559 charges the WHOLE cap, mining those as
 * priced would have spent essentially the entire float.
 *
 * getPendingBids can read the predecessor's exact cap and tip, so the bid is
 * now one step above what is actually there.
 */
const PRICE_BUMP_NUM = 1125n;
const PRICE_BUMP_DEN = 1000n;
const bumped = (v: bigint) => (v * PRICE_BUMP_NUM) / PRICE_BUMP_DEN + 1n;

/**
 * The smallest bid that displaces `prev` at its nonce, given the base fee now.
 *
 * Both replacement paths — a re-sent rescue and a cancel — need exactly this,
 * so it lives in one place and is unit-tested rather than written twice.
 *
 * A legacy predecessor has no separate tip: its single gasPrice counts as both
 * its cap and its tip, so that is the number to beat on both fields. The cap
 * also has to leave room for the new tip on top of the CURRENT base fee, or the
 * node rejects it for a different reason than the one being fixed.
 */
export function replacementBid(
  baseFee: bigint,
  prev: PendingBid,
): { cap: bigint; tip: bigint } {
  const tip = bumped(prev.type === 0 ? prev.cap : prev.tip);
  const prevCap = bumped(prev.cap);
  const wanted = baseFee + tip;
  return { cap: prevCap > wanted ? prevCap : wanted, tip };
}

/** What EIP-1559 will actually charge: base + tip, never more than the cap. */
export function effectivePrice(baseFee: bigint, cap: bigint, tip: bigint): bigint {
  const room = cap - baseFee;
  return baseFee + (tip < room ? tip : room);
}

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
  | {
      status: 'sent';
      hash: string;
      gasLimit: bigint;
      /** How many endpoints took it, of how many tried. One-of-many is the
       *  shape that wedged the keeper — see sendRawTransaction. */
      accepted?: number;
      tried?: number;
    }
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
  /**
   * The transaction already sitting at this nonce, from `getPendingBids`. With
   * it the replacement bids one step above what is actually there; without it
   * it has to escalate blindly — see PRICE_BUMP_NUM for what that cost.
   */
  predecessor?: PendingBid;
}): Promise<SendOutcome> {
  const { keeper, chain, to, data, nonce, gasBufferPct = 120, replacing = false, predecessor } = args;

  // --- the security boundary: good-accounting calls only, nothing else -----
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
  /** What this transaction is expected to be CHARGED per gas — the number the
   *  circuit breaker judges, as opposed to the cap it is allowed to reach. */
  let effectiveFeePerGas: bigint;
  let txType: 0 | 2;

  if (baseFee != null) {
    if (replacing && predecessor) {
      // One step above what is actually queued.
      const bid = replacementBid(baseFee, predecessor);
      maxFeePerGas = bid.cap;
      maxPriorityFeePerGas = bid.tip;
      effectiveFeePerGas = effectivePrice(baseFee, bid.cap, bid.tip);
    } else if (replacing) {
      // Nothing readable at this nonce: fall back to escalating blindly. Tip ==
      // cap so the bid beats a legacy predecessor on both fee fields at once.
      maxFeePerGas = baseFee * REPLACE_FEE_MULTIPLE;
      maxPriorityFeePerGas = maxFeePerGas;
      // A tip this large is not headroom, it is spent: EIP-1559 pays
      // base + min(tip, cap - base), which here is the whole cap.
      effectiveFeePerGas = maxFeePerGas;
    } else {
      maxFeePerGas = baseFee * MAX_FEE_MULTIPLE + priorityFee;
      maxPriorityFeePerGas = priorityFee;
      // What the block will actually charge; the rest of the cap is drift
      // headroom that gets refunded.
      effectiveFeePerGas = baseFee + priorityFee;
    }
    txType = 2;
  } else {
    // No baseFeePerGas on this chain's blocks — not EIP-1559. Fall back to a
    // legacy price rather than refuse to run.
    const legacyPrice = await getGasPrice(chain);
    if (legacyPrice == null) return { status: 'failed', reason: 'could not read gas price' };
    maxFeePerGas = legacyPrice;
    maxPriorityFeePerGas = legacyPrice;
    effectiveFeePerGas = legacyPrice; // legacy pays its price outright
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

  const ceiling = maxEffectiveFeeWei();

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (effectiveFeePerGas > ceiling) {
      // Priced in PLS as well as gwei, because gwei-per-gas is not a number
      // anyone can judge "too expensive?" from, and that judgement is the whole
      // reason to read this line.
      const pls = (effectiveFeePerGas * BigInt(gasLimit)) / 10n ** 18n;
      // Which advice is right depends on WHY the price is high. A replacement is
      // expensive because of what is already queued at this nonce, not because
      // gas is expensive, and raising the ceiling there just lets the bid
      // ratchet further — clearing the queue is the cheap way out.
      const fix = replacing
        ? `This nonce already holds a transaction bidding ${gwei(predecessor?.cap ?? 0n)} gwei, so ` +
          `outbidding it is what costs this much. Clear the queue instead: ` +
          `npm run hex:rescue -- --execute --cancel-stuck`
        : `Raise it with HEX_RESCUE_MAX_GWEI if that is acceptable.`;
      return {
        status: 'skipped',
        reason:
          `gas is ${gwei(effectiveFeePerGas)} gwei — this rescue would cost about ` +
          `${pls.toLocaleString()} PLS, over the ${gwei(ceiling)} gwei ceiling. ${fix}`,
      };
    }

    const bid: UnsignedTransaction =
      txType === 2
        ? { ...tx, maxFeePerGas, maxPriorityFeePerGas }
        : { ...tx, gasPrice: maxFeePerGas };

    const signature = new SigningKey(keeper.privateKey).signDigest(keccak256(serialize(bid)));
    const res = await sendRawTransaction(chain, serialize(bid, signature));

    if ('hash' in res) return { status: 'sent', hash: res.hash, gasLimit, accepted: res.accepted, tried: res.tried };
    if ('settled' in res) return { status: 'settled', reason: res.reason };

    lastError = res.error;
    if (!/underpriced|fee too low|replacement/i.test(res.error)) break; // not a pricing problem
    maxFeePerGas *= 2n;
    if (txType === 2) maxPriorityFeePerGas = maxFeePerGas;
    // Doubling a replacement's bid doubles what it pays, not just what it may
    // pay, so the breaker has to see the raised number on the next pass.
    effectiveFeePerGas = txType === 2 && replacing ? maxFeePerGas : effectiveFeePerGas * 2n;
  }

  return { status: 'failed', reason: lastError };
}

/**
 * Clear one wedged nonce by replacing it with a transaction that does nothing.
 *
 * THE SECOND KIND OF TRANSACTION THIS KEY MAY SIGN, and it is deliberately the
 * most harmless one that exists: zero PLS, to the keeper's own address, with no
 * calldata at all. It cannot move anyone's funds, cannot call any contract, and
 * cannot do anything to a stake. The three constraints are enforced here rather
 * than assumed, exactly like the good-accounting boundary above.
 *
 * Why it has to exist: a wedged queue is not free to leave alone. Nonces are
 * strictly ordered, so one stuck transaction blocks every rescue behind it, and
 * the stuck ones on the live keeper were priced at 32x the real cost of gas
 * (see PRICE_BUMP_NUM) — mining as priced they would have spent the whole
 * float. Replacing them with 21,000-gas no-ops costs about 500 PLS each
 * instead of 55,000, and unblocks the queue in one run.
 */
export async function signAndCancel(args: {
  keeper: KeeperWallet;
  chain: ChainId;
  nonce: number;
  predecessor?: PendingBid;
}): Promise<SendOutcome> {
  const { keeper, chain, nonce, predecessor } = args;

  if (chain !== 'pulsechain' && chain !== 'ethereum') {
    return { status: 'failed', reason: `refused: unsupported chain ${chain}` };
  }

  const baseFee = await getBaseFee(chain);
  const priorityFee = await getPriorityFee(chain);
  if (baseFee == null) return { status: 'failed', reason: 'could not read the base fee' };

  // Nothing readable to outbid means this is priced like an ordinary send.
  const { cap: maxFeePerGas, tip: maxPriorityFeePerGas } = predecessor
    ? replacementBid(baseFee, predecessor)
    : { cap: baseFee * MAX_FEE_MULTIPLE + priorityFee, tip: priorityFee };

  // A cancel is 21,000 gas, so it stays cheap at almost any per-gas price —
  // which is the whole point, since the price it has to beat is exactly the one
  // the per-gas ceiling would refuse. It is bounded by total COST instead.
  const cost = maxFeePerGas * CANCEL_GAS;
  if (cost > MAX_CANCEL_COST_WEI) {
    return {
      status: 'skipped',
      reason:
        `clearing nonce ${nonce} would cost about ${(cost / 10n ** 18n).toLocaleString()} PLS, ` +
        `over the ${(MAX_CANCEL_COST_WEI / 10n ** 18n).toLocaleString()} PLS-per-nonce ceiling`,
    };
  }

  const tx: UnsignedTransaction = {
    to: keeper.address, // itself
    nonce,
    gasLimit: CANCEL_GAS,
    maxFeePerGas,
    maxPriorityFeePerGas,
    data: '0x', // nothing to execute
    value: 0,
    chainId: CHAIN_IDS[chain as 'pulsechain' | 'ethereum'],
    type: 2,
  };

  // Escalate if the node says the bid is too small. Unlike a rescue, doubling
  // here is safe to do freely: at 21,000 gas the whole transaction stays worth
  // a fraction of a cent, and MAX_CANCEL_COST_WEI is the hard stop.
  let cap = maxFeePerGas;
  let tip = maxPriorityFeePerGas;
  let lastError = 'not sent';

  for (let attempt = 0; attempt < CANCEL_ATTEMPTS; attempt++) {
    if (cap * CANCEL_GAS > MAX_CANCEL_COST_WEI) break;

    const bid: UnsignedTransaction = { ...tx, maxFeePerGas: cap, maxPriorityFeePerGas: tip };
    const signature = new SigningKey(keeper.privateKey).signDigest(keccak256(serialize(bid)));
    const res = await sendRawTransaction(chain, serialize(bid, signature));

    if ('hash' in res) {
      return { status: 'sent', hash: res.hash, gasLimit: CANCEL_GAS, accepted: res.accepted, tried: res.tried };
    }
    if ('settled' in res) return { status: 'settled', reason: res.reason };

    lastError = res.error;
    if (!/underpriced|fee too low|replacement/i.test(res.error)) break;
    cap *= 2n;
    tip *= 2n;
  }

  return { status: 'failed', reason: lastError };
}

/** Enough doublings to clear a queue priced by a runaway escalation, bounded by
 *  MAX_CANCEL_COST_WEI either way. */
const CANCEL_ATTEMPTS = 5;

/** A plain value transfer is 21,000 gas — the protocol minimum, and all a
 *  do-nothing transaction needs. */
const CANCEL_GAS = 21_000n;

/** Per-nonce spend ceiling for clearing the queue: 5,000 PLS, about 6 US cents
 *  at $0.00001276. Generous next to the ~500 PLS a cancel actually costs, and
 *  still a hard stop if the predecessor's price is absurd. */
const MAX_CANCEL_COST_WEI = 5_000n * 10n ** 18n;

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
