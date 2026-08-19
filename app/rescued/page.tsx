// The Rescue Wall — every HEX stake Morbius and SuperStake have stopped from bleeding out.
//
// This is the public record, and it is deliberately verifiable rather than
// merely impressive: every row links to its transaction, so nothing here has to
// be taken on trust. That matters more than the totals, because the claim being
// made — "we spent our own gas to stop strangers losing money, and took
// nothing" — is exactly the sort of claim that deserves proof.
//
// Server-rendered so the numbers are in the HTML for link previews and for
// anyone with JavaScript off.

import Link from 'next/link';
import type { Metadata } from 'next';
import { IconExternalLink, IconClockStop, IconFlame, IconTrophy } from '@tabler/icons-react';
import { fetchRescues, totalsFor, KEEPER_ADDRESS } from '@/lib/hex/rescueFeed';
import { WHAT_HAPPENED, HEX_APP_URL } from '@/lib/hex/rescueCopy';
import { pulsechainTxUrl, pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import { RescuedBy, HexWatermark, HexMark } from '@/components/rescue/RescueBrand';

export const revalidate = 300;

const hex = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export const metadata: Metadata = {
  title: 'The Rescue Wall — HEX stakes saved from bleeding out',
  description:
    'Every matured HEX stake Morbius and SuperStake have frozen before the late-end penalty could eat it. Nothing taken, nothing given — the HEX is still the owner’s.',
};

export default async function RescueWallPage() {
  const rescues = await fetchRescues('pulsechain', 200).catch(() => []);
  const t = totalsFor(rescues);

  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-12">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-emerald-500/[0.07] p-5 md:p-7">
          <HexWatermark className="-right-10 -top-12 rotate-12" size="h-56 w-56" opacity="opacity-[0.07]" />
          <HexWatermark className="-bottom-16 right-24 -rotate-6" size="h-40 w-40" opacity="opacity-[0.04]" />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <RescuedBy />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                · a public good on PulseChain
              </span>
            </div>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-bold leading-tight text-[var(--text)] md:text-4xl">
              <HexMark className="h-9 w-9 md:h-11 md:w-11" />
              The Rescue Wall
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
              A matured HEX stake stops earning but does not stop losing — 1/700th a day until there is
              nothing left. Anyone can freeze that clock for anyone, and it pays the person who does it
              nothing. So we do it, for strangers, with our own gas. Every stake below is still its owner’s.
            </p>
          </div>
        </div>

        {rescues.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
            No rescues indexed yet. If the keeper has just run, the explorer may still be catching up.
          </div>
        ) : (
          <>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Big label="Stakes rescued" value={String(t.count)} />
              <Big label="HEX still theirs" value={hex(t.claimableHex)} tone="good" hex />
              <Big
                label="Bleeding stopped"
                value={`${hex(t.bleedStoppedPerDay)}/day`}
                icon={<IconClockStop className="h-4 w-4" />}
              />
              <Big
                label="Lost before we arrived"
                value={hex(t.penaltyHex)}
                sub="the part nobody could save"
                tone="warn"
                icon={<IconFlame className="h-4 w-4" />}
              />
            </div>

            {(t.biggest || t.closestCall) && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {t.biggest && (
                  <Highlight
                    icon={<IconTrophy className="h-4 w-4 text-amber-400" />}
                    kicker="Biggest rescue"
                    stakeId={t.biggest.stakeId}
                    line={`${hex(t.biggest.claimableHex)} HEX kept whole`}
                  />
                )}
                {t.closestCall && t.closestCall.penaltyHex != null && t.closestCall.penaltyHex > 0 && (
                  <Highlight
                    icon={<IconFlame className="h-4 w-4 text-red-400" />}
                    kicker="Closest call"
                    stakeId={t.closestCall.stakeId}
                    line={`${hex(t.closestCall.penaltyHex)} HEX already gone when we got there`}
                  />
                )}
              </div>
            )}

            {t.unpriced > 0 && (
              <p className="mt-3 text-[12px] text-[var(--text-faint)]">
                {t.unpriced} rescue{t.unpriced === 1 ? '' : 's'} could not be priced from the subgraph yet, so
                the totals above are a floor rather than the full figure.
              </p>
            )}

            <h2 className="mt-9 text-lg font-bold text-[var(--text)]">Every rescue</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              {rescues.map((r) => (
                <div
                  key={r.txHash}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--line)] px-4 py-3 last:border-b-0"
                >
                  <Link
                    href={`/rescued/${r.stakeId}`}
                    className="text-sm font-bold text-[var(--text)] hover:text-emerald-400"
                  >
                    #{r.stakeId}
                  </Link>
                  <span className="tabular-nums text-sm font-semibold text-emerald-400">
                    {hex(r.claimableHex)} HEX
                  </span>
                  {r.bleedPerDay != null && (
                    <span className="text-[12px] text-[var(--text-faint)]">
                      was losing {hex(r.bleedPerDay)}/day
                    </span>
                  )}
                  <a
                    href={pulsechainAddressUrl(r.stakerAddr)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[12px] text-[var(--text-faint)] hover:text-[var(--text)]"
                  >
                    {r.stakerAddr.slice(0, 8)}…{r.stakerAddr.slice(-6)}
                  </a>
                  <span className="ml-auto flex items-center gap-3">
                    {r.timestamp > 0 && (
                      <span className="text-[12px] text-[var(--text-faint)]">
                        {new Date(r.timestamp).toISOString().slice(0, 10)}
                      </span>
                    )}
                    <a
                      href={pulsechainTxUrl(r.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--text-faint)] hover:text-[var(--text)]"
                      aria-label={`Proof of the rescue of stake ${r.stakeId}`}
                    >
                      <IconExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Anyone landing here who has a stake of their own should be one click
            from dealing with it, rescued or not. */}
        <a
          href={HEX_APP_URL}
          target="_blank"
          rel="noreferrer"
          className="group relative mt-8 flex items-center gap-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-emerald-400/50"
        >
          <HexWatermark className="-right-6 -top-8" size="h-32 w-32" opacity="opacity-[0.08]" />
          <HexMark className="h-10 w-10 shrink-0" />
          <span className="relative">
            <span className="block text-sm font-bold text-[var(--text)]">Got a stake of your own?</span>
            <span className="block text-[13px] text-[var(--text-muted)]">
              Open the HEX app the community uses and check whether yours has matured.
            </span>
          </span>
          <IconExternalLink className="relative ml-auto h-4 w-4 shrink-0 text-[var(--text-faint)]" />
        </a>

        <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-bold text-[var(--text)]">What this actually is</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{WHAT_HAPPENED.long}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
            The keeper wallet is{' '}
            <a
              href={pulsechainAddressUrl(KEEPER_ADDRESS)}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline hover:text-[var(--text)]"
            >
              {KEEPER_ADDRESS.slice(0, 10)}…{KEEPER_ADDRESS.slice(-8)}
            </a>
            . It can do exactly one thing — call <code className="text-[var(--text)]">stakeGoodAccounting</code>,
            which pays its caller nothing — so even if its key were stolen, the worst anyone could do with it is
            spend our gas doing more people the same favour.
          </p>
        </div>
      </div>
    </div>
  );
}

function Big({
  label,
  value,
  sub,
  tone,
  icon,
  hex: showHex,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'warn';
  icon?: React.ReactNode;
  hex?: boolean;
}) {
  const color = tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : 'text-[var(--text)]';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      {showHex && <HexWatermark className="-bottom-7 -right-6" size="h-28 w-28" opacity="opacity-[0.08]" />}
      <div className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
        {icon}
        {label}
      </div>
      <div className={`relative mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="relative text-[11px] text-[var(--text-faint)]">{sub}</div>}
    </div>
  );
}

function Highlight({
  icon,
  kicker,
  stakeId,
  line,
}: {
  icon: React.ReactNode;
  kicker: string;
  stakeId: string;
  line: string;
}) {
  return (
    <Link
      href={`/rescued/${stakeId}`}
      className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 transition-colors hover:border-[var(--text-faint)]"
    >
      {icon}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
          {kicker} · #{stakeId}
        </div>
        <div className="text-sm font-semibold text-[var(--text)]">{line}</div>
      </div>
    </Link>
  );
}
