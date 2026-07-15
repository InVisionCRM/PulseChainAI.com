// Robinhood Chain launchpads + the shared contracts they build on.
//
// Every `verified: true` address below was confirmed to have deployed bytecode
// on Robinhood Chain mainnet (chain id 4663) via `eth_getCode` — see
// `scripts/verifyRobinhoodChain.ts`, which re-checks them. `pending` pads are
// live products that have not published canonical addresses we could verify, so
// they're listed for completeness but carry no wired-up factory.

import type { Launchpad } from './types';

// ── Shared DEX infrastructure ────────────────────────────────────────────────
// bow.fun, LaunchHood and NOXA all migrate/launch into the SAME canonical
// Uniswap V3 deployment on Robinhood Chain, so these are shared across pads.
export const ROBINHOOD_UNISWAP_V3 = {
  swapRouter02: '0xCaf681a66D020601342297493863E78C959E5cb2',
  factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
  positionManager: '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3',
} as const;

// Uniswap V4 singleton stack (used by Bags-style pads; kept for reference).
export const ROBINHOOD_UNISWAP_V4 = {
  poolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
  positionManager: '0x58daec3116aae6D93017bAAea7749052E8a04fA7',
  universalRouter: '0x8876789976dEcBfCbBbe364623C63652db8C0904',
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
} as const;

export const ROBINHOOD_MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';

// ── Key tokens ───────────────────────────────────────────────────────────────
// Canonical addresses to pull relevant on-chain info. WETH is the quote asset
// for launchpad pools; USDG is the chain's stablecoin. Stock/ETF tokens are the
// Robinhood-issued tokenized equities — a token with a matching ticker but a
// different address is NOT the canonical Robinhood stock token.
export const ROBINHOOD_TOKENS = {
  WETH: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73', // aeWETH proxy
  USDG: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
  // Tokenized stocks
  AAPL: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
  AMD: '0x86923f96303D656E4aa86D9d42D1e57ad2023fdC',
  AMZN: '0x12f190a9F9d7D37a250758b26824B97CE941bF54',
  BABA: '0xad25Ac6C84D497db898fa1E8387bf6Af3532a1c4',
  COIN: '0x6330D8C3178a418788dF01a47479c0ce7CCF450b',
  GOOGL: '0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3',
  META: '0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35',
  MSFT: '0xe93237C50D904957Cf27E7B1133b510C669c2e74',
  NVDA: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
  PLTR: '0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A',
  TSLA: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
  // Tokenized ETFs
  QQQ: '0xD5f3879160bc7c32ebb4dC785F8a4F505888de68',
  SPY: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C',
  SGOV: '0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5',
  SLV: '0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f',
} as const;

// ── Launchpads ───────────────────────────────────────────────────────────────
export const ROBINHOOD_LAUNCHPADS: Launchpad[] = [
  {
    id: 'bow-fun',
    name: 'bow.fun',
    chain: 'robinhood',
    url: 'https://bow.fun',
    status: 'active',
    dexVersion: 'uniswap-v3',
    description:
      'Fair-launch pad: deploys the token via CREATE2, creates & prices a ' +
      'Uniswap V3 pool, mints a single-sided position locked forever, with an ' +
      'optional dev buy — all in one transaction.',
    factory: '0xC70E510E14710Ea535CAB7b2414860aF63FEab79',
    contracts: [
      {
        label: 'LaunchFactory',
        address: '0xC70E510E14710Ea535CAB7b2414860aF63FEab79',
        role: 'factory',
        verified: true,
      },
      {
        label: 'Locker',
        address: '0x904dCCB96d877E6db365282251Fa3dD156476660',
        role: 'locker',
        verified: true,
      },
      {
        label: 'BowZap',
        address: '0xCCA95E5442BbF175d8a1Ad136Be317fA6D55CC38',
        role: 'zap',
        verified: true,
      },
    ],
    notes:
      "bow.fun's factory contract is named `LaunchFactory` on-chain — it is the " +
      'same entry point, not a separate pad.',
  },
  {
    id: 'launchhood',
    name: 'LaunchHood',
    chain: 'robinhood',
    url: 'https://launchhood.com',
    status: 'active',
    dexVersion: 'uniswap-v3',
    description:
      'Memecoin pad using Uniswap V3 concentrated liquidity directly (no ' +
      'bonding curve or migrator): the entire supply is locked permanently in a ' +
      'single pool at launch.',
    factory: '0x62B33A039D289CBDa50EbeB72Fe4261449E61Bcf',
    contracts: [
      {
        label: 'Factory',
        address: '0x62B33A039D289CBDa50EbeB72Fe4261449E61Bcf',
        role: 'factory',
        verified: true,
      },
      {
        label: 'Liquidity Locker',
        address: '0x99B79154Ff4Fc0e313549B809254B02722631ee0',
        role: 'locker',
        verified: true,
      },
      {
        label: 'Token (impl)',
        address: '0x5FDf73abC7A232d91b03638c2f9a52c16aB0E3bE',
        role: 'token-impl',
        verified: true,
      },
    ],
  },
  {
    id: 'noxa',
    name: 'NOXA',
    chain: 'robinhood',
    url: 'https://fun.noxa.fi/robinhood',
    status: 'active',
    dexVersion: 'uniswap-v3',
    description:
      'Hybrid pad: on launch a new ERC-20 is deployed, single-sided liquidity ' +
      'is added to a Uniswap V3 1% pool and the position is locked permanently ' +
      'in a locker that never migrates.',
    factory: '0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB',
    contracts: [
      {
        label: 'Launch Factory',
        address: '0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB',
        role: 'factory',
        verified: true,
      },
      {
        label: 'Launch Locker',
        address: '0x7F03effbd7ceB22A3f80Dd468f67eF27826acD85',
        role: 'locker',
        verified: true,
      },
      {
        label: 'Fee Vault',
        address: '0x9eFdC1A8e6E94f16A228e44f3025E1f346EE0417',
        role: 'fee-vault',
        verified: true,
      },
    ],
    notes: "NOXA's contracts are unverified (no published source) on Blockscout.",
  },
  {
    id: 'robinpad',
    name: 'RobinPad',
    chain: 'robinhood',
    url: 'https://www.robinpad.xyz',
    status: 'pending',
    dexVersion: 'unknown',
    description:
      'AI-agent launchpad: tokenize an AI agent on a bonding curve; it ' +
      'graduates from Prototype to Sentient and migrates to a liquidity pool ' +
      'once the curve fills.',
    factory: null,
    contracts: [],
    notes:
      'Live product, but no canonical factory address is published yet — resolve ' +
      'from the explorer before enabling reads.',
  },
  {
    id: 'pons-family',
    name: 'pons.family',
    chain: 'robinhood',
    url: 'https://pons.family',
    status: 'pending',
    dexVersion: 'unknown',
    description: 'Token-launch platform for Robinhood Chain.',
    factory: null,
    contracts: [],
    notes: 'No public contract addresses published yet; site gated at fetch time.',
  },
  {
    id: 'ape-store',
    name: 'ApeStore',
    chain: 'robinhood',
    url: 'https://ape.store',
    status: 'pending',
    dexVersion: 'unknown',
    description:
      'Multi-chain fair launchpad ("launch for gas, auto-list on Uniswap at ' +
      '69K mcap, LP burned").',
    factory: null,
    contracts: [],
    notes:
      'ApeStore is primarily deployed on Base; a canonical Robinhood Chain ' +
      'deployment was not confirmed at registry time.',
  },
  {
    id: 'baloonpad',
    name: 'baloonpad',
    chain: 'robinhood',
    url: 'https://balloon.club',
    status: 'pending',
    dexVersion: 'unknown',
    description: 'Robinhood Chain launchpad in development by the printworld team.',
    factory: null,
    contracts: [],
    notes: 'Announced but not launched at registry time — no contracts deployed.',
  },
];
