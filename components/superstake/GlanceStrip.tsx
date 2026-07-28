'use client';

// Five wordless dials — the state of the machine at a glance, read by shape and
// icon rather than by label. Every figure here is stated in full elsewhere on
// the page; this strip exists to be scanned, not to be the source.

import { IconFlame, IconActivity, IconArrowUp, IconArrowDown } from '@tabler/icons-react';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD_STOPS = (
  <>
    <stop offset="0" stopColor="#7E089D" />
    <stop offset="0.55" stopColor="#D83639" />
    <stop offset="1" stopColor="#FB9438" />
  </>
);

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-3">
      <div
        className="mb-1.5 text-center text-[9px] uppercase tracking-[0.13em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        {title}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/**
 * Which side earns more per dollar, as a tug-of-war needle: HEX's mark at one
 * end, SuperStake's at the other, dead centre meaning the two are level. Log
 * scale capped at 3x either way, so a lopsided cycle still leaves the needle
 * on the dial instead of pinned to a stop.
 */
export function VersusGauge({ ratio }: { ratio: number }) {
  const R = 62;
  const CX = 80;
  const CY = 72;
  const LEN = Math.PI * R;
  const frac =
    ratio > 0
      ? 0.5 + 0.5 * Math.max(-1, Math.min(1, Math.log(ratio) / Math.log(3)))
      : 0.5;
  const ang = Math.PI * (1 - frac);
  const nx = CX + Math.cos(ang) * (R - 13);
  const ny = CY - Math.sin(ang) * (R - 13);
  const psshAhead = ratio >= 1;
  return (
    <Tile title="HEX earned per $1">
      <svg
        viewBox="0 0 160 108"
        className="block h-auto w-full max-w-[210px]"
        role="img"
        aria-label={
          psshAhead
            ? `Holding pSSH is earning ${ratio.toFixed(2)} times the HEX per dollar that staking HEX is.`
            : `Staking HEX is earning ${(1 / ratio).toFixed(2)} times the HEX per dollar that holding pSSH is.`
        }
      >
        <defs>
          <linearGradient id="ss-vs" x1="0" y1="0" x2="1" y2="0">{GRAD_STOPS}</linearGradient>
        </defs>
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none"
              stroke="var(--line)" strokeWidth="10" strokeLinecap="round" />
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none"
              stroke="url(#ss-vs)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={LEN} strokeDashoffset={LEN * (1 - frac)}
              style={{ transition: 'stroke-dashoffset .6s ease' }} />
        {/* dead-centre tick: the two are level */}
        <line x1={CX} y1={CY - R - 6} x2={CX} y2={CY - R + 6}
              stroke="var(--text-faint)" strokeWidth="1.5" strokeDasharray="2 2" />
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="3.5" fill="var(--text)" />
        {/* the two contenders, no words */}
        <image href="/hex-logo.svg" x={CX - R - 10} y={CY + 6} width="21" height="21" opacity={psshAhead ? 0.4 : 1} />
        <image href="/superstake-logo.png" x={CX + R - 11} y={CY + 6} width="21" height="21" opacity={psshAhead ? 1 : 0.4} />
        <text x={CX} y={CY + 24} textAnchor="middle" fontSize="21" fontWeight="700"
              fill="var(--text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {(psshAhead ? ratio : 1 / ratio).toFixed(2)}×
        </text>
      </svg>
    </Tile>
  );
}

/** A ring that fills as something progresses, with an icon and a bare number. */
export function RingTile({
  frac, value, icon, title, label, good,
}: {
  frac: number;
  value: string;
  icon: React.ReactNode;
  /** Hover/screen-reader description. */
  title: string;
  /** The short heading shown on the tile. */
  label: string;
  good?: boolean;
}) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const f = Math.max(0, Math.min(1, frac));
  return (
    <Tile title={label}>
      <div className="relative" title={title}>
        <svg viewBox="0 0 84 84" className="block h-[84px] w-[84px] -rotate-90" role="img" aria-label={title}>
          <defs>
            <linearGradient id={`ss-ring-${value.replace(/\W/g, '')}`} x1="0" y1="0" x2="1" y2="1">
              {GRAD_STOPS}
            </linearGradient>
          </defs>
          <circle cx="42" cy="42" r={R} fill="none" stroke="var(--line)" strokeWidth="7" />
          <circle
            cx="42" cy="42" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
            stroke={good ? 'var(--up)' : `url(#ss-ring-${value.replace(/\W/g, '')})`}
            strokeDasharray={C} strokeDashoffset={C * (1 - f)}
            style={{ transition: 'stroke-dashoffset .6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-[var(--text-faint)]">{icon}</span>
          <span className="text-[14px] font-bold leading-none tabular-nums text-[var(--text)]">
            {value}
          </span>
        </div>
      </div>
    </Tile>
  );
}

/**
 * What the cycle is taking in against the 1% it hands out, as a level against a
 * marked line. Above the line the machine grows; below it the stake shrinks —
 * which is the single condition everything else on the page depends on.
 */
export function ThresholdTile({ inPct, outPct }: { inPct: number; outPct: number }) {
  const CAP = 6; // % of principal; comfortably above both the line and normal inflow
  const h = (v: number) => Math.max(2, Math.min(100, (v / CAP) * 100));
  const over = inPct >= outPct;
  return (
    <Tile title="Coming in vs the 1% out">
      <div
        className="flex items-end gap-2"
        title={`Taking in ${inPct.toFixed(2)}% of the pool this cycle against the ${outPct.toFixed(2)}% it pays out.`}
      >
        <div className="relative h-[62px] w-6 overflow-hidden rounded-md bg-[var(--line)]">
          <span
            className="absolute inset-x-0 bottom-0 rounded-md transition-[height] duration-500"
            style={{
              height: `${h(inPct)}%`,
              background: over
                ? 'linear-gradient(180deg,var(--up),color-mix(in srgb,var(--up) 45%,transparent))'
                : '#f87171',
            }}
          />
          {/* the 1% line everything has to clear */}
          <span
            className="absolute inset-x-0 border-t border-dashed border-[var(--text)]"
            style={{ bottom: `${h(outPct)}%` }}
          />
        </div>
        <div className="flex flex-col items-start">
          <span style={{ color: over ? 'var(--up)' : '#f87171' }}>
            {over ? <IconArrowUp className="h-4 w-4" /> : <IconArrowDown className="h-4 w-4" />}
          </span>
          <span className="text-[14px] font-bold leading-none tabular-nums text-[var(--text)]">
            {inPct.toFixed(2)}%
          </span>
          <span
            className="mt-0.5 text-[9px] tabular-nums text-[var(--text-faint)]"
            style={{ fontFamily: MONO }}
          >
            /{outPct.toFixed(2)}%
          </span>
        </div>
      </div>
    </Tile>
  );
}

export default function GlanceStrip({
  perDollarRatio, sharesLeft, sharesMinted, coverTimes, inPct, outPct,
}: {
  /** pSSH HEX-per-dollar divided by the stake's, for the tug-of-war needle. */
  perDollarRatio: number;
  sharesLeft: number;
  sharesMinted: number;
  /** How many times over current volume covers what the cycle needs. */
  coverTimes: number;
  /** What the cycle takes in, and the 1% it pays out, both as % of principal. */
  inPct: number;
  outPct: number;
}) {
  const nf = (n: number) => Math.round(n).toLocaleString();
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      {/* The countdown already has a full clock in the hero, so this strip gives
          its slot to the head-to-head instead of repeating it. */}
      <div className="col-span-2">
        <VersusGauge ratio={perDollarRatio} />
      </div>
      <RingTile
        frac={sharesMinted > 0 ? sharesLeft / sharesMinted : 0}
        value={nf(sharesLeft)}
        icon={<IconFlame className="h-4 w-4" />}
        label="S-shares left"
        title={`${nf(sharesLeft)} of ${nf(sharesMinted)} S-shares left — the count only falls.`}
      />
      <ThresholdTile inPct={inPct} outPct={outPct} />
      <RingTile
        frac={Math.min(1, coverTimes / 10)}
        value={`${coverTimes.toFixed(1)}×`}
        icon={<IconActivity className="h-4 w-4" />}
        label="Volume vs needed"
        title={`Trading is running ${coverTimes.toFixed(1)} times what this cycle needs to break even.`}
        good={coverTimes >= 1}
      />
    </div>
  );
}
