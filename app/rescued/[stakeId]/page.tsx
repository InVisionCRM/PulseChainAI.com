// The page every rescue transaction links to.
//
// Someone arrives here because a stranger touched their stake and left a note
// with this URL in it. That is an alarming way to find out about anything, so
// the job of this page, in order, is:
//
//   1. Prove it is real — their stake, their numbers, the transaction.
//   2. Say plainly that nothing was taken and nothing can be.
//   3. Tell them exactly how to get their HEX.
//
// Built the same way as the wall: the figure is the headline, the arithmetic is
// drawn rather than described, and no step is a paragraph. The one place words
// still lead is the reassurance line — someone who thinks they have been robbed
// needs a sentence, not a chart, and that sentence stays.
//
// Rendered on the server so the numbers are in the HTML: this link is shared,
// pasted and previewed, and a page that needs JavaScript to say anything is a
// page that looks broken in exactly those places.

import Link from 'next/link';
import type { Metadata } from 'next';
import { IconExternalLink, IconShieldCheck, IconArrowLeft } from '@tabler/icons-react';
import { fetchRescue } from '@/lib/hex/rescueFeed';
import { fetchStakeStarts } from '@/lib/hex/stakeStarts';
import { hexPriceHistory, windowFor } from '@/lib/hex/hexPriceHistory';
import { WHAT_HAPPENED, CLAIM_STEPS, HEX_APP_URL } from '@/lib/hex/rescueCopy';
import { pulsechainTxUrl, pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import { fmtHex } from '@/lib/hex/hexDay';
import { RescuedBy } from '@/components/rescue/RescueBrand';
import {
  HeroNumber, Speedo, Waterfall, ValueJourney,
  type WaterfallStep, type ValueMark,
} from '@/components/rescue/RescueDashboard';

// Matches the wall: a freshly-rescued stake should not have to wait five
// minutes for its own claim page to admit it exists.
export const revalidate = 60;

const hex = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const dateOf = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ stakeId: string }>;
}): Promise<Metadata> {
  const { stakeId } = await params;
  const r = await fetchRescue('pulsechain', stakeId).catch(() => null);
  if (r?.claimedAt != null) {
    return {
      title: `Stake ${stakeId} was rescued and collected`,
      description:
        'This stake was losing value after maturing. The keeper froze the penalty, and its owner has since ended the stake and collected.',
    };
  }
  const amount = r?.claimableHex != null ? `${hex(r.claimableHex)} HEX` : 'A HEX stake';
  return {
    title: `${amount} is still yours — stake ${stakeId}`,
    description: WHAT_HAPPENED.short,
  };
}

export default async function RescuedStakePage({ params }: { params: Promise<{ stakeId: string }> }) {
  const { stakeId } = await params;
  const rescue = await fetchRescue('pulsechain', stakeId).catch(() => null);

  // The stake's beginning and the price history behind it. Both are best
  // effort: the page's own figures come from the rescue itself, so a price
  // outage hides one panel rather than breaking anything.
  const [starts, prices] = await Promise.all([
    rescue ? fetchStakeStarts('pulsechain', [stakeId]).catch(() => new Map()) : Promise.resolve(new Map()),
    rescue ? hexPriceHistory().catch(() => []) : Promise.resolve([]),
  ]);
  const start = starts.get(stakeId) ?? null;
  const pw = rescue ? windowFor(prices, start?.timestamp ?? null) : null;

  const gross = (rescue?.principalHex ?? 0) + (rescue?.payoutHex ?? 0);
  const savedFrac = gross > 0 ? Math.max(0, Math.min(1, 1 - (rescue?.penaltyHex ?? 0) / gross)) : 1;
  const headline = rescue?.claimed ? rescue.claimedHex ?? rescue.claimableHex : rescue?.claimableHex;

  const steps: WaterfallStep[] = rescue
    ? [
        { label: 'Principal', delta: rescue.principalHex ?? 0, kind: 'base' },
        { label: 'Interest', delta: rescue.payoutHex ?? 0, kind: 'gain' },
        { label: 'Penalty', delta: -(rescue.penaltyHex ?? 0), kind: 'loss' },
        { label: rescue.claimed ? 'Collected' : 'Yours', delta: rescue.claimableHex ?? 0, kind: 'total' },
      ]
    : [];

  // One fixed pile of HEX — the amount that is theirs — priced at four
  // moments. A changing amount at a changing price would make the four
  // figures incomparable, so the basis is stated in the panel's heading.
  const basis = rescue ? (rescue.claimed ? rescue.claimedHex ?? rescue.claimableHex : rescue.claimableHex) ?? 0 : 0;
  const marks: ValueMark[] = pw
    ? [
        {
          key: 'start',
          label: 'At stake start',
          usd: pw.atStart ? basis * pw.atStart.usd : null,
          price: pw.atStart?.usd ?? null,
          when: pw.atStart ? dateOf(pw.atStart.t) : null,
        },
        { key: 'high', label: 'Peak', usd: basis * pw.high.usd, price: pw.high.usd, when: dateOf(pw.high.t) },
        { key: 'low', label: 'Low', usd: basis * pw.low.usd, price: pw.low.usd, when: dateOf(pw.low.t) },
        { key: 'now', label: 'Now', usd: basis * pw.now.usd, price: pw.now.usd, when: dateOf(pw.now.t) },
      ]
    : [];

  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)] [--viz-a:#d96406] [--viz-b:#d6186e] [--viz-gain:#0d9488] [--viz-loss:#be123c] dark:[--viz-a:#dd7300] dark:[--viz-b:#ff2e7e] dark:[--viz-gain:#0d9488] dark:[--viz-loss:#e11d48]">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-10">
        <Link
          href="/rescued"
          className="font-poppins mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
        >
          <IconArrowLeft className="h-3.5 w-3.5" /> every rescue
        </Link>

        {rescue ? (
          <>
            {/* ── Hero: always-dark, whatever the theme, so the figure lands ── */}
            <div
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#06182e] p-5 md:p-7"
              style={{
                ['--text' as string]: '#ffffff',
                ['--text-muted' as string]: 'rgba(255,255,255,0.70)',
                ['--text-faint' as string]: 'rgba(255,255,255,0.45)',
              }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(120% 140% at 90% -25%, rgba(255,158,0,0.30) 0%, rgba(255,46,126,0.13) 45%, transparent 75%)' }}
              />
              <img
                src="/hex-logo.svg"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rotate-12 select-none object-contain opacity-[0.22] md:h-64 md:w-64"
              />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <RescuedBy />
                  <span className="font-poppins text-[11px] font-bold uppercase tracking-wider text-white/45">
                    stake #{stakeId}
                  </span>
                </div>

                <div className="mt-5">
                  <HeroNumber
                    label={rescue.claimed ? 'You collected' : 'Still yours'}
                    value={headline ?? 0}
                    fmt="hex"
                    sub={
                      rescue.claimed
                        ? 'Ended by you — the HEX is in your wallet.'
                        : 'Frozen. It cannot shrink any further.'
                    }
                    gradient
                  />
                </div>

                {/* The reassurance stays a sentence: someone who thinks they
                    have been robbed will not read a chart first. */}
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                  <IconShieldCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--viz-gain)' }} aria-hidden="true" />
                  <p className="font-poppins text-[13px] leading-relaxed text-white/70">
                    <span className="font-semibold text-white">Nothing was taken and nothing can be.</span>{' '}
                    {rescue.claimed
                      ? 'Ending the stake paid out to your address and nowhere else. We only froze the penalty.'
                      : 'Your HEX never moved. Only the clock stopped.'}
                  </p>
                </div>
              </div>
            </div>

            {/* ── The arithmetic, drawn ── */}
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <Waterfall steps={steps} />
              <Speedo
                frac={savedFrac}
                figure={`${(savedFrac * 100).toFixed(1)}%`}
                label="Survived the bleed"
                sub={
                  (rescue.penaltyHex ?? 0) > 0
                    ? `${hex(rescue.penaltyHex)} HEX was gone before we got there`
                    : 'We reached it before the penalty took anything'
                }
              />
            </div>

            {pw && marks.length > 0 && (
              <div className="mt-3">
                <ValueJourney
                  points={pw.series.map((p) => [p.t, p.usd] as [number, number])}
                  marks={marks}
                  basisHex={fmtHex(basis)}
                  note={
                    pw.atStart
                      ? `since this stake started · ${dateOf(pw.series[0].t)}`
                      : `past 12 months · this stake predates our price history`
                  }
                />
              </div>
            )}

            {/* ── The proof, compact ── */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Fact
                label="Owner"
                value={`${rescue.stakerAddr.slice(0, 10)}…${rescue.stakerAddr.slice(-8)}`}
                href={pulsechainAddressUrl(rescue.stakerAddr)}
              />
              <Fact
                label="Rescue transaction"
                value={`${rescue.txHash.slice(0, 14)}…`}
                href={pulsechainTxUrl(rescue.txHash)}
              />
            </div>

            {/* ── The action ── */}
            {!rescue.claimed && (
              <>
                <a
                  href={HEX_APP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative mt-6 flex items-center gap-4 overflow-hidden rounded-2xl border p-4 transition-colors"
                  style={{ borderColor: 'color-mix(in srgb, var(--viz-gain) 35%, transparent)', background: 'color-mix(in srgb, var(--viz-gain) 8%, transparent)' }}
                >
                  <img src="/hex-logo.svg" alt="" aria-hidden="true" className="relative h-10 w-10 shrink-0 object-contain" />
                  <span className="relative">
                    <span className="font-jost block text-[16px] font-bold text-[var(--text)]">Open the HEX app to end it</span>
                    <span className="font-poppins block text-[12px] text-[var(--text-muted)]">
                      Pinned on IPFS. Nothing to install, nothing to sign up for.
                    </span>
                  </span>
                  <IconExternalLink className="relative ml-auto h-5 w-5 shrink-0" style={{ color: 'var(--viz-gain)' }} />
                </a>

                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {CLAIM_STEPS.map((s, i) => (
                    <div key={s.title} className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                      <span className="font-jost pointer-events-none absolute right-3 top-1 text-[40px] font-bold leading-none text-[var(--text-faint)] opacity-30">
                        {i + 1}
                      </span>
                      <div className="font-jost relative text-[13px] font-bold leading-snug text-[var(--text)]">
                        {s.title}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="font-poppins mt-2 text-[11px] text-[var(--text-faint)]">
                  Only the wallet that owns the stake can end it — which is exactly why we could stop the loss but
                  could not finish it for you.
                </p>
              </>
            )}
          </>
        ) : (
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <h1 className="font-jost text-2xl font-bold text-[var(--text)]">No rescue found for stake #{stakeId}</h1>
            <p className="font-poppins mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
              Either the link is wrong, or the rescue is very recent and has not been indexed yet. Nothing is lost
              either way — a stake can always be ended by its owner, whatever state it is in.
            </p>
            <Link
              href="/rescued"
              className="font-poppins mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5 text-[13px] font-semibold text-[var(--text)]"
            >
              See every rescue
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** One verifiable fact, linked to the chain. */
function Fact({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 transition-colors hover:border-[var(--text-faint)]"
    >
      <span className="min-w-0">
        <span className="font-poppins block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          {label}
        </span>
        <span className="block truncate font-mono text-[12px] text-[var(--text)]">{value}</span>
      </span>
      <IconExternalLink className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
    </a>
  );
}
