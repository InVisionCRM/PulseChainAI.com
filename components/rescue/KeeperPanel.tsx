'use client';

// The keeper wallet: what it is, when it runs, and how to keep it fuelled.
//
// Three things belong together here because they only make sense together — a
// stranger is being asked to send PLS to an address, so the address, what it
// can do, and what the money buys have to be in one place.
//
// The wording is careful on purpose. This is a donation toward gas, not an
// investment, not a token, and nothing is owed in return; saying so plainly is
// both honest and the thing that makes it credible. The safety line is the real
// reassurance and it is a fact rather than a promise: `stakeGoodAccounting`
// pays its caller nothing, so a key restricted to it cannot move anyone's
// funds — the worst case for money sent here is that it buys gas for someone
// else's rescue.

import { useState } from 'react';
import { IconCopy, IconCheck, IconClock, IconShieldLock, IconFlame, IconExternalLink } from '@tabler/icons-react';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';

export function KeeperPanel({
  address,
  /** UTC hour the sweep runs, from the cron schedule in vercel.json. */
  runsAtUtcHour = 3,
}: {
  address: string;
  runsAtUtcHour?: number;
}) {
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

  const utc = `${String(runsAtUtcHour).padStart(2, '0')}:00 UTC`;
  // Shown in the reader's own zone as well, because "03:00 UTC" is a small
  // maths problem for most people and this is meant to be reassuring.
  const local = new Date(Date.UTC(2000, 0, 1, runsAtUtcHour, 0)).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Schedule */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
          <IconClock className="h-3 w-3" />
          The sweep
        </div>
        <div className="mt-1 text-lg font-bold text-[var(--text)]">
          Every day at {utc}
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
          That is <span className="font-semibold text-[var(--text)]">{local}</span> your time. The bot
          takes the stakes that are bleeding hardest for the gas they cost and freezes them, biggest
          value first. A stake only needs freezing once, so nothing is ever done twice.
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-faint)]">
          It waits until a stake is past its 14-day grace before touching it — inside the grace there
          is no penalty yet, and most people end their own stakes in that window.
        </p>
      </div>

      {/* Fuel */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
          <IconFlame className="h-3 w-3" />
          Keep the bot running
        </div>
        <div className="mt-1 text-lg font-bold text-[var(--text)]">Send PLS, it becomes gas</div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
          Every rescue costs gas and nobody is paid for it. PLS sent to the keeper wallet below is
          spent on exactly one thing — freezing more stakes. There is no token, nothing is owed in
          return, and it is a donation rather than an investment.
        </p>

        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-2">
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
            aria-label="View the keeper wallet on the explorer"
          >
            <IconExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--text-faint)]">
          <IconShieldLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>
            This key can make exactly one kind of call —{' '}
            <code className="text-[var(--text-muted)]">stakeGoodAccounting</code>, which pays its
            caller nothing. Even if it were stolen, the worst anyone could do with it is spend the
            gas rescuing more strangers&rsquo; stakes.
          </span>
        </p>
      </div>
    </div>
  );
}
