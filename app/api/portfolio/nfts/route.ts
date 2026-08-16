// GET /api/portfolio/nfts?address=0x…&chain=pulsechain
//
// A wallet's NFTs, grouped by collection.
//
// Grouped rather than flat because that is how wallets actually look: the ones
// measured here hold 890 NFTs across 4 collections, and 41-145 of a single
// collection. A flat list would render hundreds of near-identical tiles and
// fetch hundreds of images to say "you own a lot of Willie".
//
// Each collection is then asked what it is, rather than looked up in a list —
// see lib/portfolio/nftKinds.ts. That matters on PulseChain, where most NFTs
// come from project websites and never touch a marketplace, so there is no
// listing, no floor and no index to read them out of. The contract is the only
// source that always exists.

import { NextRequest, NextResponse } from 'next/server';
import type { ChainId } from '@/services';
import { getCode, ethCall } from '@/lib/portfolio/evmRpc';
import { nftKind, lockedValue, claimRoute, SEL } from '@/lib/portfolio/nftKinds';
import { mintraFloors } from '@/lib/portfolio/nftFloors';
import { fetchUsdPrices } from '@/lib/portfolio/dexPrices';
import { getChain } from '@/lib/chains/registry';
import { pulsechainWriteContractUrl } from '@/lib/pulsechainExplorer';

export const revalidate = 0;
export const maxDuration = 60;

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const BLOCKSCOUT: Record<ChainId, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
  robinhood: 'https://robinhoodchain.blockscout.com/api/v2',
};

/** Bounds fan-out on wallets that have been airdropped junk collections. */
const MAX_COLLECTIONS = 40;
/** Per collection, how many instances to hand back for the gallery strip. */
const SAMPLE = 12;
/**
 * A vault collection gets read in full rather than sampled, up to this many.
 *
 * The gallery only needs a handful of tiles, but a locked balance is money: a
 * wallet holding 360 lock NFTs whose first 12 hold 12,000 PLSB does not hold
 * 12,000 PLSB. Summing a sample and printing it as the total is the kind of
 * number that is worse than no number, so the reads are done properly and the
 * response says outright whether it managed to cover everything.
 */
const MAX_VAULT_READS = 400;
/**
 * Blockscout hands back 50 instances a page. Twenty pages covers a thousand
 * NFTs, which clears the real wallets measured here (the largest held 890) with
 * room to spare; past that the response reports itself incomplete rather than
 * quietly truncating.
 */
const INSTANCE_PAGES = 20;

async function fetchJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; MorbiusPortfolio/1.0)' },
      signal: AbortSignal.timeout(15_000),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const word = (hex: string, i: number) => hex.replace(/^0x/, '').slice(i * 64, i * 64 + 64);
function decodeString(hex: string | null): string | null {
  if (!hex || hex === '0x') return null;
  try {
    const b = Buffer.from(hex.slice(2), 'hex');
    const off = Number(BigInt('0x' + b.subarray(0, 32).toString('hex')));
    const len = Number(BigInt('0x' + b.subarray(off, off + 32).toString('hex')));
    return b.subarray(off + 32, off + 32 + len).toString('utf8') || null;
  } catch {
    return null;
  }
}

/**
 * Every token id the wallet holds, grouped by collection.
 *
 * Blockscout's instance list is per-wallet, not per-collection — one page mixes
 * every collection together — so this walks it once and buckets the results
 * rather than re-walking it for each collection, which would both multiply the
 * requests and truncate the later collections. `next_page_params` drives the
 * paging; the page cap keeps a wallet holding thousands from turning one
 * request into an unbounded scan.
 */
async function idsByCollection(base: string, owner: string): Promise<Map<string, string[]>> {
  const byCollection = new Map<string, string[]>();
  let params = '';
  for (let page = 0; page < INSTANCE_PAGES; page++) {
    const data = await fetchJson(`${base}/addresses/${owner}/nft?type=ERC-721,ERC-1155${params}`);
    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    for (const it of items) {
      const c = String(it?.token?.address ?? '').toLowerCase();
      const id = String(it?.id ?? '');
      if (!c || !id) continue;
      const list = byCollection.get(c) ?? [];
      if (list.length < MAX_VAULT_READS) list.push(id);
      byCollection.set(c, list);
    }
    const np = data?.next_page_params;
    if (!np || items.length === 0) break;
    params = '&' + new URLSearchParams(
      Object.entries(np).map(([k, v]) => [k, String(v)]),
    ).toString();
  }
  return byCollection;
}

/**
 * USD per unit of the chain's native coin, via its wrapped ERC-20.
 *
 * PLS itself has no address to price, so the wrapped token stands in for it —
 * WPLS is redeemable 1:1, so its price is the coin's. The address comes from
 * the chain registry rather than being written here.
 */
async function nativeUsd(chain: ChainId): Promise<number | null> {
  const wrapped = getChain(chain)?.wrappedNative;
  if (!wrapped) return null;
  const prices = await fetchUsdPrices([wrapped], chain);
  return prices.get(wrapped.toLowerCase()) ?? null;
}

export interface NftInstanceLite {
  id: string;
  /** Blockscout's cached image, when it has one — often null on PulseChain. */
  imageUrl: string | null;
}

export interface NftCollection {
  address: string;
  name: string | null;
  symbol: string | null;
  type: string;
  /** How many of this collection the wallet holds. */
  count: number;
  holders: number | null;
  totalSupply: string | null;
  kind: Awaited<ReturnType<typeof nftKind>>;
  /**
   * The same contract exists on Ethereum. PulseChain forked Ethereum's state,
   * so most of these are fork copies of a collection that also lives there —
   * but not all: PulseBitcoinLockNFT is a genuine deploy on both chains with
   * 500 holders on Ethereum. The flag states the fact and lets the UI say
   * "also on Ethereum" rather than passing judgement on it.
   */
  alsoOnEthereum: boolean;
  /** Present only for vault/lock NFTs — a claim on real tokens. */
  locked: {
    token: string;
    symbol: string | null;
    decimals: number;
    /** Summed over `read` instances, as a decimal string. */
    amount: string;
    /**
     * The soonest unlock still in the future, unix seconds, or null when every
     * one read is already claimable. Reporting the soonest unlock overall would
     * print a date from the past next to hundreds of still-locked NFTs, which
     * tells the owner nothing about when their money frees up.
     */
    unlocksAt: number | null;
    /** How many of the instances read have passed their unlock already. */
    unlockedNow: number;
    /**
     * The part of `amount` sitting in already-unlocked NFTs — what could be
     * taken out today. Kept separate from the total because "you hold 377,001"
     * and "you can take 210,000 right now" are different facts and a holder
     * acts on the second one.
     */
    claimableAmount: string;
    /**
     * How to get it out, when the contract is verified and says so plainly.
     * Null means we could not establish a route from its ABI — better silent
     * than sending someone to a call that reverts.
     */
    claim: { method: string; burnsNft: boolean; writeUrl: string } | null;
    /** How many of the wallet's instances went into `amount`. */
    read: number;
    /**
     * False when the wallet holds more than were read, which makes `amount` a
     * floor rather than a total. The UI must say so — a partial sum shown as a
     * balance is a wrong number, not a rounded one.
     */
    complete: boolean;
  } | null;
  /**
   * Lowest live ask on Mintra, when the collection has one.
   *
   * A secondary signal, and shown as one. It is the cheapest thing a single
   * seller currently wants, on one marketplace that much of PulseChain does not
   * use — not a valuation, and deliberately never multiplied by `count`. Null
   * means nothing is listed, which is the normal case here and says nothing
   * about worth.
   */
  floor: {
    pls: number;
    usd: number | null;
    listed: number;
    /** Live listings priced in some other token, excluded from `pls`. */
    otherCurrency: number;
  } | null;
  instances: NftInstanceLite[];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get('address') ?? '').trim();
  const chain = (searchParams.get('chain') ?? 'pulsechain') as ChainId;

  if (!ADDRESS_RX.test(address)) {
    return NextResponse.json({ error: 'bad address' }, { status: 400 });
  }
  const base = BLOCKSCOUT[chain];
  if (!base) return NextResponse.json({ error: 'unsupported chain' }, { status: 400 });

  const data = await fetchJson(`${base}/addresses/${address}/nft/collections`);
  if (!data) {
    // An explorer outage must not read as "this wallet owns no NFTs".
    return NextResponse.json({ error: 'explorer unavailable', collections: null }, { status: 503 });
  }

  const raw: any[] = Array.isArray(data.items) ? data.items.slice(0, MAX_COLLECTIONS) : [];
  const [heldIds, floors, plsUsd] = await Promise.all([
    idsByCollection(base, address),
    // Never let the marketplace or the price feed take the NFT list down with
    // them — both are extras layered on top of chain data.
    mintraFloors(chain).catch(() => new Map()),
    nativeUsd(chain).catch(() => null),
  ]);

  const collections = await mapLimit(raw, 4, async (row): Promise<NftCollection | null> => {
    const token = row?.token ?? {};
    const addr = String(token.address ?? '');
    if (!ADDRESS_RX.test(addr)) return null;

    const instances: NftInstanceLite[] = (row.token_instances ?? [])
      .slice(0, SAMPLE)
      .map((i: any) => ({ id: String(i?.id ?? ''), imageUrl: i?.image_url ?? null }))
      .filter((i: NftInstanceLite) => i.id);

    const [kind, ethCode, balHex] = await Promise.all([
      nftKind(chain, addr),
      // Only PulseChain inherited Ethereum's state, so the question is only
      // meaningful there; asking on Ethereum itself would answer "yes" always.
      chain === 'pulsechain' ? getCode('ethereum', addr) : Promise.resolve(null),
      // The chain is the authority on how many you hold. Blockscout's own two
      // endpoints disagreed on a measured wallet — its collection summary said
      // 360 while its instance list only had 338 — and `balanceOf` settled it
      // at 360. ERC-1155 balances are per-id, so those keep the explorer's
      // total, which is the only whole-collection figure available for them.
      ethCall(chain, addr, SEL.balanceOf + address.slice(2).toLowerCase().padStart(64, '0')),
    ]);
    const onChainCount = balHex && !kind.erc1155 ? Number(BigInt('0x' + word(balHex, 0))) : null;
    /** How many the wallet holds, chain first, explorer second, 0 = unknown. */
    const heldCount = onChainCount ?? (Number(row.amount) || 0);

    // Vault check runs against one held instance — if the shape isn't there,
    // it reverts and costs one call.
    let locked: NftCollection['locked'] = null;
    const probeId = instances[0]?.id;
    if (probeId) {
      const lv = await lockedValue(chain, addr, probeId);
      if (lv) {
        const [symHex, decHex] = await Promise.all([
          ethCall(chain, lv.token, SEL.symbol),
          ethCall(chain, lv.token, SEL.decimals),
        ]);
        const decimals = decHex ? Number(BigInt('0x' + word(decHex, 0))) : 18;

        // Every held id, not the gallery sample — see MAX_VAULT_READS.
        const ids = heldIds.get(addr.toLowerCase()) ?? instances.map((i) => i.id);
        const amounts = await mapLimit(ids, 8, (id) => lockedValue(chain, addr, id));
        const total = amounts.reduce((s, a) => s + (a?.amount ?? 0n), 0n);
        const now = Math.floor(Date.now() / 1000);
        const ends = amounts
          .map((a) => a?.unlocksAt ?? 0)
          .filter((t) => t > 0)
          .sort((x, y) => x - y);
        const unlockedNow = ends.filter((t) => t <= now).length;
        const nextUnlock = ends.find((t) => t > now) ?? null;
        // A lock with no end date has nothing holding it, so it counts as out.
        const claimableRaw = amounts.reduce(
          (sum, a) => (a && (a.unlocksAt == null || a.unlocksAt <= now) ? sum + a.amount : sum),
          0n,
        );
        // The route comes from the contract's own ABI, and only when verified.
        const verified = await fetchJson(`${base}/smart-contracts/${addr}`);
        const route = Array.isArray(verified?.abi) ? claimRoute(verified.abi) : null;

        const scale = 10n ** BigInt(decimals);
        const fmt = (v: bigint) => {
          const whole = v / scale;
          const frac = (v % scale).toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
          return frac ? `${whole}.${frac}` : String(whole);
        };
        locked = {
          token: lv.token,
          symbol: decodeString(symHex),
          decimals,
          amount: fmt(total),
          unlocksAt: nextUnlock,
          unlockedNow,
          claimableAmount: fmt(claimableRaw),
          claim:
            route && chain === 'pulsechain'
              ? { ...route, writeUrl: pulsechainWriteContractUrl(addr) }
              : null,
          read: ids.length,
          // Only claim completeness against a held count we actually know.
          // Defaulting an unknown count to 0 would make `ids.length >= 0` true
          // and stamp "complete" on a total we never verified.
          complete: heldCount > 0 && ids.length >= heldCount,
        };
      }
    }

    const f = floors.get(addr.toLowerCase());
    const floorPls = f && f.floorWei > 0n ? Number(f.floorWei) / 1e18 : null;

    return {
      address: addr,
      name: token.name ?? null,
      symbol: token.symbol ?? null,
      type: String(token.type ?? (kind.erc1155 ? 'ERC-1155' : 'ERC-721')),
      count: heldCount || instances.length,
      holders: token.holders != null ? Number(token.holders) : null,
      totalSupply: token.total_supply ?? null,
      kind,
      alsoOnEthereum: !!ethCode && ethCode.length > 2,
      locked,
      floor:
        floorPls == null
          ? null
          : {
              pls: floorPls,
              usd: plsUsd != null ? floorPls * plsUsd : null,
              listed: f!.listed,
              otherCurrency: f!.otherCurrency,
            },
      instances,
    };
  });

  const out = collections.filter((c): c is NftCollection => c !== null);
  // Biggest holdings first; a wallet's headline NFT is usually the one it has
  // most of. Fork copies are NOT demoted — they trade on PulseChain in their
  // own right and are worth what someone pays for them here.
  out.sort((a, b) => b.count - a.count);

  return NextResponse.json({
    address,
    chain,
    collections: out,
    totalNfts: out.reduce((s, c) => s + c.count, 0),
  });
}
