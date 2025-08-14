
import {
  ensureCoreCaches,
  formatTokenAmount2,
  formatPct2,
  fetchJson,
  getWalletTokenTransfers,
} from './utils';
import { StatConfig, StatResult } from './index';

// Creator's Initial Supply
export const creatorInitialSupplyStat = {
  id: 'creatorInitialSupply',
  name: "Creator's Initial Supply",
  description: "The amount of tokens the creator received upon contract creation.",
  enabled: true,
  format: 'text' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { addressInfo, tokenInfo } = await ensureCoreCaches(tokenAddress);
    const txHash = addressInfo?.creation_tx_hash;
    if (!txHash) return { value: { error: 'No creation hash found' }, formattedValue: 'N/A', lastUpdated: new Date(), source: 'pulsechain' };

    const tx = await fetchJson(`https://api.scan.pulsechain.com/api/v2/transactions/${txHash}`);
    const creator = tx?.from?.hash;
    const token = tokenInfo?.address;
    const mintTransfer = tx?.token_transfers?.find((t: any) => t.from.hash === '0x0000000000000000000000000000000000000000' && t.to.hash === creator && t.token.address === token);

    if (!mintTransfer) return { value: { error: 'No initial mint transfer found to creator.' }, formattedValue: 'N/A', lastUpdated: new Date(), source: 'pulsechain' };

    const initialSupply = Number(mintTransfer.total.value);
    const totalSupply = Number(tokenInfo?.total_supply);
    const percentage = totalSupply > 0 ? (initialSupply / totalSupply) * 100 : 0;

    const value = {
      creator,
      initialSupply: formatTokenAmount2(initialSupply, Number(tokenInfo.decimals)),
      percentageOfTotal: formatPct2(percentage),
    };

    return {
      value,
      formattedValue: `${value.initialSupply} (${value.percentageOfTotal})`,
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'creatorInitialSupply',
    name: "Creator's Initial Supply",
    description: "The amount of tokens the creator received upon contract creation.",
    enabled: true,
    format: 'text',
  }),
};

// Creator's First 5 Outbound Txs
export const creatorFirst5OutboundStat = {
  id: 'creatorFirst5Outbound',
  name: "Creator's First 5 Outbound Txs",
  description: "The first 5 outbound transactions from the creator's wallet.",
  enabled: true,
  format: 'text' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { addressInfo } = await ensureCoreCaches(tokenAddress);
    const creatorAddress = addressInfo?.creator_address_hash;
    if (!creatorAddress) return { value: { error: 'No creator address found' }, formattedValue: 'N/A', lastUpdated: new Date(), source: 'pulsechain' };

    const txs = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${creatorAddress}/transactions`);
    const outboundTxs = (txs?.items || []).filter((tx: any) => tx.from.hash.toLowerCase() === creatorAddress.toLowerCase());
    
    const value = outboundTxs.slice(0, 5).map((tx: any) => ({
      hash: tx.hash,
      to: tx.to?.hash,
      value: formatTokenAmount2(Number(tx.value), 18) + ' PLS',
      method: tx.method,
    }));

    return {
      value,
      formattedValue: JSON.stringify(value, null, 2),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'creatorFirst5Outbound',
    name: "Creator's First 5 Outbound Txs",
    description: "The first 5 outbound transactions from the creator's wallet.",
    enabled: true,
    format: 'text',
  }),
};

// Creator's Current Balance
export const creatorCurrentBalanceStat = {
  id: 'creatorCurrentBalance',
  name: "Creator's Current Balance",
  description: "The creator's current balance of the token.",
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { addressInfo, tokenInfo } = await ensureCoreCaches(tokenAddress);
    const creatorAddress = addressInfo?.creator_address_hash;
    if (!creatorAddress) return { value: { error: 'No creator address found' }, formattedValue: 'N/A', lastUpdated: new Date(), source: 'pulsechain' };

    const balanceData = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${creatorAddress}/token-balances?token=${tokenAddress}`);
    const tokenBalance = (balanceData || []).find((b: any) => b.token.address.toLowerCase() === tokenAddress.toLowerCase());

    const value = tokenBalance ? formatTokenAmount2(Number(tokenBalance.value), Number(tokenInfo.decimals)) : '0';

    return {
      value,
      formattedValue: value,
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'creatorCurrentBalance',
    name: "Creator's Current Balance",
    description: "The creator's current balance of the token.",
    enabled: true,
    format: 'number',
  }),
};

// Ownership Status
export const ownershipStatusStat = {
  id: 'ownershipStatus',
  name: 'Ownership Status',
  description: "Whether the contract ownership has been renounced.",
  enabled: true,
  format: 'text' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { addressInfo } = await ensureCoreCaches(tokenAddress);
    const creatorAddress = addressInfo?.creator_address_hash;
    if (!creatorAddress) return { value: { error: 'No creator address found' }, formattedValue: 'N/A', lastUpdated: new Date(), source: 'pulsechain' };

    const txs = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${creatorAddress}/transactions`);
    const renouncedTx = (txs?.items || []).find((tx: any) => tx.method?.toLowerCase() === 'renounceownership');

    const value = renouncedTx ? { status: 'Renounced', transaction: renouncedTx.hash } : { status: 'Not Renounced' };

    return {
      value,
      formattedValue: value.status,
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'ownershipStatus',
    name: 'Ownership Status',
    description: "Whether the contract ownership has been renounced.",
    enabled: true,
    format: 'text',
  }),
};

// Creator's Full Token History
export const creatorTokenHistoryStat = {
  id: 'creatorTokenHistory',
  name: "Creator's Full Token History",
  description: "The creator's full transaction history for the token.",
  enabled: true,
  format: 'text' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { addressInfo, tokenInfo } = await ensureCoreCaches(tokenAddress);
    const creatorAddress = addressInfo?.creator_address_hash;
    if (!creatorAddress) return { value: { error: 'No creator address found' }, formattedValue: 'N/A', lastUpdated: new Date(), source: 'pulsechain' };

    const allCreatorTransfers = await getWalletTokenTransfers(creatorAddress);
    const relevantTransfers = allCreatorTransfers.filter(t => t.token?.address?.toLowerCase() === tokenAddress.toLowerCase());

    const value = relevantTransfers.map(t => ({
      timestamp: t.timestamp,
      direction: t.from.hash.toLowerCase() === creatorAddress.toLowerCase() ? 'OUT' : 'IN',
      counterparty: t.from.hash.toLowerCase() === creatorAddress.toLowerCase() ? t.to.hash : t.from.hash,
      value: formatTokenAmount2(Number(t.total.value), Number(tokenInfo.decimals)),
    }));

    return {
      value,
      formattedValue: JSON.stringify(value, null, 2),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'creatorTokenHistory',
    name: "Creator's Full Token History",
    description: "The creator's full transaction history for the token.",
    enabled: true,
    format: 'text',
  }),
};
