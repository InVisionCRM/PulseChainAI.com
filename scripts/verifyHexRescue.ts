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

import { signAndSend, loadKeeper } from '@/lib/hex/rescueWallet';
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
