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

/** Where a rescued staker actually ends their stake. */
export const CLAIM_STEPS = [
  {
    title: 'Connect the wallet that owns the stake',
    body:
      'Only that wallet can end it. Nobody else can — not us, not anyone. That is why we could stop the loss but could not finish the job for you.',
  },
  {
    title: 'Open the HEX contract on the explorer',
    body:
      'Go to the Write Contract tab. HEX has no app of its own that survives; the contract is the source of truth and always works.',
  },
  {
    title: 'Call stakeEnd with your stake index and stake ID',
    body:
      'The index is the stake’s position in your own stake list, which changes as stakes end, so read it fresh. The stake ID is fixed and is shown above.',
  },
  {
    title: 'The HEX arrives in your wallet',
    body:
      'The amount is already locked in and cannot shrink further, no matter how long you take from here.',
  },
] as const;

export const WHAT_HAPPENED = {
  short: 'Your stake finished its term and then started losing value. We stopped that. The HEX is still yours.',
  long:
    'A HEX stake that has served its full term stops earning, but it does not stop losing. Fourteen days after the end day, a late-end penalty begins and takes the whole stake at 1/700th per day — gone entirely after 700 days. The only way to stop it is for somebody to call stakeGoodAccounting on the stake, which freezes the payout and the penalty exactly where they are. Anyone is allowed to make that call for anyone, and it moves no money to whoever calls it. So we did it for you.',
  why:
    'Nothing was taken and nothing was given. Your HEX never moved, and it is still sitting in the contract under your address, waiting for you to end the stake whenever you like. The number below stopped falling on the day we made that call.',
} as const;
