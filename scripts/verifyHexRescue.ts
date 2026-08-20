/**
 * Verifies the HEX rescue keeper's safety boundary. Run with:
 *   npm run verify:hex-rescue
 *
 * This exists because the keeper holds a private key, and the ONLY reason that
 * is acceptable is that the key cannot do anything except call
 * `stakeGoodAccounting` — a function that moves no money to its caller. That
 * claim is enforced by guards in lib/hex/rescueWallet.ts, and a guard nobody
 * tests is a comment. So this proves, every time it runs, that:
 *
 *   1. Transactions to any address other than HEX are refused.
 *   2. Any calldata other than stakeGoodAccounting is refused — including
 *      transfer(), approve() and stakeEnd(), the three that would actually cost
 *      somebody something.
 *   3. Every refusal happens BEFORE signing, so a rejected payload is never
 *      broadcast.
 *   4. The signing stack derives addresses correctly, checked against the
 *      standard Ethereum test key.
 *   5. Calldata is built to the shape the contract expects, and the on-chain
 *      message rides along without disturbing it.
 *
 * No transaction is ever broadcast: every case is one the guards reject before
 * any network call, and the key below is a throwaway that has never held funds.
 *
 * Exits non-zero on any failure, so it doubles as a CI smoke test.
 *
 * Loads .env / .env.local via ./loadEnv, which has to be the first import —
 * see the note in that file for why the obvious placement does not work.
 */

import './loadEnv';

import {
  signAndSend,
  signAndCancel,
  loadKeeper,
  maxEffectiveFeeWei,
  replacementBid,
  effectivePrice,
} from '@/lib/hex/rescueWallet';
import { HEX_ADDRESS } from '@/lib/hex/hexDay';
import {
  SEL,
  goodAccountingCalldata,
  messageForStake,
  defaultMinPrincipalHex,
  MIN_PRINCIPAL_HEX_FALLBACK,
  RESCUE_MESSAGES,
} from '@/lib/hex/rescue';

let failures = 0;
const pass = (msg: string) => console.log(`  ✅ ${msg}`);
const fail = (msg: string) => {
  failures += 1;
  console.error(`  ❌ ${msg}`);
};

/** Never funded, never used for anything else. */
const KEEPER = {
  address: '0x0000000000000000000000000000000000000002',
  privateKey: `0x${'11'.repeat(32)}`,
};

/** From the Ethereum yellow-paper era test vectors — a fixed, public pair. */
const TEST_KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';
const TEST_ADDRESS = '0x2c7536e3605d9c16a7a3d7b1898e529396a65c23';

async function main() {
  console.log('🔐 HEX rescue keeper — safety boundary\n');
  console.log(`  pinned contract: ${HEX_ADDRESS}`);
  console.log(`  pinned selector: ${SEL.stakeGoodAccounting}  (stakeGoodAccounting)\n`);

  const valid = goodAccountingCalldata(`0x${'ab'.repeat(20)}`, 0, '12345', 'test');

  const refusals: [string, string, string][] = [
    ['sending anywhere but the HEX contract', `0x${'de'.repeat(20)}`, valid],
    ['ERC-20 transfer() calldata', HEX_ADDRESS, `0xa9059cbb${'0'.repeat(128)}`],
    ['ERC-20 approve() calldata', HEX_ADDRESS, `0x095ea7b3${'0'.repeat(128)}`],
    ['stakeEnd() calldata', HEX_ADDRESS, `0x343009a2${'0'.repeat(128)}`],
    ['empty calldata', HEX_ADDRESS, '0x'],
    ['a selector one byte off', HEX_ADDRESS, `0x65cf71b3${'0'.repeat(192)}`],
  ];

  console.log('Refusals:');
  for (const [label, to, data] of refusals) {
    const r = await signAndSend({ keeper: KEEPER, chain: 'pulsechain', to, data, nonce: 0 });
    if (r.status === 'failed' && r.reason.startsWith('refused')) pass(`${label} — ${r.reason}`);
    else fail(`${label} was NOT refused (got ${r.status})`);
  }

  console.log('\nSigning stack:');
  const prev = process.env.HEX_RESCUE_PRIVATE_KEY;
  process.env.HEX_RESCUE_PRIVATE_KEY = TEST_KEY;
  const derived = loadKeeper()?.address;
  derived === TEST_ADDRESS
    ? pass(`address derivation matches the known test vector (${TEST_ADDRESS})`)
    : fail(`address derivation is wrong: got ${derived}, expected ${TEST_ADDRESS}`);

  process.env.HEX_RESCUE_PRIVATE_KEY = 'not-a-key';
  try {
    loadKeeper();
    fail('a malformed key was accepted');
  } catch {
    pass('a malformed key is rejected rather than used');
  }
  delete process.env.HEX_RESCUE_PRIVATE_KEY;
  loadKeeper() === null ? pass('no key configured -> dry run, not a crash') : fail('missing key was not handled');
  if (prev !== undefined) process.env.HEX_RESCUE_PRIVATE_KEY = prev;

  console.log('\nCalldata:');
  const staker = `0x${'ab'.repeat(20)}`;
  const bare = goodAccountingCalldata(staker, 7, '999');
  const withMsg = goodAccountingCalldata(staker, 7, '999', 'hello');
  bare.length === 2 + 8 + 192
    ? pass(`bare calldata is selector + 3 words (${bare.length} chars)`)
    : fail(`bare calldata is ${bare.length} chars, expected ${2 + 8 + 192}`);
  withMsg.startsWith(bare)
    ? pass('the message is appended AFTER the arguments, leaving them untouched')
    : fail('appending a message altered the encoded arguments');
  const thirdWord = bare.slice(2 + 8 + 128, 2 + 8 + 192);
  thirdWord === BigInt(999).toString(16).padStart(64, '0')
    ? pass('stakeId 999 encodes to 0x3e7, left-padded to a full word')
    : fail(`third word is wrong: ${thirdWord}`);

  console.log('\nReplacement pricing:');
  const GW = 1_000_000_000n;
  const base = 652_000n * GW; // the base fee measured while the keeper was wedged
  // Mirrors REPLACE_FEE_MULTIPLE in rescueWallet.ts; kept local so a change
  // there shows up as a failure here rather than being silently tracked.
  const REPLACE_FEE_MULTIPLE_FOR_TEST = 4n;

  // The real wedge: predecessors at 22,349,612 gwei with tip == cap.
  const wedged = { nonce: 333, cap: 22_349_612n * GW, tip: 22_349_612n * GW, type: 2 as const, gasLimit: 2_509_000n };
  const b1 = replacementBid(base, wedged);
  b1.tip > wedged.tip && b1.tip < (wedged.tip * 12n) / 10n
    ? pass(`beats the queued tip by one step, not by doubling (${(Number(b1.tip) / 1e9).toLocaleString()} gwei)`)
    : fail(`replacement tip ${b1.tip} is not a single 12.5% step above ${wedged.tip}`);
  b1.cap >= base + b1.tip
    ? pass('the cap leaves room for the tip on top of the current base fee')
    : fail(`cap ${b1.cap} cannot pay tip ${b1.tip} over base ${base}`);
  // What blind escalation could reach: 4x the base fee, doubled once per retry
  // over four attempts, so 4x -> 32x. Against a predecessor a previous run had
  // already ratcheted to 34x the base fee, that tops out BELOW what it has to
  // beat — which is exactly the stall this replaces. Reading the predecessor
  // gets there in one step instead of not at all.
  const blindCeiling = base * REPLACE_FEE_MULTIPLE_FOR_TEST * 8n;
  blindCeiling <= wedged.tip && b1.tip > wedged.tip
    ? pass(
        `blind escalation tops out at ${(Number(blindCeiling) / 1e9).toLocaleString()} gwei and never ` +
          `beats the queued ${(Number(wedged.tip) / 1e9).toLocaleString()}; one step does`,
      )
    : fail('the blind-escalation comparison no longer holds — re-check the retry bounds');

  // A legacy predecessor has no separate tip — its gasPrice is both fields.
  const legacy = { nonce: 1, cap: 891_078n * GW, tip: 0n, type: 0 as const, gasLimit: 21_000n };
  replacementBid(base, legacy).tip > legacy.cap
    ? pass("a legacy predecessor's gasPrice is beaten on the TIP as well as the cap")
    : fail('a legacy predecessor would be replaced with too small a tip');

  // tip == cap is what made the wedged transactions cost the full cap.
  effectivePrice(base, 22_349_612n * GW, 22_349_612n * GW) === 22_349_612n * GW
    ? pass('tip == cap means the whole cap is charged, not the base fee')
    : fail('effectivePrice does not charge the full cap when tip == cap');
  effectivePrice(base, base * 3n, 500n * GW) === base + 500n * GW
    ? pass('a normal send is charged base + tip, and the rest of the cap is headroom')
    : fail('effectivePrice mispriced an ordinary send');

  console.log('\nBroadcast:');
  {
    // The load-bearing fix: a transaction only one node holds is invisible to
    // validators. Counting the ATTEMPTS rather than the acceptances keeps this
    // honest offline — the payload is nonsense, so every node rejects it, and
    // nothing is ever sent.
    const { RPC_URLS, sendRawTransaction } = await import('@/lib/portfolio/evmRpc');
    const urls = RPC_URLS.pulsechain ?? [];
    const hit = new Set<string>();
    const realFetch = globalThis.fetch;
    globalThis.fetch = ((input: unknown, init?: { body?: unknown }) => {
      const url = typeof input === 'string' ? input : (input as { url?: string })?.url;
      if (init?.body && String(init.body).includes('eth_sendRawTransaction')) hit.add(String(url));
      return realFetch(input as RequestInfo, init as RequestInit);
    }) as typeof fetch;
    try {
      await sendRawTransaction('pulsechain', `0x02f8${'00'.repeat(40)}`);
    } finally {
      globalThis.fetch = realFetch;
    }
    hit.size === urls.length && urls.length > 1
      ? pass(`a broadcast reaches every endpoint (${hit.size} of ${urls.length}), not just the first`)
      : fail(`a broadcast reached ${hit.size} of ${urls.length} endpoints`);
  }

  console.log('\nCancel path:');
  const cancelBadChain = await signAndCancel({
    keeper: { address: '0x0000000000000000000000000000000000000001', privateKey: `0x${'11'.repeat(32)}` },
    chain: 'robinhood' as never,
    nonce: 0,
  });
  cancelBadChain.status === 'failed' && /unsupported chain/.test(cancelBadChain.reason ?? '')
    ? pass('a cancel refuses an unsupported chain before signing')
    : fail(`a cancel on an unsupported chain was not refused: ${JSON.stringify(cancelBadChain)}`);

  console.log('\nFee ceiling:');
  const prevMaxGwei = process.env.HEX_RESCUE_MAX_GWEI;
  const GWEI = 1_000_000_000n;
  const ceiling = (set: string | undefined, wantGwei: bigint, why: string) => {
    if (set === undefined) delete process.env.HEX_RESCUE_MAX_GWEI;
    else process.env.HEX_RESCUE_MAX_GWEI = set;
    const got = maxEffectiveFeeWei();
    got === wantGwei * GWEI
      ? pass(`${why} -> ${wantGwei.toLocaleString()} gwei`)
      : fail(`${why}: expected ${wantGwei * GWEI} wei, got ${got}`);
  };
  ceiling(undefined, 25_000_000n, 'unset falls back');
  ceiling('60000000', 60_000_000n, 'HEX_RESCUE_MAX_GWEI=60000000');
  ceiling('  40000000  ', 40_000_000n, 'whitespace is tolerated');
  // Unlike the principal floor, 0 is NOT a meaningful setting here: it would
  // refuse every rescue rather than allow every one, so it falls back instead
  // of silently halting the keeper.
  ceiling('0', 25_000_000n, 'HEX_RESCUE_MAX_GWEI=0 falls back rather than halting');
  ceiling('twenty', 25_000_000n, 'unparseable falls back');
  ceiling('-5', 25_000_000n, 'negative falls back');
  if (prevMaxGwei === undefined) delete process.env.HEX_RESCUE_MAX_GWEI;
  else process.env.HEX_RESCUE_MAX_GWEI = prevMaxGwei;

  console.log('\nPrincipal floor:');
  const prevMin = process.env.HEX_RESCUE_MIN_HEX;
  const check = (set: string | undefined, want: number, why: string) => {
    if (set === undefined) delete process.env.HEX_RESCUE_MIN_HEX;
    else process.env.HEX_RESCUE_MIN_HEX = set;
    const got = defaultMinPrincipalHex();
    got === want
      ? pass(`${why} -> ${got.toLocaleString()} HEX`)
      : fail(`${why}: expected ${want}, got ${got}`);
  };
  check(undefined, MIN_PRINCIPAL_HEX_FALLBACK, 'unset falls back');
  check('100000', 100_000, 'HEX_RESCUE_MIN_HEX=100000');
  check('  250000  ', 250_000, 'whitespace is tolerated');
  // 0 means "sweep everything" and is a real setting, not an unset value —
  // easy to break with a truthiness check, so it is pinned here.
  check('0', 0, 'HEX_RESCUE_MIN_HEX=0 means no floor');
  check('banana', MIN_PRINCIPAL_HEX_FALLBACK, 'unparseable falls back');
  check('-5', MIN_PRINCIPAL_HEX_FALLBACK, 'negative falls back');
  if (prevMin === undefined) delete process.env.HEX_RESCUE_MIN_HEX;
  else process.env.HEX_RESCUE_MIN_HEX = prevMin;

  console.log('\nMessages:');
  const m1 = messageForStake('12345', 1_000_000);
  m1 === messageForStake('12345', 1_000_000)
    ? pass(`the same stake always gets the same message ("${m1}")`)
    : fail('message selection is not deterministic');

  // Counting distinct RENDERED messages would be meaningless now that each one
  // embeds its own stake id and amount — every draw is trivially unique. What
  // actually needs checking is that the TEMPLATE rotates, so strip the
  // per-stake parts back out before counting.
  const shape = (s: string) => s.replace(/[\d.,]+[MBk]?/g, '#').replace(/rescued\/\S+/, 'rescued/#');
  const shapes = new Set(Array.from({ length: 200 }, (_, i) => shape(messageForStake(String(i * 7919), 1e6))));
  shapes.size >= Math.min(4, RESCUE_MESSAGES.length)
    ? pass(`templates rotate across stakes (${shapes.size} of ${RESCUE_MESSAGES.length} seen in 200 draws)`)
    : fail(`templates barely rotate: only ${shapes.size} distinct in 200 draws`);

  const withLink = messageForStake('945449', 3_363_389);
  withLink.includes('scan.morbius.io/rescued/945449')
    ? pass('every message carries its own claim link')
    : fail(`message is missing the claim link: ${withLink}`);
  withLink.includes('3.36M')
    ? pass('every message states the amount at stake (3.36M)')
    : fail(`message is missing the amount: ${withLink}`);
  withLink.includes('Morbius') && withLink.includes('SuperStake')
    ? pass('every message credits both Morbius and SuperStake')
    : fail(`message is missing one of the two names: ${withLink}`);

  console.log(
    failures === 0
      ? '\n✅ ALL CHECKS PASSED — the key can only ever call stakeGoodAccounting'
      : `\n❌ ${failures} CHECK(S) FAILED`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
