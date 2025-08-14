
import {
  ensureDex,
  formatPct2,
  formatNumber2,
  fetchJson,
  ensureCoreCaches,
  getTransfersLastNDays,
  formatTokenAmount2,
  DEAD_ADDRESS,
} from './utils';
import { StatConfig, StatResult } from './index';

// Blue Chip Pair Ratio
export const blueChipPairRatioStat = {
  id: 'blueChipPairRatio',
  name: 'Blue Chip Pair Ratio',
  description: 'The ratio of liquidity in blue chip pairs to total liquidity.',
  enabled: true,
  format: 'percentage' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const BLUE_CHIP_ADDRESSES = new Set([
      '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
      '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
      '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', // USDC
      '0xefd766ccb38eaf1dfd701853bfce31359239f305', // DAI
    ]);
    const dex = await ensureDex(tokenAddress);
    const pairs = dex?.pairs || [];
    if (pairs.length === 0) return { value: { ratio: 0, totalLiquidity: 0, blueChipLiquidity: 0 }, formattedValue: '0%', lastUpdated: new Date(), source: 'dexscreener' };

    let totalLiquidity = 0;
    let blueChipLiquidity = 0;

    for (const pair of pairs) {
      const liquidityUsd = Number(pair.liquidity?.usd || 0);
      totalLiquidity += liquidityUsd;
      if (BLUE_CHIP_ADDRESSES.has(pair.quoteToken.address.toLowerCase())) {
        blueChipLiquidity += liquidityUsd;
      }
    }

    const ratio = totalLiquidity > 0 ? (blueChipLiquidity / totalLiquidity) * 100 : 0;
    const value = {
      ratio: formatPct2(ratio),
      totalLiquidity: formatNumber2(totalLiquidity),
      blueChipLiquidity: formatNumber2(blueChipLiquidity),
    };

    return {
      value,
      formattedValue: value.ratio,
      lastUpdated: new Date(),
      source: 'dexscreener',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'blueChipPairRatio',
    name: 'Blue Chip Pair Ratio',
    description: 'The ratio of liquidity in blue chip pairs to total liquidity.',
    enabled: true,
    format: 'percentage',
  }),
};

// Diamond Hands Score
export const diamondHandsScoreStat = {
  id: 'diamondHandsScore',
  name: 'Diamond Hands Score (90/180d)',
  description: 'The percentage of tokens that have not moved in 90 and 180 days.',
  enabled: true,
  format: 'text' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const transfers180d = await getTransfersLastNDays(tokenAddress, 180);
    const activeWallets180d = new Set(transfers180d.map(t => t.from?.hash?.toLowerCase()));

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const transfers90d = transfers180d.filter(t => new Date(t.timestamp!) > ninetyDaysAgo);
    const activeWallets90d = new Set(transfers90d.map(t => t.from?.hash?.toLowerCase()));

    const allHolders = await ensureHolders(tokenAddress);
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const totalSupply = Number(tokenInfo?.total_supply ?? 0);

    let unmoved90d = 0;
    let unmoved180d = 0;

    for (const holder of allHolders) {
      const addr = holder.hash.toLowerCase();
      if (!activeWallets90d.has(addr)) {
        unmoved90d += Number(holder.value);
      }
      if (!activeWallets180d.has(addr)) {
        unmoved180d += Number(holder.value);
      }
    }

    const score90d = totalSupply > 0 ? (unmoved90d / totalSupply) * 100 : 0;
    const score180d = totalSupply > 0 ? (unmoved180d / totalSupply) * 100 : 0;

    const value = {
      score90d: formatPct2(score90d),
      score180d: formatPct2(score180d),
    };

    return {
      value,
      formattedValue: `90d: ${value.score90d}, 180d: ${value.score180d}`,
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'diamondHandsScore',
    name: 'Diamond Hands Score (90/180d)',
    description: 'The percentage of tokens that have not moved in 90 and 180 days.',
    enabled: true,
    format: 'text',
  }),
};
