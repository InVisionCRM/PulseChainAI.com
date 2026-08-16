// Generic Uniswap-V3 concentrated-liquidity position detection.
//
// V3 positions are ERC-721 NFTs minted by a NonfungiblePositionManager (PM).
// We don't keep a list of PMs — we enumerate the wallet's NFTs and probe each
// collection for the UniV3 PM shape (`positions(tokenId)` + `factory()`). So
// 9mm V3, NEXION V3 and any UniV3 fork are covered with zero addresses.
//
// Amounts are computed from the standard LiquidityAmounts formulas. We use
// floating-point sqrt-prices (not the exact 256-bit TickMath) — more than
// precise enough for a USD readout — and add uncollected fees (tokensOwed).

import { ethCall } from './evmRpc';
import { toBig, toAddr, erc20Meta, type ProtocolPosition, type UnderlyingAsset } from './positions';
import { uncollectedFees } from './v3Fees';
import { dexForFactory } from './dexNames';
import type { ChainId } from '@/services';

const PM = {
  positions: '0x99fbab88', // positions(uint256)
  factory: '0xc45a0155',
  getPool: '0x1698ee82', // getPool(address,address,uint24)
  slot0: '0x3850c7bd',
};

const BLOCKSCOUT: Record<ChainId, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
  robinhood: 'https://robinhoodchain.blockscout.com/api/v2',
};

const MAX_NFTS = 40; // bound RPC fan-out
const Q96 = 2 ** 96;
const pad = (h: string) => h.replace(/^0x/, '').padStart(64, '0');
const word = (hex: string, i: number) => hex.replace(/^0x/, '').slice(i * 64, i * 64 + 64);

// int24 (sign-extended in a 256-bit word) → number.
function toInt24(w: string): number {
  let v = BigInt('0x' + w);
  if (v >= 1n << 255n) v -= 1n << 256n;
  return Number(v);
}

interface HeldNft { contract: string; tokenId: string }

/** Enumerate the wallet's ERC-721 holdings from Blockscout. */
async function fetchNfts(chain: ChainId, owner: string): Promise<HeldNft[]> {
  try {
    const r = await fetch(`${BLOCKSCOUT[chain]}/addresses/${owner}/nft?type=ERC-721`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    const items: any[] = data?.items ?? [];
    return items
      .map((it) => ({
        contract: String(it?.token?.address ?? it?.token?.address_hash ?? '').toLowerCase(),
        tokenId: String(it?.id ?? it?.token_id ?? ''),
      }))
      .filter((n) => n.contract && n.tokenId !== '')
      .slice(0, MAX_NFTS);
  } catch {
    return [];
  }
}

const sqrtAtTick = (tick: number) => Math.pow(1.0001, tick / 2);

/**
 * Detect Uniswap-V3 LP positions held as NFTs. Returns one ProtocolPosition per
 * in-range/owed position (USD filled in later by the route).
 */
/** Run `work` over `items`, at most `limit` in flight. */
async function mapLimit<T, R>(
  items: T[], limit: number, work: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await work(items[i]);
      }
    }),
  );
  return out;
}

export async function detectV3Positions(chain: ChainId, owner: string): Promise<ProtocolPosition[]> {
  const nfts = await fetchNfts(chain, owner);
  if (nfts.length === 0) return [];

  // One cache for the whole scan. Fifty positions usually span a handful of
  // pools, and every position in a pool otherwise re-reads the same slot0,
  // fee-growth globals and (often) the same ticks — which is what made a large
  // wallet's fee reads time out and come back as "couldn't be read".
  const memo = new Map<string, Promise<string | null>>();
  const call = (to: string, data: string): Promise<string | null> => {
    const key = `${to}:${data}`;
    let p = memo.get(key);
    if (!p) {
      // A null here means every endpoint in the pool refused, which under a
      // fan-out this size is usually rate limiting rather than a dead call —
      // so give it one more go before treating the read as unavailable.
      p = ethCall(chain, to, data).then(async (r) => {
        if (r) return r;
        await new Promise((res) => setTimeout(res, 400));
        return ethCall(chain, to, data);
      });
      memo.set(key, p);
    }
    return p;
  };

  // Confirmed V3 position managers (probed once each) → factory address.
  const pmFactory = new Map<string, Promise<string | null>>();
  const factoryOf = (contract: string) => {
    let p = pmFactory.get(contract);
    if (!p) {
      p = call(contract, PM.factory).then(toAddr);
      pmFactory.set(contract, p);
    }
    return p;
  };

  const built = await mapLimit(nfts, 3, async (nft): Promise<ProtocolPosition | null> => {
    const factory = await factoryOf(nft.contract);
    if (!factory) return null;

    const posHex = await call(nft.contract, PM.positions + pad(BigInt(nft.tokenId).toString(16)));
    if (!posHex || posHex === '0x' || posHex.length < 2 + 64 * 12) return null;

    const token0 = toAddr('0x' + word(posHex, 2));
    const token1 = toAddr('0x' + word(posHex, 3));
    const fee = Number(BigInt('0x' + word(posHex, 4)));
    const tickLower = toInt24(word(posHex, 5));
    const tickUpper = toInt24(word(posHex, 6));
    const liquidityRaw = BigInt('0x' + word(posHex, 7));
    const liquidity = Number(liquidityRaw);
    const inside0Last = BigInt('0x' + word(posHex, 8));
    const inside1Last = BigInt('0x' + word(posHex, 9));
    const owed0Raw = BigInt('0x' + word(posHex, 10));
    const owed1Raw = BigInt('0x' + word(posHex, 11));
    const owed0 = Number(owed0Raw);
    const owed1 = Number(owed1Raw);
    if (!token0 || !token1) return null;
    if (liquidity <= 0 && owed0 <= 0 && owed1 <= 0) return null; // closed/empty

    // Current price from the pool's slot0.
    const poolHex = await call(
      factory,
      PM.getPool + pad(token0.replace(/^0x/, '')) + pad(token1.replace(/^0x/, '')) + pad(fee.toString(16)),
    );
    const pool = toAddr(poolHex);
    let sqrtCur = 0;
    if (pool) {
      const slot0 = await call(pool, PM.slot0);
      if (slot0 && slot0 !== '0x') sqrtCur = Number(toBig('0x' + word(slot0, 0))) / Q96;
    }

    const sqrtA = sqrtAtTick(tickLower);
    const sqrtB = sqrtAtTick(tickUpper);
    const sp = sqrtCur > 0 ? Math.min(Math.max(sqrtCur, sqrtA), sqrtB) : sqrtA;
    // LiquidityAmounts: raw token units. Fees are NOT added in — they're
    // reported separately, since folding them here inflates the principal.
    const amt0 = liquidity * (sqrtB - sp) / (sp * sqrtB);
    const amt1 = liquidity * (sp - sqrtA);

    // tokensOwed alone is what the position was last credited; the pool's
    // accumulators carry everything earned since. Needs the pool, so a pool we
    // couldn't resolve means no fee figure rather than a zero.
    const feeRaw = pool
      ? await uncollectedFees(chain, pool, {
          tickLower, tickUpper,
          liquidity: liquidityRaw,
          feeGrowthInside0Last: inside0Last,
          feeGrowthInside1Last: inside1Last,
          owed0: owed0Raw,
          owed1: owed1Raw,
        }, call)
      : null;

    const [m0, m1] = await Promise.all([erc20Meta(chain, token0), erc20Meta(chain, token1)]);
    const underlying: UnderlyingAsset[] = [
      { address: token0, symbol: m0.symbol, decimals: m0.decimals, amount: amt0 / 10 ** m0.decimals },
      { address: token1, symbol: m1.symbol, decimals: m1.decimals, amount: amt1 / 10 ** m1.decimals },
    ];
    const fees: UnderlyingAsset[] | undefined = feeRaw
      ? [
          { address: token0, symbol: m0.symbol, decimals: m0.decimals, amount: Number(feeRaw.fee0) / 10 ** m0.decimals },
          { address: token1, symbol: m1.symbol, decimals: m1.decimals, amount: Number(feeRaw.fee1) / 10 ** m1.decimals },
        ]
      : undefined;
    const dex = dexForFactory(factory);
    const inRange = sqrtCur > 0 && sqrtCur > sqrtA && sqrtCur < sqrtB;
    return {
      kind: 'lp',
      address: nft.contract,
      id: nft.tokenId,
      symbol: `${m0.symbol}/${m1.symbol} V3`,
      dex,
      note: `${dex ?? 'V3'} liquidity${fee ? ` · ${(fee / 10000).toFixed(2)}%` : ''}`,
      underlying,
      fees,
      range: { inRange, tickLower, tickUpper },
    };
  });

  return built.filter((p): p is ProtocolPosition => p !== null);
}
