// Known-address directory — vendored from Gumshoe (MIT licensed):
// https://github.com/LiquidLiberty/gumshoe  (src/lib/address-labels.ts)
// See ./LICENSE for the upstream MIT license.
//
// Adapted here: each entry carries a `category` so the activity feed can both
// label a counterparty (e.g. "Binance Hot Wallet 14") and flag notable
// interactions (exchange / LP locker / OFAC-sanctioned / burn). Most of these
// are Ethereum-mainnet addresses (exchanges, Tornado Cash) plus the PulseX
// routers/factories and WPLS for PulseChain. Extend freely as we curate more
// PulseChain-native labels.

export type AddressCategory =
  | 'burn'
  | 'locker'
  | 'router'
  | 'factory'
  | 'wrapped'
  | 'exchange'
  | 'ofac';

export interface KnownAddress {
  label: string;
  category: AddressCategory;
}

const KNOWN_ADDRESSES: Record<string, KnownAddress> = {
  // ── Burn / Dead ──────────────────────────────────────────────
  '0x0000000000000000000000000000000000000000': { label: 'Null Address (Burn)', category: 'burn' },
  '0x000000000000000000000000000000000000dead': { label: 'Dead Address (Burn)', category: 'burn' },
  '0x0000000000000000000000000000000000000001': { label: 'Ecrecover Precompile (Burn)', category: 'burn' },

  // ── LP Lockers ───────────────────────────────────────────────
  '0x71b5759d73262fbb223956913ecf4ecc51057641': { label: 'PinkLock V2', category: 'locker' },
  '0x407993575c91ce7643a4d4ccacc9a98c36f00486': { label: 'PinkLock V1', category: 'locker' },
  '0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214': { label: 'Unicrypt LP Locker', category: 'locker' },
  '0xe2fe530c047f2d85298b07d9333c05d6e0c8a4ab': { label: 'Team Finance Locker', category: 'locker' },
  '0xdead000000000000000000000000000000000000': { label: 'Team Finance V2 Locker', category: 'locker' },
  '0xc77aab3c6d7dab46248f3cc3033c856171878bd5': { label: 'Mudra Locker', category: 'locker' },

  // ── DEX Routers ──────────────────────────────────────────────
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': { label: 'Uniswap V2 Router', category: 'router' },
  '0xe592427a0aece92de3edee1f18e0157c05861564': { label: 'Uniswap V3 Router', category: 'router' },
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': { label: 'Uniswap Universal Router', category: 'router' },
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': { label: 'Uniswap V3 Router 02', category: 'router' },
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': { label: 'SushiSwap Router', category: 'router' },
  '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506': { label: 'SushiSwap Router (L2)', category: 'router' },
  '0x98bf93ebf5c380c0e6ae8e5159a8b0cf5b5c45f7': { label: 'PulseX V2 Router', category: 'router' },
  '0x165c3410fc91ef562c50559f7d2289febed552d9': { label: 'PulseX V1 Router', category: 'router' },

  // ── DEX Factories ────────────────────────────────────────────
  '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f': { label: 'Uniswap V2 Factory', category: 'factory' },
  '0x1f98431c8ad98523631ae4a59f267346ea31f984': { label: 'Uniswap V3 Factory', category: 'factory' },
  '0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac': { label: 'SushiSwap Factory', category: 'factory' },
  '0x1715a3e4a142d8b698131108995174f37aeba10d': { label: 'PulseX V1 Factory', category: 'factory' },
  '0x29ea7545def87022badc76323f373ea1e707c523': { label: 'PulseX V2 Factory', category: 'factory' },

  // ── Wrapped Native Tokens ────────────────────────────────────
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { label: 'WETH (Ethereum)', category: 'wrapped' },
  '0xa1077a294dde1b09bb078844df40758a5d0f9a27': { label: 'WPLS (PulseChain)', category: 'wrapped' },
  '0x4200000000000000000000000000000000000006': { label: 'WETH (Base/OP Stack)', category: 'wrapped' },
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { label: 'WETH (Arbitrum)', category: 'wrapped' },

  // ── Exchanges ────────────────────────────────────────────────
  '0x28c6c06298d514db089934071355e5743bf21d60': { label: 'Binance Hot Wallet 14', category: 'exchange' },
  '0x21a31ee1afc51d94c2efccaa2043aad6a940a8d5': { label: 'Binance Hot Wallet 15', category: 'exchange' },
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': { label: 'Binance Hot Wallet 16', category: 'exchange' },
  '0xf977814e90da44bfa03b6295a0616a897441acec': { label: 'Binance 8', category: 'exchange' },
  '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be': { label: 'Binance 1', category: 'exchange' },
  '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8': { label: 'Binance 7', category: 'exchange' },
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': { label: 'Coinbase Commerce', category: 'exchange' },
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': { label: 'Coinbase 1', category: 'exchange' },
  '0x503828976d22510aad0201ac7ec88293211d23da': { label: 'Coinbase 2', category: 'exchange' },
  '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740': { label: 'Coinbase 3', category: 'exchange' },
  '0x3cd751e6b0078be393132286c442345e68a2c348': { label: 'Coinbase 4', category: 'exchange' },
  '0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511': { label: 'Coinbase 5', category: 'exchange' },
  '0xeb2629a2734e272bcc07bda959863f316f4bd4cf': { label: 'Coinbase 6', category: 'exchange' },
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2': { label: 'Kraken 1', category: 'exchange' },
  '0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13': { label: 'Kraken 2', category: 'exchange' },
  '0xe853c56864a2ebe4576a807d26fdc4a0ada51919': { label: 'Kraken 3', category: 'exchange' },
  '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0': { label: 'Kraken 4', category: 'exchange' },
  '0xfa52274dd61e1643d2205169732f29114bc240b3': { label: 'Kraken 5', category: 'exchange' },
  '0x2b5634c42055806a59e9107ed44d43c426e58258': { label: 'KuCoin 1', category: 'exchange' },
  '0x689c56aef474df92d44a1b70850f808488f9769c': { label: 'KuCoin 2', category: 'exchange' },
  '0xd6216fc19db775df9774a6e33526131da7d19a2c': { label: 'KuCoin 3', category: 'exchange' },
  '0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23': { label: 'Gate.io 1', category: 'exchange' },
  '0xd793281b45cebbef951517d210c92f0025890950': { label: 'Gate.io 2', category: 'exchange' },
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe': { label: 'Gate.io 3', category: 'exchange' },
  '0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98': { label: 'Bittrex 1', category: 'exchange' },
  '0xe94b5eec1fa96ceecbd33ef5baa8d00e4493f4f3': { label: 'Bittrex 2', category: 'exchange' },

  // ── OFAC Sanctioned ──────────────────────────────────────────
  '0x8589427373d6d84e98730d7795d8f6f8731fda16': { label: 'OFAC: Tornado Cash Router', category: 'ofac' },
  '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b': { label: 'OFAC: Tornado Cash Proxy', category: 'ofac' },
  '0x722122df12d4e14e13ac3b6895a86e84145b6967': { label: 'OFAC: Tornado Cash', category: 'ofac' },
  '0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3': { label: 'OFAC: Tornado Cash 100 ETH', category: 'ofac' },
  '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf': { label: 'OFAC: Tornado Cash Governance', category: 'ofac' },
  '0xa160cdab225685da1d56aa342ad8841c3b53f291': { label: 'OFAC: Tornado Cash Mining', category: 'ofac' },
  '0x23773e65ed146a459791799d01336db287f25334': { label: 'OFAC: Lazarus Group', category: 'ofac' },
  '0x098b716b8aaf21512996dc57eb0615e2383e2f96': { label: 'OFAC: Ronin Bridge Exploiter', category: 'ofac' },
};

/** Structured lookup (label + category) for a known address, or null. */
export function getKnownAddress(
  address: string | null | undefined,
): KnownAddress | null {
  if (!address) return null;
  return KNOWN_ADDRESSES[address.toLowerCase()] ?? null;
}

/** Human-readable label for a known address, or null when unknown. */
export function getKnownAddressLabel(
  address: string | null | undefined,
): string | null {
  return getKnownAddress(address)?.label ?? null;
}
