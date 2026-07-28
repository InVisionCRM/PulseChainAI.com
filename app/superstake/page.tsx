'use client';

// SuperStake hub — what the machine does, what it has actually done, and the
// same-dollars head-to-head against a plain HEX stake.
//
// Every figure on this page is derived from the cycle record, never hardcoded:
// the snapshot is the floor, and /api/superstake/cycles (rebuilt from the HEX +
// PulseX subgraphs) is layered on top when it answers, so a bad day upstream
// costs freshness rather than the page.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { IconArrowRight, IconExternalLink } from '@tabler/icons-react';
import {
  cycleHeadToHead,
  dayToISO,
  inputsFromCycle,
  REFLECTION_RATE,
  type CycleResult,
  type SuperStakeCycle,
  type SuperStakeSnapshot,
} from '@/lib/superstake/model';
import { pulsechainTokenUrl } from '@/lib/pulsechainExplorer';
import MachineFlow from '@/components/superstake/MachineFlow';
import CycleClock from '@/components/superstake/CycleClock';
import CycleTable from '@/components/superstake/CycleTable';
import PairVolume from '@/components/superstake/PairVolume';
import GlanceStrip from '@/components/superstake/GlanceStrip';

const PSSH = '0xb5c4ecef450fd36d0eba1420f6a19dbfbee5292e';
/**
 * The whitepaper sets 5,555 pSSH as the minimum holding that earns HEX rewards.
 * We call that block an "S-share" — it is our name for the threshold, not a
 * token or an on-chain primitive. It divides the 55,550,000 total supply into
 * exactly 10,000, and because the 1% buy-and-burn only ever removes supply, the
 * number that can exist only falls.
 */
const S_SHARE = 5_555;
/** The head-to-head here is fixed at $100; /superstake/vs-hex takes any amount. */
const STAKE_AMOUNT = 100;
const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';

interface Live {
  pHEX: number | null;
  pSSH: number | null;
  wins: Record<string, number>;
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

  useEffect(() => {
    let alive = true;
    (async () => {
      const base: SuperStakeSnapshot | null = await fetch('/api/superstake/snapshot')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!alive || !base) return;
      setSnap(base);
      try {
        const rebuilt = await fetch('/api/superstake/cycles').then((r) => (r.ok ? r.json() : null));
        if (alive && rebuilt?.cycles?.length && rebuilt?.series?.P?.length) {
          setSnap({ ...base, cycles: rebuilt.cycles, series: rebuilt.series });
          setFresh(true);
          if (rebuilt.globalTShares > 0) setGlobalTShares(rebuilt.globalTShares);
        }
      } catch {
        /* stay on the snapshot */
      }
    })();
    fetch('/api/superstake/live')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setLive(d))
      .catch(() => {});
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

  // Same countdown the clock shows, reused so the two never disagree.
  const glanceDaysLeft = useMemo(() => {
    if (!view) return 0;
    const end = Date.parse(`${dayToISO(view.running.d1)}T00:00:00Z`);
    return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
  }, [view]);

  const pSshPrice = live?.pSSH ?? snap?.meta.pSSH ?? null;

  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)]">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5">
        {/* ─────────── live header ─────────── */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_290px]">
          <header className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 md:p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-1/3 right-0 aspect-square w-2/3 opacity-20 blur-3xl"
              style={{ background: GRAD }}
            />
            <div className="relative flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/superstake-logo.png" alt="" className="h-7 w-7 object-contain" />
              <span
                className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]"
                style={{ fontFamily: MONO }}
              >
                SuperStake · pSSH
              </span>
            </div>

            <h1 className="relative mt-3.5 text-[clamp(25px,4.4vw,40px)] font-bold leading-[1.05] tracking-[-0.035em] text-[var(--text)]">
              A HEX stake that{' '}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>
                restakes itself
              </span>{' '}
              every 60 days.
            </h1>
            <p className="relative mt-2.5 max-w-[46ch] text-[13.5px] leading-relaxed text-[var(--text-muted)]">
              Nobody runs it. The contract has closed and reopened this same stake{' '}
              {view ? `${view.per.length} times` : 'again and again'} — buying HEX and burning pSSH
              the whole way — and the only thing that could stop it is HEX itself.
            </p>

            <dl className="relative mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
              <Stat
                label="In the stake"
                value={view ? Math.round(view.running.hex).toLocaleString() : '—'}
                sub={view ? `HEX · cycle ${view.running.i}` : ''}
              />
              <Stat
                label="T-shares"
                value={view ? view.running.tsh.toFixed(2) : '—'}
                // Deliberately not "% of all HEX": the snapshot's `own` field is
                // off by ~1000x against the subgraph's global share total, and
                // the live rebuild doesn't compute it at all. Share rate is solid.
                sub={snap ? `share rate ${Math.round(snap.meta.shareRate).toLocaleString()}` : ''}
              />
              <Stat
                label="pSSH burned"
                value={snap ? compact(snap.meta.burned) : '—'}
                sub={
                  snap
                    ? `${((snap.meta.burned / (snap.meta.supply + snap.meta.burned)) * 100).toFixed(1)}% of supply`
                    : ''
                }
              />
              <Stat
                label="pSSH price"
                value={usd(pSshPrice)}
                sub={
                  live?.source === 'pulsex-subgraph'
                    ? 'live · PulseX'
                    : `snapshot · ${snap?.meta.asOf ?? '—'}`
                }
              />
            </dl>
          </header>

          <div className="flex flex-col gap-3">
            {view ? (
              <CycleClock
                cycleNo={view.running.i}
                startISO={dayToISO(view.running.d0)}
                endISO={dayToISO(view.running.d1)}
              />
            ) : (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-8 text-center text-xs text-[var(--text-faint)]">
                Loading cycle…
              </div>
            )}
            {view && view.streak > 1 && (
              <div
                className="flex items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-white"
                style={{ background: GRAD }}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                pSSH ahead — last {view.streak} cycles
              </div>
            )}
          </div>
        </div>

        {/* ─────────── at a glance, no words ─────────── */}
        {view && ahead && need && (
          <div className="mt-3">
            <GlanceStrip
              perDollarRatio={
                ahead.result.stakeYield > 0
                  ? ahead.result.psshYield / ahead.result.stakeYield
                  : 1
              }
              cycleFrac={
                1 -
                Math.max(0, Math.min(1, need.days > 0 ? glanceDaysLeft / need.days : 0))
              }
              daysLeft={glanceDaysLeft}
              sharesLeft={snap ? snap.meta.supply / S_SHARE : 0}
              sharesMinted={snap ? (snap.meta.supply + snap.meta.burned) / S_SHARE : 0}
              coverTimes={need.times}
              inPct={need.inPct}
              outPct={need.outPct}
            />
          </div>
        )}

        {/* ─────────── the machine ─────────── */}
        <section className="mt-9">
          <SectionHead
            title="Two things happen. That's the whole machine."
            sub="every trade, and every 60 days"
          />
          <MachineFlow />
        </section>

        {/* ─────────── T-share vs S-share ─────────── */}
        {view && snap && (
          <section className="mt-9">
            <SectionHead
              title="HEX has the T-share. pSSH has the S-share."
              sub="the unit each one sells you"
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
          </section>
        )}

        {/* ─────────── the two engines ─────────── */}
        {view && (
          <section className="mt-9">
            <div
              className="overflow-hidden rounded-2xl border border-[var(--line)] p-5 md:p-6"
              style={{
                background:
                  'linear-gradient(180deg,rgba(126,8,157,0.14),transparent 60%), var(--panel)',
              }}
            >
              <div
                className="text-[9.5px] uppercase tracking-[0.16em] text-[var(--text-faint)]"
                style={{ fontFamily: MONO }}
              >
                Why it keeps growing
              </div>
              <h2 className="mt-1.5 text-[clamp(18px,3vw,26px)] font-bold leading-tight tracking-[-0.03em] text-[var(--text)]">
                {need ? (
                  <>
                    <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>
                      {usdShort(need.perDay)} a day
                    </span>{' '}
                    keeps it growing. It&apos;s doing {usdShort(need.actual)}.
                  </>
                ) : (
                  <>Every cycle has covered its own payout.</>
                )}
              </h2>
              <p className="mt-2.5 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--text-muted)]">
                Each cycle hands holders 1% of the pool, so the stake only shrinks if what comes in —
                HEX&apos;s own yield plus the HEX the 2% buy-tax buys — falls short of that 1%.{' '}
                {need && (
                  <>
                    Cycle {view.running.i} needs{' '}
                    <b className="text-[var(--text)]">{compact(need.gapHex)} HEX</b> from the tax to
                    break even, which takes{' '}
                    <b className="text-[var(--text)]">{usdShort(need.perDay)} of daily volume</b>.
                    Trading is currently running{' '}
                    <b className="text-[var(--up)]">{need.times.toFixed(1)}× that</b>.{' '}
                  </>
                )}
                {view.neverShrank && 'The principal has never once gone down.'}
              </p>

              <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
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
                <Fig
                  label="Cycles that covered it"
                  value={`${view.covered} of ${view.coverage.length}`}
                  sub="every finished cycle on record"
                  good={view.covered === view.coverage.length}
                />
              </div>

              <CoverageBars rows={view.coverage} />

              <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-faint)]">
                HEX&apos;s native yield alone stopped covering the payout around cycle 10 — it now
                runs well under 1% a cycle. Every cycle since has been carried by the buy-tax, which
                is why the volume figure above is the number that actually matters.
              </p>
            </div>
          </section>
        )}

        {/* ─────────── the next 60 days ─────────── */}
        {view && ahead && (
          <section className="mt-9">
            <SectionHead
              title={`$${STAKE_AMOUNT} in today, held one ${ahead.days}-day cycle`}
              sub="projected from today's prices, payout rate and volume"
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
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
            >
              See the full history with your own amount
              <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        )}

        {/* ─────────── every pair that funds it ─────────── */}
        <section className="mt-9">
          <PairVolume token={PSSH} />
        </section>

        {/* ─────────── HEX in the stake ─────────── */}
        {view && (
          <section className="mt-9">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 md:p-5">
              <SectionHead
                title="HEX in the stake"
                sub="every cycle since launch — it has never gone down"
                tight
              />
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
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
                  label={`Avg growth per cycle`}
                  value={`${view.growth.recent.toFixed(2)}%`}
                  sub={`last ${view.growth.recentN} cycles`}
                  good
                />
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--text-faint)]">
                This is the pool compounding, not a holder&apos;s return — holders receive 1% of it
                each cycle. The all-time rate is flattered by the early cycles growing off a small
                base, which is why the recent run is shown beside it.
              </p>
              <StakeChart cycles={view.cycles} />
            </div>
          </section>
        )}

        {/* ─────────── links + provenance ─────────── */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Tool href={`/geicko?address=${PSSH}`} label="pSSH on the scanner" />
          <Tool href={pulsechainTokenUrl(PSSH)} label="pSSH contract" external />
          <Tool href="https://superstake.win" label="superstake.win" external />
        </div>

        <p className="mt-5 border-t border-[var(--line)] pt-3.5 text-[11px] leading-relaxed text-[var(--text-faint)]">
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

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-[var(--panel)] px-3 py-2.5">
      <dt
        className="text-[9.5px] uppercase tracking-[0.16em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        {label}
      </dt>
      <dd className="mt-0.5 text-[clamp(15px,2.1vw,19px)] font-bold tracking-[-0.025em] tabular-nums text-[var(--text)]">
        {value}
      </dd>
      <dd className="text-[10px] text-[var(--text-faint)]">{sub}</dd>
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
