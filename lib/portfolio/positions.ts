// Generic DeFi position detection — no per-protocol address list required.
//
// PulseChain DeFi is almost entirely forks of standard protocols, so we detect
// positions by *archetype* from on-chain reads rather than a curated map:
//   • Uniswap-V2 LP        token0()/token1()/getReserves()/totalSupply()
//   • ERC-4626 vault       asset()/convertToAssets(shares)
//   • Compound cToken      underlying()/exchangeRateStored()
//   • Aave aToken          UNDERLYING_ASSET_ADDRESS()  (1:1 with underlying)
// Each held token is probed cheaply; whatever responds tells us what it is.
// Custodial farms (MasterChef) live in protocolRegistry.ts — they custody your
// deposit, so they can't be found from wallet balances.

import { ethCall } from './evmRpc';
import type { ChainId } from '@/services';

// ── ABI selectors ───────────────────────────────────────────────────────────
const SEL = {
  decimals: '0x313ce567',
  symbol: '0x95d89b41',
  totalSupply: '0x18160ddd',
  balanceOf: '0x70a08231',
  // Uniswap V2 pair
  token0: '0x0dfe1681',
  token1: '0xd21220a7',
  getReserves: '0x0902f1ac',
  // ERC-4626
  asset: '0x38d52e0f',
  convertToAssets: '0x07a2d13a',
  // Compound cToken
  cUnderlying: '0x6f307dc3',
  exchangeRateStored: '0x182df0f5',
  // Aave aToken / debt token
  aUnderlying: '0xb16a19de',
} as const;

const pad = (hex: string) => hex.replace(/^0x/, '').padStart(64, '0');
const encUint = (n: bigint) => pad(n.toString(16));
const callData = (sel: string, ...args: string[]) => sel + args.map(pad).join('');

const toBig = (hex: string | null): bigint => {
  if (!hex || hex === '0x') return 0n;
  try { return BigInt(hex.length > 66 ? hex.slice(0, 66) : hex); } catch { return 0n; }
};
const toAddr = (hex: string | null): string | null => {
  if (!hex || hex.length < 66) return null;
  return '0x' + hex.slice(hex.length - 40);
};
const toInt = (hex: string | null): number => Number(toBig(hex));

export type PositionKind = 'lp' | 'vault' | 'lending' | 'farm' | 'staking';

export interface UnderlyingAsset {
  address: string;
  symbol: string;
  decimals: number;
  amount: number; // human units
  valueUsd?: number;
}
export interface ProtocolPosition {
  kind: PositionKind;
  /** The token held / position contract. */
  address: string;
  symbol: string;
  /** Best-effort protocol name (from the receipt token's symbol prefix). */
  protocol?: string;
  underlying: UnderlyingAsset[];
  valueUsd?: number;
  /** Extra label, e.g. "Supplied", "Staked LP". */
  note?: string;
}

const fmt = (raw: bigint, decimals: number) => Number(raw) / 10 ** decimals;

async function erc20Meta(chain: ChainId, token: string): Promise<{ symbol: string; decimals: number }> {
  const [symHex, decHex] = await Promise.all([
    ethCall(chain, token, SEL.symbol),
    ethCall(chain, token, SEL.decimals),
  ]);
  return { symbol: decodeSymbol(symHex) || '???', decimals: toInt(decHex) || 18 };
}

// Symbols are returned either as a 32-byte right-padded string (old style) or
// an ABI-encoded dynamic string. Handle both.
function decodeSymbol(hex: string | null): string | null {
  if (!hex || hex === '0x') return null;
  const body = hex.replace(/^0x/, '');
  try {
    if (body.length === 64) {
      const bytes = body.replace(/0+$/, '');
      return hexToUtf8(bytes);
    }
    // dynamic: [offset][length][data]
    const len = parseInt(body.slice(64, 128), 16);
    return hexToUtf8(body.slice(128, 128 + len * 2));
  } catch {
    return null;
  }
}
function hexToUtf8(h: string): string {
  let s = '';
  for (let i = 0; i + 1 < h.length; i += 2) {
    const c = parseInt(h.slice(i, i + 2), 16);
    if (c > 0) s += String.fromCharCode(c);
  }
  return s.replace(/[^\x20-\x7E]/g, '').trim();
}

/**
 * Probe a single held token and, if it's a recognised position archetype,
 * return the decoded position with underlying amounts (USD filled in later).
 * `balanceRaw` is the wallet's balance of `token`; `decimals` its decimals.
 */
export async function detectHeldPosition(
  chain: ChainId,
  token: string,
  balanceRaw: bigint,
  decimals: number,
  symbol: string,
): Promise<ProtocolPosition | null> {
  if (balanceRaw <= 0n) return null;

  // 1) Uniswap-V2 LP — has token0 + getReserves.
  const [t0, reservesHex] = await Promise.all([
    ethCall(chain, token, SEL.token0),
    ethCall(chain, token, SEL.getReserves),
  ]);
  const token0 = toAddr(t0);
  if (token0 && reservesHex && reservesHex !== '0x') {
    const t1 = toAddr(await ethCall(chain, token, SEL.token1));
    const tsHex = await ethCall(chain, token, SEL.totalSupply);
    const totalSupply = toBig(tsHex);
    if (t1 && totalSupply > 0n) {
      const body = reservesHex.replace(/^0x/, '');
      const r0 = BigInt('0x' + body.slice(0, 64));
      const r1 = BigInt('0x' + body.slice(64, 128));
      const share = Number(balanceRaw) / Number(totalSupply);
      const [m0, m1] = await Promise.all([erc20Meta(chain, token0), erc20Meta(chain, t1)]);
      return {
        kind: 'lp',
        address: token,
        symbol,
        protocol: protocolFromSymbol(symbol),
        note: 'Liquidity',
        underlying: [
          { address: token0, symbol: m0.symbol, decimals: m0.decimals, amount: fmt(r0, m0.decimals) * share },
          { address: t1, symbol: m1.symbol, decimals: m1.decimals, amount: fmt(r1, m1.decimals) * share },
        ],
      };
    }
  }

  // 2) ERC-4626 vault — asset() + convertToAssets.
  const assetHex = await ethCall(chain, token, SEL.asset);
  const asset = toAddr(assetHex);
  if (asset) {
    const assetsHex = await ethCall(chain, token, callData(SEL.convertToAssets, encUint(balanceRaw)));
    const assets = toBig(assetsHex);
    if (assets > 0n) {
      const m = await erc20Meta(chain, asset);
      return {
        kind: 'vault',
        address: token,
        symbol,
        protocol: protocolFromSymbol(symbol),
        note: 'Vault deposit',
        underlying: [{ address: asset, symbol: m.symbol, decimals: m.decimals, amount: fmt(assets, m.decimals) }],
      };
    }
  }

  // 3) Compound cToken — underlying() + exchangeRateStored().
  const cuHex = await ethCall(chain, token, SEL.cUnderlying);
  const cu = toAddr(cuHex);
  if (cu) {
    const rateHex = await ethCall(chain, token, SEL.exchangeRateStored);
    const rate = toBig(rateHex); // scaled 1e(18 + underlyingDec - cTokenDec)
    if (rate > 0n) {
      const m = await erc20Meta(chain, cu);
      // Compound: underlying = cTokenBalance * rate / 1e18 (rate already accounts for decimals).
      const underlyingRaw = (balanceRaw * rate) / 10n ** 18n;
      return {
        kind: 'lending',
        address: token,
        symbol,
        protocol: protocolFromSymbol(symbol),
        note: 'Supplied',
        underlying: [{ address: cu, symbol: m.symbol, decimals: m.decimals, amount: fmt(underlyingRaw, m.decimals) }],
      };
    }
  }

  // 4) Aave aToken / debt token — UNDERLYING_ASSET_ADDRESS(), 1:1.
  const auHex = await ethCall(chain, token, SEL.aUnderlying);
  const au = toAddr(auHex);
  if (au) {
    const m = await erc20Meta(chain, au);
    const isDebt = /debt|variableDebt|stableDebt/i.test(symbol);
    return {
      kind: 'lending',
      address: token,
      symbol,
      protocol: protocolFromSymbol(symbol),
      note: isDebt ? 'Borrowed' : 'Supplied',
      underlying: [{ address: au, symbol: m.symbol, decimals: m.decimals, amount: fmt(balanceRaw, decimals) }],
    };
  }

  return null;
}

// Receipt tokens usually prefix the protocol, e.g. "phHEX" (Phiat), "imHEX"
// (IMPLS), "PLP" (PulseX LP). Best-effort, purely cosmetic.
function protocolFromSymbol(symbol: string): string | undefined {
  const s = symbol.toLowerCase();
  if (s.includes('plp') || s.includes('pulsex')) return 'PulseX';
  if (s.startsWith('ph')) return 'Phiat';
  if (s.startsWith('im')) return 'IMPLS';
  if (s.startsWith('phux') || s.includes('bpt')) return 'PHUX';
  if (s.startsWith('9mm') || s.includes('9inch')) return '9inch';
  return undefined;
}

/**
 * Decompose an amount of a Uniswap-V2 LP token into its underlying assets.
 * Used for both wallet-held LP and LP custodied in a farm. Returns null if the
 * token isn't a V2 pair.
 */
export async function decomposeV2(
  chain: ChainId,
  lpToken: string,
  amountRaw: bigint,
  symbol?: string,
): Promise<{ symbol: string; underlying: UnderlyingAsset[] } | null> {
  const [t0, reservesHex, tsHex] = await Promise.all([
    ethCall(chain, lpToken, SEL.token0),
    ethCall(chain, lpToken, SEL.getReserves),
    ethCall(chain, lpToken, SEL.totalSupply),
  ]);
  const token0 = toAddr(t0);
  const totalSupply = toBig(tsHex);
  if (!token0 || !reservesHex || reservesHex === '0x' || totalSupply <= 0n) return null;
  const t1 = toAddr(await ethCall(chain, lpToken, SEL.token1));
  if (!t1) return null;
  const body = reservesHex.replace(/^0x/, '');
  const r0 = BigInt('0x' + body.slice(0, 64));
  const r1 = BigInt('0x' + body.slice(64, 128));
  const share = Number(amountRaw) / Number(totalSupply);
  const [m0, m1, lpSym] = await Promise.all([
    erc20Meta(chain, token0),
    erc20Meta(chain, t1),
    symbol ? Promise.resolve(symbol) : erc20Meta(chain, lpToken).then((m) => m.symbol),
  ]);
  return {
    symbol: typeof lpSym === 'string' ? lpSym : (lpSym as { symbol: string }).symbol,
    underlying: [
      { address: token0, symbol: m0.symbol, decimals: m0.decimals, amount: fmt(r0, m0.decimals) * share },
      { address: t1, symbol: m1.symbol, decimals: m1.decimals, amount: fmt(r1, m1.decimals) * share },
    ],
  };
}

export { SEL, callData, encUint, toBig, toAddr, toInt, erc20Meta, fmt, protocolFromSymbol };
