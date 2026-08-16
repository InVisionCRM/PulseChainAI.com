'use client';

// The wallet's NFTs.
//
// Grouped by collection, because that is the shape wallets actually have — the
// ones measured while building this held 890 NFTs across 4 collections, and 700
// of a single one. A flat grid would be 700 tiles saying the same thing.
//
// Each collection is described by what its contract answers to, not by a list
// we maintain: ERC-721 or ERC-1155, enumerable, royalty-bearing, and whether it
// is a vault holding real tokens. That is what makes this work on PulseChain,
// where most NFTs come from a project's own website and are never listed on any
// marketplace, so there is no floor price and no index to look them up in.
//
// Artwork is filled in per tile after the list paints, since it means an
// off-chain fetch that may take seconds or may never answer. A tile whose
// artwork cannot be found says so and offers the link — it does not sit on a
// spinner, and it does not pretend the NFT is broken.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconRefresh, IconPhoto, IconLock, IconExternalLink, IconChevronDown } from '@tabler/icons-react';
import type { ChainId } from '@/services';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';

interface Kind {
  erc721: boolean;
  erc1155: boolean;
  enumerable: boolean;
  hasMetadata: boolean;
  royalties: boolean;
}
interface Locked {
  token: string;
  symbol: string | null;
  decimals: number;
  amount: string;
  unlocksAt: number | null;
  unlockedNow: number;
  read: number;
  complete: boolean;
}
interface Instance {
  id: string;
  imageUrl: string | null;
}
interface Collection {
  address: string;
  name: string | null;
  symbol: string | null;
  type: string;
  count: number;
  holders: number | null;
  totalSupply: string | null;
  kind: Kind;
  alsoOnEthereum: boolean;
  locked: Locked | null;
  instances: Instance[];
}

interface Meta {
  name: string | null;
  description: string | null;
  image: string | null;
  traits: { type: string; value: string }[];
}

const explorer = (chain: ChainId, a: string) =>
  chain === 'ethereum' ? `https://etherscan.io/token/${a}` : pulsechainAddressUrl(a);

function Badge({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'good' | 'info' | 'warn' }) {
  const cls =
    tone === 'good' ? 'border-emerald-400/40 text-emerald-300'
      : tone === 'info' ? 'border-sky-400/40 text-sky-300'
        : tone === 'warn' ? 'border-amber-400/40 text-amber-300'
          : 'border-[var(--line)] text-[var(--text-faint)]';
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  );
}

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
function prettyAmount(s: string): string {
  const n = Number(s);
  return Number.isFinite(n) ? nf.format(n) : s;
}
/** Only ever called with a future timestamp — see `unlocksAt` on the API. */
function whenUnlocks(ts: number): string {
  const d = new Date(ts * 1000);
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return days > 0 ? `${date} · in ${days.toLocaleString()} day${days === 1 ? '' : 's'}` : date;
}

/** One NFT tile. Artwork arrives after the tile does. */
function Tile({
  chain, collection, instance,
}: { chain: ChainId; collection: string; instance: Instance }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'none'>('idle');
  // Set once the <img> itself fails, so the tile drops to its placeholder
  // instead of re-rendering the same broken source forever.
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    // Always fetched, even when Blockscout already has a cached image: the
    // image is only part of it, and skipping this when a thumbnail happened to
    // exist was silently costing every such tile its name and its traits.
    let alive = true;
    setState('loading');
    fetch(`/api/portfolio/nft-meta?chain=${chain}&address=${collection}&id=${instance.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.meta) {
          setMeta(d.meta);
          setState('idle');
        } else {
          setState('none');
        }
      })
      .catch(() => alive && setState('none'));
    return () => {
      alive = false;
    };
  }, [chain, collection, instance.id, instance.imageUrl]);

  // Artwork goes through our proxy so a dead gateway can be retried server-side.
  // Inline (data:) art is already here and needs no fetch at all.
  const raw = instance.imageUrl ?? meta?.image ?? null;
  const src = !raw || broken
    ? null
    : raw.startsWith('data:')
      ? raw
      : `/api/portfolio/nft-media?uri=${encodeURIComponent(raw)}`;
  const title = meta?.name ?? `#${instance.id}`;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex aspect-square items-center justify-center bg-[var(--surface-2)]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 px-2 text-center">
            <IconPhoto className="h-5 w-5 text-[var(--text-faint)]" />
            <span className="text-[9px] leading-tight text-[var(--text-faint)]">
              {state === 'loading' && !broken ? 'loading…' : 'no artwork found'}
            </span>
          </div>
        )}
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-[11px] font-semibold text-[var(--text)]">{title}</p>
        {meta?.traits?.length ? (
          <p className="truncate text-[10px] text-[var(--text-faint)]">
            {meta.traits.length} trait{meta.traits.length === 1 ? '' : 's'}
          </p>
        ) : (
          <p className="truncate text-[10px] text-[var(--text-faint)]">#{instance.id}</p>
        )}
      </div>
    </div>
  );
}

function CollectionCard({ chain, c }: { chain: ChainId; c: Collection }) {
  const [open, setOpen] = useState(false);
  const name = c.name ?? c.symbol ?? 'Unnamed collection';
  const share =
    c.totalSupply && Number(c.totalSupply) > 0
      ? (c.count / Number(c.totalSupply)) * 100
      : null;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--text)]">{name}</h4>
        <span className="shrink-0 text-[13px] font-bold text-[var(--text)]">×{c.count.toLocaleString()}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <Badge>{c.kind.erc1155 ? 'ERC-1155' : 'ERC-721'}</Badge>
        {c.kind.enumerable && <Badge tone="info">enumerable</Badge>}
        {c.kind.royalties && <Badge>royalties</Badge>}
        {/*
          A statement of fact, not a warning. PulseChain forked Ethereum's state
          so the same contract exists on both — and these trade on PulseChain in
          their own right. Some are also genuine multi-chain deploys.
        */}
        {c.alsoOnEthereum && <Badge tone="warn">also on Ethereum</Badge>}
      </div>

      {c.locked && (
        <div className="mt-2 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-2.5">
          <div className="flex items-center gap-1.5">
            <IconLock className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              {c.locked.complete ? 'Locked inside' : 'Locked inside · at least'}
            </span>
          </div>
          <p className="mt-1 text-[15px] font-bold text-[var(--text)]">
            {prettyAmount(c.locked.amount)} {c.locked.symbol ?? ''}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {c.locked.unlockedNow > 0 && (
              <span className="font-semibold text-emerald-300">
                {c.locked.unlockedNow.toLocaleString()} claimable now
              </span>
            )}
            {c.locked.unlockedNow > 0 && c.locked.unlocksAt ? ' · ' : ''}
            {c.locked.unlocksAt
              ? `next unlocks ${whenUnlocks(c.locked.unlocksAt)}`
              : c.locked.unlockedNow > 0
                ? ''
                : 'no unlock date published'}
          </p>
          {!c.locked.complete && (
            // Never let a partial sum read as a balance.
            <p className="mt-1 text-[10px] text-amber-300">
              read {c.locked.read.toLocaleString()} of {c.count.toLocaleString()} — the rest could not be
              listed, so the real total is higher
            </p>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
        {c.holders != null && <span>{c.holders.toLocaleString()} holders</span>}
        {c.totalSupply && <span>{Number(c.totalSupply).toLocaleString()} supply</span>}
        {share != null && <span>{share < 0.1 ? '<0.1' : share.toFixed(1)}% of the collection</span>}
        <a
          href={explorer(chain, c.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text)]"
        >
          contract <IconExternalLink className="h-3 w-3" />
        </a>
      </div>

      {c.instances.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <IconChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            {open ? 'Hide' : `Show ${Math.min(c.instances.length, c.count)}`}
          </button>
          {open && (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {c.instances.map((i) => (
                <Tile key={i.id} chain={chain} collection={c.address} instance={i} />
              ))}
            </div>
          )}
          {c.count > c.instances.length && open && (
            <p className="mt-1.5 text-[10px] text-[var(--text-faint)]">
              showing {c.instances.length} of {c.count.toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function NftPositions({
  walletAddress,
  chains,
}: {
  walletAddress: string;
  chains: ChainId[];
}) {
  const [data, setData] = useState<Record<string, Collection[]>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<ChainId[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed([]);
    const out: Record<string, Collection[]> = {};
    const bad: ChainId[] = [];
    await Promise.all(
      chains.map(async (chain) => {
        try {
          const r = await fetch(`/api/portfolio/nfts?address=${walletAddress}&chain=${chain}`);
          const d = await r.json();
          if (!r.ok || !Array.isArray(d?.collections)) {
            // An explorer being down is not the same as owning nothing, and the
            // UI has to be able to tell the two apart.
            bad.push(chain);
            return;
          }
          out[chain] = d.collections;
        } catch {
          bad.push(chain);
        }
      }),
    );
    setData(out);
    setFailed(bad);
    setLoading(false);
  }, [walletAddress, chains]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(
    () => Object.values(data).reduce((s, cs) => s + cs.reduce((a, c) => a + c.count, 0), 0),
    [data],
  );
  const anyCollections = Object.values(data).some((cs) => cs.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-[var(--text)]">
          NFTs{total > 0 && <span className="ml-1.5 font-normal text-[var(--text-muted)]">{total.toLocaleString()}</span>}
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
        >
          <IconRefresh className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {failed.length > 0 && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-300">
          Couldn&apos;t reach the explorer for {failed.join(', ')} — that isn&apos;t the same as holding none.
        </p>
      )}

      {loading && !anyCollections ? (
        <p className="py-6 text-center text-[12px] text-[var(--text-faint)]">Reading NFTs…</p>
      ) : !anyCollections && failed.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-[var(--text-faint)]">No NFTs in this wallet.</p>
      ) : (
        Object.entries(data).map(([chain, cs]) =>
          cs.length === 0 ? null : (
            <div key={chain} className="space-y-2">
              {chains.length > 1 && (
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-faint)]">{chain}</p>
              )}
              {cs.map((c) => (
                <CollectionCard key={`${chain}:${c.address}`} chain={chain as ChainId} c={c} />
              ))}
            </div>
          ),
        )
      )}
    </div>
  );
}
