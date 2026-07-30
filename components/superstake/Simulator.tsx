'use client';

// The simulator: set the assumptions, watch what falls out of them — for one
// holder and for the stake as a whole.
//
// Everything here is `lib/superstake/simulate.ts` rendered. No figure is
// invented in this file; the component's whole job is controls in, projection
// out. The playhead never fabricates intermediate states either — it steps
// through the cycles the engine actually returned, and the smoothness comes
// from CSS transitioning between them.

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconPlayerPlayFilled, IconPlayerPauseFilled, IconRotateClockwise2, IconChevronDown } from '@tabler/icons-react';
import {
  breakEvenDailyVolume,
  simulate,
  type SimCycle,
  type SimInputs,
  type SimResult,
} from '@/lib/superstake/simulate';
import { S_SHARE } from '@/lib/superstake/model';
import ShareCards from '@/components/superstake/ShareCards';
import { SIM_CARD_IDS, type ShareData } from '@/lib/superstake/shareCard';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';
const UP = '#4ade80';
/** The three comparison lines, kept identical here and on the share cards. */
const C_PSSH = '#FB9438';
const C_STAKE = '#AE176A';
const C_HOLD = '#5E7BA6';

const nf = (n: number, dp = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const money = (n: number) =>
  !Number.isFinite(n)
    ? '—'
    : Math.abs(n) >= 1e6
      ? `$${(n / 1e6).toFixed(2)}M`
      : Math.abs(n) >= 1e3
        ? `$${(n / 1e3).toFixed(1)}k`
        : `$${n.toFixed(2)}`;
const compact = (n: number) =>
  Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : nf(n);
/** `$-27.27` reads as a typo; the sign belongs in front of the money. */
const signedMoney = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;
/** 20.5817% is four digits of noise; 0.0042% needs all four. */
const pctOf = (n: number) => `${n.toFixed(n >= 1 ? 2 : 4)}%`;

export interface SimulatorProps {
  /** Opening state, from the live page — the projection starts where reality is. */
  poolHex: number;
  supply: number;
  pHex: number;
  pSsh: number;
  shareRate: number;
  payoutPerTshare: number;
  cycleDays: number;
  /** Trailing 60-day average daily volume, the honest default. */
  dailyVolumeUsd: number;
  /**
   * The page's own share-card figures. The simulator hangs its projection off
   * them rather than rebuilding a card payload out of zeros — every field a sim
   * card doesn't use is still the real live value.
   */
  base: ShareData | null;
}

type View = 'you' | 'stake';

export default function Simulator(props: SimulatorProps) {
  const { poolHex, supply, pHex, pSsh, shareRate, payoutPerTshare, cycleDays } = props;

  // ── the dials ──────────────────────────────────────────────────────────
  const [amount, setAmount] = useState(1000);
  const [cycles, setCycles] = useState(12);
  const [volume, setVolume] = useState(Math.round(props.dailyVolumeUsd));
  const [compound, setCompound] = useState(true);
  const [hexDrift, setHexDrift] = useState(0);
  const [psshDrift, setPsshDrift] = useState(0);
  const [volDrift, setVolDrift] = useState(0);
  const [srDrift, setSrDrift] = useState(0.6);
  const [advanced, setAdvanced] = useState(false);
  const [view, setView] = useState<View>('you');

  const inputs: SimInputs = useMemo(
    () => ({
      amountUsd: amount,
      cycles,
      cycleDays,
      dailyVolumeUsd: volume,
      volumeDriftPct: volDrift,
      pHex,
      pSsh,
      hexDriftPct: hexDrift,
      psshDriftPct: psshDrift,
      poolHex,
      supply,
      shareRate,
      shareRateDriftPct: srDrift,
      payoutPerTshare,
      compound,
    }),
    [amount, cycles, cycleDays, volume, volDrift, pHex, pSsh, hexDrift, psshDrift,
     poolHex, supply, shareRate, srDrift, payoutPerTshare, compound],
  );

  const sim: SimResult | null = useMemo(() => simulate(inputs), [inputs]);
  const breakEven = useMemo(
    () => breakEvenDailyVolume(poolHex, cycleDays, shareRate, payoutPerTshare, pHex),
    [poolHex, cycleDays, shareRate, payoutPerTshare, pHex],
  );

  // ── the playhead ───────────────────────────────────────────────────────
  // Steps through real cycles; it never interpolates a state that the engine
  // didn't produce.
  const [head, setHead] = useState(cycles);
  const [playing, setPlaying] = useState(false);
  useEffect(() => setHead(cycles), [cycles]);
  useEffect(() => {
    if (!playing) return;
    if (head >= cycles) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setHead((h) => Math.min(cycles, h + 1)), 420);
    return () => clearTimeout(t);
  }, [playing, head, cycles]);

  const shown: SimCycle[] = useMemo(
    () => (sim ? sim.cycles.slice(0, Math.max(1, head)) : []),
    [sim, head],
  );
  const now = shown[shown.length - 1];

  const play = () => {
    if (head >= cycles) setHead(1);
    setPlaying(true);
  };

  const reset = () => {
    setAmount(1000);
    setCycles(12);
    setVolume(Math.round(props.dailyVolumeUsd));
    setCompound(true);
    setHexDrift(0);
    setPsshDrift(0);
    setVolDrift(0);
    setSrDrift(0.6);
  };

  // Card data — the page's live figures with this run hung off them, so a shared
  // card can't drift from what the reader is looking at.
  const { base } = props;
  const shareData: ShareData | null = useMemo(() => {
    if (!sim || !now || !base) return null;
    const tokens = now.tokens + now.compoundedTokens;
    return {
      ...base,
      sim: {
        amount,
        cycles: shown.length,
        cycleDays,
        dailyVolume: volume,
        compound,
        hexDriftPct: hexDrift,
        psshDriftPct: psshDrift,
        volumeDriftPct: volDrift,
        endValue: now.holderValueUsd,
        multiple: amount > 0 ? now.holderValueUsd / amount : 0,
        hexEarned: now.holderHexCumulative,
        hexEarnedUsd: now.holderHexCumulative * now.pHex,
        tokens,
        sShares: tokens / S_SHARE,
        sharePct: now.supplyShare * 100,
        holdHex: now.holdHexValueUsd,
        stakeHex: now.stakeHexValueUsd,
        poolStart: poolHex,
        poolEnd: now.poolHexNext,
        poolMultiple: poolHex > 0 ? now.poolHexNext / poolHex : 0,
        coverRatio: now.coverRatio,
        breakEven,
        sSharesLeft: now.sSharesLeft,
        burned: shown.reduce((s, c) => s + c.burnedTokens, 0),
        valueByCycle: shown.map((c) => c.holderValueUsd),
        holdByCycle: shown.map((c) => c.holdHexValueUsd),
        stakeByCycle: shown.map((c) => c.stakeHexValueUsd),
        poolByCycle: shown.map((c) => c.poolHexNext),
      },
    };
  }, [sim, now, shown, base, amount, cycleDays, breakEven, volume, compound, poolHex,
      hexDrift, psshDrift, volDrift]);

  if (!sim || !now) {
    return (
      <div className="grid min-h-[300px] place-items-center rounded-xl border border-[var(--line)] bg-[var(--panel)] text-sm text-[var(--text-faint)]">
        Waiting for the live figures the projection starts from…
      </div>
    );
  }

  const coverOk = now.coverRatio >= 1;

  return (
    <div className="flex flex-col gap-4">
      {/* ─────────── controls ─────────── */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div
              className="text-[9.5px] uppercase tracking-[0.16em] text-[var(--text-faint)]"
              style={{ fontFamily: MONO }}
            >
              Set the assumptions
            </div>
            <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
              Starts from today&apos;s real pool, supply and prices. Everything below is a
              projection, not a forecast.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            <IconRotateClockwise2 className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dial
            label="You put in"
            value={money(amount)}
            min={100}
            max={100_000}
            step={100}
            v={amount}
            onChange={setAmount}
            hint="after the 5.5% entry tax"
          />
          <Dial
            label="Cycles ahead"
            value={`${cycles} · ${Math.round((cycles * cycleDays) / 365.25 * 10) / 10} yr`}
            min={1}
            max={30}
            step={1}
            v={cycles}
            onChange={setCycles}
            hint={`${cycleDays} days each`}
          />
          <Dial
            label="Volume a day"
            value={money(volume)}
            min={0}
            max={Math.max(5000, Math.round(props.dailyVolumeUsd * 12))}
            step={10}
            v={volume}
            onChange={setVolume}
            hint={`break-even is ${money(breakEven)}`}
            marker={
              breakEven > 0
                ? breakEven / Math.max(5000, Math.round(props.dailyVolumeUsd * 12))
                : undefined
            }
          />
          <div className="flex flex-col justify-between rounded-lg border border-[var(--line)] bg-[var(--app-bg)] px-3 py-2.5">
            <span
              className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
              style={{ fontFamily: MONO }}
            >
              Your HEX earnings
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              {([
                [true, 'Buy more pSSH'],
                [false, 'Keep as HEX'],
              ] as const).map(([on, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCompound(on)}
                  className={`rounded-md border px-2 py-1.5 text-[10.5px] font-semibold transition-colors ${
                    compound === on
                      ? 'border-brand-orange/50 bg-[var(--surface)] text-brand-orange'
                      : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="mt-1.5 text-[9.5px] text-[var(--text-faint)]">
              {compound ? 'compounding — pays the 5.5% each time' : 'banked, and not re-taxed'}
            </span>
          </div>
        </div>

        {/* ── advanced ── */}
        <button
          type="button"
          onClick={() => setAdvanced((a) => !a)}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <IconChevronDown
            className={`h-3.5 w-3.5 transition-transform ${advanced ? 'rotate-180' : ''}`}
          />
          {advanced ? 'Hide' : 'Show'} the drifts — prices, volume and share rate over time
        </button>
        {advanced && (
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Dial label="HEX price" value={`${hexDrift >= 0 ? '+' : ''}${hexDrift}% / cycle`}
              min={-20} max={40} step={1} v={hexDrift} onChange={setHexDrift}
              hint="compounding, each cycle" signed />
            <Dial label="pSSH price" value={`${psshDrift >= 0 ? '+' : ''}${psshDrift}% / cycle`}
              min={-20} max={40} step={1} v={psshDrift} onChange={setPsshDrift}
              hint="compounding, each cycle" signed />
            <Dial label="Volume" value={`${volDrift >= 0 ? '+' : ''}${volDrift}% / cycle`}
              min={-30} max={50} step={1} v={volDrift} onChange={setVolDrift}
              hint="how trading trends" signed />
            <Dial label="Share rate" value={`+${srDrift}% / cycle`}
              min={0} max={5} step={0.1} v={srDrift} onChange={setSrDrift}
              hint="HEX's rate only ever climbs" />
          </div>
        )}
      </div>

      {/* ─────────── playhead ─────────── */}
      {/* On a phone the slider drops to its own row — sharing the row with the
          play button and the share button squeezed the cycle counter into two
          columns of two words each. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
        <button
          type="button"
          onClick={() => (playing ? setPlaying(false) : play())}
          aria-label={playing ? 'Pause' : 'Play the projection'}
          className="grid h-8 w-8 flex-none place-items-center rounded-full text-white transition-transform hover:scale-105 motion-reduce:transition-none"
          style={{ background: GRAD }}
        >
          {playing ? (
            <IconPlayerPauseFilled className="h-3.5 w-3.5" />
          ) : (
            <IconPlayerPlayFilled className="h-3.5 w-3.5" />
          )}
        </button>
        <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
              style={{ fontFamily: MONO }}
            >
              Cycle {head} of {cycles}
            </span>
            <span className="text-[10px] tabular-nums text-[var(--text-muted)]">
              {Math.round((head * cycleDays) / 30.4)} months in
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={cycles}
            step={1}
            value={head}
            onChange={(e) => {
              setPlaying(false);
              setHead(Number(e.target.value));
            }}
            aria-label="Cycle"
            className="mt-1 w-full accent-[#FB9438]"
          />
        </div>
        {shareData && (
          <span className="ml-auto">
            <ShareCards data={shareData} only={SIM_CARD_IDS} label="Share this run" />
          </span>
        )}
      </div>

      {/* ─────────── view switch ─────────── */}
      <div className="flex gap-1.5">
        {(
          [
            ['you', 'What you get'],
            ['stake', 'What the stake does'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
              view === id
                ? 'border-brand-orange/50 bg-[var(--surface)] text-brand-orange'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'you' ? (
        <HolderView
          now={now}
          shown={shown}
          amount={amount}
          compound={compound}
          sim={sim}
          psshDrift={psshDrift}
          onOpenDrifts={() => setAdvanced(true)}
        />
      ) : (
        <StakeView
          now={now}
          shown={shown}
          openingPool={poolHex}
          breakEven={breakEven}
          volume={volume}
          coverOk={coverOk}
        />
      )}

      <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
        <b className="text-[var(--text-muted)]">How this is built.</b> Each cycle&apos;s ending
        state opens the next: the stake earns at the payout rate, hands holders 1%, and the 2%
        buy-tax adds what the volume you set can buy. The 1% burn shrinks supply, which is what
        lifts your share of it. Entry and every compound pay the 5.5% toll. The same formulas the
        rest of the page uses — the pool&apos;s T-shares here reproduce its recorded 107.55 to
        within 0.003%. Nothing here is a prediction, and none of it is financial advice.
      </p>
    </div>
  );
}

/* ────────────────────────── the two views ────────────────────────── */

function HolderView({
  now, shown, amount, compound, sim, psshDrift, onOpenDrifts,
}: {
  now: SimCycle;
  shown: SimCycle[];
  amount: number;
  compound: boolean;
  sim: SimResult;
  psshDrift: number;
  onOpenDrifts: () => void;
}) {
  const multiple = amount > 0 ? now.holderValueUsd / amount : 0;
  const beatsHold = now.holderValueUsd - now.holdHexValueUsd;
  const payoutShare =
    now.holderPayoutHex + now.holderReflectionHex > 0
      ? now.holderPayoutHex / (now.holderPayoutHex + now.holderReflectionHex)
      : 0;
  const cumPayout = shown.reduce((s, c) => s + c.holderPayoutHex, 0);
  const cumRefl = shown.reduce((s, c) => s + c.holderReflectionHex, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* headline */}
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div
          className="relative overflow-hidden rounded-xl border border-[var(--line)] p-4 md:p-5"
          style={{ background: 'linear-gradient(180deg,rgba(126,8,157,0.16),transparent 60%), var(--panel)' }}
        >
          <span
            className="text-[9.5px] uppercase tracking-[0.16em] text-[var(--text-faint)]"
            style={{ fontFamily: MONO }}
          >
            Your position, cycle {now.n}
          </span>
          <Big value={money(now.holderValueUsd)} />
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className="text-[15px] font-bold tabular-nums"
              style={{
                backgroundImage: GRAD,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {multiple.toFixed(2)}×
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">on {money(amount)} in</span>
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                beatsHold >= 0 ? 'text-[var(--up)]' : 'text-red-400'
              }`}
            >
              {signedMoney(beatsHold)} vs just holding HEX
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Tile label="HEX earned" value={compact(now.holderHexCumulative)} sub={`${money(now.holderHexCumulative * now.pHex)} at cycle-${now.n} price`} good />
          <Tile label="pSSH held" value={compact(now.tokens + now.compoundedTokens)} sub={compound ? 'compounding each cycle' : 'unchanged — earnings banked'} />
          <Tile label="S-shares" value={((now.tokens + now.compoundedTokens) / S_SHARE).toFixed(2)} sub={`of ${nf(now.sSharesLeft, 0)} left`} />
          <Tile label="Share of supply" value={pctOf(now.supplyShare * 100)} sub="rises as the 1% burns" />
        </div>
      </div>

      {/* the three lines */}
      <Panel title="Your money, three ways" sub="same dollars, same cycles">
        <MultiLine
          series={[
            { label: 'Hold pSSH', values: shown.map((c) => c.holderValueUsd), color: C_PSSH, width: 2.6 },
            { label: 'Stake the HEX', values: shown.map((c) => c.stakeHexValueUsd), color: C_STAKE, width: 1.8 },
            { label: 'Just hold HEX', values: shown.map((c) => c.holdHexValueUsd), color: C_HOLD, width: 1.6 },
          ]}
          fmt={money}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-faint)]">
          {psshDrift === 0 ? (
            <>
              <b className="text-[var(--text-muted)]">The pSSH price is held flat here.</b> The stake
              behind the token can grow several times over without that line moving, because nothing
              forces the price to follow the backing — so this curve is what the payouts and
              reflections alone are worth.{' '}
              <button
                type="button"
                onClick={onOpenDrifts}
                className="font-semibold text-brand-orange underline underline-offset-2"
              >
                Set a price drift
              </button>{' '}
              to see it another way.
            </>
          ) : (
            <>
              <b className="text-[var(--text-muted)]">
                This run assumes pSSH moves {psshDrift > 0 ? '+' : ''}
                {psshDrift}% a cycle.
              </b>{' '}
              Most of the curve above is that assumption compounding, not the payouts —{' '}
              <button
                type="button"
                onClick={onOpenDrifts}
                className="font-semibold text-brand-orange underline underline-offset-2"
              >
                set it back to flat
              </button>{' '}
              to see what the machine alone pays.
            </>
          )}
        </p>
      </Panel>

      {now.supplyShare > 0.02 && (
        <p className="rounded-lg border border-[var(--line-strong)] bg-[var(--app-bg)] px-3 py-2 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
          At {pctOf(now.supplyShare * 100)} of the supply this is a large position, and the
          projection assumes buying it moves neither the price nor anyone else&apos;s share. In
          practice a buy that size moves the market it is buying into — read the figures above as
          the arithmetic, not the fill you would get.
        </p>
      )}

      {/* what pays you */}
      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="What pays you" sub="over the run so far">
          <div className="flex items-center gap-4">
            <Split value={payoutShare} />
            <ul className="min-w-0 flex-1 space-y-2 text-[11.5px]">
              <li className="flex items-baseline justify-between gap-2">
                <span className="text-[var(--text-muted)]">End-stake payout (1%)</span>
                <b className="tabular-nums text-[var(--text)]">{compact(cumPayout)} HEX</b>
              </li>
              <li className="flex items-baseline justify-between gap-2">
                <span className="text-[var(--text-muted)]">Reflections (2.5%)</span>
                <b className="tabular-nums text-[var(--text)]">{compact(cumRefl)} HEX</b>
              </li>
              <li className="flex items-baseline justify-between gap-2 border-t border-[var(--line)] pt-2">
                <span className="text-[var(--text-muted)]">This cycle alone</span>
                <b className="tabular-nums text-[var(--up)]">{compact(now.holderHex)} HEX</b>
              </li>
            </ul>
          </div>
        </Panel>

        <Panel title="HEX earned, cycle by cycle" sub="the 1% and the 2.5%, stacked">
          <StackBars
            rows={shown.map((c) => ({
              a: c.holderPayoutHex,
              b: c.holderReflectionHex,
              label: c.n,
            }))}
          />
        </Panel>
      </div>

      {sim.final.holderValueUsd < amount && (
        <p className="rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-[11.5px] text-red-300">
          Under these assumptions the position ends below what went in. That is the projection
          doing its job — the dials you set produce this, and nothing here rounds it away.
        </p>
      )}
    </div>
  );
}

function StakeView({
  now, shown, openingPool, breakEven, volume, coverOk,
}: {
  now: SimCycle;
  shown: SimCycle[];
  openingPool: number;
  breakEven: number;
  volume: number;
  coverOk: boolean;
}) {
  const growth = openingPool > 0 ? now.poolHexNext / openingPool : 0;
  const burnedSoFar = shown.reduce((s, c) => s + c.burnedTokens, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div
          className="relative overflow-hidden rounded-xl border border-[var(--line)] p-4 md:p-5"
          style={{ background: 'linear-gradient(180deg,rgba(216,54,57,0.14),transparent 60%), var(--panel)' }}
        >
          <span
            className="text-[9.5px] uppercase tracking-[0.16em] text-[var(--text-faint)]"
            style={{ fontFamily: MONO }}
          >
            HEX in the stake, cycle {now.n}
          </span>
          <Big value={nf(Math.round(now.poolHexNext))} />
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className="text-[15px] font-bold tabular-nums"
              style={{
                backgroundImage: GRAD,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {growth.toFixed(2)}×
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              from {compact(openingPool)} today
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              {money(now.poolHexNext * now.pHex)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Tile label="Covers its payout" value={`${now.coverRatio.toFixed(2)}×`} sub={coverOk ? 'the pool grows' : 'the pool shrinks'} good={coverOk} bad={!coverOk} />
          <Tile label="T-shares" value={now.poolTShares.toFixed(1)} sub="what the stake earns on" />
          <Tile label="S-shares left" value={nf(now.sSharesLeft, 0)} sub={`${compact(burnedSoFar)} pSSH burned in the run`} />
          <Tile label="Volume needed" value={money(breakEven)} sub={`you set ${money(volume)}`} good={volume >= breakEven} bad={volume < breakEven} />
        </div>
      </div>

      <Panel title="The pool, cycle by cycle" sub="principal at each restake">
        <MultiLine
          series={[{ label: 'HEX', values: shown.map((c) => c.poolHex), color: '#D83639', width: 2.6, fill: true }]}
          fmt={(v) => compact(v)}
        />
      </Panel>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="What comes in against the 1% out" sub="above the line, it grows">
          <CoverBars rows={shown.map((c) => ({ n: c.n, ratio: c.coverRatio }))} />
        </Panel>
        <Panel title="Where each cycle's HEX comes from" sub="its own yield vs what the tax bought">
          <StackBars
            rows={shown.map((c) => ({ a: c.poolYieldHex, b: c.boughtHex, label: c.n }))}
          />
          <div className="mt-2 flex gap-4 text-[10px] text-[var(--text-muted)]">
            <Legend color="#7E089D" label="stake's own yield" />
            <Legend color="#FB9438" label="bought by the 2%" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ────────────────────────── pieces ────────────────────────── */

function Big({ value }: { value: string }) {
  return (
    <div className="mt-1 text-[clamp(30px,5.6vw,46px)] font-bold leading-[0.98] tracking-[-0.04em] tabular-nums text-[var(--text)] transition-all duration-300">
      {value}
    </div>
  );
}

function Tile({
  label, value, sub, good, bad,
}: { label: string; value: string; sub: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
      <div
        className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-[19px] font-bold tracking-[-0.03em] tabular-nums transition-colors ${
          good ? 'text-[var(--up)]' : bad ? 'text-red-400' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] leading-snug text-[var(--text-faint)]">{sub}</div>
    </div>
  );
}

function Panel({
  title, sub, children,
}: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:p-4">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-2">
        <h3 className="text-[13.5px] font-bold tracking-[-0.02em] text-[var(--text)]">{title}</h3>
        <span className="text-[10.5px] text-[var(--text-faint)]">{sub}</span>
      </div>
      {children}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

/**
 * A slider that shows the value it's set to and, optionally, a marker for a
 * threshold worth seeing on the track itself.
 */
function Dial({
  label, value, min, max, step, v, onChange, hint, marker, signed,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  v: number;
  onChange: (n: number) => void;
  hint?: string;
  marker?: number;
  signed?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--app-bg)] px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)]"
          style={{ fontFamily: MONO }}
        >
          {label}
        </span>
        <span className="text-[12.5px] font-bold tabular-nums text-[var(--text)]">{value}</span>
      </div>
      <div className="relative mt-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="w-full accent-[#FB9438]"
        />
        {marker !== undefined && marker > 0 && marker < 1 && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-[var(--up)]"
            style={{ left: `${marker * 100}%` }}
          />
        )}
      </div>
      {hint && (
        <div className="mt-0.5 text-[9.5px] text-[var(--text-faint)]">
          {signed && v === 0 ? 'flat — no drift' : hint}
        </div>
      )}
    </div>
  );
}

/** Payout vs reflections, as one ring. */
function Split({ value }: { value: number }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 70 70" className="h-[74px] w-[74px] flex-none" role="img" aria-label={`${Math.round(value * 100)}% from the end-stake payout`}>
      <circle cx="35" cy="35" r={R} fill="none" stroke="#FB9438" strokeWidth="11" />
      <circle
        cx="35" cy="35" r={R} fill="none" stroke="#7E089D" strokeWidth="11"
        strokeDasharray={`${value * C} ${C}`}
        transform="rotate(-90 35 35)"
        className="transition-[stroke-dasharray] duration-500"
      />
      <text x="35" y="38" textAnchor="middle" className="fill-[var(--text)] text-[13px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}

/**
 * Multi-series line, redrawn on every parameter change. The paths transition,
 * so dragging a slider moves the curve rather than snapping it.
 */
function MultiLine({
  series, fmt,
}: {
  series: { label: string; values: number[]; color: string; width: number; fill?: boolean }[];
  fmt: (v: number) => string;
}) {
  const W = 640;
  const H = 190;
  const PAD = 10;
  const all = series.flatMap((s) => s.values);
  const hi = Math.max(...all, 1);
  const lo = Math.min(...all, hi);
  // Three lines that all begin at the same dollar figure sit in the top tenth
  // of a zero-based axis, which hides the only thing the chart is for. So the
  // floor lifts to just under the lowest point — and gets printed, because a
  // truncated axis is only dishonest when it's unlabelled. A filled series
  // keeps its zero floor: the shading means "from nothing", and lifting it
  // would overstate the area.
  const filled = series.some((s) => s.fill);
  const floor = filled || lo <= 0 ? 0 : Math.max(0, lo - (hi > lo ? (hi - lo) * 0.25 : lo * 0.05));
  const top = hi * 1.04;
  const span = Math.max(top - floor, 1e-9);
  const n = Math.max(...series.map((s) => s.values.length), 2);

  const pathFor = (vals: number[]) =>
    vals
      .map((v, i) => {
        const x = (i / Math.max(1, n - 1)) * W;
        const y = H - PAD - ((v - floor) / span) * (H - PAD * 2);
        return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label="Projection over the cycles">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="var(--line)" strokeWidth="1" />
        ))}
        {/* the axis it's actually drawn against */}
        <text x="4" y={PAD + 9} className="fill-[var(--text-faint)] text-[9px]" style={{ fontFamily: MONO }}>
          {fmt(top)}
        </text>
        <text x="4" y={H - PAD - 3} className="fill-[var(--text-faint)] text-[9px]" style={{ fontFamily: MONO }}>
          {fmt(floor)}
        </text>
        {series.map((s) => {
          const d = pathFor(s.values);
          return (
            <g key={s.label}>
              {s.fill && (
                <path
                  d={`${d} L${W} ${H} L0 ${H} Z`}
                  fill={s.color}
                  opacity="0.16"
                  className="transition-all duration-500"
                />
              )}
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="transition-all duration-500 motion-reduce:transition-none"
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-[var(--text-muted)]">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.label}
            <b className="tabular-nums text-[var(--text)]">
              {fmt(s.values[s.values.length - 1] ?? 0)}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Two stacked quantities per cycle. */
function StackBars({ rows }: { rows: { a: number; b: number; label: number }[] }) {
  const max = Math.max(...rows.map((r) => r.a + r.b), 1);
  return (
    <div className="flex h-[120px] items-end gap-[3px]">
      {rows.map((r) => {
        const total = ((r.a + r.b) / max) * 100;
        const aPart = r.a + r.b > 0 ? (r.a / (r.a + r.b)) * 100 : 0;
        return (
          <span
            key={r.label}
            title={`Cycle ${r.label}`}
            className="flex flex-1 flex-col justify-end overflow-hidden rounded-t-sm transition-all duration-500 motion-reduce:transition-none"
            style={{ height: `${Math.max(2, total)}%` }}
          >
            <span className="block w-full" style={{ height: `${100 - aPart}%`, background: '#FB9438' }} />
            <span className="block w-full" style={{ height: `${aPart}%`, background: '#7E089D' }} />
          </span>
        );
      })}
    </div>
  );
}

/** Coverage per cycle against the break-even line. */
function CoverBars({ rows }: { rows: { n: number; ratio: number }[] }) {
  const TOP = 6;
  const h = (r: number) => (r <= 0 ? 3 : Math.min(100, (Math.min(r, TOP) / TOP) * 100));
  return (
    <div>
      <div className="relative h-[120px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--line-strong)]"
          style={{ bottom: `${(1 / TOP) * 100}%` }}
        />
        <div className="flex h-full items-end gap-[3px]">
          {rows.map((r) => (
            <span
              key={r.n}
              title={`Cycle ${r.n} — ${r.ratio.toFixed(2)}× its payout`}
              className="flex-1 rounded-t-sm transition-all duration-500 motion-reduce:transition-none"
              style={{
                height: `${h(r.ratio)}%`,
                background:
                  r.ratio >= 1
                    ? `linear-gradient(180deg,${UP},color-mix(in srgb,${UP} 40%,transparent))`
                    : '#ef4444',
              }}
            />
          ))}
        </div>
      </div>
      <div
        className="mt-1.5 text-center text-[9px] tracking-[0.08em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        DASHED LINE = COVERS ITS OWN PAYOUT
      </div>
    </div>
  );
}
