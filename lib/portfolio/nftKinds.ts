// What kind of NFT contract is this, asked of the contract itself.
//
// There is no curated list here on purpose. ERC-721 and ERC-1155 are standards,
// so a contract will tell you what it implements if you ask it — ERC-165's
// `supportsInterface` is the ask. That covers every collection on the chain,
// including the many PulseChain NFTs that never reach a marketplace and so
// appear in no listing, no index and no price feed.
//
// Beyond the standards, the interesting part is what a contract *holds*. A lock
// or vault NFT is a claim on real tokens: its worth has nothing to do with a
// floor price and everything to do with the balance sitting behind it. Those
// are found by probing for the shape rather than by knowing the project.
//
// Every interface id and selector below was checked against live PulseChain
// contracts rather than written from memory:
//   • ERC-721            — PulseChain Willie, Pitbulls, Killer GF, SOYL Genesis
//   • ERC-721 Enumerable — PulseChain Willie answers true
//   • ERC-1155           — Aruharts (0xb3C7E3aF…567c) answers true
//   • ERC-2981 royalties — Willie, Pitbulls, Aruharts, SOYL Genesis answer true
//   • the lock shape     — PulseBitcoinLockNFT (0x1f06E2bb…814b) returns
//                          121.6398 PLSB and a 2027-07-25 unlock for token
//                          28739, against 2,992,818 PLSB held by the contract

import { ethCall } from './evmRpc';
import type { ChainId } from '@/services';

/** ERC-165 interface ids. */
const IFACE = {
  erc721: '80ac58cd',
  erc721Metadata: '5b5e139f',
  erc721Enumerable: '780e9d63',
  erc1155: 'd9b67a26',
  erc1155Metadata: '0e89341c',
  erc2981: '2a55205a',
} as const;

export const SEL = {
  supportsInterface: '0x01ffc9a7',
  tokenURI: '0xc87b56dd', // tokenURI(uint256)
  uri: '0x0e89341c', // uri(uint256) — ERC-1155
  name: '0x06fdde03',
  symbol: '0x95d89b41',
  decimals: '0x313ce567',
  totalSupply: '0x18160ddd',
  balanceOf: '0x70a08231', // balanceOf(address)
  tokenOfOwnerByIndex: '0x2f745c59',
  // the lock/vault shape
  token: '0xfc0c546a', // token()
  tokenIdsToAmounts: '0x5ea73972', // tokenIdsToAmounts(uint256)
  lockTime: '0xe8b23f66', // lockTime(uint256)
} as const;

export const pad = (n: bigint | number) => BigInt(n).toString(16).padStart(64, '0');
const word = (hex: string, i: number) => hex.replace(/^0x/, '').slice(i * 64, i * 64 + 64);

/** A bare `bool` return, tolerant of contracts that answer with junk. */
const isTrue = (hex: string | null) => !!hex && /1$/.test(hex.trim());

export interface NftKind {
  erc721: boolean;
  erc1155: boolean;
  /** Holdings can be walked on-chain with no indexer at all. */
  enumerable: boolean;
  hasMetadata: boolean;
  royalties: boolean;
}

/**
 * Ask a contract what it implements.
 *
 * A contract that doesn't implement ERC-165 reverts, which `ethCall` surfaces as
 * null — that reads as "not supported" rather than an error, which is the right
 * answer for our purposes.
 */
export async function nftKind(chain: ChainId, address: string): Promise<NftKind> {
  const ask = (id: string) => ethCall(chain, address, SEL.supportsInterface + id.padEnd(64, '0'));
  const [a, b, c, d, e, f] = await Promise.all([
    ask(IFACE.erc721),
    ask(IFACE.erc1155),
    ask(IFACE.erc721Enumerable),
    ask(IFACE.erc721Metadata),
    ask(IFACE.erc1155Metadata),
    ask(IFACE.erc2981),
  ]);
  return {
    erc721: isTrue(a),
    erc1155: isTrue(b),
    enumerable: isTrue(c),
    hasMetadata: isTrue(d) || isTrue(e),
    royalties: isTrue(f),
  };
}

export interface LockedValue {
  /** The ERC-20 the NFT is a claim on. */
  token: string;
  /** Raw units — the caller applies decimals, which it reads from the token. */
  amount: bigint;
  /** Unix seconds, or null when the contract doesn't express a lock end. */
  unlocksAt: number | null;
}

/**
 * A vault/lock NFT's contents, or null when this isn't one.
 *
 * The shape probed for is `token()` naming an ERC-20 plus a per-token-id amount.
 * PulseBitcoinLockNFT is the case this was verified against, but nothing here
 * is specific to it — any contract wearing the same shape reads correctly, and
 * one that doesn't simply reverts and returns null.
 *
 * A zero amount is returned as-is rather than as null: an emptied lock is a
 * real answer, and squashing it to "not a vault" would hide a position the user
 * still owns.
 */
export async function lockedValue(
  chain: ChainId,
  address: string,
  tokenId: string,
): Promise<LockedValue | null> {
  const [tokenHex, amountHex] = await Promise.all([
    ethCall(chain, address, SEL.token),
    ethCall(chain, address, SEL.tokenIdsToAmounts + pad(BigInt(tokenId))),
  ]);
  if (!tokenHex || !amountHex) return null;
  const token = '0x' + word(tokenHex, 0).slice(24);
  if (!/^0x[0-9a-f]{40}$/i.test(token) || /^0x0{40}$/.test(token)) return null;

  const lockHex = await ethCall(chain, address, SEL.lockTime + pad(BigInt(tokenId)));
  const unlocksAt = lockHex ? Number(BigInt('0x' + word(lockHex, 0))) : 0;
  return {
    token,
    amount: BigInt('0x' + (word(amountHex, 0) || '0')),
    unlocksAt: unlocksAt > 0 ? unlocksAt : null,
  };
}
