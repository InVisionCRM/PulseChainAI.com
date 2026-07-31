'use client';

// "Depth" tab for the Geicko token view (PulseChain only).
//
// What a $100 / $1k / $10k trade would actually execute at, on both venues
// that can be quoted on chain — and putting them under one another is the
// point. The same table twice makes the comparison immediate: on PLSX a $10k
// ticket costs ~1% on PulseX against ~84% on LibertySwap. Split across two
// tabs, nobody would ever see that.
//
//   1. **PulseX** — the deep venue, quoted through its router.
//   2. **LibertySwap** — the small one, quoted through its QuoterV2.
//   3. **Bridge** — LibertySwap's USDC bridge between PulseChain and Ethereum.
//      It cannot quote this (or any) PulseChain token; it moves USDC only, so
//      it sits below the depth panel as a way to get funds here, clearly
//      separated rather than dressed up as token data.
//
// Nothing on this page is signable. The depth figures are `eth_call` reads,
// and the bridge proxy strips the API's calldata before it reaches the
// browser, so a compromised upstream can mislead a reader but cannot move
// anyone's money. The actual swap or bridge happens on LibertySwap.

import React, { useCallback, useState } from 'react';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import TradeDepthPanel from './TradeDepthPanel';
import {
  LIBERTY_FACTORY,
  LIBERTY_SWAP_ROUTER,
  LIBERTY_QUOTER_V2,
  LIBERTY_BRIDGE_CHAINS,
  LIBERTY_BRIDGE_MIN_UNITS,
  LIBERTY_BRIDGE_MAX_UNITS,
} from '@/lib/dex/libertyswap';

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
        <h2 className="text-[15px] font-semibold text-[var(--text)]">Trade depth</h2>
        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
          What a real ticket executes at on each venue, simulated on chain.
        </p>
      </div>

      <TradeDepthPanel token={token} venue="pulsex" symbol={sym} priceUsd={priceUsd} heading />

      <div className="border-t border-[var(--line)] pt-4">
        <TradeDepthPanel token={token} venue="liberty" symbol={sym} priceUsd={priceUsd} heading />
      </div>

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
