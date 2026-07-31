'use client';

// Where a holder's transferred tokens came from, drawn rather than narrated.
//
// This replaces a paragraph of prose nobody read. The trace is a tree of
// senders, and a tree of senders is a picture: each root becomes one row,
// flowing left to right from the furthest-back origin we could reach to the
// holder. Depth is visible at a glance, which is the point — a one-hop trail
// and a three-hop trail should not look the same.
//
// Deliberately un-boxed. An earlier pass wrapped every number in its own
// bordered tile and every root in its own bar, which ate more vertical space
// than the data justified. Here the headline is one line of type, and each
// row's share of the transferred total IS the row's background fill — the
// proportion is drawn by the thing it describes instead of by an extra
// element next to it.
//
// Each row ends in a chip saying how that trail ended: at a buy, a router, the
// mint, a labelled address, or against one of the walk's limits. Those limits
// stay on the chip rather than in a footnote, because "we stopped looking" and
// "there was nothing to find" are different answers.

import React, { useState } from 'react';
import { fmtAmount } from '@/lib/format';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';

export interface OriginTraceNode {
  address: string;
  short: string;
  label: string | null;
  isContract: boolean;
  tokens: number;
  transfers: number;
  origin:
    | { kind: 'bought'; boughtTokens: number; boughtUsd: number; firstBuyTs: number | null; avgPriceUsd: number | null; coversSent: number }
    | { kind: 'minted' } | { kind: 'router' } | { kind: 'known'; category: string | null }
    | { kind: 'depth-capped' } | { kind: 'budget-capped' } | { kind: 'time-capped' }
    | { kind: 'untraceable' }
    | null;
  upstream: OriginTraceNode[] | null;
}

export interface OriginPayload {
  supported: boolean;
  hasData: boolean;
  inboundTokens?: number;
  routerDeliveredTokens?: number;
  coveragePct?: number | null;
  traces?: OriginTraceNode[];
  limits?: { truncated?: boolean; nodesUsed?: number; maxDepth?: number; timedOut?: boolean };
  note?: string;
}

const fmtDate = (ts: number | null | undefined) =>
  ts ? new Date(ts * 1000).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' }) : '';

/** How a trail ended: a short label, a colour, and the longer story on hover. */
function terminal(n: OriginTraceNode): { text: string; cls: string; title: string } | null {
  const o = n.origin;
  if (!o) return null;
  switch (o.kind) {
    case 'bought':
      return {
        // "bought 0%" read as "bought nothing", the opposite of what it means —
        // the sender did buy, its buys just don't account for most of what it
        // forwarded. Say what the number actually measures.
        text: o.coversSent < 0.95 ? `buys cover ${(o.coversSent * 100).toFixed(0)}%` : 'bought',
        cls: o.coversSent < 0.95 ? 'text-amber-300' : 'text-emerald-300',
        title:
          `Bought on PulseX${o.firstBuyTs ? ` ${fmtDate(o.firstBuyTs)}` : ''}` +
          `${o.avgPriceUsd != null ? ` at an average of $${o.avgPriceUsd.toPrecision(3)}` : ''}.` +
          (o.coversSent < 0.95
            ? ` Its own buys only cover ${(o.coversSent * 100).toFixed(0)}% of what it passed on, so the rest came from somewhere else.`
            : ''),
      };
    case 'router':
      return { text: 'router', cls: 'text-[var(--text-muted)]', title: 'A swap router or aggregator — the holder’s own buys arriving from the router’s address, already counted in its trade record.' };
    case 'minted':
      return { text: 'minted', cls: 'text-[var(--text-muted)]', title: 'The zero or burn address — these tokens were minted, not bought.' };
    case 'known':
      return { text: n.label ?? 'known', cls: 'text-sky-300', title: `${n.label ?? 'A labelled address'}${o.category ? ` (${o.category})` : ''}. What happens on the far side isn’t visible on this chain.` };
    case 'depth-capped':
      return { text: 'goes deeper', cls: 'text-amber-300', title: 'The trail keeps going — this is as deep as the walk goes.' };
    case 'budget-capped':
      return { text: 'more branches', cls: 'text-amber-300', title: 'This wallet has more inbound branches than the walk covers.' };
    case 'time-capped':
      return { text: 'timed out', cls: 'text-amber-300', title: 'The explorer was slow and the walk ran out of time here — about today’s upstream, not about the data.' };
    case 'untraceable':
      return { text: 'no source', cls: 'text-[var(--text-faint)]', title: 'No on-chain origin found — a bridge, an OTC deal, or tokens held from before the pools existed.' };
  }
}

/** Flatten one root into every distinct origin→holder path it contains. */
function lanes(node: OriginTraceNode): OriginTraceNode[][] {
  if (!node.upstream?.length) return [[node]];
  return node.upstream.flatMap((u) => lanes(u).map((path) => [...path, node]));
}

function Hop({ n }: { n: OriginTraceNode }) {
  return (
    <a
      href={pulsechainAddressUrl(n.address)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`${n.address}\n${fmtAmount(n.tokens)} passed on across ${n.transfers} transfer${n.transfers === 1 ? '' : 's'}`}
      className="shrink-0 font-mono text-[12px] text-[var(--text)] underline decoration-dotted decoration-[var(--line-strong)] underline-offset-2 hover:decoration-[var(--text)]"
    >
      {n.short}
      {n.isContract && <sup className="ml-0.5 text-[9px] text-purple-300">C</sup>}
    </a>
  );
}

export default function TransferOriginFlow({
  origin,
  tokenSymbol,
}: {
  origin: OriginPayload;
  tokenSymbol: string;
}) {
  const [showNotes, setShowNotes] = useState(false);

  const inbound = origin.inboundTokens ?? 0;
  const router = origin.routerDeliveredTokens ?? 0;
  const coverage = origin.coveragePct;
  // Router deliveries are the holder's own buys wearing a transfer's clothes;
  // they belong in the headline, not as a row, so the rows stay about tokens
  // that genuinely came from someone else.
  const roots = (origin.traces ?? []).filter((n) => n.origin?.kind !== 'router');
  const biggest = Math.max(...roots.map((r) => r.tokens), 0);
  const coverTone =
    coverage == null ? 'text-[var(--text-muted)]'
      : coverage >= 50 ? 'text-emerald-300'
      : coverage > 0 ? 'text-amber-300'
      : 'text-[var(--text-muted)]';

  return (
    <div className="space-y-2 border-l-2 border-cyan-500/40 pl-3">
      {/* One line of type instead of three bordered tiles. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[15px] font-semibold tabular-nums text-[var(--text)]">
          {fmtAmount(inbound)} <span className="text-[12px] font-normal text-[var(--text-muted)]">{tokenSymbol} in by transfer</span>
        </span>
        {coverage != null && (
          <span className={`text-[15px] font-semibold tabular-nums ${coverTone}`}>
            {coverage.toFixed(0)}% <span className="text-[12px] font-normal text-[var(--text-muted)]">traced to a buy</span>
          </span>
        )}
        {router > 0 && (
          <span className="text-[12px] tabular-nums text-[var(--text-faint)]">
            + {fmtAmount(router)} via routers (own buys)
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowNotes((v) => !v); }}
          className="ml-auto shrink-0 text-[11px] text-[var(--text-faint)] underline decoration-dotted transition-colors hover:text-[var(--text-muted)]"
          aria-expanded={showNotes}
        >
          {showNotes ? 'hide' : 'how to read this'}
        </button>
      </div>

      {roots.length === 0 ? (
        <div className="text-[12px] text-[var(--text-muted)]">
          No transfers from anyone else — everything here came from this wallet&apos;s own swaps.
        </div>
      ) : (
        <div className="space-y-px">
          {roots.flatMap((root) => {
            const share = biggest > 0 ? (root.tokens / biggest) * 100 : 0;
            return lanes(root).map((path, i) => (
              <div
                key={`${root.address}-${i}`}
                // The row's own fill is the share bar. No extra element, and the
                // proportion sits under the numbers it describes.
                style={{
                  background: `linear-gradient(to right, rgb(34 211 238 / 0.13) ${share}%, transparent ${share}%)`,
                }}
                className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-sm px-1.5 py-1 text-[12px]"
              >
                {path.map((n, j) => {
                  const t = j === 0 ? terminal(n) : null;
                  return (
                    <React.Fragment key={`${n.address}-${j}`}>
                      <Hop n={n} />
                      {t && <span className={`shrink-0 text-[11px] font-semibold ${t.cls}`} title={t.title}>{t.text}</span>}
                      <span aria-hidden className="shrink-0 text-[var(--text-faint)]">→</span>
                    </React.Fragment>
                  );
                })}
                <span className="shrink-0 font-semibold text-cyan-300">holder</span>
                {i === 0 && (
                  <span className="ml-auto shrink-0 tabular-nums text-[11px] text-[var(--text-muted)]">
                    {fmtAmount(root.tokens)}
                  </span>
                )}
              </div>
            ));
          })}
        </div>
      )}

      {(origin.limits?.timedOut || origin.limits?.truncated) && (
        <div className="text-[11px] text-amber-400/90">
          {origin.limits?.timedOut
            ? 'The explorer was slow — some trails stop earlier than the walk allows.'
            : 'Partial: this wallet has more transfer history than the walk covers.'}
        </div>
      )}

      {showNotes && (
        <div className="space-y-1 text-[11px] leading-relaxed text-[var(--text-faint)]">
          <p>Each row runs from the furthest-back sender we reached, on the left, to this holder. The word after an address says how that trail ended; the shaded width is that sender&apos;s share of the transferred total.</p>
          <p>Tokens are fungible, so when a sender both bought and received, both are shown rather than guessing which tokens moved. Nothing here is folded into PnL. PulseX v1+v2 only — other venues and bridged flow aren&apos;t visible.</p>
        </div>
      )}
    </div>
  );
}
