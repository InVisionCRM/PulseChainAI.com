'use client';

// SuperStake hub — what the machine does, what it has actually done, and the
// same-dollars head-to-head against a plain HEX stake.
//
// Every figure on this page is derived from the cycle record, never hardcoded:
// the snapshot is the floor, and /api/superstake/cycles (rebuilt from the HEX +
// PulseX subgraphs) is layered on top when it answers, so a bad day upstream
// costs freshness rather than the page.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { IconArrowRight, IconExternalLink } from '@tabler/icons-react';
import {
  cycleHeadToHead,
  dayToISO,
  hexPerDollar,
  inputsFromCycle,
  REFLECTION_RATE,
  S_SHARE,
  type CycleResult,
  type SuperStakeCycle,
  type SuperStakeSnapshot,
} from '@/lib/superstake/model';
import { pulsechainTokenUrl } from '@/lib/pulsechainExplorer';
import MachineFlow from '@/components/superstake/MachineFlow';
import CycleTable from '@/components/superstake/CycleTable';
import PairVolume from '@/components/superstake/PairVolume';
import PayoutBars from '@/components/superstake/PayoutBars';
import { Sparkline } from '@/components/lab/charts';
import GlanceStrip from '@/components/superstake/GlanceStrip';
import ShareCards from '@/components/superstake/ShareCards';
import EntryLoader, { type LoadPhase } from '@/components/EntryLoader';
import StatBanner from '@/components/superstake/StatBanner';
import ActionDock from '@/components/superstake/ActionDock';
import { GeickoTabNavigation } from '@/components/geicko';
import type { ShareData } from '@/lib/superstake/shareCard';

const PSSH = '0xb5c4ecef450fd36d0eba1420f6a19dbfbee5292e';
// `S_SHARE` (5,555 pSSH) now comes from the model, so the banner and the
// comparison table can't drift apart on it. The whitepaper sets it as the
// minimum holding that earns HEX rewards; "S-share" is our name for that
// threshold, not a token or an on-chain primitive. It divides the 55,550,000
// total supply into exactly 10,000, and because the 1% buy-and-burn only ever
// removes supply, the number that can exist only falls.

/** The head-to-head here is fixed at $100; /superstake/vs-hex takes any amount. */
const STAKE_AMOUNT = 100;
const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';

/**
 * The page is an onboarding tool before it is a dashboard, so the tabs are the
 * questions a newcomer asks, in the order they ask them — not a filing system
 * for the sections that happen to exist.
 */
const TABS = [
  { id: 'what', label: 'What happens' },
  { id: 'own', label: 'What you own' },
  { id: 'worked', label: 'Has it worked' },
  { id: 'hundred', label: 'What $100 does' },
  { id: 'alive', label: 'What keeps it alive' },
] as const;
type Tab = (typeof TABS)[number]['id'];

interface Live {
  pHEX: number | null;
  pSSH: number | null;
  wins: Record<string, number>;
  /** pSSH move since the previous day's close, percent. */
  psshChangePct?: number | null;
  /** HEX bought by the 2% and held unstaked, read off chain. */
  poolHexWaiting?: number | null;
  source: string;
}

const nf = (n: number, dp = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(0);
const usd = (n: number | null | undefined, dp = 6) =>
  n == null || !Number.isFinite(n) ? '—' : `$${n.toFixed(dp)}`;
/** Money at reading scale — cents only when the figure is small enough to need them. */
const usdShort = (n: number) =>
  !Number.isFinite(n)
    ? '—'
    : n >= 1e6
      ? `$${(n / 1e6).toFixed(2)}M`
      : n >= 1e3
        ? `$${(n / 1e3).toFixed(1)}k`
        : n >= 100
          ? `$${Math.round(n)}`
          : `$${n.toFixed(2)}`;

export default function SuperStakeHubPage() {
  const [snap, setSnap] = useState<SuperStakeSnapshot | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [fresh, setFresh] = useState(false);
  const [globalTShares, setGlobalTShares] = useState<number | null>(null);
  /**
   * Which of the three fetches have answered. The entry loader reads this, so
   * every step it shows is a request the page is genuinely waiting on — and a
   * failure has to be recorded as `fail`, or the loader would sit on it.
   */
  const [phases, setPhases] = useState<Record<'snapshot' | 'cycles' | 'live', LoadPhase>>({
    snapshot: 'wait',
    cycles: 'wait',
    live: 'wait',
  });

  useEffect(() => {
    let alive = true;
    const mark = (k: 'snapshot' | 'cycles' | 'live', p: LoadPhase) =>
      alive && setPhases((prev) => ({ ...prev, [k]: p }));

    (async () => {
      const base: SuperStakeSnapshot | null = await fetch('/api/superstake/snapshot')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!alive) return;
      if (!base) {
        // Nothing to layer onto, so the rebuild can't run either.
        mark('snapshot', 'fail');
        mark('cycles', 'fail');
        return;
      }
      setSnap(base);
      mark('snapshot', 'ok');
      try {
        const rebuilt = await fetch('/api/superstake/cycles').then((r) => (r.ok ? r.json() : null));
        if (alive && rebuilt?.cycles?.length && rebuilt?.series?.P?.length) {
          setSnap({ ...base, cycles: rebuilt.cycles, series: rebuilt.series });
          setFresh(true);
          if (rebuilt.globalTShares > 0) setGlobalTShares(rebuilt.globalTShares);
          mark('cycles', 'ok');
        } else {
          mark('cycles', 'fail');
        }
      } catch {
        /* stay on the snapshot */
        mark('cycles', 'fail');
      }
    })();
    fetch('/api/superstake/live')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d) {
          setLive(d);
          mark('live', 'ok');
        } else {
          mark('live', 'fail');
        }
      })
      .catch(() => mark('live', 'fail'));
    return () => {
      alive = false;
    };
  }, []);

  const view = useMemo(() => {
    if (!snap?.cycles?.length) return null;
    const cycles = snap.cycles;
    const running = cycles[cycles.length - 1];
    const completed = cycles.filter((c) => c.done);
    if (!completed.length) return null;

    // --- did each cycle cover its own 1% payout? ----------------------------
    // A cycle is self-funding when what came in (native HEX yield + the HEX the
    // 2% buy-tax bought) is at least what went out (the 1% holder payout). The
    // HEX bought during a cycle isn't recorded directly, so it's implied by the
    // next cycle's principal: next = principal + yield - payout + bought.
    const coverage = cycles
      .slice(0, -1)
      .map((c, i) => {
        const bought = cycles[i + 1].hex - (c.hex + c.nY - c.pay);
        const gained = c.nY + Math.max(0, bought);
        return { cycle: c, bought, gained, ratio: c.pay > 0 ? gained / c.pay : 0 };
      })
      .filter((x) => x.cycle.done);
    const covered = coverage.filter((x) => x.ratio >= 1).length;

    // --- the same $100 decision, scored one cycle at a time -----------------
    const per = completed
      .map((c) => {
        const inputs = inputsFromCycle(snap, c);
        const result = inputs ? cycleHeadToHead(STAKE_AMOUNT, inputs) : null;
        return result ? { cycle: c, result } : null;
      })
      .filter((x): x is { cycle: SuperStakeCycle; result: CycleResult } => x !== null);
    const psshWins = per.filter((p) => p.result.winner === 'pssh').length;
    let streak = 0;
    for (let i = per.length - 1; i >= 0; i--) {
      if (per[i].result.winner === 'pssh') streak++;
      else break;
    }

    // Compound growth of the stake itself. Quoted per cycle and over the recent
    // run as well as all-time, because the early cycles grew off a tiny base and
    // the all-time figure alone would flatter the current rate.
    const first = cycles[0];
    const lastC = cycles[cycles.length - 1];
    const spans = cycles.length - 1;
    const recent = cycles.slice(-7);
    const perCycleGrowth = (a: number, b: number, n: number) =>
      a > 0 && n > 0 ? (Math.pow(b / a, 1 / n) - 1) * 100 : 0;
    const growth = {
      multiple: first.hex > 0 ? lastC.hex / first.hex : 0,
      spans,
      allTime: perCycleGrowth(first.hex, lastC.hex, spans),
      recent: perCycleGrowth(recent[0].hex, recent[recent.length - 1].hex, recent.length - 1),
      recentN: recent.length - 1,
    };

    return {
      cycles, running, per, psshWins, streak, coverage, covered, growth,
      coverageByCycle: new Map(
        coverage.map((x) => [x.cycle.i, { ratio: x.ratio, gained: x.gained, bought: x.bought }]),
      ),
      neverShrank: cycles.every((c, i) => i === 0 || c.hex >= cycles[i - 1].hex),
    };
  }, [snap]);

  // The cycle now running, scored on today's prices, payout rate and volume.
  // A projection, not a record — it assumes the next 60 days look like today.
  const ahead = useMemo(() => {
    if (!view || !snap) return null;
    const { running } = view;
    const days = running.d1 - running.d0;
    const pHex = live?.pHEX ?? snap.meta.pHEX;
    const pSsh = live?.pSSH ?? snap.meta.pSSH;
    const avgVol = live?.wins?.['60'] ?? snap.wins?.['60'] ?? 0;
    const result = cycleHeadToHead(STAKE_AMOUNT, {
      days,
      pHex,
      pSsh,
      pHexAvg: pHex,
      shareRate: snap.meta.shareRate,
      payoutPerTshare: snap.meta.payoutPerTshare,
      poolHex: running.hex,
      poolYieldHex: running.tsh * snap.meta.payoutPerTshare * days,
      volumeUsd: avgVol * days,
      supply: snap.meta.supply,
    });
    return result ? { result, days, avgVol } : null;
  }, [view, snap, live]);

  // How much daily volume the running cycle needs to cover its own payout.
  // Expected yield comes from the stake's T-shares at the current payout rate;
  // the shortfall has to be bought by the 2% tax, which only volume funds.
  const need = useMemo(() => {
    if (!view || !snap) return null;
    const { running } = view;
    const days = running.d1 - running.d0;
    if (!(days > 0)) return null;
    const pHex = live?.pHEX ?? snap.meta.pHEX;
    if (!(pHex > 0)) return null;
    const expYield = running.tsh * snap.meta.payoutPerTshare * days;
    const payout = 0.01 * (running.hex + expYield);
    const gapHex = Math.max(0, payout - expYield);
    const perDay = (gapHex * pHex) / 0.02 / days;
    const actual = live?.wins?.['60'] ?? snap.wins?.['60'] ?? 0;
    // What the cycle is actually taking in — HEX's own yield plus the HEX the
    // 2% buys at current volume — against the 1% it hands out, both as a share
    // of the principal so they sit on one scale.
    const boughtHex = (0.02 * actual * days) / pHex;
    const inPct = running.hex > 0 ? ((expYield + boughtHex) / running.hex) * 100 : 0;
    const outPct = running.hex > 0 ? (payout / running.hex) * 100 : 0;
    return {
      days, expYield, payout, gapHex, perDay, actual,
      times: perDay > 0 ? actual / perDay : 0,
      inPct, outPct,
    };
  }, [view, snap, live]);

  // Client-only, so the first paint matches the server's and React doesn't
  // complain about a mismatched countdown. Floored to whole days to match the
  // hero clock exactly — two different roundings of the same deadline sitting
  // a few hundred pixels apart just reads as one of them being wrong.
  const [daysLeft, setDaysLeft] = useState(0);
  useEffect(() => {
    if (!view) return;
    setDaysLeft(
      Math.max(
        0,
        Math.floor((Date.parse(`${dayToISO(view.running.d1)}T00:00:00Z`) - Date.now()) / 86_400_000),
      ),
    );
  }, [view]);

  // Everything the cards draw, from the same figures the page renders.
  const shareData: ShareData | null = useMemo(() => {
    if (!snap || !view || !ahead || !need) return null;
    return {
      asOf: fresh ? new Date().toISOString().slice(0, 10) : snap.meta.asOf,
      cycleNo: view.running.i,
      daysLeft,
      stakeHex: view.running.hex,
      tShares: view.running.tsh,
      pSSH: live?.pSSH ?? snap.meta.pSSH,
      pHEX: live?.pHEX ?? snap.meta.pHEX,
      amount: STAKE_AMOUNT,
      stakeYield: ahead.result.stakeYield,
      psshYield: ahead.result.psshYield,
      payouts: ahead.result.payouts,
      reflections: ahead.result.reflections,
      psshWins: view.psshWins,
      cyclesDone: view.per.length,
      winnerStrip: view.per.map((p) => p.result.winner === 'pssh'),
      covered: view.covered,
      coverage: view.coverage.map((x) => x.ratio),
      needPerDay: need.perDay,
      actualPerDay: need.actual,
      coverTimes: need.times,
      inPct: need.inPct,
      outPct: need.outPct,
      sSharesLeft: snap.meta.supply / S_SHARE,
      sSharesMinted: (snap.meta.supply + snap.meta.burned) / S_SHARE,
      burned: snap.meta.burned,
      hexByCycle: view.cycles.map((c) => c.hex),
      growthMultiple: view.growth.multiple,
      growthAllTime: view.growth.allTime,
      growthRecent: view.growth.recent,
      growthRecentN: view.growth.recentN,
      sShareCost: (live?.pSSH ?? snap.meta.pSSH) * S_SHARE,
      hexWaiting: live?.poolHexWaiting ?? null,
      streak: view.streak,
    };
  }, [snap, view, ahead, need, live, fresh, daysLeft]);

  const pSshPrice = live?.pSSH ?? snap?.meta.pSSH ?? null;
  const pHexPrice = live?.pHEX ?? snap?.meta.pHEX ?? null;
  /** What the stake is worth today, at the same HEX price the rest of the page quotes. */
  const stakeUsd = view && pHexPrice ? view.running.hex * pHexPrice : null;

  /**
   * What a dollar buys on each side. The banner leads on it because it is the
   * one figure that answers "why bother" without any of the page's context.
   */
  const unit = useMemo(() => {
    if (!snap || !view || !pHexPrice || !pSshPrice) return null;
    return hexPerDollar({
      poolPayout: view.running.pay,
      cycleDays: view.running.d1 - view.running.d0,
      avgVolUsd: live?.wins?.['60'] ?? snap.wins?.['60'] ?? 0,
      pHex: pHexPrice,
      pSsh: pSshPrice,
      supply: snap.meta.supply,
      shareRate: snap.meta.shareRate,
      payoutPerTshare: snap.meta.payoutPerTshare,
    });
  }, [snap, view, live, pHexPrice, pSshPrice]);

  // ── tabs ────────────────────────────────────────────────────────────────
  // Read and written through `window.location` rather than `useSearchParams`,
  // which would drag a Suspense boundary in for a value this page can happily
  // resolve after mount.
  const [tab, setTab] = useState<Tab>('what');
  // The tab bar sticks directly under the banner, so it has to know how tall
  // the banner actually is — measured rather than assumed, because the banner
  // grows a line when a value wraps.
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const [bannerH, setBannerH] = useState(0);
  useEffect(() => {
    const el = bannerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setBannerH(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab');
    if (q && TABS.some((t) => t.id === q)) setTab(q as Tab);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') === tab) return;
    url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url);
  }, [tab]);

  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)]">
      <EntryLoader
        ready={!!view}
        steps={[
          { label: 'Cycle record', phase: phases.snapshot },
          { label: 'Rebuilt from the subgraphs', phase: phases.cycles },
          { label: 'Live prices and volume', phase: phases.live },
        ]}
        art={{
          landscape: '/superstake-loading.jpg',
          portrait: '/superstake-loading-portrait.jpg',
        }}
        markSrc="/superstake-logo.png"
        markLabel="SuperStake · pSSH"
        title={{ lead: 'A HEX stake that', accent: 'restakes itself' }}
        sub="Replaying every cycle from the HEX and PulseX subgraphs."
        ariaLabel="Loading SuperStake"
      />
      {/* ─────────── the live strip ───────────
          Every figure a returning holder opens the page for. It stays put, so
          the tabs below can explain rather than report. */}
      <div ref={bannerRef} className="sticky top-0 z-30">
        <StatBanner
          cycleNo={view?.running.i ?? null}
          daysLeft={daysLeft}
          cycleDays={view ? view.running.d1 - view.running.d0 : 60}
          endISO={view ? dayToISO(view.running.d1) : null}
          pSsh={pSshPrice}
          psshChangePct={live?.psshChangePct ?? null}
          sShareCost={pSshPrice != null ? pSshPrice * S_SHARE : null}
          hexPerDollar={unit?.sShare ?? null}
          hexPerDollarStaking={unit?.tShare ?? null}
          hexWaiting={live?.poolHexWaiting ?? null}
          burned={snap?.meta.burned ?? null}
          burnedPct={
            snap ? (snap.meta.burned / (snap.meta.supply + snap.meta.burned)) * 100 : null
          }
          isLive={live?.source === 'pulsex-subgraph'}
          asOf={snap?.meta.asOf}
        />
      </div>

      {/* Bottom padding clears what floats over the page. On a phone that's the
          bottom nav (64px) plus the dock riding above it; on desktop just the
          dock at 41px + its own height. */}
      <div className="w-full px-2 pb-36 pt-4 md:px-3 md:pb-24">
        {/* ─────────── the headline, and nothing else ───────────
            The stat card that used to live here said "closed and reopened 17×",
            which only means something once you already know what a cycle is.
            Those figures are either in the banner now or inside the tab that
            explains them. */}
        <header className="relative mb-4 overflow-hidden rounded-xl px-3 py-5 md:px-5 md:py-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-1/2 right-0 aspect-square w-1/2 opacity-[0.18] blur-3xl"
            style={{ background: GRAD }}
          />
          <h1 className="relative max-w-[15ch] text-balance text-[clamp(30px,5.4vw,54px)] font-bold leading-[1.02] tracking-[-0.04em] text-[var(--text)]">
            A HEX stake that{' '}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>
              restakes itself
            </span>{' '}
            every 60 days.
          </h1>
          <p className="relative mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--text-muted)]">
            The same stake, closing and reopening on its own — buying HEX and burning pSSH the whole
            way. The only thing that could stop it is HEX itself.
          </p>
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            {shareData && <ShareCards data={shareData} />}
            <Tool href={pulsechainTokenUrl(PSSH)} label="pSSH contract" external />
            {view && view.streak > 1 && (
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-white"
                style={{ background: GRAD }}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
                pSSH ahead — last {view.streak} cycles
              </span>
            )}
          </div>
        </header>

        {/* ─────────── the questions ─────────── */}
        <div className="sticky z-30 bg-[var(--app-bg)] pt-1" style={{ top: bannerH }}>
          <GeickoTabNavigation<Tab> activeTab={tab} tabs={TABS} onTabChange={setTab} fit="scroll" />
        </div>
        <div className="px-2 md:px-3">
          <div className="relative z-20 min-h-[420px] rounded-lg rounded-t-none border border-[var(--line)] bg-[var(--panel)] p-3 md:p-5">
            {/* ── what happens ── */}
            {tab === 'what' && (
              <div className="flex flex-col gap-4">
                <SectionHead
                  title="Two things happen. That's the whole machine."
                  sub="every trade, and every 60 days"
                  tight
                />
                <MachineFlow />
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <Fig
                    label="Closed and reopened"
                    value={view ? `${view.per.length}×` : '—'}
                    sub="with nobody at the wheel"
                  />
                  <Fig
                    label="HEX in the stake"
                    value={view ? Math.round(view.running.hex).toLocaleString() : '—'}
                    sub={
                      stakeUsd != null && pHexPrice != null
                        ? `$${Math.round(stakeUsd).toLocaleString()} at ${usd(pHexPrice, 6)} / HEX`
                        : ''
                    }
                  />
                  <Fig
                    label="T-shares"
                    value={view ? view.running.tsh.toFixed(2) : '—'}
                    // Deliberately not "% of all HEX": the snapshot's `own` field is
                    // off by ~1000x against the subgraph's global share total, and
                    // the live rebuild doesn't compute it at all. Share rate is solid.
                    sub={snap ? `share rate ${Math.round(snap.meta.shareRate).toLocaleString()}` : ''}
                  />
                </div>
                {view && view.cycles.length > 1 && (
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--app-bg)] p-3">
                    <div
                      className="text-[9.5px] uppercase tracking-[0.13em] text-[var(--text-faint)]"
                      style={{ fontFamily: MONO }}
                    >
                      HEX in the stake, every cycle
                    </div>
                    <div className="mt-2 max-w-[420px]">
                      <Sparkline data={view.cycles.map((c) => c.hex)} height={30} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── what you own ── */}
            {tab === 'own' && view && snap && (
              <div className="flex flex-col gap-4">
                <SectionHead
                  title="HEX has the T-share. pSSH has the S-share."
                  sub="the unit each one sells you"
                  tight
                />
                <ShareCompare
              snap={snap}
              poolHex={view.running.hex}
              poolPayout={view.running.pay}
              cycleDays={view.running.d1 - view.running.d0}
              avgVol={live?.wins?.['60'] ?? snap.wins?.['60'] ?? 0}
              pHex={live?.pHEX ?? snap.meta.pHEX}
              pSsh={live?.pSSH ?? snap.meta.pSSH}
                  globalTShares={globalTShares}
                  cyclesDone={view.per.length}
                />
              </div>
            )}

            {/* ── has it worked ── */}
            {tab === 'worked' && view && (
              <div className="flex flex-col gap-4">
                <SectionHead
                  title="HEX in the stake"
                  sub="every cycle since launch — it has never gone down"
                  tight
                />
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <Fig
                    label="Growth all time"
                    value={`${view.growth.multiple.toFixed(2)}×`}
                    sub={`over ${view.growth.spans} cycles`}
                  />
                  <Fig
                    label="Avg growth per cycle"
                    value={`${view.growth.allTime.toFixed(2)}%`}
                    sub="all time"
                  />
                  <Fig
                    label="Avg growth per cycle"
                    value={`${view.growth.recent.toFixed(2)}%`}
                    sub={`last ${view.growth.recentN} cycles`}
                    good
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
                  This is the pool compounding, not a holder&apos;s return — holders receive 1% of it
                  each cycle. The all-time rate is flattered by the early cycles growing off a small
                  base, which is why the recent run is shown beside it.
                </p>
                <StakeChart cycles={view.cycles} />

                <div className="border-t border-[var(--line)] pt-4">
                  <SectionHead
                    title="Every cycle covered its own payout"
                    sub="what came in against the 1% that went out"
                    tight
                  />
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    <Fig
                      label="Cycles that covered it"
                      value={`${view.covered} of ${view.coverage.length}`}
                      sub="every finished cycle on record"
                      good={view.covered === view.coverage.length}
                    />
                    <Fig
                      label="Times the principal fell"
                      value={view.neverShrank ? 'never' : 'see chart'}
                      sub={`across ${view.cycles.length} cycles`}
                      good={view.neverShrank}
                    />
                  </div>
                  <CoverageBars rows={view.coverage} />
                </div>
              </div>
            )}

            {/* ── what $100 does ── */}
            {tab === 'hundred' && view && ahead && (
              <div className="flex flex-col gap-4">
                <SectionHead
                  title={`$${STAKE_AMOUNT} in today, held one ${ahead.days}-day cycle`}
                  sub="projected from today's prices, payout rate and volume"
                  tight
                />
                <div className="grid overflow-hidden rounded-t-2xl border border-[var(--line)] md:grid-cols-2">
              <div className="flex flex-col bg-[var(--panel)] p-5 md:p-6">
                <div
                  className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]"
                  style={{ fontFamily: MONO }}
                >
                  Stake the HEX yourself
                </div>
                <div className="mt-3 text-[clamp(34px,6.2vw,54px)] font-bold leading-none tracking-[-0.045em] tabular-nums text-[var(--text)]">
                  +{Math.round(ahead.result.stakeYield).toLocaleString()}
                  <span className="ml-1.5 text-[0.3em] font-semibold text-[var(--text-faint)]">
                    HEX
                  </span>
                </div>
                <p className="mt-2 max-w-[34ch] text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                  Buy {Math.round(ahead.result.hexAmount).toLocaleString()} HEX at{' '}
                  {usd(ahead.result.pHex, 6)} and lock it for {ahead.days} days.
                </p>
                <dl className="mt-auto grid gap-1.5 pt-4">
                  <Row k="T-shares earned" v={ahead.result.tShares.toFixed(3)} />
                  <Row
                    k="Longer-pays-better bonus"
                    v={`+${((ahead.result.lpbMultiplier - 1) * 100).toFixed(1)}%`}
                  />
                </dl>
              </div>

              <div
                className="relative flex flex-col p-5 text-white md:p-6"
                style={{ background: GRAD }}
              >
                {view.streak > 1 && (
                  <span
                    className="self-start rounded-full border border-white/40 bg-white/20 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em]"
                    style={{ fontFamily: MONO }}
                  >
                    ahead {view.streak} cycles running
                  </span>
                )}
                <div
                  className="mt-2.5 text-[10px] uppercase tracking-[0.18em] opacity-85"
                  style={{ fontFamily: MONO }}
                >
                  Buy pSSH and sit on it
                </div>
                <div className="mt-3 text-[clamp(34px,6.2vw,54px)] font-bold leading-none tracking-[-0.045em] tabular-nums">
                  +{Math.round(ahead.result.psshYield).toLocaleString()}
                  <span className="ml-1.5 text-[0.3em] font-semibold opacity-70">HEX</span>
                </div>
                <p className="mt-2 max-w-[34ch] text-[12.5px] leading-relaxed opacity-80">
                  ${(STAKE_AMOUNT * (1 - 0.055)).toFixed(2)} of pSSH after the 5.5% tax —{' '}
                  {Math.round(ahead.result.psshAmount).toLocaleString()} tokens, held through the
                  end-stake.
                </p>
                <dl className="mt-auto grid gap-1.5 pt-4">
                  <Row
                    k="From the end-stake payout"
                    v={`${Math.round(ahead.result.payouts).toLocaleString()} HEX`}
                    light
                  />
                  <Row
                    k={`From reflections at ${usdShort(ahead.avgVol)}/day`}
                    v={`${Math.round(ahead.result.reflections).toLocaleString()} HEX`}
                    light
                  />
                </dl>
              </div>
            </div>

            <p className="rounded-b-2xl border border-t-0 border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[11.5px] leading-relaxed text-[var(--text-faint)]">
              A projection, not a record: it holds today&apos;s pHEX and pSSH prices, the current
              payout-per-T-share of {snap?.meta.payoutPerTshare.toFixed(4)}, and the trailing 60-day
              average volume of {usdShort(ahead.avgVol)}/day steady for the whole cycle. Every one of
              those moves. The table below is what actually happened, cycle by cycle.
            </p>

            {/* every cycle, scored the same way — each row opens up */}
            <CycleTable
              rows={view.per}
              coverage={view.coverageByCycle}
              amount={STAKE_AMOUNT}
              psshWins={view.psshWins}
              series={snap?.series}
              running={view.running}
              daysLeft={Math.max(
                0,
                Math.ceil(
                  (Date.parse(`${dayToISO(view.running.d1)}T00:00:00Z`) - Date.now()) / 86_400_000,
                ),
              )}
            />

                <Link
                  href="/superstake/vs-hex"
                  className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  See the full history with your own amount
                  <IconArrowRight className="h-3.5 w-3.5" />
                </Link>

                {snap && view.cycles.length > 0 && (
                  <div className="border-t border-[var(--line)] pt-4">
                    <PayoutBars
                      cycles={view.cycles}
                      coverage={view.coverageByCycle}
                      supply={snap.meta.supply}
                      amount={STAKE_AMOUNT}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── what keeps it alive ── */}
            {tab === 'alive' && (
              <div className="flex flex-col gap-4">
                {view && (
                  <>
                    <SectionHead
                      title={
                        need
                          ? `${usdShort(need.perDay)} a day keeps it growing. It's doing ${usdShort(need.actual)}.`
                          : 'Every cycle has covered its own payout.'
                      }
                      sub="the buy-tax, not HEX's own yield"
                      tight
                    />
                    <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--text-muted)]">
                      Each cycle hands holders 1% of the pool, so the stake only shrinks if what comes
                      in — HEX&apos;s own yield plus the HEX the 2% buy-tax buys — falls short of that
                      1%.{' '}
                      {need && (
                        <>
                          Cycle {view.running.i} needs{' '}
                          <b className="text-[var(--text)]">{compact(need.gapHex)} HEX</b> from the
                          tax to break even, which takes{' '}
                          <b className="text-[var(--text)]">{usdShort(need.perDay)} of daily volume</b>
                          . Trading is currently running{' '}
                          <b className="text-[var(--up)]">{need.times.toFixed(1)}× that</b>.{' '}
                        </>
                      )}
                      {view.neverShrank && 'The principal has never once gone down.'}
                    </p>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <Fig
                        label="Daily volume needed"
                        value={usdShort(need?.perDay ?? 0)}
                        sub={need ? `to cover cycle ${view.running.i}` : '—'}
                      />
                      <Fig
                        label="Daily volume actual"
                        value={usdShort(need?.actual ?? 0)}
                        sub="trailing 60-day average"
                        good
                      />
                    </div>

                    <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
                      HEX&apos;s native yield alone stopped covering the payout around cycle 10 — it
                      now runs well under 1% a cycle. Every cycle since has been carried by the
                      buy-tax, which is why the volume figure above is the number that actually
                      matters.
                    </p>

                    {ahead && need && (
                      <GlanceStrip
                        perDollarRatio={
                          ahead.result.stakeYield > 0
                            ? ahead.result.psshYield / ahead.result.stakeYield
                            : 1
                        }
                        sharesLeft={snap ? snap.meta.supply / S_SHARE : 0}
                        sharesMinted={snap ? (snap.meta.supply + snap.meta.burned) / S_SHARE : 0}
                        coverTimes={need.times}
                        inPct={need.inPct}
                        outPct={need.outPct}
                        daysLeft={daysLeft}
                        cycleDays={view.running.d1 - view.running.d0}
                        sShareCost={pSshPrice != null ? pSshPrice * S_SHARE : null}
                        hexWaiting={live?.poolHexWaiting ?? null}
                        stakeHex={view.running.hex}
                      />
                    )}
                  </>
                )}

                <div className="border-t border-[var(--line)] pt-4">
                  <PairVolume token={PSSH} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─────────── provenance ─────────── */}
        <p className="mt-6 px-2 text-[11px] leading-relaxed text-[var(--text-faint)] md:px-3">
          <b className="text-[var(--text-muted)]">Where these come from.</b> Cycle history, share
          rates and payouts are replayed from the HEX subgraph; prices and pSSH volume from the
          PulseX subgraph, using untracked volume so the smaller pairs aren&apos;t dropped.{' '}
          {fresh ? (
            <b className="text-[var(--up)]">Rebuilt live from the subgraphs.</b>
          ) : (
            <b className="text-[var(--text-muted)]">
              Subgraphs unavailable — showing the {snap?.meta.asOf ?? '—'} snapshot.
            </b>
          )}{' '}
          Past cycles are a record, not a forecast, and none of this is financial advice.
        </p>
      </div>

      {/* Buy and the project's links, held within reach at every scroll position
          rather than only above the reasons to act on them. */}
      <ActionDock token={PSSH} />
    </div>
  );
}

/* ────────────────────────── small pieces ────────────────────────── */

function SectionHead({ title, sub, tight }: { title: string; sub: string; tight?: boolean }) {
  return (
    <div className={`flex flex-wrap items-baseline gap-3 ${tight ? 'mb-1' : 'mb-3.5'}`}>
      <h2 className="text-[clamp(17px,2.4vw,21px)] font-bold tracking-[-0.02em] text-[var(--text)]">
        {title}
      </h2>
      <span className="text-[12.5px] text-[var(--text-faint)]">{sub}</span>
    </div>
  );
}


/**
 * Side-by-side on the unit each system sells. The contrast that matters is the
 * last row: T-shares are minted forever and get dearer as the share rate climbs,
 * while S-shares were fixed at exactly 10,000 by the supply and only ever burn.
 */
function ShareCompare({
  snap, poolHex, poolPayout, cycleDays, avgVol, pHex, pSsh, globalTShares, cyclesDone,
}: {
  snap: SuperStakeSnapshot;
  poolHex: number;
  poolPayout: number;
  cycleDays: number;
  avgVol: number;
  pHex: number;
  pSsh: number;
  globalTShares: number | null;
  /** Finished cycles, so the burn can be quoted as a rate rather than a total. */
  cyclesDone: number;
}) {
  const total = snap.meta.supply + snap.meta.burned;
  const mintedS = total / S_SHARE;
  const leftS = snap.meta.supply / S_SHARE;
  const burnedS = snap.meta.burned / S_SHARE;
  const pctLeft = mintedS > 0 ? (leftS / mintedS) * 100 : 0;
  // An S-share earns twice: its slice of the 1% end-stake payout, plus its slice
  // of the 2.5% reflections the cycle's volume funds. Counting only the payout
  // would understate it against a T-share, which earns just the one way.
  const reflHex = pHex > 0 ? (REFLECTION_RATE * avgVol * cycleDays) / pHex : 0;
  const perS = leftS > 0 ? (poolPayout + reflHex) / leftS : 0;
  const perT = snap.meta.payoutPerTshare * cycleDays;

  const rows: { k: string; t: string; s: string; hero?: boolean }[] = [
    {
      k: 'What one unit is',
      t: `${nf(snap.meta.shareRate)} HEX`,
      s: `${nf(S_SHARE)} pSSH`,
    },
    {
      k: 'What it costs today',
      t: pHex > 0 ? `$${(snap.meta.shareRate * pHex).toFixed(2)}` : '—',
      s: pSsh > 0 ? `$${(S_SHARE * pSsh).toFixed(2)}` : '—',
    },
    {
      k: 'How many exist',
      t: globalTShares ? `${nf(globalTShares)}` : '—',
      s: `${nf(leftS, 1)} of ${nf(mintedS)}`,
    },
    {
      // Priced as well as counted: 505 HEX reads as a lot until you notice it's
      // under a dollar against a $16 S-share. It is not a redemption right —
      // holders receive 1% of the pool per cycle, never the pool itself.
      k: 'HEX already staked behind it',
      t: 'you stake your own',
      s: `${nf(poolHex / leftS, 1)} HEX${pHex > 0 ? ` · $${((poolHex / leftS) * pHex).toFixed(2)}` : ''}`,
    },
    {
      k: 'HEX earned per $1 spent',
      t: pHex > 0 ? `${(perT / (snap.meta.shareRate * pHex)).toFixed(2)} HEX` : '—',
      s: pSsh > 0 ? `${(perS / (S_SHARE * pSsh)).toFixed(2)} HEX` : '—',
      hero: true,
    },
    {
      k: 'If you want out',
      t: 'locked for the term — ending early forfeits yield and pays a penalty',
      s: 'sell any day · reflections already paid are yours',
    },
    {
      k: 'Where the count goes',
      t: 'up forever — new stakes mint more',
      s: 'down only — the 1% burns them',
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="grid grid-cols-[1.1fr_1fr_1fr] items-end gap-2 border-b border-[var(--line)] px-4 py-3 sm:grid-cols-[1.4fr_1fr_1fr]">
        <span
          className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
          style={{ fontFamily: MONO }}
        >
          Per unit
        </span>
        <span className="text-right text-sm font-bold tracking-tight text-[var(--text)]">
          T-share
          <span className="ml-1 text-[10px] font-medium text-[var(--text-faint)]">HEX</span>
        </span>
        <span
          className="text-right text-sm font-bold tracking-tight"
          style={{ backgroundImage: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
        >
          S-share
          <span className="ml-1 text-[10px] font-medium text-[var(--text-faint)]">pSSH</span>
        </span>
      </div>

      {rows.map((r) => (
        <div
          key={r.k}
          className="grid grid-cols-[1.1fr_1fr_1fr] items-baseline gap-2 border-b border-[var(--line)] px-4 py-2.5 last:border-b-0 sm:grid-cols-[1.4fr_1fr_1fr]"
        >
          <span className="text-[12px] leading-snug text-[var(--text-muted)]">{r.k}</span>
          <span
            className={`text-right tabular-nums text-[var(--text)] ${
              r.hero ? 'text-[17px] font-bold tracking-[-0.02em]' : 'text-[13px]'
            }`}
          >
            {r.t}
          </span>
          <span
            className={`text-right tabular-nums ${
              r.hero ? 'text-[17px] font-bold tracking-[-0.02em]' : 'text-[13px]'
            }`}
            style={
              r.hero
                ? { backgroundImage: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
                : { color: 'var(--text)' }
            }
          >
            {r.s}
          </span>
        </div>
      ))}

      {/* how much of the fixed 10,000 is already gone */}
      <div className="border-t border-[var(--line)] px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span
            className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
            style={{ fontFamily: MONO }}
          >
            S-shares remaining
          </span>
          <span className="text-[11.5px] text-[var(--text-muted)]">
            <b className="text-[var(--text)]">{nf(burnedS, 1)}</b> burned out of {nf(mintedS)}
            {cyclesDone > 0 && (
              <>
                {' · '}
                <b className="text-[var(--text)]">{(burnedS / cyclesDone).toFixed(1)}</b> a cycle
              </>
            )}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-[var(--line)]">
          <span className="block h-full rounded" style={{ width: `${pctLeft}%`, background: GRAD }} />
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--text-faint)]">
          <b className="text-[var(--text-muted)]">S-share is our name for it, not a token.</b> The
          pSSH whitepaper sets {nf(S_SHARE)} pSSH as the minimum holding that earns HEX rewards, and
          that divides the {nf(total)} total supply into exactly {nf(mintedS)}. Every buy and sell
          burns 1%, so the count only falls — a T-share is minted on demand and gets dearer as the
          share rate climbs, an S-share can only get scarcer.
        </p>
      </div>
    </div>
  );
}

function Fig({
  label, value, sub, good,
}: { label: string; value: string; sub: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--app-bg)] p-3">
      <div
        className="text-[9.5px] uppercase tracking-[0.13em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        {label}
      </div>
      <div
        className={`mt-1.5 text-[22px] font-bold tracking-[-0.03em] tabular-nums ${
          good ? 'text-[var(--up)]' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-faint)]">{sub}</div>
    </div>
  );
}

/**
 * One bar per finished cycle, filled green when that cycle brought in at least
 * the 1% it paid out. Coverage spans ~1.7x to ~227x, so the bar height is on a
 * log scale — a linear one would flatten every recent cycle to nothing.
 */
function CoverageBars({
  rows,
}: { rows: { cycle: SuperStakeCycle; ratio: number }[] }) {
  if (!rows.length) return null;
  const TOP = 30; // ratio at which a bar reaches full height
  const h = (ratio: number) =>
    ratio <= 0 ? 6 : 14 + 86 * Math.min(1, Math.log10(ratio) / Math.log10(TOP));

  return (
    <div className="mt-4">
      <div className="relative h-[86px]">
        {/* the break-even line — anything reaching it covered its payout */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--line-strong)]"
          style={{ bottom: '14%' }}
        />
        <div className="flex h-full items-end gap-[3px]">
          {rows.map(({ cycle, ratio }) => {
            const ok = ratio >= 1;
            return (
              <span
                key={cycle.i}
                title={`Cycle ${cycle.i} — brought in ${ratio.toFixed(2)}× its payout`}
                className="flex-1 rounded-t-sm transition-colors"
                style={{
                  height: `${h(ratio)}%`,
                  background: ok
                    ? 'linear-gradient(180deg,var(--up),color-mix(in srgb,var(--up) 45%,transparent))'
                    : 'var(--line-strong)',
                }}
              />
            );
          })}
        </div>
      </div>
      <div
        className="mt-1.5 flex justify-between text-[9.5px] tracking-[0.08em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        <span>CYCLE {rows[0].cycle.i}</span>
        <span>DASHED LINE = THE 1% PAYOUT COVERED</span>
        <span>CYCLE {rows[rows.length - 1].cycle.i}</span>
      </div>
    </div>
  );
}

function Row({ k, v, light }: { k: string; v: string; light?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-3 border-t pt-1.5 text-xs ${
        light ? 'border-white/25 opacity-90' : 'border-[var(--line)] text-[var(--text-muted)]'
      }`}
    >
      <dt>{k}</dt>
      <dd className="font-bold tabular-nums">{v}</dd>
    </div>
  );
}

function Tool({ href, label, external }: { href: string; label: string; external?: boolean }) {
  const cls =
    'inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]';
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {label} <IconExternalLink className="h-3 w-3" />
    </a>
  ) : (
    <Link href={href} className={cls}>
      {label} <IconArrowRight className="h-3 w-3" />
    </Link>
  );
}

/** HEX principal per cycle, drawn as an area + line with the latest point marked. */
function StakeChart({ cycles }: { cycles: SuperStakeCycle[] }) {
  const { d, area, tip, first, last } = useMemo(() => {
    const W = 640;
    const H = 190;
    const PAD = 12;
    const max = Math.max(...cycles.map((c) => c.hex)) * 1.02 || 1;
    const pts = cycles.map((c, i) => [
      (i / Math.max(1, cycles.length - 1)) * W,
      H - PAD - (c.hex / max) * (H - PAD * 2),
    ]);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return {
      d: path,
      area: `${path} L${W} ${H} L0 ${H} Z`,
      tip: pts[pts.length - 1],
      first: cycles[0],
      last: cycles[cycles.length - 1],
    };
  }, [cycles]);

  return (
    <div className="mt-3">
      <svg
        viewBox="0 0 640 190"
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={`HEX held in the stake grew from ${Math.round(first.hex).toLocaleString()} at cycle ${first.i} to ${Math.round(last.hex).toLocaleString()} at cycle ${last.i}.`}
      >
        <defs>
          <linearGradient id="ssk-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7E089D" />
            <stop offset="0.55" stopColor="#D83639" />
            <stop offset="1" stopColor="#FB9438" />
          </linearGradient>
          <linearGradient id="ssk-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D83639" stopOpacity="0.34" />
            <stop offset="1" stopColor="#D83639" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 72, 124, 176].map((y) => (
          <line key={y} x1="0" y1={y} x2="640" y2={y} stroke="var(--line)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#ssk-fill)" />
        <path d={d} fill="none" stroke="url(#ssk-line)" strokeWidth="2.6" strokeLinejoin="round" />
        <circle cx={tip[0] - 2} cy={tip[1]} r="4.5" fill="#FB9438" />
      </svg>
      <div
        className="mt-1.5 flex justify-between text-[9.5px] tracking-[0.08em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        <span>
          {Math.round(first.hex).toLocaleString()} HEX · CYCLE {first.i}
        </span>
        <span>
          {Math.round(last.hex).toLocaleString()} HEX · CYCLE {last.i}
        </span>
      </div>
    </div>
  );
}
