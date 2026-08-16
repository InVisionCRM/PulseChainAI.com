// GET /api/portfolio/nft-meta?chain=pulsechain&address=0x…&id=123
//
// One NFT's name, artwork and traits.
//
// Deliberately separate from /api/portfolio/nfts: the collection list has to be
// fast and is read on every tab switch, while metadata means an off-chain fetch
// per token that may or may not answer. Keeping them apart lets the gallery
// paint immediately and fill in art as it lands, and lets a collection whose
// IPFS content is gone fail to a placeholder instead of holding up the page.
//
// The tokenURI is read from the contract rather than from the explorer, because
// on PulseChain the explorer usually has nothing: `metadata` came back null for
// every native collection checked, while `tokenURI` answered on all of them.
//
// Resolution rules, and why they are what they are, live in
// lib/portfolio/nftMetadata.ts — in short, gateways are raced and their answers
// are checked, because a gateway returning 200 with a parking page is a thing
// that happens and silently turns "this NFT is gone" into "here is your NFT".

import { NextRequest, NextResponse } from 'next/server';
import type { ChainId } from '@/services';
import { ethCall } from '@/lib/portfolio/evmRpc';
import { nftKind, SEL, pad } from '@/lib/portfolio/nftKinds';
import { fetchUri, readMeta, toLoadable, type NftMeta } from '@/lib/portfolio/nftMetadata';

export const revalidate = 0;
export const maxDuration = 30;

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;

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
 * ERC-1155 lets a contract publish one template URI containing `{id}`, which
 * every token shares. Substituting it is part of the standard, not a guess.
 */
function expandId(uri: string, id: string): string {
  if (!uri.includes('{id}')) return uri;
  return uri.replace(/\{id\}/g, BigInt(id).toString(16).padStart(64, '0'));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get('address') ?? '').trim();
  const id = (searchParams.get('id') ?? '').trim();
  const chain = (searchParams.get('chain') ?? 'pulsechain') as ChainId;

  if (!ADDRESS_RX.test(address) || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const kind = await nftKind(chain, address);
  const raw = kind.erc1155
    ? await ethCall(chain, address, SEL.uri + pad(BigInt(id)))
    : await ethCall(chain, address, SEL.tokenURI + pad(BigInt(id)));

  const uri = decodeString(raw);
  if (!uri) {
    return NextResponse.json(
      { error: 'no tokenURI', meta: null, source: null },
      // 200, not an error status: "this contract publishes no metadata" is a
      // fact about the NFT, not a failure of ours, and the tile should render
      // as a placeholder rather than as a broken request.
      { status: 200 },
    );
  }

  const target = expandId(uri, id);
  const got = await fetchUri(target);
  if (!got) {
    return NextResponse.json({
      error: 'unresolved',
      // The raw URI is still worth returning — the UI can offer it as a link so
      // the owner can see where the artwork was meant to live.
      uri: toLoadable(target),
      meta: null,
      source: null,
    });
  }

  // Some contracts point tokenURI straight at the artwork instead of at JSON.
  if (got.kind === 'image') {
    const meta: NftMeta = { name: null, description: null, image: toLoadable(target), externalUrl: null, traits: [] };
    return NextResponse.json({ meta, source: got.source, uri: toLoadable(target) });
  }

  return NextResponse.json({
    meta: readMeta(got.kind.json),
    source: got.source,
    uri: toLoadable(target),
  });
}
