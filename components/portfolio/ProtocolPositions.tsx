'use client';

// DeBank-style "Protocol Positions" — tokens you have locked in DeFi (lending,
// farms, liquidity, vaults) that don't show up as plain wallet balances.
// Detected generically from on-chain reads (see lib/portfolio/positions.ts), so
// no per-protocol address list is needed for the common archetypes.

import { useEffect, useState } from 'react';
import { IconRefresh, IconStack2, IconExternalLink } from '@tabler/icons-react';
import type { ChainId } from '@/services';
import { fmtUsd, fmtAmount } from '@/lib/format';

interface UnderlyingAsset { address: string; symbol: string; decimals: number; amount: number; valueUsd?: number }
interface ProtocolPosition {
  kind: 'lp' | 'vault' | 'lending' | 'farm' | 'staking';
  address: string; symbol: string; protocol?: string; note?: string;
  underlying: UnderlyingAsset[]; valueUsd?: number;
}
interface Group { kind: ProtocolPosition['kind']; positions: ProtocolPosition[] }

const KIND_LABEL: Record<ProtocolPosition['kind'], string> = {
  lending: 'Lending', farm: 'Farms', lp: 'Liquidity', vault: 'Yield vaults', staking: 'Staking',
};
const explorerToken = (chain: ChainId, a: string) =>
  chain === 'ethereum' ? `https://etherscan.io/token/${a}` : `https://scan.pulsechain.com/address/${a}`;

export function ProtocolPositions({ walletAddress, chains }: { walletAddress: string; chains: ChainId[] }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [chainOf, setChainOf] = useState<Record<string, ChainId>>({});

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
        const merged = new Map<ProtocolPosition['kind'], ProtocolPosition[]>();
        const cmap: Record<string, ChainId> = {};
        let totalUsd = 0;
        for (const res of results) {
          if (!res) continue;
          totalUsd += res.totalUsd ?? 0;
          for (const g of (res.groups as Group[]) ?? []) {
            const list = merged.get(g.kind) ?? [];
            for (const p of g.positions) cmap[p.address.toLowerCase()] = res.chain;
            list.push(...g.positions);
            merged.set(g.kind, list);
          }
        }
        const order: ProtocolPosition['kind'][] = ['lending', 'farm', 'lp', 'vault', 'staking'];
        setGroups(order.filter((k) => merged.has(k)).map((kind) => ({ kind, positions: merged.get(kind)! })));
        setChainOf(cmap);
        setTotal(totalUsd);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  };

  useEffect(load, [walletAddress, chains.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <IconStack2 className="h-4 w-4 text-purple-400" /> Protocol positions
          {status === 'ready' && total !== 0 && (
            <span className="text-[var(--text-muted)] tabular-nums">· {fmtUsd(total)}</span>
          )}
        </div>
        <button type="button" onClick={load} disabled={status === 'loading'} className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-40" title="Re-scan">
          <IconRefresh className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {status === 'loading' && (
        <div className="grid place-items-center py-12 text-sm text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-2"><IconRefresh className="h-4 w-4 animate-spin" /> Scanning protocols…</span>
        </div>
      )}
      {status === 'error' && <div className="py-10 text-center text-sm text-red-300">Couldn’t scan protocol positions.</div>}
      {status === 'ready' && groups.length === 0 && (
        <div className="py-10 text-center text-sm text-[var(--text-faint)]">
          No DeFi positions detected. We auto-find lending, LP (V2 + V3), vaults, liquid staking, HEX stakes, and farms you’ve staked into — very exotic protocols may not be covered yet.
        </div>
      )}

      {status === 'ready' && groups.map((g) => (
        <div key={g.kind} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
          <div className="border-b border-[var(--line)] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
            {KIND_LABEL[g.kind]}
          </div>
          <div className="divide-y divide-[var(--line-soft)]">
            {g.positions.map((p, i) => {
              const chain = chainOf[p.address.toLowerCase()] ?? chains[0];
              return (
                <div key={`${p.address}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {p.protocol && <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-purple-300">{p.protocol}</span>}
                      <a href={explorerToken(chain, p.address)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--text)] hover:text-purple-300">
                        {p.symbol}
                        <IconExternalLink className="h-3 w-3 text-[var(--text-faint)]" />
                      </a>
                      {p.note && <span className="text-[10px] text-[var(--text-faint)]">· {p.note}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-[var(--text-muted)] tabular-nums">
                      {p.underlying.length === 0 ? (
                        <span>amount hidden by protocol</span>
                      ) : (
                        p.underlying.map((u, j) => (
                          <span key={j}>{fmtAmount(u.amount)} {u.symbol}{j < p.underlying.length - 1 ? ' +' : ''}</span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-sm font-semibold tabular-nums" style={{ color: (p.valueUsd ?? 0) < 0 ? '#f87171' : 'var(--text)' }}>
                    {p.valueUsd != null ? fmtUsd(p.valueUsd) : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
        Positions are detected on-chain by archetype — V2/V3 LP, lending receipts, ERC-4626 vaults, Balancer pools, liquid staking, HEX stakes — plus custodial farms discovered from your own approvals. No protocol address list needed. Borrowed amounts show as negative; V3 amounts use floating-point price math (display-grade). Some exotic protocols may not be detected.
      </p>
    </div>
  );
}

export default ProtocolPositions;
