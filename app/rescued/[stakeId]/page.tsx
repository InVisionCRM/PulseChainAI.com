// The page every rescue transaction links to.
//
// Someone arrives here because a stranger touched their stake and left a note
// with this URL in it. That is an alarming way to find out about anything, so
// the job of this page, in order, is:
//
//   1. Prove it is real — show their stake, their numbers, and the transaction.
//   2. Say plainly that nothing was taken and nothing can be.
//   3. Tell them exactly how to get their HEX.
//
// Rendered on the server so the numbers are in the HTML: this link is shared,
// pasted and previewed, and a page that needs JavaScript to say anything is a
// page that looks broken in exactly those places.

import Link from 'next/link';
import type { Metadata } from 'next';
import { IconExternalLink, IconShieldCheck } from '@tabler/icons-react';
import { fetchRescue } from '@/lib/hex/rescueFeed';
import { WHAT_HAPPENED, CLAIM_STEPS, HEX_APP_URL } from '@/lib/hex/rescueCopy';
import { pulsechainTxUrl, pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import { RescuedBy, HexWatermark, HexMark } from '@/components/rescue/RescueBrand';

// Matches the wall: a freshly-rescued stake should not have to wait five
// minutes for its own claim page to admit it exists.
export const revalidate = 60;

const hex = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ stakeId: string }>;
}): Promise<Metadata> {
  const { stakeId } = await params;
  const r = await fetchRescue('pulsechain', stakeId).catch(() => null);
  const amount = r?.claimableHex != null ? `${hex(r.claimableHex)} HEX` : 'A HEX stake';
  return {
    title: `${amount} is still yours — stake ${stakeId}`,
    description: WHAT_HAPPENED.short,
  };
}

export default async function RescuedStakePage({ params }: { params: Promise<{ stakeId: string }> }) {
  const { stakeId } = await params;
  const rescue = await fetchRescue('pulsechain', stakeId).catch(() => null);

  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)]">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-12">
        <Link
          href="/rescued"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
        >
          ← every rescue
        </Link>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <RescuedBy />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            · stake #{stakeId}
          </span>
        </div>

        {rescue ? (
          <>
            <h1 className="mt-2 flex flex-wrap items-center gap-x-3 text-3xl font-bold leading-tight text-[var(--text)] md:text-4xl">
              <HexMark className="h-8 w-8 md:h-10 md:w-10" />
              {rescue.claimableHex != null ? (
                <span>
                  <span className="text-emerald-400">{hex(rescue.claimableHex)}</span>{' '}
                  <span className="text-emerald-400">HEX</span> is still yours.
                </span>
              ) : (
                <span>Your stake stopped losing value.</span>
              )}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
              {WHAT_HAPPENED.short}
            </p>

            {/* The reassurance has to come before the detail — someone who thinks
                they have been robbed will not read a table. */}
            <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 sm:flex-row sm:items-center sm:gap-4">
              <IconShieldCheck className="h-6 w-6 shrink-0 text-emerald-400" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text)]">Nothing was taken and nothing can be.</span>{' '}
                {WHAT_HAPPENED.why}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label="Claimable now" value={`${hex(rescue.claimableHex)} HEX`} tone="good" />
              <Stat
                label="Was losing"
                value={rescue.bleedPerDay != null ? `${hex(rescue.bleedPerDay)} HEX/day` : '—'}
                sub="until we froze it"
              />
              <Stat
                label="Lost before we arrived"
                value={`${hex(rescue.penaltyHex)} HEX`}
                sub="the part nobody could save"
                tone={rescue.penaltyHex && rescue.penaltyHex > 0 ? 'warn' : undefined}
              />
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              <Row label="Stake ID" value={`#${stakeId}`} />
              <Row
                label="Owner"
                value={
                  <a
                    href={pulsechainAddressUrl(rescue.stakerAddr)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[13px] hover:text-[var(--text)]"
                  >
                    {rescue.stakerAddr.slice(0, 10)}…{rescue.stakerAddr.slice(-8)}
                    <IconExternalLink className="h-3.5 w-3.5" />
                  </a>
                }
              />
              <Row label="Principal staked" value={`${hex(rescue.principalHex)} HEX`} />
              <Row label="Interest earned" value={`${hex(rescue.payoutHex)} HEX`} />
              <Row
                label="Frozen on"
                value={rescue.timestamp ? new Date(rescue.timestamp).toUTCString().replace('GMT', 'UTC') : '—'}
              />
              <Row
                label="Proof"
                value={
                  <a
                    href={pulsechainTxUrl(rescue.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[13px] hover:text-[var(--text)]"
                  >
                    {rescue.txHash.slice(0, 12)}…
                    <IconExternalLink className="h-3.5 w-3.5" />
                  </a>
                }
              />
            </div>

            <h2 className="mt-8 text-lg font-bold text-[var(--text)]">How to get it</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              There is no rush — the amount above cannot shrink any further. But it also will not arrive on its own.
            </p>

            {/* The app is the action, so it leads rather than sitting under the
                steps as an afterthought. */}
            <a
              href={HEX_APP_URL}
              target="_blank"
              rel="noreferrer"
              className="group relative mt-4 flex items-center gap-4 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.14] to-transparent p-4 transition-colors hover:border-emerald-400/60"
            >
              <HexWatermark className="-right-6 -top-8" size="h-32 w-32" opacity="opacity-[0.10]" />
              <HexMark className="h-11 w-11 shrink-0" />
              <span className="relative">
                <span className="block text-base font-bold text-[var(--text)]">Open the HEX app</span>
                <span className="block text-[13px] text-[var(--text-muted)]">
                  The one the community uses, pinned on IPFS. Nothing to install, nothing to sign up for.
                </span>
              </span>
              <IconExternalLink className="relative ml-auto h-5 w-5 shrink-0 text-emerald-400" />
            </a>

            <p className="mt-3 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              then, in the app
            </p>
            <ol className="mt-2 space-y-2.5">
              {CLAIM_STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-3)] text-[12px] font-bold text-[var(--text)]">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{s.title}</div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">No rescue found for stake #{stakeId}</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
              This keeper has not good-accounted that stake — either the link is wrong, or the rescue is very
              recent and has not been indexed yet. Nothing is lost either way: a stake can always be ended by
              its owner, whatever state it is in.
            </p>
            <Link
              href="/rescued"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text)]"
            >
              See every rescue
            </Link>
          </>
        )}

        <p className="mt-10 border-t border-[var(--line)] pt-4 text-[12px] leading-relaxed text-[var(--text-faint)]">
          {WHAT_HAPPENED.long}{' '}
          <Link href="/rescued" className="underline hover:text-[var(--text)]">
            See every stake Morbius and SuperStake have rescued
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * The same metric shape the portfolio's HEX summary and the Rescue Wall use.
 *
 * Was a chunkier card with its own type scale, which made this page read as a
 * separate product from the rest of the HEX surfaces. 10px uppercase label over
 * a tabular figure is the house style; matching it is the polish.
 */
function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'warn';
}) {
  const color = tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-red-400' : 'text-[var(--text)]';
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="truncate text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] tabular-nums text-[var(--text-faint)]">{sub}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5 last:border-b-0">
      <span className="text-[13px] text-[var(--text-muted)]">{label}</span>
      <span className="text-right text-[13px] font-semibold tabular-nums text-[var(--text)]">{value}</span>
    </div>
  );
}
