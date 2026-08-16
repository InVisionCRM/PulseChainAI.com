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
import { createPortal } from 'react-dom';
import { IconRefresh, IconPhoto, IconLock, IconExternalLink, IconChevronDown, IconX } from '@tabler/icons-react';
import type { ChainId } from '@/services';
import { pulsechainAddressUrl, pulsechainWriteContractUrl } from '@/lib/pulsechainExplorer';
import { identicon } from '@/lib/identicon';

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
  claimableAmount: string;
  claim: { method: string; burnsNft: boolean; writeUrl: string } | null;
  read: number;
  complete: boolean;
}
interface Floor {
  pls: number;
  usd: number | null;
  listed: number;
  otherCurrency: number;
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
  floor: Floor | null;
  instances: Instance[];
}

interface Meta {
  name: string | null;
  description: string | null;
  image: string | null;
  externalUrl: string | null;
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
/** Big PLS figures are unreadable in full; 125,000,000 reads as 125M. */
function compact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
  return n.toFixed(n < 1 ? 4 : 2);
}

/** Only ever called with a future timestamp — see `unlocksAt` on the API. */
function whenUnlocks(ts: number): string {
  const d = new Date(ts * 1000);
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return days > 0 ? `${date} · in ${days.toLocaleString()} day${days === 1 ? '' : 's'}` : date;
}

/**
 * Stand-in art for an NFT whose own artwork can't be fetched.
 *
 * Drawn from the contract address and token id, so a given NFT always gets the
 * same picture and two of them never collide. It replaces a grid of identical
 * grey placeholders, which looked broken and made a wallet's tokens impossible
 * to tell apart.
 *
 * It is always labelled. Generated art that isn't marked would be mistaken for
 * the real thing, and telling someone their NFT looks like something it does
 * not is worse than showing them nothing.
 */
function GeneratedArt({ seed, rounded = false }: { seed: string; rounded?: boolean }) {
  const { cells, size, colors } = useMemo(() => identicon(seed), [seed]);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={`h-full w-full ${rounded ? 'rounded-xl' : ''}`}
      // Nearest-neighbour keeps the squares square instead of smearing them.
      style={{ imageRendering: 'pixelated', background: colors[0] }}
      aria-hidden
    >
      {Array.from(cells).map((v, i) =>
        v === 0 ? null : (
          <rect
            key={i}
            x={i % size}
            y={Math.floor(i / size)}
            width={1}
            height={1}
            fill={colors[v]}
          />
        ),
      )}
    </svg>
  );
}

/**
 * The opened NFT: big artwork and every trait it publishes.
 *
 * Portalled to <body> rather than rendered in place. The portfolio page puts a
 * floating chip at z-110 and a FAB at z-120, and both sit in their own stacking
 * contexts — a dialog nested inside the card loses to them however high its own
 * z-index goes, and ends up with its lower half untappable. The share modal hit
 * exactly this; the fix there was the same portal.
 */
function NftDetail({
  chain, collection, collectionName, instance, meta, onClose,
}: {
  chain: ChainId;
  collection: string;
  collectionName: string;
  instance: Instance;
  meta: Meta | null;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // One frame at the small size, so the transition has something to run from.
    const r = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(r);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const raw = instance.imageUrl ?? meta?.image ?? null;
  const src = !raw
    ? null
    : raw.startsWith('data:')
      ? raw
      : `/api/portfolio/nft-media?uri=${encodeURIComponent(raw)}`;
  const title = meta?.name ?? `#${instance.id}`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className={`fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm transition-opacity duration-200 sm:items-center sm:p-4 ${
        shown ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl transition-all duration-200 sm:rounded-2xl ${
          shown ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0'
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold text-[var(--text)]">{title}</p>
            <p className="truncate text-[11px] text-[var(--text-faint)]">{collectionName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-[var(--line)] p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-[var(--surface-2)]">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={title} className="h-full w-full object-contain" />
            ) : (
              <GeneratedArt seed={`${collection}:${instance.id}`} rounded />
            )}
          </div>

          {!src && (
            <p className="mt-2 text-[11px] text-[var(--text-faint)]">
              This one&apos;s artwork couldn&apos;t be fetched — its metadata is unreachable or
              unpinned. The picture above is generated from the token&apos;s address and id, not the
              collection&apos;s art.
            </p>
          )}

          {meta?.description && (
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-muted)]">{meta.description}</p>
          )}

          {meta?.traits?.length ? (
            <>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-faint)]">
                Traits · {meta.traits.length}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {meta.traits.map((t, i) => (
                  <div
                    key={`${t.type}:${t.value}:${i}`}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2"
                  >
                    <p className="truncate text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                      {t.type}
                    </p>
                    <p className="truncate text-[12px] font-semibold text-[var(--text)]" title={t.value}>
                      {t.value}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 text-[11px] text-[var(--text-faint)]">
              This one publishes no traits.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line)] pt-3 text-[11px] text-[var(--text-muted)]">
            <span>Token #{instance.id}</span>
            {/*
              The project's own link, only when the metadata publishes one.
              `external_url` is the single website that can be established
              without a curated list, since the collection authors it itself —
              most PulseChain collections leave it blank, and a missing link is
              better than an invented one.
            */}
            {meta?.externalUrl && (
              <a
                href={meta.externalUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text)]"
              >
                project site <IconExternalLink className="h-3 w-3" />
              </a>
            )}
            <a
              href={explorer(chain, collection)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text)]"
            >
              contract <IconExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** One NFT tile. Artwork arrives after the tile does. */
function Tile({
  chain, collection, instance, onOpen,
}: {
  chain: ChainId;
  collection: string;
  instance: Instance;
  /** Hands the already-loaded metadata up, so opening never refetches. */
  onOpen: (instance: Instance, meta: Meta | null) => void;
}) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'none'>('idle');
  // Set once the <img> itself fails, so the tile drops to its placeholder
  // instead of re-rendering the same broken source forever.
  const [broken, setBroken] = useState(false);
  const [box, setBox] = useState<HTMLElement | null>(null);
  const [near, setNear] = useState(false);

  // Art shows without being asked for now, which means a wallet can put many
  // hundreds of tiles on the page at once. Fetching for all of them would
  // rebuild the fan-out problem the media proxy was just fixed for, so a tile
  // only asks for its metadata once it is near the viewport.
  useEffect(() => {
    if (!box || near) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setNear(true),
      { rootMargin: '300px' },
    );
    io.observe(box);
    return () => io.disconnect();
  }, [box, near]);

  useEffect(() => {
    if (!near) return;
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
  }, [chain, collection, instance.id, instance.imageUrl, near]);

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
    <button
      type="button"
      ref={setBox}
      onClick={() => onOpen(instance, meta)}
      aria-label={`Open ${title}`}
      className="group relative block w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] text-left transition-transform duration-150 hover:-translate-y-0.5 hover:border-[var(--text-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-faint)]">
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
        ) : state === 'loading' && !broken ? (
          <div className="flex flex-col items-center gap-1 px-2 text-center">
            <IconPhoto className="h-5 w-5 text-[var(--text-faint)]" />
            <span className="text-[9px] leading-tight text-[var(--text-faint)]">loading…</span>
          </div>
        ) : (
          <div className="relative h-full w-full">
            <GeneratedArt seed={`${collection}:${instance.id}`} />
            {/* Never unmarked — see GeneratedArt. */}
            <span
              className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-px text-[8px] font-semibold uppercase tracking-wider text-white/80"
              title="Artwork couldn't be fetched; this picture is generated from the token id"
            >
              generated
            </span>
          </div>
        )}
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-[11px] font-semibold text-[var(--text)]">{title}</p>
        {/*
          The id only earns a second line when the title isn't already it —
          without a name the title falls back to "#2113", and printing the id
          underneath said the same thing twice.
        */}
        {meta?.traits?.length ? (
          <p className="truncate text-[10px] text-[var(--text-faint)]">
            {meta.traits.length} trait{meta.traits.length === 1 ? '' : 's'}
          </p>
        ) : meta?.name ? (
          <p className="truncate text-[10px] text-[var(--text-faint)]">#{instance.id}</p>
        ) : null}
      </div>
    </button>
  );
}

function CollectionCard({ chain, c }: { chain: ChainId; c: Collection }) {
  // Open by default — the art is the point of the tab, and making people click
  // to see it hid the one thing they came for.
  const [open, setOpen] = useState(true);
  const [opened, setOpened] = useState<{ instance: Instance; meta: Meta | null } | null>(null);
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
          {c.locked.claim && Number(c.locked.claimableAmount) > 0 && (
            <div className="mt-2 rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-2">
              <p className="text-[12px] font-bold text-emerald-200">
                {prettyAmount(c.locked.claimableAmount)} {c.locked.symbol ?? ''} can be taken out now
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                Call{' '}
                <code className="rounded bg-black/30 px-1 py-0.5 text-[10px] text-[var(--text)]">
                  {c.locked.claim.method}
                </code>{' '}
                on the contract, once per NFT.
                {/*
                  Said outright, because it is the cost of the action and the
                  contract does not warn anyone: the override transfers the
                  tokens and then destroys the token that held them.
                */}
                {c.locked.claim.burnsNft && (
                  <> This <span className="font-semibold text-amber-300">destroys the NFT</span> — the
                  tokens come back, the collectible does not.</>
                )}
              </p>
              <a
                href={c.locked.claim.writeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:underline"
              >
                Open the contract to do it <IconExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {!c.locked.complete && (
            // Never let a partial sum read as a balance.
            <p className="mt-1 text-[10px] text-amber-300">
              read {c.locked.read.toLocaleString()} of {c.count.toLocaleString()} — the rest could not be
              listed, so the real total is higher
            </p>
          )}
        </div>
      )}

      {c.floor && (
        // Deliberately NOT multiplied by `count`. One seller asking 500,000 PLS
        // for one token says nothing about offloading a hundred of them, and
        // floor × held is a figure that looks like a valuation while being
        // made up. The wording says "asking", because that is all it is.
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          <span className="text-[var(--text-faint)]">Cheapest listed on Mintra</span>{' '}
          <span className="font-semibold text-[var(--text)]">
            {compact(c.floor.pls)} PLS
            {c.floor.usd != null && ` · $${c.floor.usd < 0.01 ? '<0.01' : compact(c.floor.usd)}`}
          </span>
          <span className="text-[var(--text-faint)]">
            {' '}· {c.floor.listed} listed
            {c.floor.otherCurrency > 0 && `, ${c.floor.otherCurrency} priced in other tokens`}
          </span>
        </p>
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
            {open ? 'Hide art' : `Show ${Math.min(c.instances.length, c.count)}`}
          </button>
          {open && (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {c.instances.map((i) => (
                <Tile
                  key={i.id}
                  chain={chain}
                  collection={c.address}
                  instance={i}
                  onOpen={(instance, meta) => setOpened({ instance, meta })}
                />
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

      {opened && (
        <NftDetail
          chain={chain}
          collection={c.address}
          collectionName={name}
          instance={opened.instance}
          meta={opened.meta}
          onClose={() => setOpened(null)}
        />
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
