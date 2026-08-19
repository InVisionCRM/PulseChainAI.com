# HEX stake rescue

Freezes HEX stakes that are bleeding out. This is a gift to strangers, not a
feature — nobody has to sign up, and nothing here can take anyone's HEX.

## What the problem is

A HEX stake that has served its full term stops earning. It does **not** stop
losing. Fourteen days after its end day the late-end penalty starts and takes
the whole thing at 1/700th per day:

```
penalty = grossReturn * daysPastGrace / 700
```

So a stake nobody ends is fully consumed in 700 days past grace. People forget,
lose keys, and die.

Measured on PulseChain, of the stakes that matured in the ~400 days before this
was written:

| | |
|---|---|
| ended by the staker | 76.2% |
| already good-accounted by someone | 7.9% |
| **still bleeding** | **17.8%** |

That last group held **15.0M HEX**, had already burned **7.5M HEX**, and was
losing **~21,400 HEX/day**. (Sampled against a paging cap, so those are floors.)

## Why a stranger can fix it

Two functions, deliberately different:

```solidity
stakeGoodAccounting(address stakerAddr, uint256 stakeIndex, uint40 stakeId)  // anyone
stakeEnd(uint256 stakeIndex, uint40 stakeId)                                  // owner only
```

`stakeGoodAccounting` takes the staker's **address** and has no caller check, so
anyone may call it for anyone. It *freezes* the payout and penalty as of that
day — the stake stops bleeding immediately.

`stakeEnd` reads `stakeLists[msg.sender]` and does `_mint(msg.sender, ...)`, so
only the owner can end a stake and the proceeds go to whoever calls it. That is
why this job can stop the bleeding but can never finish the job: the HEX stays
the staker's, collectable whenever they end the stake themselves.

## Why the hot key is safe

`stakeGoodAccounting` pays its caller **nothing** — it emits an event, folds the
penalty into the global pool, and updates the stake. No transfer, no mint, no
approval. The worst anyone can do with a leaked keeper key is spend its gas
doing strangers a favour.

That only holds while the key can make *only* that call, so `lib/hex/rescueWallet.ts`
refuses to sign anything else: wrong destination, wrong selector, non-zero
value, or gas over a ceiling. Those guards are the security boundary, and
`npm run verify:hex-rescue` proves they hold — it tries to sign `transfer()`,
`approve()`, `stakeEnd()` and a drain to an attacker address, and every one must
be refused before signing.

**Still: fund it with a small float — $20 or so of PLS — and top it up. It is a
hot key on a server. Treat it as spendable, never as storage.**

## Setup

1. **Make a fresh wallet.** A brand new one, used for nothing else, holding
   nothing but PLS for gas. Never reuse a wallet that holds funds.
2. **Fund it with PLS.** A good-accounting call costs roughly 250–600k gas
   (~$0.003–0.007 at the time of writing). $20 covers thousands.
3. **Set the environment variables** in Vercel:

   ```
   HEX_RESCUE_PRIVATE_KEY=0x<the new wallet's 64-hex-char private key>
   CRON_SECRET=<already used by the other cron routes>
   ```

   Without `HEX_RESCUE_PRIVATE_KEY` everything still runs — as a **dry run** that
   reports what it would have done. That is deliberate: it is safe to deploy
   before the key exists.

## Running it

```bash
npm run verify:hex-rescue          # prove the key can't do anything else
npm run hex:rescue                 # DRY RUN — prints exactly what it would do
npm run hex:rescue -- --execute    # actually send
npm run hex:rescue -- --execute --limit 200   # clear the backlog
npm run hex:rescue -- --min-days 30           # only stakes 30+ days past grace
```

Dry run is the default and `--execute` is the only way past it. Watch a full
day's worth of output before letting it sign anything.

The daily cron (`/api/cron/hex-rescue`, 03:00 UTC, in `vercel.json`) takes a
bounded bite — at most 20 stakes or 45 seconds — because a serverless
invocation has a wall clock. About 23 stakes a day go past grace, so the steady
state fits easily. Clear the initial backlog from a terminal instead, where
there is no time limit.

## Two things that will bite whoever edits this

**Stake indexes move.** `stakeGoodAccounting` needs the stake's *index* in the
staker's array, which is not in the subgraph and is not stable: `_stakeRemove`
is swap-and-pop, so ending any stake in a wallet moves that wallet's last stake
into the freed slot. The index must be resolved on chain immediately before the
call and can never be cached. The contract does guard it —
`require(stakeIdParam == stRef.stakeId)` — so a stale index reverts instead of
good-accounting the wrong stake.

**Gas scales with the stake's term, not its size,** because the payout is summed
across the stake's daily data. Measured at ~2,900–3,300 gas per staked day:
449k gas for a 135-day stake, 6.75M for a 2,400-day one. Batch by gas, not by
count — the longest possible stake (5,555 days) approaches 18M gas against
PulseChain's ~45M block limit.

## The messages

Each transaction carries a short note in its calldata, visible in the explorer's
input data. Solidity ignores trailing bytes after a call's arguments, so it rides
along harmlessly — measured at ~19 gas a byte, about a hundred-thousandth of a
cent.

They are in `RESCUE_MESSAGES` in `lib/hex/rescue.ts`, chosen deterministically
per stake so a retry carries the same note. Keep them friendly. Whoever reads
one forgot about a stake, lost a key, or died — the joke is on the situation,
never on them.
