'use client';

import React, { useEffect, useState } from 'react';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';
import { txUrl, addressUrl } from '@/lib/pulsechain/explorer';

// "Trades" tab for the Geicko token view: a DexScreener-style live buys/sells
// feed plus a 24h top-traders table, both from PulseX v1+v2 swaps
// (/api/geicko/trades). Trader = swap recipient; top-traders is realized flow
// over 24h (bought/sold/net), not lifetime PnL.

interface Trade { type: 'buy' | 'sell'; ts: number; usd: number; tokenAmount: number; price: number; wallet: string; tx: string }
interface Trader { wallet: string; boughtUsd: number; soldUsd: number; volumeUsd: number; netUsd: number; buys: number; sells: number }
interface TradesResp {
  chain: string;
  supported?: boolean;
  empty?: boolean;
  pairCount?: number;
  recent?: Trade[];
  topTraders?: Trader[];
  error?: string;
}
type View = 'recent' | 'traders';

const fmtUsd = (v: number) => {
  const a = Math.abs(v); const s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  if (a >= 1) return `${s}$${a.toFixed(2)}`;
  return `${s}$${a.toFixed(a >= 0.01 ? 4 : 6)}`;
};
const fmtAmt = (v: number) => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return v.toFixed(2);
};
const fmtPrice = (v: number) => (v > 0 ? `$${v.toLocaleString('en-US', { maximumSignificantDigits: 4 })}` : '—');
const shortAddr = (a: string) => (a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '—');
const ago = (ts: number) => {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${active ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
    >
      {children}
    </button>
  );
}

function Wallet({ address, symbol }: { address: string; symbol?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <a href={addressUrl(address)} target="_blank" rel="noopener noreferrer" className="font-mono text-[var(--text-muted)] hover:text-[var(--text)]">
        {shortAddr(address)}
      </a>
      <AddToGroupButton address={address} source="tx" chain="pulsechain" context={{ tokenSymbol: symbol }} size={12}
        className="text-[var(--text-muted)] hover:text-orange-300 transition-colors" />
    </span>
  );
}

export default function GeickoTradesTab({
  network, token, symbol,
}: { network?: string | null; token?: string | null; symbol?: string }) {
  const [data, setData] = useState<TradesResp | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [view, setView] = useState<View>('recent');

  useEffect(() => {
    if (!token) { setStatus('idle'); return; }
    let alive = true;
    setStatus('loading');
    const qs = new URLSearchParams();
    if (network) qs.set('network', network);
    qs.set('token', token);
    fetch(`/api/geicko/trades?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: TradesResp) => {
        if (!alive) return;
        if (d.error || d.supported === false) { setStatus('error'); return; }
        if (d.empty || (!d.recent?.length && !d.topTraders?.length)) { setStatus('empty'); return; }
        setData(d);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [network, token]);

  if (status === 'loading' || status === 'idle') {
    return <div className="py-10 text-center text-sm text-[var(--text-muted)]">Loading trades…</div>;
  }
  if (status === 'error' || status === 'empty') {
    return <div className="py-10 text-center text-sm text-[var(--text-muted)]">No recent trade activity for this token.</div>;
  }

  return (
    <div className="p-2 md:p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
          <Tab active={view === 'recent'} onClick={() => setView('recent')}>Recent trades</Tab>
          <Tab active={view === 'traders'} onClick={() => setView('traders')}>Top traders (24h)</Tab>
        </div>
        {data?.pairCount ? <span className="text-[10px] tabular-nums text-[var(--text-faint)]">{data.pairCount} pairs</span> : null}
      </div>

      {view === 'recent' && (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
          <table className="w-full min-w-[560px] text-[11px] tabular-nums">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                <th className="px-2 py-1.5 font-medium">Type</th>
                <th className="px-2 py-1.5 font-medium text-right">Price</th>
                <th className="px-2 py-1.5 font-medium text-right">Value</th>
                <th className="px-2 py-1.5 font-medium text-right">Amount</th>
                <th className="px-2 py-1.5 font-medium">Wallet</th>
                <th className="px-2 py-1.5 font-medium text-right">Age</th>
              </tr>
            </thead>
            <tbody>
              {data?.recent?.map((t, i) => (
                <tr key={`${t.tx}-${i}`} className="border-b border-[var(--line)]/50 last:border-0 hover:bg-white/5">
                  <td className={`px-2 py-1 font-bold ${t.type === 'buy' ? 'text-[var(--up)]' : 'text-red-400'}`}>{t.type === 'buy' ? 'Buy' : 'Sell'}</td>
                  <td className="px-2 py-1 text-right text-[var(--text-muted)]">{fmtPrice(t.price)}</td>
                  <td className={`px-2 py-1 text-right font-semibold ${t.type === 'buy' ? 'text-[var(--up)]' : 'text-red-400'}`}>{fmtUsd(t.usd)}</td>
                  <td className="px-2 py-1 text-right text-[var(--text-muted)]">{fmtAmt(t.tokenAmount)}</td>
                  <td className="px-2 py-1"><Wallet address={t.wallet} symbol={symbol} /></td>
                  <td className="px-2 py-1 text-right text-[var(--text-faint)]">
                    <a href={txUrl(t.tx)} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text)]" title="View transaction">{ago(t.ts)} ago</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'traders' && (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
          <table className="w-full min-w-[560px] text-[11px] tabular-nums">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                <th className="px-2 py-1.5 font-medium">#</th>
                <th className="px-2 py-1.5 font-medium">Wallet</th>
                <th className="px-2 py-1.5 font-medium text-right">Bought</th>
                <th className="px-2 py-1.5 font-medium text-right">Sold</th>
                <th className="px-2 py-1.5 font-medium text-right">Net</th>
                <th className="px-2 py-1.5 font-medium text-right">Trades</th>
              </tr>
            </thead>
            <tbody>
              {data?.topTraders?.map((t, i) => (
                <tr key={t.wallet} className="border-b border-[var(--line)]/50 last:border-0 hover:bg-white/5">
                  <td className="px-2 py-1 text-[var(--text-faint)]">{i + 1}</td>
                  <td className="px-2 py-1"><Wallet address={t.wallet} symbol={symbol} /></td>
                  <td className="px-2 py-1 text-right text-[var(--up)]">{fmtUsd(t.boughtUsd)}</td>
                  <td className="px-2 py-1 text-right text-red-400">{fmtUsd(t.soldUsd)}</td>
                  <td className={`px-2 py-1 text-right font-semibold ${t.netUsd >= 0 ? 'text-[var(--up)]' : 'text-red-400'}`}>{fmtUsd(t.netUsd)}</td>
                  <td className="px-2 py-1 text-right text-[var(--text-muted)]">{t.buys + t.sells}<span className="text-[var(--text-faint)]"> ({t.buys}/{t.sells})</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-2 py-1.5 text-[10px] text-[var(--text-faint)]">Realized buy/sell flow over the last 24h across all pairs — not lifetime PnL.</div>
        </div>
      )}
    </div>
  );
}
