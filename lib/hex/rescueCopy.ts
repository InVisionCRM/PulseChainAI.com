// Shared numbers and words for the rescue pages.
//
// Split out from the page components so the wall, the claim page and the
// portfolio card all describe a rescue the same way — and so the one piece of
// wording that really matters is written down once, with its reasoning:
//
// We never say we "gave" anyone HEX, or that we "recovered" it. We stopped a
// loss. The HEX was always theirs, it never moved, and the only thing that
// changed is that the clock stopped. Overstating that would be the fastest way
// to make a genuinely generous thing look like a scam.

export const HEX_CONTRACT = '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39';

/**
 * The HEX app the community actually uses, pinned on IPFS.
 *
 * This is the front door for ending a stake, not a fallback: it is where HEX
 * holders already go, it shows the stake list with real numbers, and ending is
 * a button rather than a hand-encoded contract call. Verified live — it answers
 * 200 and serves the HEX app.
 *
 * An IPFS URL rather than a domain on purpose. The content is addressed by its
 * own hash, so this exact build cannot be swapped out from under anyone, which
 * is the right property for a link we hand to someone who has just been told a
 * stranger touched their stake.
 */
export const HEX_APP_URL =
  'https://hex.mypinata.cloud/ipfs/bafybeigxypck6aqtgt2wrvt2kd4ixy3ipxr7lhaafvg3j3ucdu4w3vumbm/';

/**
 * Ending a stake, the way people actually do it.
 *
 * Deliberately no contract addresses, no stake index, no `stakeEnd` ABI. An
 * earlier version of this page walked through calling the contract by hand on
 * a block explorer, which is accurate and almost useless: the person reading it
 * has just learned a stranger touched their stake, and the last thing that
 * moment needs is an ABI. The app does all of it, and it is where the community
 * already goes.
 */
export const CLAIM_STEPS = [
  {
    title: 'Connect the wallet that owns the stake',
    body:
      'Only that wallet can end it — not us, not anyone else. That is exactly why we could stop the loss but could not finish it for you.',
  },
  {
    title: 'Find the stake and press End Stake',
    body:
      'It will be listed with the stake ID shown above. The app handles the rest; you just confirm the transaction in your wallet.',
  },
  {
    title: 'The HEX lands in your wallet',
    body:
      'The amount is already locked in and cannot shrink any further, however long you take to get to it.',
  },
] as const;

export const WHAT_HAPPENED = {
  short: 'Your stake finished its term and then started losing value. We stopped that. The HEX is still yours.',
  long:
    'A HEX stake that has served its full term stops earning, but it does not stop losing. Fourteen days after the end day, a late-end penalty begins and takes the whole stake at 1/700th per day — gone entirely after 700 days. The only way to stop it is for somebody to call stakeGoodAccounting on the stake, which freezes the payout and the penalty exactly where they are. Anyone is allowed to make that call for anyone, and it moves no money to whoever calls it. So we did it for you.',
  why:
    'Nothing was taken and nothing was given. Your HEX never moved, and it is still sitting in the contract under your address, waiting for you to end the stake whenever you like. The number below stopped falling on the day we made that call.',
} as const;
