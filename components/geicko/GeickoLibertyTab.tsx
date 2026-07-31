'use client';

// "Liberty" tab for the Geicko token view (PulseChain only).
//
// Two things live here, and they answer different questions:
//
//   1. **Depth** — what a $100 / $1k / $10k trade in this token would actually
//      execute at on LibertySwap, simulated on chain by its QuoterV2. This is
//      the honest version of "how deep is this pool": not TVL, but the price
//      you'd really get, and how much worse it gets as the ticket grows.
//   2. **Bridge** — LibertySwap's USDC bridge between PulseChain and Ethereum.
//      It cannot quote this (or any) PulseChain token; it moves USDC only, so
//      it sits below the depth panel as a way to get funds here, clearly
//      separated rather than dressed up as token data.
//
// Nothing on this page is signable. The depth figures are `eth_call` reads,
// and the bridge proxy strips the API's calldata before it reaches the
// browser, so a compromised upstream can mislead a reader but cannot move
// anyone's money. The actual swap or bridge happens on LibertySwap.

import React, { useCallback, useEffect, useState } from 'react';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import {
  LIBERTY_FACTORY,
  LIBERTY_SWAP_ROUTER,
  LIBERTY_QUOTER_V2,
  LIBERTY_BRIDGE_CHAINS,
  LIBERTY_BRIDGE_MIN_UNITS,
  LIBERTY_BRIDGE_MAX_UNITS,
} from '@/lib/dex/libertyswap';

interface Step {
  usd: number;
  tokens: number;
  usdOther: number;
  effectivePrice: number;
  impactPct: number;
  gas: number;
}
interface DepthResp {
  supported?: boolean;
  hasRoute?: boolean;
  reason?: string;
  symbol?: string | null;
  marketPriceUsd?: number;
  route?: {
    hub: string;
    hubAddress: string;
    feeTier: number;
    feePct: number;
    pool: string | null;
    tiersWithLiquidity: number[];
  };
  buy?: Step[];
  sell?: Step[];
  vsMarketPct?: number | null;
  hubsChecked?: string[];
  error?: string;
}
interface BridgeResp {
  ok?: boolean;
  direction?: 'in' | 'out';
  router?: string;
  routerListed?: boolean;
  srcAmount?: number;
  destAmount?: number;
  feePct?: number;
  feeAmount?: number;
  error?: string;
}

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

/** Impact is only alarming past a point; colour it rather than make people read. */
function impactClass(p: number): string {
  if (p < 1) return 'text-[var(--up)]';
  if (p < 5) return 'text-[var(--text)]';
  if (p < 20) return 'text-amber-400';
  return 'text-red-400';
}

function Addr({ label, address }: { label: string; address: string }) {
  return (
    <a
      href={pulsechainAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 transition-colors hover:border-[var(--line-strong)]"
    >
      <span className="text-[11px] font-medium text-[var(--text-muted)]">{label}</span>
      <span className="font-mono text-[11px] text-[var(--text)]">
        {address.slice(0, 6)}…{address.slice(-4)}
      </span>
    </a>
  );
}

// ── depth ───────────────────────────────────────────────────────────────────

/**
 * Four columns a side, so both tables fit next to each other without a
 * horizontal scrollbar swallowing the slippage figure. The buy side's answer
 * is "how many tokens", the sell side's is "how many dollars back"; the other
 * leg of each trade is the ticket, and the exact amount is on hover.
 */
function DepthTable({ side, steps, symbol }: { side: 'buy' | 'sell'; steps: Step[]; symbol: string }) {
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

function DepthSection({ token, priceUsd, symbol }: { token: string; priceUsd?: number; symbol: string }) {
  const [data, setData] = useState<DepthResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    const price = priceUsd && priceUsd > 0 ? `&price=${priceUsd}` : '';
    fetch(`/api/geicko/liberty-depth?token=${token}&network=pulsechain${price}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ error: 'Could not reach the quoter' }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token, priceUsd]);

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 text-[13px] text-[var(--text-muted)]">
        Simulating trades through LibertySwap…
      </div>
    );
  }
  if (!data || data.error) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 text-[13px] text-[var(--text-muted)]">
        {data?.error ?? 'No response from the quoter.'}
      </div>
    );
  }
  if (!data.hasRoute) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="text-[13px] font-semibold text-[var(--text)]">No LibertySwap pool</div>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
          {data.reason === 'unknown-decimals'
            ? 'This contract did not answer decimals(), so a quote cannot be scaled correctly.'
            : `LibertySwap has no pool for this token against ${(data.hubsChecked ?? []).join(', ')} on any of its four fee tiers. That is normal — it is a small venue with a few hundred pools, not a mirror of PulseX.`}
        </p>
      </div>
    );
  }

  const r = data.route!;
  const vs = data.vsMarketPct;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text)]">
          via {r.hub}
        </span>
        <span className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
          {r.feePct}% fee tier
        </span>
        {r.tiersWithLiquidity.length > 1 && (
          <span className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-faint)]">
            best of {r.tiersWithLiquidity.map((t) => `${t / 10_000}%`).join(', ')}
          </span>
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
          <span
            className={`rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold ${
              Math.abs(vs) < 2 ? 'text-[var(--up)]' : 'text-amber-400'
            }`}
            title="LibertySwap's small-trade price against this token's market price. Near zero means the pool is well arbitraged."
          >
            {pct(vs)} vs market
          </span>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--up)]">
            Buying {symbol}
          </div>
          <DepthTable side="buy" steps={data.buy ?? []} symbol={symbol} />
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-red-400">
            Selling {symbol}
          </div>
          {data.sell?.length ? (
            <DepthTable side="sell" steps={data.sell} symbol={symbol} />
          ) : (
            <p className="py-3 text-[12px] text-[var(--text-muted)]">
              No sell quote — the market price needed to size the trade is unknown.
            </p>
          )}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
        Slippage is measured against the $100 ticket, the closest thing to spot this pool can
        quote. Every figure is a live <span className="font-mono">eth_call</span> to LibertySwap&apos;s
        QuoterV2, so it includes the pool&apos;s real curve — not a mid-price estimate — but it is a
        simulation, not a guaranteed fill.
      </p>
    </div>
  );
}

// ── bridge ──────────────────────────────────────────────────────────────────

function BridgeSection() {
  // One corridor, so there is nothing to pick: PulseChain ↔ Ethereum.
  const chain = LIBERTY_BRIDGE_CHAINS[0];
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('100');
  const [quote, setQuote] = useState<BridgeResp | null>(null);
  const [loading, setLoading] = useState(false);

  const amountNum = Number(amount);
  const amountValid =
    Number.isFinite(amountNum) &&
    amountNum >= LIBERTY_BRIDGE_MIN_UNITS &&
    amountNum <= LIBERTY_BRIDGE_MAX_UNITS;

  const run = useCallback(async () => {
    if (!amountValid) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/geicko/liberty-bridge?chain=${chain.id}&direction=${direction}&amount=${amountNum}`,
      );
      setQuote(await r.json());
    } catch {
      setQuote({ ok: false, error: 'Could not reach the bridge API' });
    } finally {
      setLoading(false);
    }
  }, [chain.id, direction, amountNum, amountValid]);

  const from = direction === 'in' ? chain.name : 'PulseChain';
  const to = direction === 'in' ? 'PulseChain' : chain.name;

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="text-[13px] font-semibold text-[var(--text)]">Bridge USDC</div>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
        LibertySwap&apos;s bridge moves USDC between PulseChain and {chain.name}. It cannot quote
        this token — or any PulseChain token — so this is here as a way to get funds onto the
        chain, not as a price for the asset above.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
            Direction
          </span>
          <select
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value as 'in' | 'out');
              setQuote(null);
            }}
            className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text)]"
          >
            <option value="in">→ to PulseChain</option>
            <option value="out">← from PulseChain</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
            USDC ({LIBERTY_BRIDGE_MIN_UNITS}–{LIBERTY_BRIDGE_MAX_UNITS.toLocaleString()})
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setQuote(null);
            }}
            className="h-8 w-28 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text)]"
          />
        </label>

        <button
          type="button"
          onClick={run}
          disabled={!amountValid || loading}
          className="h-8 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-[12px] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40"
        >
          {loading ? 'Quoting…' : 'Get quote'}
        </button>
      </div>

      {!amountValid && amount !== '' && (
        <p className="mt-2 text-[11px] text-amber-400">
          The bridge only accepts {LIBERTY_BRIDGE_MIN_UNITS}–
          {LIBERTY_BRIDGE_MAX_UNITS.toLocaleString()} USDC per transfer.
        </p>
      )}

      {quote && !quote.ok && (
        <p className="mt-3 text-[12px] text-red-400">{quote.error ?? 'No quote available.'}</p>
      )}

      {quote?.ok && (
        <div className="mt-3 space-y-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
            <span className="text-[var(--text-muted)]">
              {quote.srcAmount?.toLocaleString()} USDC on {from}
            </span>
            <span className="text-[var(--text-faint)]">→</span>
            <span className="font-semibold text-[var(--text)]">
              {quote.destAmount?.toLocaleString()} USDC on {to}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
            <span>
              Fee {quote.feePct}% ({quote.feeAmount?.toFixed(2)} USDC)
            </span>
            <span>
              Router{' '}
              <a
                href={pulsechainAddressUrl(quote.router ?? '')}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[var(--text)] underline decoration-dotted"
              >
                {quote.router?.slice(0, 6)}…{quote.router?.slice(-4)}
              </a>
            </span>
            {/*
              Inbound quotes return a router on Ethereum, and LibertySwap only
              publishes its PulseChain deployments — so "unlisted" is the
              expected answer there and shouldn't be dressed up as a warning.
              Outbound is the case that matters: that router IS published, and
              an unlisted one would be the tampering their docs warn about.
            */}
            <span
              className={
                quote.routerListed
                  ? 'text-[var(--up)]'
                  : direction === 'in'
                    ? 'text-[var(--text-faint)]'
                    : 'text-amber-400'
              }
            >
              {quote.routerListed
                ? 'on LibertySwap’s published router list'
                : direction === 'in'
                  ? 'Ethereum-side router — LibertySwap publishes its PulseChain routers only'
                  : 'not on LibertySwap’s published router list'}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
            Quote only — no transaction data is produced here, so nothing on this page can be
            signed. Bridge on LibertySwap itself.
          </p>
        </div>
      )}
    </div>
  );
}

// ── tab ─────────────────────────────────────────────────────────────────────

export interface GeickoLibertyTabProps {
  token: string;
  symbol?: string;
  priceUsd?: number;
}

export default function GeickoLibertyTab({ token, symbol, priceUsd }: GeickoLibertyTabProps) {
  const sym = symbol || 'token';
  return (
    <div className="w-full space-y-4 p-2 md:p-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">LibertySwap</h2>
        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
          Trade depth simulated on chain, plus the USDC bridge.
        </p>
      </div>

      <DepthSection token={token} priceUsd={priceUsd} symbol={sym} />

      <BridgeSection />

      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
          Verified contracts
        </div>
        <div className="grid gap-1.5 sm:grid-cols-3">
          <Addr label="Factory" address={LIBERTY_FACTORY} />
          <Addr label="SwapRouter" address={LIBERTY_SWAP_ROUTER} />
          <Addr label="QuoterV2" address={LIBERTY_QUOTER_V2} />
        </div>
      </div>
    </div>
  );
}
