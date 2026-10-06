// The Rescue Wall — every HEX stake Morbius and SuperStake have stopped from
// bleeding out, drawn as an instrument cluster rather than an essay.
//
// The rule for this page: numbers first, sentences second, paragraphs never.
// Every figure animates once and settles, every claim links to its
// transaction, and the HEX brand carries the design — Jost for figures,
// Poppins for labels, the orange→pink gradient on chrome, the hexagon mark
// everywhere it earns its place.
//
// Data marks (gauges, bars) do NOT use the raw brand colors: --viz-a/--viz-b
// are per-theme steps validated against this app's light and dark surfaces
// with the dataviz palette checker. The gradient is for decoration only.
//
// Server-rendered so the numbers are in the HTML for link previews and for
// anyone with JavaScript off; the client layer only adds motion.

import Link from 'next/link';
import type { Metadata } from 'next';
import {
  IconExternalLink, IconTrophy, IconClock, IconDroplet, IconSnowflake,
} from '@tabler/icons-react';
import { fetchRescues, keeperBurn, totalsFor, weiToPls, KEEPER_ADDRESS, type Rescue } from '@/lib/hex/rescueFeed';
import { getBalance } from '@/lib/portfolio/evmRpc';
import { HEX_APP_URL } from '@/lib/hex/rescueCopy';
import { fmtHex, fmtUsdShort } from '@/lib/hex/hexDay';
import { HexAmount, HEX_GRADIENT } from '@/components/hex/HexAmount';
import { RescuedBy } from '@/components/rescue/RescueBrand';
import { RescueList } from '@/components/rescue/RescueList';
import { KeeperPanel, type KeeperFuel } from '@/components/rescue/KeeperPanel';
import { Manifesto, ManifestoLink } from '@/components/rescue/Manifesto';
import { UpcomingBleeders } from '@/components/rescue/UpcomingBleeders';
import { findUpcomingBleeders, defaultMinPrincipalHex, defaultMaxPrincipalHex } from '@/lib/hex/rescue';
import { dbAvailable } from '@/lib/db/hexLockedStakes';
import { readFates } from '@/lib/db/hexRescueFates';
import { readRoadDaily } from '@/lib/db/hexRoadSnapshots';
import roadHistory from '@/lib/hex/roadToZeroHistory.json';
import { RoadToZero, type RoadPoint } from '@/components/rescue/RoadToZero';
import {
  BigStat, CollectedFates, HeroNumber, SavedChart, Speedo, type FateSlice, type RescuePoint,
} from '@/components/rescue/RescueDashboard';

// A minute, not five. The wall is watched live while the keeper runs, and a
// five-minute window meant a sweep looked like nothing had happened.
export const revalidate = 60;
// The render walks the keeper's whole history from Blockscout (~15 s at 3,368
// sends, growing with every rescue). Set explicitly rather than left to the
// project default, so a long walk finishes instead of being cut off — a cut-off
// render fails and leaves the wall frozen on its last copy.
export const maxDuration = 120;

export const metadata: Metadata = {
  title: 'The Rescue Wall — HEX stakes saved from bleeding out',
  description:
    'Every matured HEX stake Morbius and SuperStake have frozen before the late-end penalty could eat it. Nothing taken, nothing given — the HEX is still the owner’s.',
};

/** How many stake cards to draw. Page weight, not data: the totals are summed
 *  over every rescue regardless of what is rendered. */
const CARD_LIMIT = 200;

/** Days of gas spend the fuel gauge averages. Two weeks smooths a busy day
 *  without reaching back into the launch backlog. */
const FUEL_WINDOW_DAYS = 14;

/** How far ahead the "about to start bleeding" list looks, and how many it shows. */
const UPCOMING_HOURS = 72;
const UPCOMING_SHOWN = 10;

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

/** What the record chart needs of each rescue — the chart buckets these by
 *  day, week or month itself and lists them when a bar is opened. */
function chartPoints(rescues: Rescue[]): RescuePoint[] {
  return rescues
    .filter((r) => r.timestamp > 0)
    .map((r) => ({
      t: r.timestamp,
      stakeId: r.stakeId,
      // Whole HEX: the list prints whole HEX anyway, and the eight decimals
      // were most of the bytes this sends for every rescue.
      saved: Math.round(r.claimableHex ?? 0),
      // Stakers' half of the penalty this freeze released (HEX splits it 50/50 with Origin).
      paid: Math.round((r.penaltyHex ?? 0) / 2),
    }));
}

/** What collected owners did next, summed by outcome over the stakes the
 *  rescue-fates cron has worked out. Shares are of HEX collected. */
function fateSlices(rescues: Rescue[], fates: Awaited<ReturnType<typeof readFates>>): { slices: FateSlice[]; judged: number } {
  const by = new Map<FateSlice['outcome'], FateSlice>();
  let judged = 0;
  for (const r of rescues) {
    const f = r.claimed ? fates.get(r.stakeId) : undefined;
    if (!f) continue;
    judged += 1;
    const s = by.get(f.outcome) ?? { outcome: f.outcome, stakes: 0, hex: 0 };
    s.stakes += 1;
    s.hex += f.collectedHex;
    by.set(f.outcome, s);
  }
  return { slices: [...by.values()], judged };
}

/**
 * The Road to Zero series: the rebuilt history (immutable chain history, see
 * scripts/roadToZeroHistory.ts), then the cron's latest snapshot of each later
 * day. Same calculator for both, so the seam is not a change of method.
 */
function roadPoints(snapshots: Awaited<ReturnType<typeof readRoadDaily>> | null): RoadPoint[] {
  const history: RoadPoint[] = roadHistory.days;
  const lastHistoryDay = history[history.length - 1]?.day ?? -1;
  const later = (snapshots ?? []).filter((s) => s.day > lastHistoryDay);
  return [...history, ...later];
}

/** Average gas per rescue over the fuel window, from the rescues' own fees —
 *  the same days the gauge's burn rate averages. Null with none in the window. */
function gasPerRescue(rescues: Rescue[], now: number): number | null {
  const recent = rescues.filter((r) => r.timestamp >= now - FUEL_WINDOW_DAYS * 86_400_000);
  if (!recent.length) return null;
  return weiToPls(recent.reduce((sum, r) => sum + BigInt(r.feeWei), 0n)) / recent.length;
}

/** Keeper wallet balance for the fuel gauge; null if no RPC answered. The
 *  burn rate beside it is worked out from the rescues themselves. */
async function keeperBalance(): Promise<{ balancePls: number | null; measuredAt: number }> {
  const measuredAt = Date.now();
  const wei = await getBalance('pulsechain', KEEPER_ADDRESS);
  return { balancePls: wei != null ? Number(wei / 10n ** 12n) / 1e6 : null, measuredAt };
}

/** The honeycomb the hero wears — the HEX mark, tiled, fading out rightward. */
function Honeycomb() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.13]">
      <defs>
        <pattern id="rescue-hex" width="56" height="97" patternUnits="userSpaceOnUse">
          <path
            d="M28 2 L52 16 L52 44 L28 58 L4 44 L4 16 Z M28 60.5 L52 74.5 L52 102.5 M4 102.5 L4 74.5 L28 60.5"
            fill="none"
            stroke="#ff9e00"
            strokeWidth="1.5"
          />
        </pattern>
        <linearGradient id="rescue-hex-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="rescue-hex-mask">
          <rect width="100%" height="100%" fill="url(#rescue-hex-fade)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#rescue-hex)" mask="url(#rescue-hex-mask)" />
    </svg>
  );
}

export default async function RescueWallPage() {
  const balanceP = keeperBalance();
  const upcomingP = findUpcomingBleeders('pulsechain', UPCOMING_HOURS);
  // Marked handled so a failure here while the history below is also failing
  // is not an unhandled rejection; the await further down still throws it.
  upcomingP.catch(() => {});
  // The whole history, not a page of it: the totals below are summed from this
  // list, so a cap here would not shorten the wall, it would under-report how
  // much HEX was saved. Cards are capped further down instead.
  // Not caught: if the history cannot be read in full, this render fails and
  // ISR keeps serving the last complete wall instead of a short or empty one.
  const [rescues, price, fates, roadSnapshots] = await Promise.all([
    fetchRescues('pulsechain'),
    hexUsd(),
    // Stored by the rescue-fates cron. Optional like the fuel gauge: without a
    // database, or if it cannot be read, the section is left out, never guessed.
    dbAvailable() ? readFates('pulsechain').catch(() => null) : Promise.resolve(null),
    // Snapshots after the history file ends. Best effort: without them the
    // road still shows its rebuilt history, ending on its last day.
    dbAvailable() ? readRoadDaily('pulsechain').catch(() => null) : Promise.resolve(null),
  ]);
  const balance = await balanceP;
  // Null only when the locked-stake index is not ready; the section is left
  // out then rather than shown short.
  const upcoming = await upcomingP;
  const renderedAt = Date.now();
  const t = totalsFor(rescues);
  const burn = keeperBurn(rescues, FUEL_WINDOW_DAYS, balance.measuredAt);
  const fuel: KeeperFuel = {
    ...balance,
    plsPerDay: burn?.plsPerDay ?? null,
    windowDays: burn?.windowDays ?? null,
    spentPls: t.gasPls,
    rescueCount: t.count,
    plsPerRescue: gasPerRescue(rescues, balance.measuredAt),
  };
  const points = chartPoints(rescues);
  const fateView = fates ? fateSlices(rescues, fates) : null;
  const road = roadPoints(roadSnapshots);
  const manifesto = {
    rescues: t.count,
    wallets: new Set(rescues.map((r) => r.stakerAddr.toLowerCase())).size,
    keptHex: t.claimableHex,
    bleedStoppedPerDay: t.bleedStoppedPerDay,
    gasPls: t.gasPls,
    originHex: t.penaltyHex / 2,
  };

  const gross = t.claimableHex + t.penaltyHex;
  const keptFrac = gross > 0 ? t.claimableHex / gross : 0;
  const outcomes = t.claimed + t.unclaimed;
  const collectedFrac = outcomes > 0 ? t.claimed / outcomes : 0;
  const usd = (hex: number) => (price != null ? fmtUsdShort(hex * price) : null);

  return (
    <div
      className="min-h-screen w-full bg-[var(--app-bg)] [--viz-a:#d96406] [--viz-b:#d6186e] [--viz-c:#2a78d6] [--viz-gain:#0d9488] [--viz-loss:#be123c] dark:[--viz-a:#dd7300] dark:[--viz-b:#ff2e7e] dark:[--viz-c:#3987e5] dark:[--viz-gain:#0d9488] dark:[--viz-loss:#e11d48]"
    >
      <Manifesto figures={manifesto} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-10">
        {/* ── Hero: always-dark molten HEX panel, whatever the theme ──
            The panel pins the ink text vars locally so children built on the
            theme tokens (the RescuedBy lockup) stay legible in light mode. */}
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#06182e] p-5 md:p-8"
          style={{
            ['--text' as string]: '#ffffff',
            ['--text-muted' as string]: 'rgba(255,255,255,0.70)',
            ['--text-faint' as string]: 'rgba(255,255,255,0.45)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(120% 140% at 92% -20%, rgba(255,158,0,0.32) 0%, rgba(255,46,126,0.14) 45%, transparent 75%)' }}
          />
          <Honeycomb />
          <img
            src="/hex-logo.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -right-14 -top-14 h-64 w-64 rotate-12 select-none object-contain opacity-25 md:h-80 md:w-80"
          />
          <div className="relative">
            <RescuedBy />
            <h1 className="font-jost mt-3 flex items-center gap-3 text-[34px] font-bold leading-none tracking-tight text-white md:text-[52px]">
              <img src="/hex-logo.svg" alt="" aria-hidden="true" className="h-9 w-9 object-contain md:h-12 md:w-12" />
              The Rescue Wall
            </h1>
            <p className="font-poppins mt-2.5 text-[13px] text-white/60 md:text-[14px]">
              Matured HEX stakes bleed 1/700th a day until someone freezes them. We freeze them —{' '}
              <span className="font-semibold text-white">every one is still its owner’s.</span>
            </p>
            <ManifestoLink className="mt-2" />

            <div className="mt-7 grid gap-6 sm:grid-cols-2 md:gap-8">
              <HeroNumber
                label="Stakes rescued"
                value={t.count}
                fmt="int"
                sub="the keeper sweeps every hour"
                gradient
              />
              <HeroNumber
                label="HEX saved"
                value={t.claimableHex}
                fmt="hex"
                sub={usd(t.claimableHex) ?? 'kept whole at the freeze'}
              />
            </div>
          </div>
        </div>

        {rescues.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
            No rescues indexed yet. If the keeper has just run, the explorer may still be catching up.
          </div>
        ) : (
          <>
            {/* ── The instrument row ── */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Speedo
                frac={keptFrac}
                figure={`${(keptFrac * 100).toFixed(1)}%`}
                label="Kept whole"
                sub={`${fmtHex(t.penaltyHex)} HEX burned before we arrived`}
                tone="a"
              />
              <Speedo
                frac={collectedFrac}
                figure={`${t.claimed}`}
                label="Collected by owners"
                sub={
                  t.claimedHex > 0
                    ? `${fmtHex(t.claimedHex)} HEX taken home · ${fmtHex(t.unclaimedHex)} HEX in ${t.unclaimed.toLocaleString()} still waiting`
                    : `${fmtHex(t.unclaimedHex)} HEX in ${t.unclaimed.toLocaleString()} still waiting`
                }
                tone="b"
              />
              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
                {t.medianDaysToClaim != null && (
                  <BigStat
                    label="Typical wait to collect"
                    value={Math.max(1, Math.round(t.medianDaysToClaim * 24))}
                    fmt="waitHours"
                    sub="from freeze to collection"
                  />
                )}
                {t.biggest && (
                  <Link href={`/rescued/${t.biggest.stakeId}`} className="group">
                    <div className="relative h-full overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors group-hover:border-[#ff2e7e]/50">
                      <div className="font-poppins flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                        <IconTrophy className="h-3.5 w-3.5 text-amber-400" /> Biggest rescue
                      </div>
                      <div className="font-jost mt-1.5 text-[34px] font-bold leading-none tracking-tight text-[var(--text)] tabular-nums md:text-[40px]">
                        <HexAmount hex={t.biggest.claimableHex ?? 0} />
                      </div>
                      <div className="font-poppins mt-1.5 text-[11px] text-[var(--text-muted)]">
                        Stake #{t.biggest.stakeId} · kept whole
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </div>

            {/* ── The road to zero: what is still bleeding, and the decline ── */}
            <div className="mt-3">
              <RoadToZero points={road} price={price} minHex={roadHistory.minHex} maxHex={roadHistory.maxHex} />
            </div>

            {/* ── What owners did with the HEX once they collected it ── */}
            {fateView && fateView.judged > 0 && (
              <div className="mt-3">
                <CollectedFates slices={fateView.slices} judged={fateView.judged} collected={t.claimed} price={price} />
              </div>
            )}

            {/* ── What is coming next: stakes about to leave their grace ── */}
            {upcoming && (
              <div className="mt-3">
                <UpcomingBleeders
                  stakes={upcoming}
                  hours={UPCOMING_HOURS}
                  shown={UPCOMING_SHOWN}
                  keeperMinHex={defaultMinPrincipalHex()}
                  keeperMaxHex={defaultMaxPrincipalHex()}
                  now={renderedAt}
                />
              </div>
            )}

            {/* ── The record over time ── */}
            {points.length > 0 && (
              <div className="mt-3">
                <SavedChart points={points} price={price} />
              </div>
            )}

            {/* ── How it works: three beats, one line each ── */}
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                { icon: <IconClock className="h-5 w-5" style={{ color: 'var(--viz-a)' }} />, head: 'A stake matures', line: 'Its owner never comes back for it.' },
                { icon: <IconDroplet className="h-5 w-5 text-red-400" />, head: 'It starts to bleed', line: '1/700th of everything, every day, forever.' },
                { icon: <IconSnowflake className="h-5 w-5 text-cyan-300" />, head: 'We freeze it', line: 'Our gas, their HEX. Nothing taken.' },
              ].map((s, i) => (
                <div key={s.head} className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                  <span className="font-jost pointer-events-none absolute right-3 top-1 text-[44px] font-bold leading-none text-[var(--text-faint)] opacity-30">
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-2">{s.icon}
                    <span className="font-jost text-[15px] font-bold text-[var(--text)]">{s.head}</span>
                  </div>
                  <p className="font-poppins mt-1 text-[12px] text-[var(--text-muted)]">{s.line}</p>
                </div>
              ))}
            </div>

            {/* ── The keeper: schedule, fuel, address ── */}
            <div className="mt-3">
              <KeeperPanel address={KEEPER_ADDRESS} fuel={fuel} />
            </div>

            {t.unpriced > 0 && (
              <p className="font-poppins mt-2 text-[11px] text-[var(--text-faint)]">
                {t.unpriced} rescue{t.unpriced === 1 ? '' : 's'} not priced yet — the totals are a floor.
              </p>
            )}

            <h2 className="font-jost mt-8 flex items-baseline gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Every rescue
              <span className="text-[var(--text-muted)]">· {rescues.length}</span>
            </h2>
            <RescueList rescues={rescues} hexUsd={price} cardLimit={CARD_LIMIT} />
          </>
        )}

        {/* Anyone landing here who has a stake of their own should be one click
            from dealing with it, rescued or not. */}
        <a
          href={HEX_APP_URL}
          target="_blank"
          rel="noreferrer"
          className="group relative mt-6 flex items-center gap-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[#ff2e7e]/50"
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ background: HEX_GRADIENT }} />
          <img src="/hex-logo.svg" alt="" aria-hidden="true" className="relative h-9 w-9 shrink-0 object-contain" />
          <span className="relative">
            <span className="font-jost block text-sm font-bold text-[var(--text)]">Got a stake of your own?</span>
            <span className="font-poppins block text-[12px] text-[var(--text-muted)]">
              Check whether it has matured before it starts bleeding.
            </span>
          </span>
          <IconExternalLink className="relative ml-auto h-4 w-4 shrink-0 text-[var(--text-faint)]" />
        </a>
      </div>
    </div>
  );
}
