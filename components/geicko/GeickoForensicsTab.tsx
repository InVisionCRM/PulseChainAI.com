'use client';

import React, { useEffect, useState } from 'react';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';
import { txUrl, addressUrl } from '@/lib/pulsechain/explorer';

// "Forensics" tab for the Geicko token view — who is behind this token:
//   • Creator: who funded them, what else they deployed, how much of the supply
//     they still hold, and whether they've been selling.
//   • First buyers: the earliest wallets in after the pair launched, same-block
//     snipers, and who still holds vs dumped.
//   • Insiders: wallets the creator sent the token to directly.
// Sourced from /api/geicko/forensics (Blockscout + PulseX subgraphs, free).

interface Funding { from: string; ts: string | null; valuePls: number }
interface Deployment { address: string; name: string | null; ts: string | null }
interface Insider { address: string; tokens: number; ts: string | null; currentTokens: number | null; isFirstBuyer: boolean }
interface Creator {
  address: string; creationTx: string | null;
  fundedBy: Funding | null; fundedByPartial: boolean;
  deployments: Deployment[]; deploymentCount: number;
  tokenBalance: number; pctSupply: number | null;
  sells: { count: number; tokens: number };
  insiders: Insider[];
}
interface Buyer {
  wallet: string; ts: number; block: number; usd: number; tokenAmount: number;
  sniper: boolean; currentTokens: number | null; stillHolds: boolean | null;
}
interface FirstBuyers {
  pair: string; pairedWith: string; pairCreatedAt: number; launchBlock: number | null;
  initialLiquidityUsd: number | null; windowHours: number; swapsScanned: number; buyers: Buyer[];
}
interface ForensicsResp {
  chain: string; supported?: boolean; symbol?: string; totalSupply?: number;
  creator: Creator | null; firstBuyers: FirstBuyers | null; error?: string;
}

const fmtUsd = (v: number) => {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return v > 0 ? `$${v.toFixed(4)}` : '—';
};
const fmtAmt = (v: number) => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(v >= 1 ? 2 : 4);
};
const shortAddr = (a: string) => (a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '—');
const fmtDate = (ts: number | string | null) => {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

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

function Chip({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'good' | 'bad' | 'warn' | 'neutral' }) {
  const cls = tone === 'good' ? 'text-[var(--up)]' : tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : 'text-[var(--text)]';
  return (
    <div className="rounded-lg bg-gradient-to-br from-white/5 via-purple-500/5 to-white/5 border border-[var(--line)] p-2 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'bad' | 'warn' | 'good' }) {
  const cls = tone === 'bad' ? 'bg-red-500/15 text-red-300' : tone === 'warn' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300';
  return <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${cls}`}>{children}</span>;
}

export default function GeickoForensicsTab({
  network, token, symbol,
}: { network?: string | null; token?: string | null; symbol?: string }) {
  const [data, setData] = useState<ForensicsResp | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [showDeployments, setShowDeployments] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('idle'); return; }
    let alive = true;
    setStatus('loading');
    const qs = new URLSearchParams();
    if (network) qs.set('network', network);
    qs.set('token', token);
    fetch(`/api/geicko/forensics?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: ForensicsResp) => {
        if (!alive) return;
        if (d.error || d.supported === false) { setStatus('error'); return; }
        setData(d);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [network, token]);

  if (status === 'idle') return null;
  if (status === 'loading') {
    return (
      <div className="p-6 text-center text-sm text-[var(--text-muted)]">
        Tracing creator, funding and first buyers on-chain… <span className="text-[var(--text-faint)]">(can take ~30s on busy tokens, then cached)</span>
      </div>
    );
  }
  if (status === 'error' || !data) {
    return <div className="p-6 text-center text-sm text-[var(--text-muted)]">Forensics aren’t available for this token.</div>;
  }

  const c = data.creator;
  const f = data.firstBuyers;
  const snipers = f ? f.buyers.filter((b) => b.sniper).length : 0;
  const holdersKnown = f ? f.buyers.filter((b) => b.stillHolds !== null) : [];
  const stillHolding = holdersKnown.filter((b) => b.stillHolds).length;
  const creatorExited = !!c && c.tokenBalance <= 0 && c.sells.count > 0;
  const serialDeployer = !!c && c.deploymentCount >= 3;

  return (
    <div className="space-y-3 p-2 md:p-3">
      {/* Summary chips */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Chip label="Creator holds" value={c ? `${c.pctSupply != null ? c.pctSupply.toFixed(1) : '?'}%` : '—'}
          tone={c && (c.pctSupply ?? 0) > 20 ? 'warn' : 'neutral'} />
        <Chip label="Creator DEX sells" value={c ? String(c.sells.count) : '—'} tone={c && c.sells.count > 0 ? 'bad' : 'good'} />
        <Chip label="Snipers (launch block)" value={f ? `${snipers} / ${f.buyers.length}` : '—'} tone={snipers > 5 ? 'bad' : snipers > 0 ? 'warn' : 'good'} />
        <Chip label="First buyers holding" value={holdersKnown.length ? `${stillHolding} / ${holdersKnown.length}` : '—'}
          tone={holdersKnown.length && stillHolding / holdersKnown.length < 0.2 ? 'bad' : 'neutral'} />
      </div>

      {/* Creator card */}
      {c ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Creator</h3>
            <Wallet address={c.address} symbol={symbol} />
            {creatorExited && <Badge tone="bad">Exited</Badge>}
            {serialDeployer && <Badge tone="warn">Serial deployer · {c.deploymentCount}</Badge>}
            {c.creationTx && (
              <a href={txUrl(c.creationTx)} target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] text-[var(--text-faint)] hover:text-[var(--text)]">
                deploy tx ↗
              </a>
            )}
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)]/40 py-1">
              <span className="text-[var(--text-muted)]">Funded by</span>
              {c.fundedBy ? (
                <span className="flex items-center gap-1.5 tabular-nums">
                  <Wallet address={c.fundedBy.from} symbol={symbol} />
                  <span className="text-[var(--text-faint)]">{fmtAmt(c.fundedBy.valuePls)} PLS{c.fundedByPartial ? ' · partial scan' : ''}</span>
                </span>
              ) : <span className="text-[var(--text-faint)]">unknown</span>}
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)]/40 py-1">
              <span className="text-[var(--text-muted)]">Still holds</span>
              <span className="tabular-nums text-[var(--text)]">{fmtAmt(c.tokenBalance)} {data.symbol}{c.pctSupply != null ? ` · ${c.pctSupply.toFixed(2)}%` : ''}</span>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)]/40 py-1">
              <span className="text-[var(--text-muted)]">Sold to DEX / contracts</span>
              <span className={`tabular-nums ${c.sells.count > 0 ? 'text-red-400' : 'text-[var(--up)]'}`}>
                {c.sells.count > 0 ? `${c.sells.count}× · ${fmtAmt(c.sells.tokens)} ${data.symbol}` : 'none seen'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)]/40 py-1">
              <span className="text-[var(--text-muted)]">Other contracts deployed</span>
              {c.deploymentCount > 0 ? (
                <button type="button" onClick={() => setShowDeployments((v) => !v)} className="tabular-nums text-[var(--text)] underline decoration-white/30 underline-offset-2 hover:decoration-white/60">
                  {c.deploymentCount} {showDeployments ? '▴' : '▾'}
                </button>
              ) : <span className="text-[var(--text-faint)]">none seen</span>}
            </div>
          </div>
          {showDeployments && c.deployments.length > 0 && (
            <div className="mt-2 space-y-0.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2">
              {c.deployments.map((d) => (
                <div key={d.address} className="flex items-center gap-2 text-[11px]">
                  <Wallet address={d.address} symbol={symbol} />
                  <span className="truncate text-[var(--text-muted)]">{d.name ?? 'contract'}</span>
                  <span className="ml-auto shrink-0 text-[var(--text-faint)]">{fmtDate(d.ts)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 text-xs text-[var(--text-muted)]">Creator information isn’t available for this token.</div>
      )}

      {/* Insiders */}
      {!!c?.insiders.length && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Wallets seeded by the creator</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[11px] tabular-nums">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="px-2 py-1.5 font-medium">Wallet</th>
                  <th className="px-2 py-1.5 font-medium text-right">Received</th>
                  <th className="px-2 py-1.5 font-medium text-right">Now holds</th>
                  <th className="px-2 py-1.5 font-medium text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {c.insiders.map((i) => (
                  <tr key={i.address} className="border-b border-[var(--line)]/50 last:border-0 hover:bg-white/5">
                    <td className="px-2 py-1">
                      <span className="flex items-center gap-1.5"><Wallet address={i.address} symbol={symbol} />{i.isFirstBuyer && <Badge tone="warn">first buyer</Badge>}</span>
                    </td>
                    <td className="px-2 py-1 text-right text-[var(--text)]">{fmtAmt(i.tokens)}</td>
                    <td className="px-2 py-1 text-right text-[var(--text-muted)]">{i.currentTokens == null ? '?' : fmtAmt(i.currentTokens)}</td>
                    <td className="px-2 py-1 text-right text-[var(--text-faint)]">{fmtDate(i.ts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* First buyers */}
      {f ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">First buyers</h3>
            <span className="text-[10px] tabular-nums text-[var(--text-faint)]">
              launched vs {f.pairedWith} · {fmtDate(f.pairCreatedAt)}{f.initialLiquidityUsd ? ` · seed ${fmtUsd(f.initialLiquidityUsd)}` : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[11px] tabular-nums">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="px-2 py-1.5 font-medium">#</th>
                  <th className="px-2 py-1.5 font-medium">Wallet</th>
                  <th className="px-2 py-1.5 font-medium text-right">Bought</th>
                  <th className="px-2 py-1.5 font-medium text-right">Block</th>
                  <th className="px-2 py-1.5 font-medium text-right">Still holds</th>
                </tr>
              </thead>
              <tbody>
                {f.buyers.map((b, i) => (
                  <tr key={b.wallet} className="border-b border-[var(--line)]/50 last:border-0 hover:bg-white/5">
                    <td className="px-2 py-1 text-[var(--text-faint)]">{i + 1}</td>
                    <td className="px-2 py-1">
                      <span className="flex items-center gap-1.5"><Wallet address={b.wallet} symbol={symbol} />{b.sniper && <Badge tone="bad">sniper</Badge>}</span>
                    </td>
                    <td className="px-2 py-1 text-right text-[var(--text)]">{fmtUsd(b.usd)} <span className="text-[var(--text-faint)]">· {fmtAmt(b.tokenAmount)}</span></td>
                    <td className="px-2 py-1 text-right text-[var(--text-muted)]">{b.block || '—'}</td>
                    <td className={`px-2 py-1 text-right font-semibold ${b.stillHolds == null ? 'text-[var(--text-faint)]' : b.stillHolds ? 'text-[var(--up)]' : 'text-red-400'}`}>
                      {b.stillHolds == null ? '?' : b.stillHolds ? `✓ ${fmtAmt(b.currentTokens ?? 0)}` : 'dumped'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-1.5 text-[10px] text-[var(--text-faint)]">
            Earliest unique buyers within {f.windowHours}h of pair creation ({f.swapsScanned.toLocaleString()} swaps scanned). Sniper = bought in the same block the liquidity was added.
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 text-xs text-[var(--text-muted)]">No PulseX launch pair found for this token.</div>
      )}
    </div>
  );
}
