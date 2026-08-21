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
import { fetchRescues, totalsFor, KEEPER_ADDRESS, type Rescue } from '@/lib/hex/rescueFeed';
import { HEX_APP_URL } from '@/lib/hex/rescueCopy';
import { fmtHex, fmtUsdShort } from '@/lib/hex/hexDay';
import { HexAmount, HEX_GRADIENT } from '@/components/hex/HexAmount';
import { RescuedBy } from '@/components/rescue/RescueBrand';
import { RescueStakeCard } from '@/components/rescue/RescueStakeCard';
import { RescueList } from '@/components/rescue/RescueList';
import { KeeperPanel } from '@/components/rescue/KeeperPanel';
import {
  BigStat, HeroNumber, SavedChart, Speedo, type RescueBucket,
} from '@/components/rescue/RescueDashboard';

// A minute, not five. The wall is watched live while the keeper runs, and a
// five-minute window meant a sweep looked like nothing had happened.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'The Rescue Wall — HEX stakes saved from bleeding out',
  description:
    'Every matured HEX stake Morbius and SuperStake have frozen before the late-end penalty could eat it. Nothing taken, nothing given — the HEX is still the owner’s.',
};

/** How many stake cards to draw. Page weight, not data: the totals are summed
 *  over every rescue regardless of what is rendered. */
const CARD_LIMIT = 200;

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

/**
 * The chart's buckets: weekly while the record is young, monthly once it
 * spans a season — a two-month keeper with monthly bars is two lonely
 * rectangles, and a two-year one with weekly bars is a hundred slivers.
 */
function bucketize(rescues: Rescue[]): { buckets: RescueBucket[]; unit: string } {
  const stamped = rescues.filter((r) => r.timestamp > 0);
  if (stamped.length === 0) return { buckets: [], unit: 'day by day' };
  const min = Math.min(...stamped.map((r) => r.timestamp));
  const max = Math.max(...stamped.map((r) => r.timestamp));
  const span = max - min;
  const DAY = 86_400_000;
  const grain: 'day' | 'week' | 'month' = span < 45 * DAY ? 'day' : span < 200 * DAY ? 'week' : 'month';

  const keyOf = (ms: number) => {
    const d = new Date(ms);
    if (grain === 'month') return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    // Weekly buckets key on the Monday the rescue's week began.
    if (grain === 'week') day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    return String(day.getTime());
  };
  const labelOf = (ms: number) => {
    const d = new Date(ms);
    return grain === 'month'
      ? d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  const map = new Map<string, RescueBucket & { at: number }>();
  for (const r of stamped) {
    const k = keyOf(r.timestamp);
    const cur = map.get(k) ?? { label: labelOf(r.timestamp), hex: 0, count: 0, at: r.timestamp };
    cur.hex += r.claimableHex ?? 0;
    cur.count += 1;
    cur.at = Math.min(cur.at, r.timestamp);
    map.set(k, cur);
  }
  return {
    buckets: [...map.values()].sort((a, b) => a.at - b.at).map(({ at, ...b }) => b),
    unit: grain === 'day' ? 'day by day' : grain === 'week' ? 'week by week' : 'month by month',
  };
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
  // The whole history, not a page of it: the totals below are summed from this
  // list, so a cap here would not shorten the wall, it would under-report how
  // much HEX was saved. Cards are capped further down instead.
  const [rescues, price] = await Promise.all([
    fetchRescues('pulsechain').catch(() => []),
    hexUsd(),
  ]);
  const t = totalsFor(rescues);
  const collected = rescues.filter((r) => r.claimed);
  const { buckets, unit: bucketUnit } = bucketize(rescues);

  const gross = t.claimableHex + t.penaltyHex;
  const keptFrac = gross > 0 ? t.claimableHex / gross : 0;
  const outcomes = t.claimed + t.unclaimed;
  const collectedFrac = outcomes > 0 ? t.claimed / outcomes : 0;
  const usd = (hex: number) => (price != null ? fmtUsdShort(hex * price) : null);

  return (
    <div
      className="min-h-screen w-full bg-[var(--app-bg)] [--viz-a:#d96406] [--viz-b:#d6186e] [--viz-gain:#0d9488] [--viz-loss:#be123c] dark:[--viz-a:#dd7300] dark:[--viz-b:#ff2e7e] dark:[--viz-gain:#0d9488] dark:[--viz-loss:#e11d48]"
    >
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

            <div className="mt-7 grid gap-6 sm:grid-cols-3 md:gap-8">
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
                sub={usd(t.claimableHex) ?? 'waiting for their owners'}
              />
              <HeroNumber
                label="Bleeding stopped"
                value={t.bleedStoppedPerDay}
                fmt="hex"
                sub={usd(t.bleedStoppedPerDay) ? `${usd(t.bleedStoppedPerDay)} · every day` : 'HEX per day'}
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
                    ? `${fmtHex(t.claimedHex)} HEX taken home · ${t.unclaimed.toLocaleString()} still frozen safe`
                    : `${t.unclaimed.toLocaleString()} still frozen safe`
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

            {/* ── The record over time ── */}
            {buckets.length > 1 && (
              <div className="mt-3">
                <SavedChart buckets={buckets} price={price} unit={bucketUnit} />
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
              <KeeperPanel address={KEEPER_ADDRESS} />
            </div>

            {t.unpriced > 0 && (
              <p className="font-poppins mt-2 text-[11px] text-[var(--text-faint)]">
                {t.unpriced} rescue{t.unpriced === 1 ? '' : 's'} not priced yet — the totals are a floor.
              </p>
            )}

            {/* The rescues that reached their ending, pulled out of the main
                list: ordering by transaction buries them far past the card
                limit, and they are the proof the whole thing works. */}
            {collected.length > 0 && (
              <>
                <h2 className="font-jost mt-8 flex items-baseline gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-faint)]">
                  Collected by their owners
                  <span className="text-[var(--text-muted)]">· {collected.length}</span>
                </h2>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {collected.map((r) => (
                    <RescueStakeCard key={`claimed-${r.txHash}`} rescue={r} hexUsd={price} />
                  ))}
                </div>
              </>
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
