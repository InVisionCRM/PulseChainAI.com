// Chain-aware explorer links.
//
// PulseChain uses Otterscan (hash routes, no /token page) via
// `lib/pulsechainExplorer.ts`. Every other chain in the registry is a Blockscout
// instance, which uses plain `/address/…`, `/tx/…`, `/token/…` paths off its
// `explorerUrl`. Callers that render a link for a token on an arbitrary chain
// should use these helpers instead of hardcoding a single explorer.

import type { ChainKey } from '@/lib/chains/types';
import { getChain } from '@/lib/chains/registry';
import {
  pulsechainAddressUrl,
  pulsechainTxUrl,
  pulsechainTokenUrl,
  PULSECHAIN_EXPLORER_NAME,
} from '@/lib/pulsechainExplorer';

const trimBase = (chain: ChainKey) => getChain(chain).explorerUrl.replace(/\/+$/, '');

export function explorerAddressUrl(chain: ChainKey, addr: string): string {
  if (chain === 'pulsechain') return pulsechainAddressUrl(addr);
  return `${trimBase(chain)}/address/${addr}`;
}

export function explorerTxUrl(chain: ChainKey, hash: string): string {
  if (chain === 'pulsechain') return pulsechainTxUrl(hash);
  return `${trimBase(chain)}/tx/${hash}`;
}

export function explorerTokenUrl(chain: ChainKey, addr: string): string {
  if (chain === 'pulsechain') return pulsechainTokenUrl(addr);
  return `${trimBase(chain)}/token/${addr}`;
}

// Display label for the explorer link text (e.g. "Otterscan" / "Blockscout").
export function explorerName(chain: ChainKey): string {
  return chain === 'pulsechain' ? PULSECHAIN_EXPLORER_NAME : 'Blockscout';
}
