// LibertySwap on PulseChain — a Uniswap-V3 fork (the Peacock/PCOCK ecosystem
// DEX) plus a separate USDC bridge API. Addresses supplied by the owner and
// then verified on chain before being written down here:
//
//   • `eth_getCode` returns bytecode for all five addresses on PulseChain.
//   • `QuoterV2.factory()` and `SwapRouter.factory()` both return
//     `LIBERTY_FACTORY`, so the three DEX contracts are one deployment.
//   • `QuoterV2.WETH9()` returns WPLS (`0xa1077a…`) — this is the PulseChain
//     deployment, not a copy pointing at another chain.
//   • Blockscout has the factory verified under the name `LibertyV3Factory`.
//   • `feeAmountTickSpacing` is non-zero for exactly the four tiers below
//     (1 / 10 / 50 / 200 tick spacing); every other Uniswap tier is disabled.

export const LIBERTY_FACTORY = '0x796fcbDC956b85797EFe21145Aa97599B7FB36a6';
export const LIBERTY_SWAP_ROUTER = '0x48e8100374ae6Ff2Cc8871Db6224B296718EeB0d';
export const LIBERTY_QUOTER_V2 = '0xdB368A7f9eDF3EF73e7ceDA97bC67ECF84E39D95';

/** The only fee tiers the factory enables. Anything else has no pools. */
export const LIBERTY_FEE_TIERS = [100, 500, 2500, 10000] as const;

/**
 * Routing hubs, in the order LibertySwap actually uses them — WPLS appears in
 * 175 of the factory's 430 pools, USDC in 66, PCOCK in 55. A token with no
 * pool against any of these has no route we can price in USD.
 */
export const LIBERTY_HUBS = [
  { address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', symbol: 'WPLS', decimals: 18 },
  { address: '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', symbol: 'USDC', decimals: 6 },
  { address: '0xc10a4ed9b4042222d69ff0b374eddd47ed90fc1f', symbol: 'PCOCK', decimals: 18 },
] as const;

export const LIBERTY_BRIDGE_QUOTE_URL = 'https://apis.libertyswap.finance/swap/v1/quote';

/**
 * The routers LibertySwap publishes as official, keyed by chain id.
 *
 * Their docs list only the PulseChain side, which is the side that matters
 * here: those are the contracts a PulseChain user would ever be asked to sign
 * against. Quotes *into* PulseChain return a router on the source chain, and
 * those addresses are deliberately not treated as whitelisted — an address
 * that isn't on the published list is reported as unlisted rather than
 * silently accepted.
 *
 * This app only ever displays bridge quotes. `methodParameters` (the signable
 * calldata) is stripped server-side and never reaches the browser, so nothing
 * the API returns can be signed from here even if the API were compromised.
 */
export const LIBERTY_OFFICIAL_ROUTERS: Record<number, Record<string, string>> = {
  369: {
    USDC: '0xe7EE706a6708b691a232452c9cb267d186942F09',
    WETH: '0x80C2C603d72ea17A0D85B670D4489eB3012035Cd',
  },
};

export function isOfficialLibertyRouter(chainId: number, address: string): boolean {
  const chain = LIBERTY_OFFICIAL_ROUTERS[chainId];
  if (!chain) return false;
  const a = address.toLowerCase();
  return Object.values(chain).some((r) => r.toLowerCase() === a);
}

/**
 * The bridge corridor this app offers: PulseChain ↔ Ethereum, USDC only.
 *
 * The API also answers for Base, Arbitrum, Polygon and BNB Chain, all of them
 * likewise USDC-only with PulseChain on one leg. Those are deliberately not
 * exposed — this app is a PulseChain and Ethereum tool, and a chain picker
 * full of networks it shows no other data for would be noise.
 *
 * Every non-USDC asset and every same-chain route returned "Unsupported swap
 * pair" when probed, including the WETH corridor their own router list implies.
 *
 * `usdcDecimals` is confirmed from the API's own `srcToken` reply rather than
 * assumed — the wrong scale just trips its min/max guard.
 */
export const LIBERTY_BRIDGE_CHAINS = [
  { id: 1, name: 'Ethereum', usdcDecimals: 6 },
] as const;

export const PULSECHAIN_ID = 369;

/** Per-asset limits the API enforces, quoted back verbatim in its errors. */
export const LIBERTY_BRIDGE_MIN_UNITS = 10;
export const LIBERTY_BRIDGE_MAX_UNITS = 25_000;
