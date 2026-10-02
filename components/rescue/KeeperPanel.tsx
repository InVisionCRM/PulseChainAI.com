'use client';

// The keeper wallet: when it runs, how to fuel it, and the address — one card,
// one line per fact. A stranger is being asked to send PLS to an address, so
// the address, the schedule and what the money buys stay together.
//
// The wording is careful on purpose and stays short WITHOUT dropping the two
// honesty rules this component has always carried: the schedule is stated in
// plain words (a computed "03:00 UTC" once drifted false when the cron moved),
// and the fuel line says donation — not investment, nothing owed in return.
// There is deliberately NO claim about what the keeper key can or cannot do; a
// safety promise that drifts out of date is worse than none at all.
//
// The fuel gauge is an estimate and says so: balance divided by the trailing
// burn rate. Each figure that could not be read draws as a dash — a guessed
// runway on a page asking for donations would be worse than none.

import { useState } from 'react';
import { IconCopy, IconCheck, IconClock, IconFlame, IconExternalLink, IconGasStation, IconAlertTriangle } from '@tabler/icons-react';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';

export interface KeeperFuel {
  /** PLS in the keeper wallet now; null if no RPC answered. */
  balancePls: number | null;
  /** Trailing gas burn; null if the explorer could not be read. */
  plsPerDay: number | null;
  windowDays: number | null;
  /** Unix ms the figures were read — the runway's date counts from here, not
   *  from the browser's clock, so the cached render and hydration agree. */
  measuredAt: number;
}

/** Below this the runway turns red and says so in words, not only color. */
const LOW_DAYS = 14;

const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${Math.round(n)}`;

/** The runway in the unit a person would say it in, plus the other reading. */
function runway(days: number): { head: string; sub: string } {
  const months = days / 30.44;
  const years = days / 365.25;
  if (days < 1) return { head: 'Under a day', sub: `${Math.round(days * 24)} hours` };
  if (days < 60) return { head: `${Math.round(days)} days`, sub: `≈ ${months.toFixed(1)} months` };
  if (days < 730) return { head: `${months.toFixed(1)} months`, sub: `≈ ${Math.round(days)} days` };
  return { head: `${years.toFixed(1)} years`, sub: `≈ ${Math.round(months)} months` };
}

function FuelStat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'low' }) {
  return (
    <div className="min-w-0">
      <div className="font-poppins truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
        {label}
      </div>
      <div
        className="font-jost mt-0.5 truncate text-[22px] font-bold leading-none tracking-tight md:text-[26px]"
        style={{ color: tone === 'low' ? 'var(--viz-loss)' : 'var(--text)' }}
      >
        {value}
      </div>
      <div className="font-poppins mt-1 text-[11px] leading-snug text-[var(--text-muted)]">{sub}</div>
    </div>
  );
}

export function KeeperPanel({ address, fuel }: { address: string; fuel: KeeperFuel }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the address is on screen and selectable anyway */
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="font-poppins flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            <IconClock className="h-3.5 w-3.5" /> The sweep
          </div>
          <div className="font-jost mt-1 text-lg font-bold text-[var(--text)]">Every hour, on the hour</div>
          <p className="font-poppins mt-0.5 text-[12px] text-[var(--text-muted)]">
            Biggest bleeders first, never inside the 14-day grace, never twice.
          </p>
        </div>
        <div>
          <div className="font-poppins flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            <IconFlame className="h-3.5 w-3.5" /> Keep it running
          </div>
          <div className="font-jost mt-1 text-lg font-bold text-[var(--text)]">Send PLS, it becomes gas</div>
          <p className="font-poppins mt-0.5 text-[12px] text-[var(--text-muted)]">
            A donation toward rescue gas — not an investment, nothing owed back.
          </p>
        </div>
      </div>

      <FuelGauge fuel={fuel} />

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-2">
        <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-tight text-[var(--text)]">
          {address}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md border border-[var(--line)] p-1.5 text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
          aria-label="Copy the keeper wallet address"
        >
          {copied ? <IconCheck className="h-3.5 w-3.5 text-emerald-400" /> : <IconCopy className="h-3.5 w-3.5" />}
        </button>
        <a
          href={pulsechainAddressUrl(address)}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md border border-[var(--line)] p-1.5 text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
          aria-label="Open the keeper wallet in the explorer"
        >
          <IconExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function FuelGauge({ fuel }: { fuel: KeeperFuel }) {
  const { balancePls, plsPerDay, windowDays, measuredAt } = fuel;
  const days = balancePls != null && plsPerDay != null && plsPerDay > 0 ? balancePls / plsPerDay : null;
  const left = days != null ? runway(days) : null;
  const low = days != null && days < LOW_DAYS;
  const dryOn =
    days != null && days < 3650
      ? new Date(measuredAt + days * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
      : null;

  return (
    <div className="mt-4 border-t border-[var(--line)] pt-3">
      <div className="font-poppins flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        <IconGasStation className="h-3.5 w-3.5" /> Fuel left
        {low && (
          <span className="ml-1 inline-flex items-center gap-1 normal-case tracking-normal" style={{ color: 'var(--viz-loss)' }}>
            <IconAlertTriangle className="h-3.5 w-3.5" /> running low
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <FuelStat label="In the wallet" value={balancePls != null ? compact(balancePls) : '—'} sub="PLS for gas" />
        <FuelStat
          label="Burning"
          value={plsPerDay != null ? compact(plsPerDay) : '—'}
          sub={plsPerDay != null && windowDays != null ? `PLS/day · last ${Math.round(windowDays)}d` : 'PLS/day'}
        />
        <FuelStat
          label="Lasts about"
          value={left?.head ?? '—'}
          sub={left ? `${left.sub}${dryOn ? ` · ~${dryOn}` : ''}` : 'not enough data'}
          tone={low ? 'low' : undefined}
        />
      </div>
      <p className="font-poppins mt-2 text-[11px] text-[var(--text-faint)]">
        An estimate at the recent pace. A day with a backlog of matured stakes can burn many times more.
      </p>
    </div>
  );
}
