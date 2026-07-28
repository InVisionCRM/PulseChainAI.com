'use client';

// SuperStake hub — the landing page for everything pSSH. Live on-chain state up
// top, a short "how it works" explainer, then routes into the deep tools. Each
// tool is its own page so it can be linked and shared, and so this page stays
// light (they code-split away).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IconArrowRight,
  IconScale,
  IconChartHistogram,
  IconReceipt2,
  IconExternalLink,
} from '@tabler/icons-react';
import type { SuperStakeSnapshot } from '@/lib/superstake/model';
import { pulsechainTokenUrl } from '@/lib/pulsechainExplorer';

const PSSH = '0xb5c4ecef450fd36d0eba1420f6a19dbfbee5292e';

interface Live {
  pHEX: number | null;
  pSSH: number | null;
  wins: Record<string, number>;
  source: string;
}

const fmtUsd = (n: number | null | undefined, dp = 2) =>
  n == null || !Number.isFinite(n)
    ? '—'
    : n >= 1e6
      ? `$${(n / 1e6).toFixed(2)}M`
      : n >= 1e3
        ? `$${(n / 1e3).toFixed(1)}k`
        : `$${n.toFixed(dp)}`;
const fmtNum = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n)
    ? '—'
    : n >= 1e6
      ? `${(n / 1e6).toFixed(2)}M`
      : n >= 1e3
        ? `${(n / 1e3).toFixed(1)}k`
        : n.toFixed(2);

export default function SuperStakeHubPage() {
  const [snap, setSnap] = useState<SuperStakeSnapshot | null>(null);
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/superstake/snapshot')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setSnap(d))
      .catch(() => {});
    fetch('/api/superstake/live')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setLive(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Live prices when we have them, snapshot figures otherwise — labelled either way.
  const pHex = live?.pHEX ?? snap?.meta.pHEX ?? null;
  const pSsh = live?.pSSH ?? snap?.meta.pSSH ?? null;
  const isLive = live?.source === 'pulsex-subgraph' && live?.pSSH != null;
  const latest = snap?.cycles[snap.cycles.length - 1];
  const avgVol = live?.wins?.['60'] ?? null;

  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)]">
      <div className="mx-auto w-full max-w-5xl px-3 py-5 md:px-6">
        {/* ---- Hero ---- */}
        <header className="mb-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-orange-400/80">
            SuperStake · pSSH
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] normal-case ${
                isLive
                  ? 'bg-[var(--up)]/15 text-[var(--up)]'
                  : 'bg-[var(--surface-2)] text-[var(--text-faint)]'
              }`}
            >
              {isLive ? 'live on-chain' : `snapshot · ${snap?.meta.asOf ?? '—'}`}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text)] md:text-3xl">
            The mass accumulation of HEX
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
            A real HEX stake that re-locks every 60 days and compounds. Every trade pays a 5.5%
            toll: most of it buys HEX for the stake, a sliver burns pSSH, the rest pays holders in
            HEX. This page is the record of what actually happened — not a projection.
          </p>
        </header>

        {/* ---- Live state ---- */}
        <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="pSSH price" value={fmtUsd(pSsh, 6)} sub={isLive ? 'live · PulseX' : 'snapshot'} />
          <Stat label="pHEX price" value={fmtUsd(pHex, 6)} sub={isLive ? 'live · PulseX' : 'snapshot'} />
          <Stat
            label="HEX in the stake"
            value={fmtNum(latest?.hex)}
            sub={latest ? `cycle #${latest.i}${latest.done ? '' : ' · running'}` : '—'}
          />
          <Stat
            label="Avg daily volume"
            value={fmtUsd(avgVol)}
            sub="trailing 60d"
          />
        </div>

        {/* ---- How it works ---- */}
        <section className="mb-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            How it works
          </h2>
          <ol className="grid gap-3 md:grid-cols-3">
            <Step
              n="01"
              title="Every trade pays a 5.5% toll"
              body="The only time the market touches the machine. 2% buys HEX for the stake, 1% burns pSSH, 2.5% pays holders in HEX."
            />
            <Step
              n="02"
              title="A 60-day loop that feeds itself"
              body="The stake ends, pays holders 1% of the whole pool, then restakes everything left plus the HEX bought during the cycle."
            />
            <Step
              n="03"
              title="Yield is what makes it free"
              body="Bigger stakes pay more, but the volume needed barely moves as a share of the pool. It self-sustains once per-cycle yield clears ~1.01%."
            />
          </ol>
        </section>

        {/* ---- Tools ---- */}
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Dig in
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            <ToolCard
              href="/superstake/vs-hex"
              icon={<IconScale className="h-5 w-5" />}
              title="Stake HEX vs hold pSSH"
              body="Same dollars, same day, replayed against the on-chain record. The head-to-head."
              featured
            />
            <ToolCard
              href="/geicko?address=0xb5c4ecef450fd36d0eba1420f6a19dbfbee5292e"
              icon={<IconChartHistogram className="h-5 w-5" />}
              title="pSSH on the scanner"
              body="Live chart, holders, liquidity, trades and forensics for the token itself."
            />
            <ToolCard
              href="https://superstake.win"
              external
              icon={<IconReceipt2 className="h-5 w-5" />}
              title="superstake.win"
              body="The project's own site — the full model, ledger and documentation."
            />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-faint)]">
          <a
            href={pulsechainTokenUrl(PSSH)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-[var(--text)]"
          >
            pSSH contract <IconExternalLink className="h-3 w-3" />
          </a>
          <span>·</span>
          <span>
            Cycle history snapshotted {snap?.meta.asOf ?? '—'}. Nothing here is financial advice.
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums text-[var(--text)]">{value}</div>
      <div className="text-[10px] text-[var(--text-faint)]">{sub}</div>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3">
      <div className="text-[10px] font-bold tracking-wider text-orange-400/80">{n}</div>
      <div className="mt-0.5 text-sm font-semibold text-[var(--text)]">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{body}</p>
    </li>
  );
}

function ToolCard({
  href, icon, title, body, featured, external,
}: {
  href: string; icon: React.ReactNode; title: string; body: string; featured?: boolean; external?: boolean;
}) {
  const cls = `group flex h-full flex-col rounded-xl border p-4 transition-colors ${
    featured
      ? 'border-orange-500/50 bg-orange-500/[0.07] hover:bg-orange-500/[0.12]'
      : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'
  }`;
  const inner = (
    <>
      <div className={featured ? 'text-orange-300' : 'text-[var(--text-muted)]'}>{icon}</div>
      <div className="mt-2 flex items-center gap-1 text-sm font-bold text-[var(--text)]">
        {title}
        {external ? <IconExternalLink className="h-3.5 w-3.5 text-[var(--text-faint)]" /> : (
          <IconArrowRight className="h-3.5 w-3.5 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5" />
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{body}</p>
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
  ) : (
    <Link href={href} className={cls}>{inner}</Link>
  );
}
