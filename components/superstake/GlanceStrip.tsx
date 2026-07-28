'use client';

// Five wordless dials — the state of the machine at a glance, read by shape and
// icon rather than by label. Every figure here is stated in full elsewhere on
// the page; this strip exists to be scanned, not to be the source.

import { IconClock, IconFlame, IconActivity, IconArrowUp, IconArrowDown } from '@tabler/icons-react';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD_STOPS = (
  <>
    <stop offset="0" stopColor="#7E089D" />
    <stop offset="0.55" stopColor="#D83639" />
    <stop offset="1" stopColor="#FB9438" />
  </>
);

function Tile({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-3">
      {children}
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
  const R = 46;
  const CX = 60;
  const CY = 54;
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
    <Tile>
      <svg
        viewBox="0 0 120 82"
        className="block h-auto w-full max-w-[128px]"
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
              stroke="var(--line)" strokeWidth="8" strokeLinecap="round" />
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none"
              stroke="url(#ss-vs)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={LEN} strokeDashoffset={LEN * (1 - frac)}
              style={{ transition: 'stroke-dashoffset .6s ease' }} />
        {/* dead-centre tick: the two are level */}
        <line x1={CX} y1={CY - R - 5} x2={CX} y2={CY - R + 5}
              stroke="var(--text-faint)" strokeWidth="1.5" strokeDasharray="2 2" />
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="3" fill="var(--text)" />
        {/* the two contenders, no words */}
        <image href="/hex-logo.svg" x={CX - R - 8} y={CY + 4} width="16" height="16" opacity={psshAhead ? 0.45 : 1} />
        <image href="/superstake-logo.png" x={CX + R - 8} y={CY + 4} width="16" height="16" opacity={psshAhead ? 1 : 0.45} />
        <text x={CX} y={CY + 20} textAnchor="middle" fontSize="15" fontWeight="700"
              fill="var(--text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {(psshAhead ? ratio : 1 / ratio).toFixed(2)}×
        </text>
      </svg>
    </Tile>
  );
}

/** A ring that fills as something progresses, with an icon and a bare number. */
export function RingTile({
  frac, value, icon, title, good,
}: {
  frac: number;
  value: string;
  icon: React.ReactNode;
  title: string;
  good?: boolean;
}) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const f = Math.max(0, Math.min(1, frac));
  return (
    <Tile>
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
    <Tile>
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
  perDollarRatio, cycleFrac, daysLeft, sharesLeft, sharesMinted, coverTimes, inPct, outPct,
}: {
  /** pSSH HEX-per-dollar divided by the stake's, for the tug-of-war needle. */
  perDollarRatio: number;
  cycleFrac: number;
  daysLeft: number;
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <VersusGauge ratio={perDollarRatio} />
      <RingTile
        frac={cycleFrac}
        value={`${daysLeft}`}
        icon={<IconClock className="h-4 w-4" />}
        title={`${daysLeft} days left in the current cycle.`}
      />
      <RingTile
        frac={sharesMinted > 0 ? sharesLeft / sharesMinted : 0}
        value={nf(sharesLeft)}
        icon={<IconFlame className="h-4 w-4" />}
        title={`${nf(sharesLeft)} of ${nf(sharesMinted)} S-shares left — the count only falls.`}
      />
      <ThresholdTile inPct={inPct} outPct={outPct} />
      <RingTile
        frac={Math.min(1, coverTimes / 10)}
        value={`${coverTimes.toFixed(1)}×`}
        icon={<IconActivity className="h-4 w-4" />}
        title={`Trading is running ${coverTimes.toFixed(1)} times what this cycle needs to break even.`}
        good={coverTimes >= 1}
      />
    </div>
  );
}
