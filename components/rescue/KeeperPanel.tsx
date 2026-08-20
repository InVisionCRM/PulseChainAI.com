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

import { useState } from 'react';
import { IconCopy, IconCheck, IconClock, IconFlame, IconExternalLink } from '@tabler/icons-react';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';

export function KeeperPanel({ address }: { address: string }) {
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
