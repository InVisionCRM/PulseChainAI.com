// PulseX router/factory addresses, verified on chain before being written down.
//
//   • v2 router `0x165C…52D9` — 17.6M transactions; `factory()` returns
//     PULSEX_FACTORY_V2, which Blockscout has verified as `PulseXFactory`.
//   • v1 router `0x98bf…cc02` — 7.2M transactions; `factory()` returns
//     PULSEX_FACTORY_V1, likewise verified as `PulseXFactory`.
//
// A near-duplicate router at `0xaf5e33cb31A3454C950bee39ed1C76fd65b394cf`
// points at the v1 factory but has only ~91 transactions. It is deliberately
// absent: quoting through a router nobody uses tells you nothing.
//
// v1 and v2 are separate deployments with separate pairs, and a token can live
// in one and not the other — WPLS/pSSH exists on v2 and reverts on v1. Both
// have to be probed; neither can stand in for the other.
//
// NOTE: `lib/gumshoe/address-labels.ts` labels the v2 router as "PulseX V1
// Router". That mislabel predates this file and is left alone here rather than
// fixed as a drive-by.

export const PULSEX_ROUTER_V2 = '0x165C3410fC91EF562C50559f7d2289fEbed552d9';
export const PULSEX_ROUTER_V1 = '0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02';
export const PULSEX_FACTORY_V2 = '0x29eA7545DEf87022BAdc76323F373EA1e707C523';
export const PULSEX_FACTORY_V1 = '0x1715a3E4A142d8b698131108995174F37aEBA10D';

export const PULSEX_VERSIONS = [
  { version: 'v2' as const, router: PULSEX_ROUTER_V2, factory: PULSEX_FACTORY_V2 },
  { version: 'v1' as const, router: PULSEX_ROUTER_V1, factory: PULSEX_FACTORY_V1 },
];

export const WPLS = '0xa1077a294dde1b09bb078844df40758a5d0f9a27';

/**
 * The tokens a route can start from, i.e. the ones we can put a USD price on.
 * Each was checked for real WPLS-side depth on both versions before being
 * listed — the thinnest here still holds billions of WPLS.
 *
 * Note the addresses: PulseChain carries both the forked Ethereum contract and
 * a bridged copy for the stables, and they are *not* interchangeable. The fork
 * DAI (`0x6b17…`) and the bridged USDC (`0x15D3…`) are the deep ones; the
 * bridged DAI and forked USDC are an order of magnitude thinner on the side
 * that matters. Picking the wrong twin would quote a shallow pool as the venue.
 */
export const PULSEX_PRICED_HUBS = [
  { address: WPLS, symbol: 'WPLS', decimals: 18 },
  { address: '0x6b175474e89094c44da98b954eedeac495271d0f', symbol: 'DAI', decimals: 18 },
  { address: '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', symbol: 'USDC', decimals: 6 },
] as const;

export const PLSX = '0x95b303987a60c71504d99aa1b13b4da07b0790ab';
export const PULSECHAIN_HEX = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';

/**
 * Candidate routes from a priced hub to the token, as PulseX's own interface
 * would search them. The first element is the hub the trade is priced from;
 * anything after it is an intermediary hop.
 *
 * The two-hop entries matter more than they look: plenty of PulseChain tokens
 * never got a WPLS pair and only trade against PLSX or HEX, and a direct-only
 * quoter would report those as having no market at all.
 */
export const PULSEX_ROUTE_PREFIXES: readonly (readonly string[])[] = [
  [WPLS],
  ['0x6b175474e89094c44da98b954eedeac495271d0f'],
  ['0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07'],
  [WPLS, PLSX],
  [WPLS, PULSECHAIN_HEX],
];
