'use client';

// The Road to Zero — how many matured stakes in the keeper's range are still
// bleeding or bled out, how much the late penalty has taken from them (interest
// included), and how that count has fallen since the keeper started.
//
// Always dark, like the hero: the road needs asphalt. Decoration (title, lane
// dashes) uses the raw HEX orange; data marks use stepped colours validated by
// the dataviz checker on this #0b0b10 surface — bleeding #dd7300, bled out
// #ff2e7e (worst CVD ΔE 9.9). #ff9e00 failed the lightness band as a mark.
//
// Motion runs on arrival and in the explainer loop only; reduced motion gets
// the settled states.

import { useEffect, useRef, useState } from 'react';
import { HEX_LAUNCH_TS } from '@/lib/hex/hexDay';
import { useSettled, EASE } from '@/components/hex/Instruments';

export interface RoadPoint {
  day: number;
  remaining: number;
  bleeding: number;
  drained: number;
  principalHex: number;
  /** Penalty already taken, interest included. */
  penaltyHex: number;
}

const BLEEDING = '#dd7300';
const DRAINED = '#ff2e7e';
const ROAD_ORANGE = '#ff9e00';

/** 126.6M, 25M, 10K — a trailing ".0" says nothing, so it is dropped. */
const compact = (n: number) => {
  const trim = (v: number, d: number) => v.toFixed(d).replace(/\.0+$/, '');
  return n >= 1e9 ? `${trim(n / 1e9, 2)}B` : n >= 1e6 ? `${trim(n / 1e6, 1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : Math.round(n).toLocaleString();
};
const usdShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`);
const dateOf = (day: number, o: Intl.DateTimeFormatOptions) =>
  new Date((HEX_LAUNCH_TS + day * 86_400) * 1000).toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });

function niceCeil(n: number): number {
  if (n <= 0) return 2;
  const p = 10 ** Math.floor(Math.log10(n));
  return ([1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find((m) => m * p >= n) ?? 10) * p;
}

type Measure = 'stakes' | 'penalty';

/* ─────────────────────────── the road in the header ─────────────────────────── */

function RoadHeader() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-full w-full" viewBox="0 0 400 140" preserveAspectRatio="none">
      <defs>
        <linearGradient id="rtz-asphalt" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#1a1a22" />
          <stop offset="1" stopColor="#0b0b10" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rtz-edge" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={ROAD_ORANGE} stopOpacity="0.55" />
          <stop offset="1" stopColor={ROAD_ORANGE} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* the road, narrowing to a vanishing point */}
      <polygon points="120,140 280,140 206,28 194,28" fill="url(#rtz-asphalt)" />
      <line x1="120" y1="140" x2="194" y2="28" stroke="url(#rtz-edge)" strokeWidth="1.2" />
      <line x1="280" y1="140" x2="206" y2="28" stroke="url(#rtz-edge)" strokeWidth="1.2" />
      {/* lane dashes rushing toward zero */}
      <line className="rtz-lane" x1="200" y1="140" x2="200" y2="30" stroke={ROAD_ORANGE} strokeOpacity="0.7" strokeWidth="2" strokeDasharray="10 12" />
    </svg>
  );
}

/* ─────────────────────────── the decline chart ─────────────────────────── */

function DeclineChart({ points, measure, price }: { points: RoadPoint[]; measure: Measure; price: number | null }) {
  const { on } = useSettled();
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(640);
  const plot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const top = niceCeil(Math.max(...points.map((p) => (measure === 'stakes' ? p.remaining : p.penaltyHex))));
  const x = (i: number) => (n === 1 ? 500 : (i / (n - 1)) * 1000);
  const y = (v: number) => 100 - (v / top) * 100;
  // Stacked: bled out is the floor, still-bleeding rides on top of it.
  const lower = points.map((p) => (measure === 'stakes' ? p.drained : p.penaltyHex));
  const upper = points.map((p) => (measure === 'stakes' ? p.remaining : p.penaltyHex));
  /** The band between `hi` and `lo` (the baseline when null): along the top
   *  left to right, back along the bottom right to left. */
  const area = (hi: number[], lo: number[] | null) => {
    const bottom = lo ?? hi.map(() => 0);
    const along = hi.map((v, i) => `${x(i)},${y(v)}`).join(' L');
    const back = bottom.map((v, i) => `${x(i)},${y(v)}`).reverse().join(' L');
    return `M${along} L${back} Z`;
  };
  const line = (vals: number[]) => `M${vals.map((v, i) => `${x(i)},${y(v)}`).join(' L')}`;
  const fmt = (v: number) => (measure === 'stakes' ? Math.round(v).toLocaleString() : `${compact(v)}`);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(width / 70))));
  const h = hover != null ? points[hover] : null;
  const pct = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);

  return (
    <div className="flex gap-2">
      <div className="font-poppins relative h-44 w-11 shrink-0 text-right text-[10px] tabular-nums text-white/45">
        {[top, top / 2, 0].map((v, i) => (
          <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / 2) * 100}%` }}>{fmt(v)}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div
          ref={plot}
          className="relative h-44 touch-none"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
          }}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
          }}
          onPointerLeave={(e) => { if (e.pointerType !== 'touch') setHover(null); }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} aria-hidden className="absolute inset-x-0 border-t" style={{ top: `${(i / 2) * 100}%`, borderColor: 'rgba(255,255,255,0.10)', borderStyle: i === 2 ? 'solid' : 'dashed' }} />
          ))}
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden>
            <g style={{ clipPath: on ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)', transition: `clip-path 1.4s ${EASE}` }}>
              {measure === 'stakes' ? (
                <>
                  <path d={area(lower, null)} fill={DRAINED} fillOpacity={0.55} />
                  <path d={area(upper, lower)} fill={BLEEDING} fillOpacity={0.5} />
                  <path d={line(upper)} fill="none" stroke={BLEEDING} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  <path d={line(lower)} fill="none" stroke={DRAINED} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </>
              ) : (
                <>
                  <path d={area(upper, null)} fill={BLEEDING} fillOpacity={0.4} />
                  <path d={line(upper)} fill="none" stroke={BLEEDING} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </>
              )}
            </g>
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={100} stroke="rgba(255,255,255,0.5)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
          </svg>
          {h && (
            <div
              className="pointer-events-none absolute top-1 z-10 rounded-lg border border-white/15 bg-[#16161d] px-2.5 py-1.5 shadow-lg"
              style={{ left: `${pct(hover!)}%`, transform: pct(hover!) < 25 ? 'translateX(6px)' : pct(hover!) > 75 ? 'translateX(calc(-100% - 6px))' : 'translateX(-50%)' }}
            >
              <div className="font-poppins whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-white/45">
                {dateOf(h.day, { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              {measure === 'stakes' ? (
                <>
                  <div className="font-jost whitespace-nowrap text-[15px] font-bold leading-tight text-white tabular-nums">{h.remaining.toLocaleString()} stakes left</div>
                  <div className="font-poppins whitespace-nowrap text-[11px] text-white/70 tabular-nums">
                    <span className="mr-1 inline-block h-2 w-2 rounded-[2px]" style={{ background: BLEEDING }} />{h.bleeding.toLocaleString()} bleeding
                    <span className="ml-2 mr-1 inline-block h-2 w-2 rounded-[2px]" style={{ background: DRAINED }} />{h.drained.toLocaleString()} bled out
                  </div>
                </>
              ) : (
                <div className="font-jost whitespace-nowrap text-[15px] font-bold leading-tight text-white tabular-nums">
                  {compact(h.penaltyHex)} HEX{price != null ? <span className="font-poppins ml-1.5 text-[11px] font-normal text-white/60">{usdShort(h.penaltyHex * price)}</span> : null}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="font-poppins relative mt-1.5 h-4 text-[10px] text-white/45">
          {points.map((p, i) =>
            (n - 1 - i) % every === 0 ? (
              <span key={p.day} className="absolute top-0 whitespace-nowrap tabular-nums" style={{ left: `${pct(i)}%`, transform: pct(i) < 6 ? 'none' : pct(i) > 94 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                {dateOf(p.day, { month: 'short', day: 'numeric' })}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── how good accounting works ─────────────────────────── */

const STEPS = [
  { at: 'Term ends', line: 'The stake matures. Its owner has 14 days of grace to end it.' },
  { at: 'Grace runs out', line: 'From day 15 the late penalty starts: 1/700th of principal + interest, every day.' },
  { at: 'Anyone can freeze it', line: 'stakeGoodAccounting can be called by anyone, for anyone. We pay the gas.' },
  { at: 'Frozen', line: 'The penalty stops for good. The HEX stays the owner’s; its shares go back to every staker.' },
];

function HowItWorks() {
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">How good accounting works</div>
      <svg className="rtz-scene mt-2 h-auto w-full" viewBox="0 0 600 100" role="img" aria-label="A matured HEX stake drives down the road, starts losing HEX after the 14-day grace, then is frozen and stops losing">
        {/* the road: term → grace → bleeding → frozen */}
        <rect x="0" y="70" width="600" height="14" rx="3" fill="#16161d" />
        <line x1="10" y1="77" x2="590" y2="77" stroke={ROAD_ORANGE} strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="8 10" />
        <rect x="190" y="70" width="90" height="14" fill="#2a2a1a" />
        <rect x="280" y="70" width="170" height="14" fill="#3a1220" />
        <rect x="450" y="70" width="150" height="14" fill="#10293a" />
        {[
          [0, 'term'], [190, 'grace'], [280, 'bleeding 1/700 a day'], [450, 'frozen'],
        ].map(([x, t]) => (
          // Hidden on phones, where they would render ~5px: the step cards below say the same.
          <text key={String(t)} className="hidden sm:inline" x={Number(x) + 6} y="96" fill="rgba(255,255,255,0.55)" fontSize="10" fontFamily="var(--font-poppins), sans-serif">{t}</text>
        ))}
        {/* the stake, driving */}
        <g className="rtz-coin">
          <circle cx="0" cy="48" r="17" fill="#22222b" stroke={ROAD_ORANGE} strokeWidth="2" />
          <clipPath id="rtz-fill-clip"><rect className="rtz-fill" x="-17" y="31" width="34" height="34" /></clipPath>
          <circle cx="0" cy="48" r="15" fill={BLEEDING} clipPath="url(#rtz-fill-clip)" />
          <text x="0" y="52" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="var(--font-jost), sans-serif">HEX</text>
          <circle className="rtz-ice" cx="0" cy="48" r="19" fill="none" stroke="#7dd3fc" strokeWidth="3" />
          <g className="rtz-flake" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round">
            <line x1="0" y1="18" x2="0" y2="6" /><line x1="-6" y1="12" x2="6" y2="12" /><line x1="-4" y1="8" x2="4" y2="16" /><line x1="4" y1="8" x2="-4" y2="16" />
          </g>
          {[0, 1, 2].map((i) => <circle key={i} className={`rtz-drop rtz-drop-${i}`} cx={-6 + i * 6} cy="66" r="2.6" fill={DRAINED} />)}
        </g>
      </svg>
      <ol className="mt-2 grid gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.at} className={`rtz-step rtz-step-${i} rounded-xl border border-white/10 p-2.5`}>
            <div className="font-jost text-[13px] font-bold text-white">{i + 1}. {s.at}</div>
            <div className="font-poppins mt-0.5 text-[11px] leading-snug text-white/65">{s.line}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ─────────────────────────── the section ─────────────────────────── */

export function RoadToZero({ points, price, minHex, maxHex }: {
  /** One point per HEX day, oldest first; the last is the latest reading. */
  points: RoadPoint[];
  price: number | null;
  minHex: number;
  maxHex: number;
}) {
  const [measure, setMeasure] = useState<Measure>('stakes');
  if (points.length === 0) return null;
  const now = points[points.length - 1];
  const first = points[0];
  const fell = first.remaining - now.remaining;

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b10] p-5 md:p-7"
      style={{ ['--text' as string]: '#ffffff', ['--text-muted' as string]: 'rgba(255,255,255,0.70)', ['--text-faint' as string]: 'rgba(255,255,255,0.45)' }}
    >
      <style>{`
        @keyframes rtz-lane { to { stroke-dashoffset: -44; } }
        .rtz-lane { animation: rtz-lane 0.9s linear infinite; }
        @keyframes rtz-drive { 0% { transform: translateX(30px); } 30% { transform: translateX(200px); } 70% { transform: translateX(440px); } 100% { transform: translateX(560px); } }
        .rtz-coin { animation: rtz-drive 10s ${EASE} infinite; }
        @keyframes rtz-fill { 0%, 36% { transform: translateY(0); } 70%, 100% { transform: translateY(12px); } }
        .rtz-fill { animation: rtz-fill 10s linear infinite; }
        @keyframes rtz-drop { 0% { transform: translateY(0); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(14px); opacity: 0; } }
        @keyframes rtz-drop-window { 0%, 36% { visibility: hidden; } 37%, 69% { visibility: visible; } 70%, 100% { visibility: hidden; } }
        .rtz-drop { animation: rtz-drop 0.8s ease-in infinite, rtz-drop-window 10s step-end infinite; }
        .rtz-drop-1 { animation-delay: 0.27s, 0s; } .rtz-drop-2 { animation-delay: 0.53s, 0s; }
        @keyframes rtz-freeze { 0%, 70% { opacity: 0; transform: scale(0.4); } 76%, 100% { opacity: 1; transform: scale(1); } }
        .rtz-ice, .rtz-flake { transform-box: fill-box; transform-origin: center; animation: rtz-freeze 10s ${EASE} infinite; }
        @keyframes rtz-on-0 { 0%, 28% { border-color: ${ROAD_ORANGE}; } 30%, 100% { border-color: rgba(255,255,255,0.10); } }
        @keyframes rtz-on-1 { 0%, 34% { border-color: rgba(255,255,255,0.10); } 36%, 64% { border-color: ${DRAINED}; } 66%, 100% { border-color: rgba(255,255,255,0.10); } }
        @keyframes rtz-on-2 { 0%, 64% { border-color: rgba(255,255,255,0.10); } 66%, 76% { border-color: #7dd3fc; } 78%, 100% { border-color: rgba(255,255,255,0.10); } }
        @keyframes rtz-on-3 { 0%, 76% { border-color: rgba(255,255,255,0.10); } 78%, 100% { border-color: #7dd3fc; } }
        .rtz-step-0 { animation: rtz-on-0 10s infinite; } .rtz-step-1 { animation: rtz-on-1 10s infinite; }
        .rtz-step-2 { animation: rtz-on-2 10s infinite; } .rtz-step-3 { animation: rtz-on-3 10s infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rtz-lane, .rtz-coin, .rtz-fill, .rtz-drop, .rtz-ice, .rtz-flake, .rtz-step { animation: none !important; }
          .rtz-coin { transform: translateX(520px); } .rtz-fill { transform: translateY(12px); }
          .rtz-drop { visibility: hidden; } .rtz-ice, .rtz-flake { opacity: 1; }
        }
      `}</style>

      {/* ── title over the road ── */}
      <div className="relative -mx-5 -mt-5 mb-4 px-5 pb-6 pt-5 md:-mx-7 md:-mt-7 md:px-7">
        <RoadHeader />
        <div className="relative">
          <h2
            className="font-jost bg-clip-text text-[34px] font-bold uppercase leading-none tracking-tight text-transparent md:text-[52px]"
            style={{ backgroundImage: 'linear-gradient(115deg, #ff9e00, #ff2e7e)' }}
          >
            The road to zero
          </h2>
          <p className="font-poppins mt-2 max-w-xl text-[13px] text-white/65">
            Every matured stake of {compact(minHex)}–{compact(maxHex)} HEX that is still losing HEX, or has lost it all, and is
            not yet frozen. The keeper is driving this number to zero.
          </p>
        </div>
      </div>

      {/* ── where the road stands ── */}
      <div className="relative grid gap-5 sm:grid-cols-3">
        <div>
          <div className="font-poppins text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Stakes left to freeze</div>
          <div className="font-jost mt-1 text-[40px] font-bold leading-none tabular-nums text-white md:text-[48px]">{now.remaining.toLocaleString()}</div>
          <div className="font-poppins mt-1.5 text-[11px] text-white/60">
            {fell > 0 ? `${fell.toLocaleString()} fewer than ${dateOf(first.day, { month: 'short', day: 'numeric' })}` : `since ${dateOf(first.day, { month: 'short', day: 'numeric' })}`}
          </div>
        </div>
        <div>
          <div className="font-poppins text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Fully bled out</div>
          <div className="font-jost mt-1 text-[40px] font-bold leading-none tabular-nums md:text-[48px]" style={{ color: DRAINED }}>{now.drained.toLocaleString()}</div>
          <div className="font-poppins mt-1.5 text-[11px] text-white/60">
            {now.bleeding.toLocaleString()} still bleeding · freezing a bled-out stake returns its shares
          </div>
        </div>
        <div>
          <div className="font-poppins text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Penalties sitting</div>
          <div className="font-jost mt-1 text-[40px] font-bold leading-none tabular-nums text-white md:text-[48px]">
            {compact(now.penaltyHex)} <span className="text-[18px] text-white/60">HEX</span>
          </div>
          <div className="font-poppins mt-1.5 text-[11px] text-white/60">
            principal + interest × days late ÷ 700{price != null ? ` · ${usdShort(now.penaltyHex * price)}` : ''}
          </div>
        </div>
      </div>

      {/* ── the decline ── */}
      <div className="relative mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="font-poppins flex items-center gap-3 text-[11px] text-white/65">
            {measure === 'stakes' ? (
              <>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BLEEDING }} />Still bleeding</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: DRAINED }} />Bled out</span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BLEEDING }} />Penalty sitting, HEX</span>
            )}
          </div>
          <div role="group" aria-label="Measure" className="flex rounded-full border border-white/15 p-0.5">
            {([['stakes', 'Stakes'], ['penalty', 'Penalty HEX']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMeasure(k)}
                aria-pressed={measure === k}
                className={`font-poppins rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${measure === k ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {points.length > 1 && <DeclineChart points={points} measure={measure} price={price} />}
      </div>

      <HowItWorks />

      <table className="sr-only">
        <caption>The road to zero, by day</caption>
        <thead><tr><th>Day</th><th>Stakes left</th><th>Still bleeding</th><th>Bled out</th><th>Penalty sitting (HEX)</th></tr></thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}><td>{dateOf(p.day, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td>{p.remaining}</td><td>{p.bleeding}</td><td>{p.drained}</td><td>{Math.round(p.penaltyHex)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
