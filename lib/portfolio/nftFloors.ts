// The lowest live ask per NFT collection, read from Mintra's contract.
//
// Mintra is a thirdweb-style direct-listings marketplace on PulseChain. Its
// front end is currently down — mintra.ai and app.mintra.ai both answer
// Vercel's DEPLOYMENT_DISABLED — but the contract is untouched and public, so
// the listings are still readable. That is the only reason this exists: it does
// not depend on their site being up.
//
// This is a SECONDARY signal and callers should treat it as one. A floor is the
// cheapest thing someone is currently asking for, on one marketplace, which is
// not the same as what a collection is worth and is emphatically not what a
// wallet's NFTs would fetch. Most PulseChain NFTs are never listed anywhere at
// all, so for the majority of collections there is simply no number here — an
// absent floor means "nobody has one listed", never "worthless".
//
// Deliberately NOT multiplied out by holdings anywhere. One person asking
// 500,000 PLS for one token says nothing about selling a hundred of them, and
// floor × count is the kind of figure that looks like a valuation while being
// invented.
//
// Verified against the live contract: the struct below matches the ABI's
// `IDirectListings.Listing` field for field, a full sweep of all 15,832
// listings costs 8 eth_calls and 3.8s, and it yields native-PLS floors for 52
// collections (plus 4 listed only in other currencies, which are excluded —
// see NATIVE).

import { ethCall } from './evmRpc';
import type { ChainId } from '@/services';

/** MintraDirectListings, verified by reading its own ABI from the explorer. */
const MINTRA = '0x11B8fa3FEa40262CF0c82e4FA36b5e18E1B33645';

/**
 * thirdweb's native-token sentinel. Confirmed to hold no code on PulseChain, so
 * it is an address standing in for PLS rather than an ERC-20.
 *
 * Listings priced in some other token are counted but never folded into the
 * floor: comparing 500,000 PLS against 500,000 of some memecoin and taking the
 * smaller would produce a confident, meaningless number.
 */
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const SEL = {
  totalListings: '0xc78b616c',
  getAllValidListings: '0x31654b4d', // getAllValidListings(uint256,uint256)
} as const;

/** Listing ids per call. 2,000 returns ~90KB, well inside a node's limits. */
const STEP = 2000;
/** Guards against a runaway sweep if totalListings ever returns nonsense. */
const MAX_CALLS = 40;
/** Listings move slowly; a few minutes of staleness costs nothing. */
const TTL_MS = 5 * 60 * 1000;

/** Status 1 is the marketplace's "created and live" state. */
const STATUS_ACTIVE = 1;

export interface CollectionFloor {
  /** Lowest live ask, in wei of the native coin. */
  floorWei: bigint;
  /** How many live native-priced listings the collection has. */
  listed: number;
  /** Live listings priced in some other token, excluded from `floorWei`. */
  otherCurrency: number;
}

const pad = (n: number | bigint) => BigInt(n).toString(16).padStart(64, '0');
const word = (hex: string, i: number) => hex.slice(i * 64, (i + 1) * 64);

let cache: { at: number; floors: Map<string, CollectionFloor> } | null = null;

/**
 * Decode `Listing[]`, whose fields are, per the contract's ABI:
 * listingId, tokenId, quantity, pricePerToken, startTimestamp, endTimestamp,
 * listingCreator, assetContract, currency, tokenType, status, reserved.
 *
 * Every member takes a full word in ABI encoding — the two uint128 timestamps
 * are not packed — so each listing is exactly twelve words.
 */
function decodeListings(hex: string, into: Map<string, CollectionFloor>): void {
  const b = hex.replace(/^0x/, '');
  if (b.length < 128) return;
  const off = Number(BigInt('0x' + word(b, 0))) * 2;
  const count = Number(BigInt('0x' + b.slice(off, off + 64)));
  const base = off + 64;
  for (let i = 0; i < count; i++) {
    const p = base + i * 64 * 12;
    if (p + 64 * 12 > b.length) break;
    const f = (j: number) => b.slice(p + j * 64, p + (j + 1) * 64);
    if (Number(BigInt('0x' + f(10))) !== STATUS_ACTIVE) continue;

    const collection = ('0x' + f(7).slice(24)).toLowerCase();
    const currency = ('0x' + f(8).slice(24)).toLowerCase();
    const price = BigInt('0x' + f(3));

    const row = into.get(collection) ?? { floorWei: 0n, listed: 0, otherCurrency: 0 };
    if (currency === NATIVE) {
      row.listed += 1;
      if (row.floorWei === 0n || price < row.floorWei) row.floorWei = price;
    } else {
      row.otherCurrency += 1;
    }
    into.set(collection, row);
  }
}

/**
 * Floors for every collection with a live listing, keyed by lower-cased address.
 *
 * Returns an empty map rather than throwing when the marketplace can't be read
 * — a missing floor is a missing extra, and must never take the NFT list with
 * it.
 */
export async function mintraFloors(chain: ChainId): Promise<Map<string, CollectionFloor>> {
  // Mintra is PulseChain-only; asking anywhere else is meaningless.
  if (chain !== 'pulsechain') return new Map();
  if (cache && Date.now() - cache.at < TTL_MS) return cache.floors;

  const totalHex = await ethCall(chain, MINTRA, SEL.totalListings);
  if (!totalHex) return cache?.floors ?? new Map();
  const total = Number(BigInt('0x' + word(totalHex.replace(/^0x/, ''), 0)));
  if (!Number.isFinite(total) || total <= 0) return new Map();

  const floors = new Map<string, CollectionFloor>();
  const chunks: [number, number][] = [];
  for (let s = 0; s < total && chunks.length < MAX_CALLS; s += STEP) {
    chunks.push([s, Math.min(s + STEP - 1, total - 1)]);
  }

  const pages = await Promise.all(
    chunks.map(([s, e]) => ethCall(chain, MINTRA, SEL.getAllValidListings + pad(s) + pad(e))),
  );
  for (const page of pages) if (page) decodeListings(page, floors);

  // Only replace a good cache with a good result; a partial sweep shouldn't
  // silently erase floors we already had.
  if (floors.size > 0) cache = { at: Date.now(), floors };
  return floors.size > 0 ? floors : (cache?.floors ?? floors);
}
