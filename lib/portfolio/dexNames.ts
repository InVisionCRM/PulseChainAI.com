// Which DEX a position belongs to, from the factory that minted its pool.
//
// Position detection is deliberately archetype-based — it finds any Uniswap
// fork without a curated list — but a row that just says "V3 liquidity" tells
// the reader nothing about where their money is. The factory address is the one
// thing every pool reports, so it's what the name is keyed on.
//
// Every address below was verified on PulseChain rather than copied:
//   • 9mm V3      — `factory()` on the deepest 9mm V3 pool (0xe4baadcb…ae3e,
//                   taken from 9mm's own subgraph) returns 0xe50dbdc8…9c68.
//   • LibertySwap — `factory()` on a live liberty-swap pair returns
//                   0x796fcbdc…36a6, matching the LibertyV3Factory recorded in
//                   lib/dex/libertyswap.ts, where the quoter and router both
//                   report it as their factory.
//   • PulseX V1/V2 — `factory()` on the deepest pair of each subgraph.
//
// 9mm V2 is deliberately absent. Its subgraph answers `_meta` but holds no
// pairs, and every 9mm pool DexScreener lists across the tokens checked is
// labelled V3 — so there is no address to verify and nothing to attribute.
// An unknown factory returns undefined and the row keeps its generic label,
// which is the honest outcome for a fork nobody has named yet.

const FACTORIES: Record<string, string> = {
  // ── PulseChain ──────────────────────────────────────────────────────────
  '0x1715a3e4a142d8b698131108995174f37aeba10d': 'PulseX V1',
  '0x29ea7545def87022badc76323f373ea1e707c523': 'PulseX V2',
  '0xe50dbdc88e87a2c92984d794bcf3d1d76f619c68': '9mm V3',
  '0x796fcbdc956b85797efe21145aa97599b7fb36a6': 'LibertySwap',
};

/** The DEX behind a factory address, or undefined when it isn't one we know. */
export function dexForFactory(factory: string | null | undefined): string | undefined {
  if (!factory) return undefined;
  return FACTORIES[factory.toLowerCase()];
}

/** Registered factory addresses, lower-cased — handy for tests and lookups. */
export const KNOWN_FACTORIES = Object.keys(FACTORIES);
