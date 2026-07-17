'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ChainKey } from '@/lib/chains/types';
import { explorerAddressUrl } from '@/lib/explorer';
import { formatCurrencyCompact } from '@/components/geicko/utils';

// Live launchpad leaderboard: which launchpads are most active on a chain, and
// what's trading on each. Fed by /api/launchpads/activity (GeckoTerminal volume
// + Blockscout creator attribution). Known pads are labelled from the registry;
// prolific unknown creators surface by address.

interface ActivityToken {
  address: string;
  symbol: string;
  name: string;
  volume24: number;
  liquidityUsd: number;
  logo: string | null;
}
interface ActivityPad {
  factory: string;
  name: string;
  url: string | null;
  known: boolean;
  likelyLaunchpad: boolean;
  tokenCount: number;
  volume24: number;
  liquidityUsd: number;
  topTokens: ActivityToken[];
}
interface ActivityResponse {
  chain: ChainKey;
  launchpads: ActivityPad[];
  tokensScanned?: number;
  tokensAttributed?: number;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function TokenChip({ chain, t }: { chain: ChainKey; t: ActivityToken }) {
  const [failed, setFailed] = useState(false);
  const href = `/geicko?address=${t.address}${chain === 'pulsechain' ? '' : `&network=${chain}`}`;
  return (
    <Link
      href={href}
      title={`${t.name} — ${formatCurrencyCompact(t.volume24)} 24h vol`}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 text-xs transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-3)]"
    >
      {t.logo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.logo} alt="" onError={() => setFailed(true)} className="h-4 w-4 rounded-full object-cover" />
      ) : (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-3)] text-[8px] font-semibold text-[var(--text-muted)]">
          {(t.symbol || '?').slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="font-medium text-[var(--text)]">{t.symbol}</span>
      <span className="text-[var(--text-faint)]">{formatCurrencyCompact(t.volume24)}</span>
    </Link>
  );
}

function PadCard({ chain, pad, rank }: { chain: ChainKey; pad: ActivityPad; rank: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--surface-2)] text-xs font-bold text-[var(--text-muted)]">
            {rank}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              {pad.url ? (
                <a href={pad.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[var(--text)] hover:text-[#00C805]">
                  {pad.name}
                </a>
              ) : (
                <a
                  href={explorerAddressUrl(chain, pad.factory)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm font-semibold text-[var(--text)] hover:text-[#00C805]"
                  title={pad.factory}
                >
                  {short(pad.factory)}
                </a>
              )}
              {pad.known ? (
                <span className="rounded bg-[#00C805]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#00C805]">
                  Verified pad
                </span>
              ) : (
                <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                  Unlabeled
                </span>
              )}
            </div>
            <div className="text-[11px] text-[var(--text-faint)]">
              {pad.tokenCount} {pad.tokenCount === 1 ? 'token' : 'tokens'} trading
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-[var(--text)]">{formatCurrencyCompact(pad.volume24)}</div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">24h volume</div>
        </div>
      </div>

      {pad.topTokens.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {pad.topTokens.map((t) => (
            <TokenChip key={t.address} chain={chain} t={t} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--text-faint)]">No graduated tokens trading in the current top set.</p>
      )}
    </div>
  );
}

export default function LaunchpadActivity({ chain }: { chain: ChainKey }) {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/launchpads/activity?chain=${chain}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d && Array.isArray(d.launchpads)) setData(d);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [chain]);

  if (!data && !failed) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[120px] animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)]" />
        ))}
      </div>
    );
  }

  if (failed || !data) {
    return (
      <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--text-faint)]">
        Launchpad activity is momentarily unavailable — try again shortly.
      </p>
    );
  }

  // Feature real launchpads (registered or prolific creators); one-off deployers
  // are counted but not shown as pads.
  const pads = data.launchpads.filter((p) => p.likelyLaunchpad);
  const oneOffs = data.launchpads.length - pads.length;

  return (
    <div className="space-y-3">
      {pads.length === 0 ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--text-faint)]">
          No active launchpads found in the current top tokens.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {pads.map((p, i) => (
            <PadCard key={p.factory} chain={chain} pad={p} rank={i + 1} />
          ))}
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
        Ranked by 24h volume of attributed tokens (creator address → launchpad factory), via GeckoTerminal + the
        block explorer. Only graduated (trading) tokens are attributed — coins still on a bonding curve aren&apos;t
        exposed by free data. {oneOffs > 0 ? `${oneOffs} one-off deployer${oneOffs === 1 ? '' : 's'} not shown.` : ''}
      </p>
    </div>
  );
}
