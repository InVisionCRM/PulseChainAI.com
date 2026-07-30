'use client';

// The Lab — every reusable visual piece in one place.
//
// These are real components from components/lab/*, not markup samples: each
// card shows the live thing and the import line that puts it on a page. The
// point is that adding one to SuperStake is an import, not a copy-paste that
// then drifts from its twin.
//
// House rules for anything added here:
//   • CSS and Tailwind only — no animation library, so nothing costs bundle.
//   • Every animation pairs with `motion-reduce:`, or checks the media query.
//   • The value is a prop. Nothing animates a number it wasn't given.

import { useState } from 'react';
import {
  SpeedGauge, RadialProgress, SegmentMeter, VersusNeedle, BulletGauge,
} from '@/components/lab/gauges';
import {
  Sparkline, BarChart, AreaTrend, Donut, RankedBars,
} from '@/components/lab/charts';
import {
  CountUp, Odometer, Marquee, FlashValue, Typewriter,
} from '@/components/lab/counters';
import {
  Reveal, Stagger, GradientBorder, GlowCard, Spotlight, GradientText, Aurora,
  Skeleton, PulseDot, FlipCard,
} from '@/components/lab/effects';
import {
  ProgressBar, StreakDots, StatusPill, StepTrack, DeltaChip, StatTile,
} from '@/components/lab/indicators';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';

const TABS = [
  { key: 'gauges', label: 'Gauges' },
  { key: 'charts', label: 'Charts' },
  { key: 'counters', label: 'Counters' },
  { key: 'motion', label: 'Motion' },
  { key: 'effects', label: 'Effects' },
  { key: 'indicators', label: 'Indicators' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/** Sample series — shaped like real data so the demos aren't flattering. */
const SERIES = [2.95, 9.7, 11.43, 12.76, 13.29, 14.21, 15.34, 15.76, 16.23, 16.78, 16.94, 17.06, 17.23, 17.46, 17.66, 19.05, 19.62];
const SPARK = [12, 14, 13, 17, 16, 21, 19, 24, 23, 28, 31, 29, 34];

export default function LabPage() {
  const [tab, setTab] = useState<TabKey>('gauges');
  // One live number, so the counters have something that actually moves.
  const [tick, setTick] = useState(1284);

  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)]">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5">
        {/* ── header ── */}
        <header className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 md:p-7">
          <Aurora />
          <div className="relative">
            <div
              className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]"
              style={{ fontFamily: MONO }}
            >
              Component Lab
            </div>
            <h1 className="mt-3 text-[clamp(28px,5vw,48px)] font-bold leading-[1.03] tracking-[-0.04em] text-[var(--text)]">
              The parts that make a page{' '}
              <GradientText animate>feel alive</GradientText>.
            </h1>
            <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--text-muted)]">
              Gauges, charts, counters and motion — all CSS and Tailwind, no animation library.
              Every piece here is a real component: pick one, copy its import, and it behaves the
              same wherever it lands.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusPill state="live">{TOTAL} components</StatusPill>
              <StatusPill state="ok">reduced-motion safe</StatusPill>
              <StatusPill state="ok">zero new deps</StatusPill>
            </div>
          </div>
        </header>

        {/* ── tabs ── */}
        <div className="sticky top-0 z-10 -mx-4 mt-5 bg-[var(--app-bg)]/90 px-4 py-2 backdrop-blur">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={tab === t.key}
                className={`shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.key
                    ? 'text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
                style={
                  tab === t.key
                    ? { background: 'linear-gradient(135deg,#7E089D,#D83639 58%,#FB9438)' }
                    : undefined
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'gauges' && (
          <Grid>
            <Item name="SpeedGauge" from="lab/gauges" note="240° dial with optional condition bands. Needle and arc both ease to the value.">
              <SpeedGauge
                value={73} min={0} max={100} label="Coverage" unit="%"
                zones={[
                  { from: 0, to: 0.33, color: '#ef4444' },
                  { from: 0.33, to: 0.66, color: '#FB9438' },
                  { from: 0.66, to: 1, color: '#4ade80' },
                ]}
              />
            </Item>
            <Item name="RadialProgress" from="lab/gauges" note="The workhorse. Anything that's a share of a whole.">
              <div className="flex flex-wrap items-center justify-center gap-4">
                <RadialProgress value={68} sub="of supply" />
                <RadialProgress value={94.83} max={100} label="9,483" sub="s-shares" size={120} />
              </div>
            </Item>
            <Item name="SegmentMeter" from="lab/gauges" note="Coarser than a bar on purpose — for 'roughly how full'.">
              <div className="space-y-4">
                <SegmentMeter value={71} label="Cycle progress" />
                <SegmentMeter value={28} segments={20} label="Supply burned" />
              </div>
            </Item>
            <Item name="VersusNeedle" from="lab/gauges" note="Two sides, centre is level. Log-scaled so a lopsided reading stays on the dial.">
              <VersusNeedle ratio={1.5} leftLabel="HEX" rightLabel="pSSH" />
            </Item>
            <Item name="BulletGauge" from="lab/gauges" note="Actual against target, with the target as a hard marker. Reads over/under instantly.">
              <div className="space-y-4">
                <BulletGauge value={354} target={60.51} label="Daily volume" unit="" />
                <BulletGauge value={42} target={80} label="Below target" />
              </div>
            </Item>
          </Grid>
        )}

        {tab === 'charts' && (
          <Grid>
            <Item name="Sparkline" from="lab/charts" wide note="A trend as one glyph. Put it beside a number, never instead of one.">
              <div className="grid gap-4 sm:grid-cols-3">
                {[SPARK, [...SPARK].reverse(), SPARK.map((v, i) => v + Math.sin(i) * 6)].map((d, i) => (
                  <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]" style={{ fontFamily: MONO }}>
                        Pair {i + 1}
                      </span>
                      <DeltaChip value={i === 1 ? -8.4 : 12.6} />
                    </div>
                    <Sparkline data={d} />
                  </div>
                ))}
              </div>
            </Item>
            <Item name="BarChart" from="lab/charts" wide note="Staggered growth from the baseline. Labels wait out their own bar, so a number is never legible above a bar still climbing.">
              <BarChart data={SERIES.map((v, i) => ({ label: i + 1, value: v }))} fmt={(v) => v.toFixed(2)} />
            </Item>
            <Item name="AreaTrend" from="lab/charts" wide note="Line draws itself in, fill follows, latest point marked.">
              <AreaTrend data={SERIES} caption={['CYCLE 1', 'CYCLE 17']} />
            </Item>
            <Item name="Donut" from="lab/charts" note="Composition. Slices sweep in one after another.">
              <Donut
                centerLabel="$1.70M" centerSub="all time"
                slices={[
                  { label: 'WPLS / pSSH', value: 1140, color: '#7E089D' },
                  { label: 'HEX / pSSH', value: 163, color: '#D83639' },
                  { label: 'pTGC / pSSH', value: 82, color: '#E96635' },
                  { label: 'Others', value: 315, color: '#FB9438' },
                ]}
              />
            </Item>
            <Item name="RankedBars" from="lab/charts" note="Top-N by share, as a list that fills.">
              <RankedBars
                rows={[
                  { label: 'WPLS / pSSH', value: 1140000 },
                  { label: 'HEX / pSSH', value: 163200 },
                  { label: 'pTGC / pSSH', value: 82100 },
                  { label: 'INC / pSSH', value: 59400 },
                ]}
                fmt={(v) => `$${(v / 1000).toFixed(1)}k`}
              />
            </Item>
          </Grid>
        )}

        {tab === 'counters' && (
          <Grid>
            <Item name="CountUp" from="lab/counters" note="Climbs when scrolled to. Formats the same way throughout, so it never settles on a differently-rounded figure.">
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="HEX in the stake" value={<CountUp to={4790629} />} sub="cycle 18" />
                <StatTile label="Collected" value={<CountUp to={253.46} decimals={2} suffix=" HEX" />} sub="17 cycles" accent />
              </div>
            </Item>
            <Item name="Odometer" from="lab/counters" note="Digits roll to the new value. Best on a figure that ticks while you watch.">
              <div className="flex flex-col items-center gap-3">
                <Odometer value={tick} digits={6} className="text-4xl font-bold text-[var(--text)]" />
                <button
                  type="button"
                  onClick={() => setTick((v) => v + Math.floor(Math.random() * 400) + 20)}
                  className="rounded-lg border border-[var(--line-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
                >
                  Tick it
                </button>
              </div>
            </Item>
            <Item name="FlashValue" from="lab/counters" note="Flashes green or red on change — the live-price tell. Flashes on the change, not a timer, so a still market stays still.">
              <div className="flex flex-col items-center gap-3">
                <FlashValue value={tick} fmt={(v) => `$${(v / 1000).toFixed(4)}`} className="text-3xl font-bold" />
                <span className="text-[11px] text-[var(--text-faint)]">Use the Tick it button above</span>
              </div>
            </Item>
            <Item name="Marquee" from="lab/counters" wide note="Seamless loop — the track is duplicated and the copy is aria-hidden. Pauses on hover.">
              <Marquee speed={26}>
                {['pSSH $0.002417', 'HEX $0.001144', 'WPLS $0.000008', 'PLSX $0.000007', 'INC $0.369500'].map((t) => (
                  <span key={t} className="whitespace-nowrap text-sm text-[var(--text-muted)]" style={{ fontFamily: MONO }}>
                    {t}
                  </span>
                ))}
              </Marquee>
            </Item>
            <Item name="Typewriter" from="lab/counters" wide note="Types, holds, erases, moves on. Reduced motion shows the first line outright.">
              <div className="text-lg font-semibold text-[var(--text)]">
                <Typewriter lines={['A HEX stake that restakes itself.', 'Nobody at the wheel.', '17 cycles and counting.']} />
              </div>
            </Item>
          </Grid>
        )}

        {tab === 'motion' && (
          <Grid>
            <Item name="Reveal" from="lab/effects" wide note="Slides and fades in when scrolled to. Four directions. The workhorse of the set.">
              <div className="grid gap-3 sm:grid-cols-4">
                {(['up', 'down', 'left', 'right'] as const).map((d) => (
                  <Reveal key={d} from={d}>
                    <div className="grid h-20 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-xs text-[var(--text-muted)]">
                      from=&quot;{d}&quot;
                    </div>
                  </Reveal>
                ))}
              </div>
            </Item>
            <Item name="Stagger" from="lab/effects" wide note="Reveals children one after another. Pass the step in ms.">
              <Stagger step={110} className="grid gap-2 sm:grid-cols-5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="grid h-16 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm text-[var(--text-muted)]">
                    {n}
                  </div>
                ))}
              </Stagger>
            </Item>
            <Item name="FlipCard" from="lab/effects" note="Hover to turn. Good for a stat that has a 'why' behind it.">
              <FlipCard
                front={<span className="text-2xl font-bold text-[var(--text)]">+5.39%</span>}
                back={<span className="px-4 text-center text-xs text-[var(--text-muted)]">Ownership gained since cycle 1, as the float burned down</span>}
              />
            </Item>
            <Item name="Skeleton" from="lab/effects" note="Shimmer placeholder. Use while real content loads — never as filler.">
              <div className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
              </div>
            </Item>
          </Grid>
        )}

        {tab === 'effects' && (
          <Grid>
            <Item name="GradientBorder" from="lab/effects" note="Brand ring that doesn't bleed into the fill. Optionally rotates.">
              <div className="grid gap-3 sm:grid-cols-2">
                <GradientBorder className="grid h-24 place-items-center">
                  <span className="text-xs text-[var(--text-muted)]">static</span>
                </GradientBorder>
                <GradientBorder animate className="grid h-24 place-items-center">
                  <span className="text-xs text-[var(--text-muted)]">animate</span>
                </GradientBorder>
              </div>
            </Item>
            <Item name="Spotlight" from="lab/effects" note="Light follows the cursor. Driven by CSS custom properties — no re-render per frame.">
              <Spotlight className="grid h-32 place-items-center">
                <span className="text-sm text-[var(--text-muted)]">Move the pointer across me</span>
              </Spotlight>
            </Item>
            <Item name="GlowCard" from="lab/effects" note="Lifts and glows on hover. One step, restrained on purpose.">
              <GlowCard className="grid h-32 place-items-center p-4">
                <span className="text-sm text-[var(--text-muted)]">Hover me</span>
              </GlowCard>
            </Item>
            <Item name="GradientText" from="lab/effects" note="Brand ramp across glyphs, optionally panning.">
              <div className="space-y-2 text-2xl font-bold">
                <div><GradientText>Static ramp</GradientText></div>
                <div><GradientText animate>Panning ramp</GradientText></div>
              </div>
            </Item>
            <Item name="Aurora" from="lab/effects" note="Slow drifting wash for a hero background. Sits behind content — see the header above.">
              <div className="relative grid h-32 place-items-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                <Aurora />
                <span className="relative text-sm text-[var(--text-muted)]">content sits on top</span>
              </div>
            </Item>
            <Item name="PulseDot" from="lab/effects" note="Draws the eye to something live or urgent.">
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><PulseDot /> live</span>
                <span className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><PulseDot color="#FB9438" /> pending</span>
                <span className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><PulseDot color="#ef4444" /> alert</span>
              </div>
            </Item>
          </Grid>
        )}

        {tab === 'indicators' && (
          <Grid>
            <Item name="ProgressBar" from="lab/indicators" note="Plain or striped. Striped reads as 'in flight'.">
              <div className="space-y-4">
                <ProgressBar value={62} label="Cycle 18" />
                <ProgressBar value={38} label="Rebuilding" striped />
              </div>
            </Item>
            <Item name="StreakDots" from="lab/indicators" note="A run of results as pips. Reads as a pattern before it reads as data.">
              <StreakDots
                label="pSSH ahead"
                results={[true, true, true, false, false, false, false, false, true, true, true, true, true, true, true, true, true]}
              />
            </Item>
            <Item name="StatusPill" from="lab/indicators" note="Four states, one shape. Live gets a pulse.">
              <div className="flex flex-wrap gap-2">
                <StatusPill state="live">Live</StatusPill>
                <StatusPill state="ok">Covered</StatusPill>
                <StatusPill state="warn">Degraded</StatusPill>
                <StatusPill state="off">Idle</StatusPill>
              </div>
            </Item>
            <Item name="StepTrack" from="lab/indicators" wide note="Where something is in a fixed sequence.">
              <StepTrack steps={['Open', 'Accrue', 'End stake', 'Pay out', 'Restake']} current={2} />
            </Item>
            <Item name="DeltaChip" from="lab/indicators" note="Signed change with direction in the colour.">
              <div className="flex flex-wrap gap-2">
                <DeltaChip value={12.64} />
                <DeltaChip value={-3.19} />
                <DeltaChip value={0.14} />
              </div>
            </Item>
            <Item name="StatTile" from="lab/indicators" wide note="Label, figure, sub, optional slot. The default container for a number.">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile label="Burned all time" value="2,870,214" sub="pSSH" />
                <StatTile label="Ownership gained" value="+5.39%" sub="never down" accent />
                <StatTile label="Volume" value="$354" sub="per day">
                  <Sparkline data={SPARK} height={28} />
                </StatTile>
              </div>
            </Item>
          </Grid>
        )}

        <p className="mt-8 text-[11.5px] leading-relaxed text-[var(--text-faint)]">
          Everything here lives in <code className="text-[var(--text-muted)]">components/lab/</code> and
          imports cleanly into any page. Keyframes are namespaced <code className="text-[var(--text-muted)]">lab-</code> in
          globals.css. The sample figures are SuperStake&apos;s real numbers, so the demos show how
          these behave on the data they&apos;ll actually carry rather than on flattering noise.
        </p>
      </div>
    </div>
  );
}

const TOTAL = 26;

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 grid gap-3 md:grid-cols-2">{children}</div>;
}

/** One library entry: name, import line, a note on when to reach for it, live demo. */
function Item({
  name,
  from,
  note,
  wide,
  children,
}: {
  name: string;
  from: string;
  note: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const line = `import { ${name} } from '@/components/${from}';`;

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] ${wide ? 'md:col-span-2' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <h3 className="text-sm font-bold tracking-tight text-[var(--text)]">{name}</h3>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(line).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              },
              () => {},
            );
          }}
          className="rounded-md border border-[var(--line)] px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          title={line}
        >
          {copied ? 'Copied' : 'Copy import'}
        </button>
      </div>
      <p className="px-4 pt-3 text-[11.5px] leading-relaxed text-[var(--text-faint)]">{note}</p>
      <div className="px-4 pb-4 pt-3">{children}</div>
    </section>
  );
}
