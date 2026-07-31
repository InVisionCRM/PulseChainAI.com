'use client';

// "What would a trade of this size actually get me" — one panel, either venue.
//
// The two backends differ (PulseX is a V2 fork quoted through its router,
// LibertySwap a V3 fork quoted through QuoterV2) but the question and the
// arithmetic are identical, so they render identically too. That is the point:
// put the same table under both and the comparison is immediate — on PLSX,
// PulseX costs ~1% at a $10k ticket where LibertySwap costs ~84%.
//
// Slippage is measured against the $100 ticket rather than a mid-price,
// because a mid-price is a number nobody can trade at.

import React, { useEffect, useRef, useState } from 'react';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';

export interface DepthStep {
  usd: number;
  tokens: number;
  usdOther: number;
  effectivePrice: number;
  impactPct: number;
}
interface DepthResp {
  supported?: boolean;
  hasRoute?: boolean;
  reason?: string;
  symbol?: string | null;
  marketPriceUsd?: number;
  route?: {
    // PulseX
    version?: 'v1' | 'v2';
    pathLabel?: string;
    hops?: number;
    alternatives?: { version: string; pathLabel: string; worseByPct: number }[];
    // LibertySwap
    feeTier?: number;
    feePct?: number;
    pool?: string | null;
    tiersWithLiquidity?: number[];
    // both
    hub?: string;
  };
  buy?: DepthStep[];
  sell?: DepthStep[];
  vsMarketPct?: number | null;
  hubsChecked?: string[];
  error?: string;
}

export type DepthVenue = 'pulsex' | 'liberty';

const VENUES: Record<DepthVenue, { name: string; endpoint: string; blurb: string }> = {
  pulsex: {
    name: 'PulseX',
    endpoint: '/api/geicko/pulsex-depth',
    blurb:
      'Simulated on chain through the PulseX router — both v1 and v2, direct and two-hop routes, best output wins.',
  },
  liberty: {
    name: 'LibertySwap',
    endpoint: '/api/geicko/liberty-depth',
    blurb: 'Simulated on chain with LibertySwap’s QuoterV2 across its four fee tiers.',
  },
};

const fmtUsd = (v: number) => {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e3) return `${s}$${a.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (a >= 1) return `${s}$${a.toFixed(2)}`;
  return `${s}$${a.toFixed(4)}`;
};
/** Prices here run from cents to 1e-9, so significant digits beat fixed ones. */
const fmtPrice = (v: number) => (v > 0 ? `$${v.toPrecision(5)}` : '—');
const fmtTokens = (v: number) => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(v >= 1 ? 2 : 6);
};
const pct = (v: number, digits = 2) => `${v >= 0 ? '' : '-'}${Math.abs(v).toFixed(digits)}%`;

/** Slippage is only alarming past a point; colour it rather than make people read. */
function impactClass(p: number): string {
  if (p < 1) return 'text-[var(--up)]';
  if (p < 5) return 'text-[var(--text)]';
  if (p < 20) return 'text-amber-400';
  return 'text-red-400';
}

const Chip = ({
  children,
  strong,
  tone,
  title,
}: {
  children: React.ReactNode;
  strong?: boolean;
  tone?: string;
  title?: string;
}) => (
  <span
    title={title}
    className={`rounded-md border bg-[var(--surface)] px-2 py-1 text-[11px] ${
      strong ? 'border-[var(--line-strong)] font-semibold' : 'border-[var(--line)]'
    } ${tone ?? (strong ? 'text-[var(--text)]' : 'text-[var(--text-muted)]')}`}
  >
    {children}
  </span>
);

/**
 * Four columns a side, so both tables fit next to each other without a
 * horizontal scrollbar swallowing the slippage figure. The buy side's answer
 * is "how many tokens", the sell side's is "how many dollars back"; the other
 * leg of each trade is the ticket, and the exact amount is on hover.
 */
function DepthTable({
  side,
  steps,
  symbol,
}: {
  side: 'buy' | 'sell';
  steps: DepthStep[];
  symbol: string;
}) {
  const buying = side === 'buy';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[300px] text-left text-[12px]">
        <thead>
          <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
            <th className="py-1.5 pr-2 font-medium">Ticket</th>
            <th className="py-1.5 pr-2 font-medium">You get</th>
            <th className="py-1.5 pr-2 font-medium">Price</th>
            <th className="py-1.5 font-medium">Slippage</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.usd} className="border-b border-[var(--line)]/50 last:border-0">
              <td
                className="py-1.5 pr-2 font-semibold text-[var(--text)]"
                title={buying ? undefined : `${fmtTokens(s.tokens)} ${symbol} in`}
              >
                {fmtUsd(s.usd)}
              </td>
              <td className="py-1.5 pr-2 text-[var(--text)]">
                {buying ? `${fmtTokens(s.tokens)} ${symbol}` : fmtUsd(s.usdOther)}
              </td>
              <td className="py-1.5 pr-2 font-mono text-[11px] text-[var(--text)]">
                {fmtPrice(s.effectivePrice)}
              </td>
              <td className={`py-1.5 font-semibold ${impactClass(s.impactPct)}`}>
                {s.impactPct <= 0.005 ? '—' : pct(s.impactPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface TradeDepthPanelProps {
  token: string;
  venue: DepthVenue;
  symbol?: string;
  priceUsd?: number;
  /** Show the venue name as a heading. Off when the parent already says it. */
  heading?: boolean;
}

export default function TradeDepthPanel({
  token,
  venue,
  symbol,
  priceUsd,
  heading = false,
}: TradeDepthPanelProps) {
  const v = VENUES[venue];
  const [data, setData] = useState<DepthResp | null>(null);
  const [loading, setLoading] = useState(true);
  const sym = symbol || 'token';

  // The price only scales the sell-side ticket sizes, so it rides in a ref
  // rather than the dependency list. It used to be a dependency, and because
  // it arrives late and then ticks with the live pair feed, every tick tore a
  // loaded panel back down to "Simulating trades…" — on a cold call that takes
  // tens of seconds, the spinner never cleared and the panel looked missing.
  const priceRef = useRef(priceUsd);
  priceRef.current = priceUsd;

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setData(null);
    setLoading(true);
    const price = priceRef.current && priceRef.current > 0 ? `&price=${priceRef.current}` : '';
    fetch(`${v.endpoint}?token=${token}&network=pulsechain${price}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ error: 'Could not reach the quoter' }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token, v.endpoint]);

  const Head = heading ? (
    <div>
      <h3 className="text-[14px] font-semibold text-[var(--text)]">{v.name} trade depth</h3>
      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{v.blurb}</p>
    </div>
  ) : null;

  if (loading && !data) {
    return (
      <div className="space-y-2">
        {Head}
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 text-[13px] text-[var(--text-muted)]">
          Simulating trades through {v.name}…
        </div>
      </div>
    );
  }
  if (!data || data.error || data.supported === false) {
    return (
      <div className="space-y-2">
        {Head}
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 text-[13px] text-[var(--text-muted)]">
          {data?.error ?? 'No response from the quoter.'}
        </div>
      </div>
    );
  }
  if (!data.hasRoute) {
    return (
      <div className="space-y-2">
        {Head}
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="text-[13px] font-semibold text-[var(--text)]">No {v.name} route</div>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
            {data.reason === 'unknown-decimals'
              ? 'This contract did not answer decimals(), so a quote cannot be scaled correctly.'
              : venue === 'pulsex'
                ? `Neither PulseX v1 nor v2 could route this token from ${(data.hubsChecked ?? []).join(', ')}, directly or through PLSX or HEX. That usually means it has no live pair.`
                : `LibertySwap has no pool for this token against ${(data.hubsChecked ?? []).join(', ')} on any of its four fee tiers. That is normal — it is a small venue with a few hundred pools, not a mirror of PulseX.`}
          </p>
        </div>
      </div>
    );
  }

  const r = data.route ?? {};
  const vs = data.vsMarketPct;

  return (
    <div className="space-y-3">
      {Head}

      <div className="flex flex-wrap items-center gap-2">
        {r.version && <Chip strong>PulseX {r.version}</Chip>}
        {r.pathLabel ? (
          <Chip strong={!r.version}>{r.pathLabel}</Chip>
        ) : (
          r.hub && <Chip strong>via {r.hub}</Chip>
        )}
        {r.feePct != null && <Chip>{r.feePct}% fee tier</Chip>}
        {(r.tiersWithLiquidity?.length ?? 0) > 1 && (
          <Chip tone="text-[var(--text-faint)]">
            best of {r.tiersWithLiquidity!.map((t) => `${t / 10_000}%`).join(', ')}
          </Chip>
        )}
        {r.pool && (
          <a
            href={pulsechainAddressUrl(r.pool)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 font-mono text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text)]"
          >
            pool {r.pool.slice(0, 6)}…{r.pool.slice(-4)}
          </a>
        )}
        {vs != null && (
          <Chip
            tone={Math.abs(vs) < 2 ? 'text-[var(--up)] font-semibold' : 'text-amber-400 font-semibold'}
            title={`${v.name}'s small-trade price against this token's market price. Near zero means the pool is well arbitraged.`}
          >
            {pct(vs)} vs market
          </Chip>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--up)]">
            Buying {sym}
          </div>
          <DepthTable side="buy" steps={data.buy ?? []} symbol={sym} />
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-red-400">
            Selling {sym}
          </div>
          {data.sell?.length ? (
            <DepthTable side="sell" steps={data.sell} symbol={sym} />
          ) : (
            <p className="py-3 text-[12px] text-[var(--text-muted)]">
              No sell quote — the market price needed to size the trade is unknown.
            </p>
          )}
        </div>
      </div>

      {(r.alternatives?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
            Routes that lost
          </div>
          <div className="flex flex-wrap gap-1.5">
            {r.alternatives!.map((a) => (
              <Chip key={`${a.version}-${a.pathLabel}`} tone="text-[var(--text-faint)]">
                <span className="font-medium text-[var(--text-muted)]">{a.version}</span>{' '}
                {a.pathLabel} · −{a.worseByPct.toFixed(2)}%
              </Chip>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
        Slippage is measured against the $100 ticket, the closest thing to spot this venue can
        quote. Every figure is a live <span className="font-mono">eth_call</span>, so it includes
        the pool&apos;s real curve — but it is pool maths only. A token that charges a transfer tax
        (a toll, reflections) delivers less than this, because the token contract takes its cut
        after the router has done its part.
      </p>
    </div>
  );
}
