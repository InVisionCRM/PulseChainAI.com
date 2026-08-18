'use client';

// Everything the wallet has in a liquidity pool, in one place.
//
// Two shapes end up here. V2-style LP tokens are ERC-20s the wallet holds, so
// they arrive with the balance list already priced and split into their two
// sides. V3 positions are NFTs and can't be seen that way at all — they come
// from the position scan, which probes each held ERC-721 for the Uniswap-V3
// position-manager shape and so covers 9mm V3, LibertySwap and any other fork
// without a curated address list.
//
// Fees are shown apart from the position's value, never folded into it: on V3
// they're read from the pool's fee-growth accumulators, and on a PulseX V2 pair
// LpPositionRow reconstructs them from the wallet's own add/remove history.

import { useEffect, useMemo, useState } from 'react';
import { IconRefresh, IconDroplet, IconExternalLink } from '@tabler/icons-react';
import type { ChainId } from '@/services';
import { fmtUsd, fmtAmount } from '@/lib/format';
import LpPositionRow from '@/components/portfolio/LpPositionRow';

interface UnderlyingAsset {
  address: string; symbol: string; decimals: number; amount: number; valueUsd?: number;
}
interface ProtocolPosition {
  kind: 'lp' | 'vault' | 'lending' | 'farm' | 'staking';
  address: string; symbol: string; protocol?: string; note?: string; dex?: string;
  underlying: UnderlyingAsset[]; valueUsd?: number;
  fees?: UnderlyingAsset[];
  range?: { inRange: boolean; tickLower: number; tickUpper: number };
}

/** A V2 LP token as the balance list already knows it. */
export interface V2LpRow {
  chain: ChainId;
  address: string;
  symbol: string;
  balanceFormatted: number;
  valueUsd?: number;
  lp?: {
    pairAddress?: string;
    dexId?: string | null;
    userShare: number;
    // Mirrors LpUnderlying in services/core/types.ts. It said `amount` here
    // before, which does not exist on the real object — so every side amount
    // rendered as a dash — and it omitted weightPct entirely, which is why the
    // pair weighting disappeared when LP moved to its own tab.
    sides: {
      symbol: string;
      amountFormatted: number;
      valueUsd?: number;
      weightPct: number;
    }[];
  };
}

const explorer = (chain: ChainId, a: string) =>
  chain === 'ethereum' ? `https://etherscan.io/token/${a}` : `https://scan.pulsechain.com/address/${a}`;

/** DexScreener's dex ids, as a name worth printing. */
const DEX_LABEL: Record<string, string> = {
  pulsex: 'PulseX', '9mm': '9mm', '9inch': '9inch', 'liberty-swap': 'LibertySwap',
  switchx: 'SwitchX', 'pulse-rate': 'PulseRate', dextop: 'Dextop', uniswap: 'Uniswap',
  sushiswap: 'SushiSwap', pancakeswap: 'PancakeSwap',
};

/**
 * The split of value across a pair, drawn.
 *
 * A number alone ("50.2% / 49.8%") makes you read and compare; the bar shows
 * imbalance at a glance, which is the thing that actually matters — a pool
 * drifting to 80/20 means one side has been sold into heavily.
 *
 * Falls back to nothing rather than guessing when the weights don't add up:
 * an unpriced side leaves weightPct at whatever the reserves implied, and half
 * a bar is worse than no bar.
 */
function WeightBar({ sides }: { sides: { symbol: string; weightPct: number | null | undefined }[] }) {
  if (sides.length !== 2 || sides.some((s) => s.weightPct == null || !Number.isFinite(s.weightPct))) {
    return null;
  }
  const total = sides.reduce((sum, s) => sum + (s.weightPct as number), 0);
  if (total <= 0) return null;
  // Normalised, so a pair whose weights sum to 99.7 still fills the bar.
  const pct = sides.map((s) => ((s.weightPct as number) / total) * 100);
  const COLORS = ['#22d3ee', '#f59e0b']; // cyan-400, amber-500

  return (
    <div className="mt-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        {pct.map((p, i) => (
          <div
            key={sides[i].symbol}
            style={{ width: `${p}%`, background: COLORS[i] }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        {pct.map((p, i) => (
          <span key={sides[i].symbol} className="flex items-center gap-1.5 tabular-nums">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />
            <span className="font-semibold text-[var(--text)]">{p.toFixed(1)}%</span>
            <span className="text-[var(--text-faint)]">{sides[i].symbol}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Badge({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'good' | 'warn' }) {
  const cls =
    tone === 'good' ? 'border-emerald-400/40 text-emerald-300'
      : tone === 'warn' ? 'border-amber-400/40 text-amber-300'
        : 'border-[var(--line)] text-[var(--text-faint)]';
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  );
}

/**
 * Weights for a scanned position, from what each side is worth.
 *
 * V2 LP tokens arrive with weightPct already computed from pool reserves; a
 * scanned position doesn't, but it does carry a USD value per side, which is
 * the same thing. Returns nulls when a side isn't priced — half a weighting is
 * worse than none, and WeightBar declines to draw it.
 */
function sideWeights(u: UnderlyingAsset[]): { symbol: string; weightPct: number | null }[] {
  const total = u.reduce((sum, s) => sum + (s.valueUsd ?? 0), 0);
  const allPriced = u.every((s) => s.valueUsd != null);
  return u.map((s) => ({
    symbol: s.symbol,
    weightPct: allPriced && total > 0 ? ((s.valueUsd as number) / total) * 100 : null,
  }));
}

/** Fees priced off the position's own underlying, so no extra price lookup. */
function feesUsd(p: ProtocolPosition): number | null {
  if (!p.fees?.length) return null;
  let total = 0;
  let priced = false;
  for (const f of p.fees) {
    const side = p.underlying.find((u) => u.address.toLowerCase() === f.address.toLowerCase());
    if (!side || !side.valueUsd || !side.amount) continue;
    priced = true;
    total += (side.valueUsd / side.amount) * f.amount;
  }
  return priced ? total : null;
}

export function LpPositions({
  walletAddress, chains, v2,
}: { walletAddress: string; chains: ChainId[]; v2: V2LpRow[] }) {
  // Values reconstructed by LpPositionRow from PulseX history, keyed by pair.
  // The header has no price for a pair DexScreener never listed; this panel
  // can still work one out, so the card borrows it rather than showing nothing.
  const [reconstructed, setReconstructed] = useState<Record<string, number>>({});
  // Raw scan results, before the balance list's own V2 rows are subtracted.
  // Kept unfiltered so that subtraction can happen at render time — see below.
  const [found, setFound] = useState<{ pos: ProtocolPosition; chain: ChainId }[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = () => {
    setStatus('loading');
    Promise.all(
      chains.map((chain) =>
        fetch('/api/portfolio/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: walletAddress, chain }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d ? { chain, ...d } : null))
          .catch(() => null),
      ),
    )
      .then((results) => {
        const all: { pos: ProtocolPosition; chain: ChainId }[] = [];
        for (const res of results) {
          if (!res) continue;
          for (const g of (res.groups as { kind: string; positions: ProtocolPosition[] }[]) ?? []) {
            if (g.kind !== 'lp') continue;
            for (const pos of g.positions) all.push({ pos, chain: res.chain });
          }
        }
        setFound(all);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  };

  // Deliberately NOT keyed on `v2`. The scan behind this is expensive — it
  // probes every held token and every position NFT on chain — and `v2` only
  // ever mattered for the de-duplication below, which is a pure filter over
  // results already in hand. Keying the fetch on it meant opening the LP tab
  // while the balance list was still arriving re-ran the whole scan the moment
  // it landed, and two of these in flight at once share one RPC egress: a scan
  // that takes ~9s alone took 55s when it was racing a duplicate of itself.
  useEffect(load, [walletAddress, chains.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // The V2 LP tokens are already on screen from the balance list; the position
  // scan finds them too, so drop the duplicates by address. The scan also finds
  // V2 LP the balance list's symbol heuristic misses, which is why this can't
  // just be "show the V3 ones" — only the V3 ones carry a range and fees, and
  // that's what splits the two groups downstream.
  const v3 = useMemo(() => {
    const held = new Set(v2.map((t) => t.address.toLowerCase()));
    return found.filter((f) => !held.has(f.pos.address.toLowerCase()));
  }, [found, v2]);

  const total = useMemo(() => {
    const a = v2.reduce((t, r) => t + (r.valueUsd ?? 0), 0);
    const b = v3.reduce((t, r) => t + (r.pos.valueUsd ?? 0), 0);
    return a + b;
  }, [v2, v3]);

  const empty = v2.length === 0 && v3.length === 0;
  const v3Count = v3.filter((r) => !!r.pos.range).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <IconDroplet className="h-4 w-4 text-sky-400" /> Liquidity positions
          {status === 'ready' && total > 0 && (
            <span className="tabular-nums text-[var(--text-muted)]">· {fmtUsd(total)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={status === 'loading'}
          title="Re-scan"
          className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-40"
        >
          <IconRefresh className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* V2 LP tokens — held as ERC-20s, so they're already priced. */}
      {v2.map((t) => {
        const sides = t.lp?.sides ?? [];
        const name = sides.length === 2 ? `${sides[0].symbol}/${sides[1].symbol}` : t.symbol;
        const dex = t.lp?.dexId ? DEX_LABEL[t.lp.dexId] ?? t.lp.dexId : null;
        return (
          <div key={`${t.chain}:${t.address}`} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-[var(--text)]">{name}</span>
              {dex && <Badge>{dex}</Badge>}
              <Badge>V2</Badge>
              <a
                href={explorer(t.chain, t.address)}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--text-faint)] hover:text-[var(--text)]"
                aria-label="View the pair on the explorer"
              >
                <IconExternalLink className="h-3.5 w-3.5" />
              </a>
              <span className="ml-auto tabular-nums text-sm font-bold text-[var(--text)]">
                {t.valueUsd != null
                  ? fmtUsd(t.valueUsd)
                  : t.lp?.pairAddress && reconstructed[t.lp.pairAddress.toLowerCase()] != null
                    ? fmtUsd(reconstructed[t.lp.pairAddress.toLowerCase()])
                    : '—'}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--text-muted)]">
              {sides.map((s) => (
                <span key={s.symbol} className="tabular-nums">
                  {fmtAmount(s.amountFormatted)} <span className="text-[var(--text-faint)]">{s.symbol}</span>
                </span>
              ))}
              {t.lp?.userShare != null && (
                <span className="tabular-nums text-[var(--text-faint)]">
                  {(t.lp.userShare * 100).toLocaleString(undefined, { maximumFractionDigits: 4 })}% of the pool
                </span>
              )}
            </div>
            <WeightBar sides={sides} />
            {t.lp?.pairAddress && (
              <LpPositionRow
                pair={t.lp.pairAddress}
                wallet={walletAddress}
                chain={t.chain}
                balance={t.balanceFormatted}
                onCurrentValue={(usd) =>
                  setReconstructed((prev) =>
                    prev[t.lp!.pairAddress!.toLowerCase()] === usd
                      ? prev
                      : { ...prev, [t.lp!.pairAddress!.toLowerCase()]: usd },
                  )
                }
              />
            )}
          </div>
        );
      })}

      {/* V2 pairs the scan found that the balance list didn't flag as LP. */}
      {v3.filter((r) => !r.pos.range).map(({ pos, chain }, i) => (
        <div key={`v2x:${chain}:${pos.address}:${i}`} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-[var(--text)]">
              {pos.underlying.length === 2
                ? `${pos.underlying[0].symbol}/${pos.underlying[1].symbol}`
                : pos.symbol}
            </span>
            {pos.protocol && <Badge>{pos.protocol}</Badge>}
            <Badge>V2</Badge>
            <a
              href={explorer(chain, pos.address)}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--text-faint)] hover:text-[var(--text)]"
              aria-label="View the pair on the explorer"
            >
              <IconExternalLink className="h-3.5 w-3.5" />
            </a>
            <span className="ml-auto tabular-nums text-sm font-bold text-[var(--text)]">
              {pos.valueUsd != null ? fmtUsd(pos.valueUsd) : '—'}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--text-muted)]">
            {pos.underlying.map((u) => (
              <span key={u.address} className="tabular-nums">
                {fmtAmount(u.amount)} <span className="text-[var(--text-faint)]">{u.symbol}</span>
              </span>
            ))}
          </div>
          <WeightBar sides={sideWeights(pos.underlying)} />
        </div>
      ))}

      {/* V3 positions — NFTs, with fees read from the pool. */}
      {v3.filter((r) => !!r.pos.range).map(({ pos, chain }, i) => {
        const fUsd = feesUsd(pos);
        const hasFees = !!pos.fees?.some((f) => f.amount > 0);
        return (
          <div key={`${chain}:${pos.address}:${i}`} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-[var(--text)]">{pos.symbol.replace(/ V3$/, '')}</span>
              {pos.dex && <Badge>{pos.dex}</Badge>}
              <Badge>V3</Badge>
              {pos.range && (
                <Badge tone={pos.range.inRange ? 'good' : 'warn'}>
                  {pos.range.inRange ? 'in range' : 'out of range'}
                </Badge>
              )}
              <span className="ml-auto tabular-nums text-sm font-bold text-[var(--text)]">
                {pos.valueUsd != null ? fmtUsd(pos.valueUsd) : '—'}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--text-muted)]">
              {pos.underlying.map((u) => (
                <span key={u.address} className="tabular-nums">
                  {fmtAmount(u.amount)} <span className="text-[var(--text-faint)]">{u.symbol}</span>
                </span>
              ))}
            </div>
            {/*
              Worth the most on a V3 position: a concentrated range drifts to
              one side as price moves through it, and an out-of-range position
              is 100/0. The split is the fastest read of where it sits.
            */}
            <WeightBar sides={sideWeights(pos.underlying)} />
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--line)] pt-2 text-[12px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Uncollected fees
              </span>
              {pos.fees ? (
                <>
                  {pos.fees.map((f) => (
                    <span key={f.address} className="tabular-nums text-[var(--text-muted)]">
                      {fmtAmount(f.amount)} <span className="text-[var(--text-faint)]">{f.symbol}</span>
                    </span>
                  ))}
                  {fUsd != null && (
                    <span className="ml-auto tabular-nums font-semibold text-emerald-300">{fmtUsd(fUsd)}</span>
                  )}
                  {!hasFees && (
                    <span className="text-[var(--text-faint)]">nothing accrued since the last collect</span>
                  )}
                </>
              ) : (
                <span className="text-[var(--text-faint)]">
                  couldn’t be read from the pool — not the same as zero
                </span>
              )}
            </div>
            {!pos.range?.inRange && (
              <p className="mt-1.5 text-[11px] text-[var(--text-faint)]">
                Out of range: the position is entirely one side and is earning nothing until price returns.
              </p>
            )}
          </div>
        );
      })}

      {status === 'loading' && v3Count === 0 && (
        <div className="grid place-items-center py-10 text-sm text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-2">
            <IconRefresh className="h-4 w-4 animate-spin" /> Scanning for V3 positions…
          </span>
        </div>
      )}
      {status === 'error' && (
        <div className="py-8 text-center text-sm text-red-300">Couldn’t scan for liquidity positions.</div>
      )}
      {status === 'ready' && empty && (
        <div className="py-10 text-center text-sm text-[var(--text-faint)]">
          No liquidity positions found. This covers V2 LP tokens and V3 positions on
          PulseX, 9mm and LibertySwap — and any other Uniswap fork, since positions are
          found by shape rather than from a list of addresses.
        </div>
      )}
    </div>
  );
}

export default LpPositions;
