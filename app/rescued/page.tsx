// The Rescue Wall — every HEX stake Morbius and SuperStake have stopped from
// bleeding out.
//
// This is the public record, and it is deliberately verifiable rather than
// merely impressive: every stake links to its transaction, so nothing here has
// to be taken on trust. That matters more than the totals, because the claim
// being made — "we spent our own gas to stop strangers losing money, and took
// nothing" — is exactly the sort of claim that deserves proof.
//
// Drawn with the same vocabulary as the rest of the HEX surfaces: the Metric
// strip from the portfolio's stake list, stake cards that mirror
// ActiveStakeCard, HexAmount for every figure. A rescue IS a HEX stake, so a
// page that invented its own look would be the odd one out, not the polished
// one.
//
// Server-rendered so the numbers are in the HTML for link previews and for
// anyone with JavaScript off.

import Link from 'next/link';
import type { Metadata } from 'next';
import { IconExternalLink, IconTrophy, IconFlame } from '@tabler/icons-react';
import { fetchRescues, totalsFor, KEEPER_ADDRESS } from '@/lib/hex/rescueFeed';
import { WHAT_HAPPENED, HEX_APP_URL } from '@/lib/hex/rescueCopy';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import { HexAmount, HexUnit, HEX_GRADIENT } from '@/components/hex/HexAmount';
import { fmtHex, fmtUsdShort } from '@/lib/hex/hexDay';
import { RescuedBy } from '@/components/rescue/RescueBrand';
import { RescueStakeCard } from '@/components/rescue/RescueStakeCard';
import { KeeperPanel } from '@/components/rescue/KeeperPanel';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'The Rescue Wall — HEX stakes saved from bleeding out',
  description:
    'Every matured HEX stake Morbius and SuperStake have frozen before the late-end penalty could eat it. Nothing taken, nothing given — the HEX is still the owner’s.',
};

/** Live pHEX price for the USD figures. Best effort — the page is fully useful
 *  in HEX alone, so a price outage hides dollars rather than breaking. */
async function hexUsd(): Promise<number | null> {
  try {
    const r = await fetch(
      'https://api.dexscreener.com/latest/dex/tokens/0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
      { next: { revalidate: 300 }, headers: { Accept: 'application/json' } },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const best = (j?.pairs ?? [])
      .filter((p: any) => p?.chainId === 'pulsechain')
      .sort((a: any, b: any) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0))[0];
    const n = Number(best?.priceUsd);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export default async function RescueWallPage() {
  const [rescues, price] = await Promise.all([
    fetchRescues('pulsechain', 200).catch(() => []),
    hexUsd(),
  ]);
  const t = totalsFor(rescues);
  const usd = (hex: number) => (price != null ? fmtUsdShort(hex * price) : null);

  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-10">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-7">
          <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ background: HEX_GRADIENT }} />
          <img
            src="/hex-logo.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-12 h-56 w-56 rotate-12 select-none object-contain opacity-[0.16]"
          />
          <div className="relative">
            <RescuedBy />
            <h1 className="mt-2.5 flex items-center gap-3 text-[28px] font-bold leading-none tracking-tight text-[var(--text)] md:text-[40px]">
              <img src="/hex-logo.svg" alt="" aria-hidden="true" className="h-8 w-8 object-contain md:h-10 md:w-10" />
              The Rescue Wall
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--text-muted)] md:text-[15px]">
              A matured HEX stake stops earning but does not stop losing — 1/700th a day until there
              is nothing left. Anyone can freeze that clock for anyone, and it pays the person who
              does it nothing. So we do it, for strangers, with our own gas.{' '}
              <span className="text-[var(--text)]">Every stake below is still its owner’s.</span>
            </p>
          </div>
        </div>

        {rescues.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
            No rescues indexed yet. If the keeper has just run, the explorer may still be catching up.
          </div>
        ) : (
          <>
            {/* Metric strip — same shape as the portfolio's HEX stake summary. */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Stakes rescued" value={String(t.count)} sub="and counting" />
              <Metric
                label="HEX still theirs"
                value={fmtHex(t.claimableHex)}
                sub={usd(t.claimableHex) ?? <HexUnit className="text-[var(--text-faint)]" />}
                good
              />
              <Metric
                label="Bleeding stopped"
                value={fmtHex(t.bleedStoppedPerDay)}
                sub={usd(t.bleedStoppedPerDay) ? `${usd(t.bleedStoppedPerDay)} / day` : 'per day'}
              />
              <Metric
                label="Lost before us"
                value={fmtHex(t.penaltyHex)}
                sub="nobody could save it"
                bad
              />
            </div>

            {(t.biggest || t.closestCall) && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {t.biggest && (
                  <Highlight
                    icon={<IconTrophy className="h-4 w-4 text-amber-400" />}
                    kicker="Biggest rescue"
                    stakeId={t.biggest.stakeId}
                    hex={t.biggest.claimableHex ?? 0}
                    line="kept whole"
                  />
                )}
                {t.closestCall && (t.closestCall.penaltyHex ?? 0) > 0 && (
                  <Highlight
                    icon={<IconFlame className="h-4 w-4 text-red-400" />}
                    kicker="Closest call"
                    stakeId={t.closestCall.stakeId}
                    hex={t.closestCall.penaltyHex ?? 0}
                    line="already gone"
                    bad
                  />
                )}
              </div>
            )}

            {t.unpriced > 0 && (
              <p className="mt-2 text-[11px] text-[var(--text-faint)]">
                {t.unpriced} rescue{t.unpriced === 1 ? '' : 's'} could not be priced from the subgraph
                yet, so the totals above are a floor rather than the full figure.
              </p>
            )}

            {/* How it runs, and how to fuel it. */}
            <h2 className="mt-7 text-sm font-bold uppercase tracking-wider text-[var(--text-faint)]">
              How it runs
            </h2>
            <div className="mt-2">
              <KeeperPanel address={KEEPER_ADDRESS} runsAtUtcHour={3} />
            </div>

            <h2 className="mt-7 flex items-baseline gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Every rescue
              <span className="text-[var(--text-muted)]">· {rescues.length}</span>
            </h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {rescues.map((r) => (
                <RescueStakeCard key={r.txHash} rescue={r} hexUsd={price} />
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
          className="group relative mt-6 flex items-center gap-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[#ff2e7e]/50"
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ background: HEX_GRADIENT }} />
          <img src="/hex-logo.svg" alt="" aria-hidden="true" className="relative h-9 w-9 shrink-0 object-contain" />
          <span className="relative">
            <span className="block text-sm font-bold text-[var(--text)]">Got a stake of your own?</span>
            <span className="block text-[12px] text-[var(--text-muted)]">
              Open the HEX app the community uses and check whether yours has matured.
            </span>
          </span>
          <IconExternalLink className="relative ml-auto h-4 w-4 shrink-0 text-[var(--text-faint)]" />
        </a>

        <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
            What this actually is
          </h2>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">{WHAT_HAPPENED.long}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
            The keeper wallet is{' '}
            <a
              href={pulsechainAddressUrl(KEEPER_ADDRESS)}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline hover:text-[var(--text)]"
            >
              {KEEPER_ADDRESS.slice(0, 10)}…{KEEPER_ADDRESS.slice(-8)}
            </a>
            , and every rescue above links to the transaction that made it.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Same shape as the portfolio's HEX summary metric, so the two read as one app. */
function Metric({
  label,
  value,
  sub,
  good,
  bad,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  good?: boolean;
  bad?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="truncate text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
        {label}
      </div>
      <div
        className={`mt-0.5 text-sm font-semibold tabular-nums ${
          good ? 'text-emerald-400' : bad ? 'text-red-400' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </div>
      {sub != null ? <div className="text-[10px] tabular-nums text-[var(--text-faint)]">{sub}</div> : null}
    </div>
  );
}

function Highlight({
  icon,
  kicker,
  stakeId,
  hex,
  line,
  bad,
}: {
  icon: React.ReactNode;
  kicker: string;
  stakeId: string;
  hex: number;
  line: string;
  bad?: boolean;
}) {
  return (
    <Link
      href={`/rescued/${stakeId}`}
      className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 transition-colors hover:border-[var(--text-faint)]"
    >
      {icon}
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
          {kicker} · #{stakeId}
        </div>
        <div className="text-sm font-semibold text-[var(--text)]">
          <HexAmount hex={hex} className={bad ? 'text-red-400' : 'text-[var(--text)]'} />{' '}
          <span className="font-normal text-[var(--text-muted)]">{line}</span>
        </div>
      </div>
    </Link>
  );
}
