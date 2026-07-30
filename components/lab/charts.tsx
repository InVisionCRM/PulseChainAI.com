'use client';

// Charts — small, dependency-free SVG. Recharts is in the project and is the
// right tool for a full analytical chart with axes, legends and tooltips; these
// are for the other case, where a chart is a figure that happens to have a
// shape and needs to sit inside a card without dragging a library in.
//
// Every one takes plain numbers and animates in with a stroke or transform, so
// they drop into a stat tile as easily as a number does.

import { useEffect, useId, useMemo, useRef, useState } from 'react';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
export const RAMP = ['#7E089D', '#D83639', '#FB9438'] as const;

/** Fires once when the element is first seen. Charts below the fold animate on
 *  arrival rather than having already finished before anyone looked. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === 'undefined') return;
    if (
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => es.some((e) => e.isIntersecting) && (setSeen(true), io.disconnect()),
      { threshold: 0.25 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

/**
 * Sparkline. A trend as a single glyph — put it beside a number, not instead
 * of one. Wipes itself in left-to-right.
 *
 * The reveal is a clip rect rather than a dash offset: the box is stretched
 * (`preserveAspectRatio="none"`), and under a non-uniform scale a
 * `pathLength`-normalised dash no longer matches the path as drawn, so the
 * stroke stops short of the right edge. Clipping is immune to that.
 */
export function Sparkline({
  data,
  height = 40,
  showArea = true,
  color,
}: {
  data: number[];
  height?: number;
  showArea?: boolean;
  color?: string;
}) {
  const [ref, seen] = useInView<HTMLDivElement>();
  // Unique per instance — a shared id would make every sparkline on the page
  // paint the first one's fill, so a falling series would get a rising colour.
  const uid = useId().replace(/:/g, '');
  const W = 200;
  const H = 48;
  const { line, area, up } = useMemo(() => {
    if (data.length < 2) return { line: '', area: '', up: true };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const pts = data.map((v, i) => [
      (i / (data.length - 1)) * W,
      H - 4 - ((v - min) / span) * (H - 8),
    ]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return {
      line: d,
      area: `${d} L${W} ${H} L0 ${H} Z`,
      up: data[data.length - 1] >= data[0],
    };
  }, [data]);

  const stroke = color ?? (up ? 'var(--up)' : '#f87171');

  return (
    <div ref={ref} style={{ height }} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={`spark-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity="0.3" />
            <stop offset="1" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
          <clipPath id={`spark-clip-${uid}`}>
            <rect
              x="0"
              y="0"
              height={H}
              style={{ width: seen ? W : 0, transition: 'width 1.1s ease-out' }}
            />
          </clipPath>
        </defs>
        <g clipPath={`url(#spark-clip-${uid})`}>
          {showArea && <path d={area} fill={`url(#spark-fill-${uid})`} />}
          <path
            d={line}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * Bar chart. Bars grow from the baseline, staggered left to right. Labels wait
 * out their own bar so a number is never legible above a bar still climbing.
 */
export function BarChart({
  data,
  height = 180,
  fmt = (v: number) => String(Math.round(v)),
  showValues = true,
  gradient = RAMP,
}: {
  data: { label: string | number; value: number }[];
  height?: number;
  fmt?: (v: number) => string;
  showValues?: boolean;
  gradient?: readonly [string, string, string] | readonly string[];
}) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const W = 680;
  const H = 210;
  const TOP = 26;
  const BASE = H - 18;
  const PAD_L = 34; // gutter, or tall bars paint over the axis labels
  const slot = (W - PAD_L) / Math.max(1, data.length);
  const bw = Math.min(34, slot * 0.62);
  const max = Math.max(...data.map((d) => d.value), 1);
  const id = `lab-bar-${gradient.join('')}`.replace(/[^a-z0-9-]/gi, '');

  return (
    <div ref={ref} className="w-full overflow-x-auto" style={{ minHeight: height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[520px] overflow-visible">
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={gradient[0]} />
            <stop offset="0.5" stopColor={gradient[1]} />
            <stop offset="1" stopColor={gradient[2]} />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = BASE - f * (BASE - TOP);
          return (
            <g key={f}>
              <line x1={PAD_L} y1={y} x2={W} y2={y} stroke="var(--line)" strokeWidth="1" />
              {f > 0 && (
                <text x={PAD_L - 4} y={y + 3} textAnchor="end" className="fill-[var(--text-faint)]"
                  style={{ fontFamily: MONO, fontSize: 8.5 }}>
                  {fmt(max * f)}
                </text>
              )}
            </g>
          );
        })}

        {data.map((d, k) => {
          const h = Math.max(2, (d.value / max) * (BASE - TOP));
          const x = PAD_L + k * slot + (slot - bw) / 2;
          const delay = k * 60;
          return (
            <g key={k}>
              <title>{`${d.label}: ${fmt(d.value)}`}</title>
              <rect
                x={x} y={BASE - h} width={bw} height={h} rx="3" fill={`url(#${id})`}
                className="origin-bottom transition-transform duration-700 ease-out [transform-box:fill-box]"
                style={{ transform: seen ? 'scaleY(1)' : 'scaleY(0)', transitionDelay: `${delay}ms` }}
              />
              {showValues && (
                <text
                  x={x + bw / 2} y={BASE - h - 6} textAnchor="middle"
                  className="fill-[var(--text-muted)] transition-opacity duration-300"
                  style={{ fontFamily: MONO, fontSize: 9, opacity: seen ? 1 : 0, transitionDelay: `${delay + 700}ms` }}
                >
                  {fmt(d.value)}
                </text>
              )}
              <text x={x + bw / 2} y={H - 4} textAnchor="middle" className="fill-[var(--text-faint)]"
                style={{ fontFamily: MONO, fontSize: 9 }}>
                {d.label}
              </text>
            </g>
          );
        })}
        <line x1={PAD_L} y1={BASE} x2={W} y2={BASE} stroke="var(--line-strong)" strokeWidth="1" />
      </svg>
    </div>
  );
}

/** Area trend with a marked latest point. For "it went up over time". */
export function AreaTrend({
  data,
  height = 190,
  fmt = (v: number) => String(Math.round(v)),
  caption,
}: {
  data: number[];
  height?: number;
  fmt?: (v: number) => string;
  caption?: [string, string];
}) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const W = 640;
  const H = 190;
  const PAD = 12;
  const { d, area, tip } = useMemo(() => {
    const max = Math.max(...data) * 1.02 || 1;
    const pts = data.map((v, i) => [
      (i / Math.max(1, data.length - 1)) * W,
      H - PAD - (v / max) * (H - PAD * 2),
    ]);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return { d: path, area: `${path} L${W} ${H} L0 ${H} Z`, tip: pts[pts.length - 1] };
  }, [data]);

  return (
    <div ref={ref} className="w-full" style={{ minHeight: height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="lab-area-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={RAMP[0]} />
            <stop offset="0.55" stopColor={RAMP[1]} />
            <stop offset="1" stopColor={RAMP[2]} />
          </linearGradient>
          <linearGradient id="lab-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={RAMP[1]} stopOpacity="0.34" />
            <stop offset="1" stopColor={RAMP[1]} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 72, 124, 176].map((y) => (
          <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="var(--line)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#lab-area-fill)" className="transition-opacity duration-700 delay-500"
          style={{ opacity: seen ? 1 : 0 }} />
        <path
          d={d} fill="none" stroke="url(#lab-area-line)" strokeWidth="2.6" strokeLinejoin="round"
          pathLength={1} strokeDasharray={1} strokeDashoffset={seen ? 0 : 1}
          className="transition-[stroke-dashoffset] duration-[1200ms] ease-out"
        />
        <circle cx={tip[0] - 2} cy={tip[1]} r="4.5" fill={RAMP[2]}
          className="transition-opacity duration-500 delay-[1100ms]" style={{ opacity: seen ? 1 : 0 }} />
      </svg>
      {caption && (
        <div className="mt-1.5 flex justify-between text-[9.5px] tracking-[0.08em] text-[var(--text-faint)]"
          style={{ fontFamily: MONO }}>
          <span>{caption[0]}</span>
          <span>{caption[1]}</span>
        </div>
      )}
    </div>
  );
}

/** Donut for composition. Slices sweep in one after another. */
export function Donut({
  slices,
  size = 170,
  thickness = 22,
  centerLabel,
  centerSub,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 50 - thickness / 2;
  const C = 2 * Math.PI * R;

  let acc = 0;
  const arcs = slices.map((s, i) => {
    const frac = s.value / total;
    const seg = { ...s, frac, offset: acc, delay: i * 160 };
    acc += frac;
    return seg;
  });

  return (
    <div ref={ref} className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx="50" cy="50" r={R} fill="none" stroke={a.color} strokeWidth={thickness}
              strokeDashoffset={-C * a.offset}
              className="transition-[stroke-dasharray] duration-700 ease-out"
              style={{
                strokeDasharray: seen ? `${C * a.frac} ${C}` : `0 ${C}`,
                transitionDelay: `${a.delay}ms`,
              }}
            />
          ))}
        </svg>
        {(centerLabel || centerSub) && (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-bold tabular-nums text-[var(--text)]" style={{ fontFamily: MONO, fontSize: size * 0.16 }}>
                {centerLabel}
              </div>
              {centerSub && (
                <div className="text-[var(--text-faint)]" style={{ fontFamily: MONO, fontSize: size * 0.06, letterSpacing: 1 }}>
                  {centerSub.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <ul className="min-w-0 flex-1 space-y-1">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-[11px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-[var(--text-muted)]">{s.label}</span>
            <span className="shrink-0 tabular-nums text-[var(--text)]">
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal ranked bars — the "top N by share" list. */
export function RankedBars({
  rows,
  fmt = (v: number) => v.toLocaleString(),
}: {
  rows: { label: string; value: number }[];
  fmt?: (v: number) => string;
}) {
  const [ref, seen] = useInView<HTMLUListElement>();
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul ref={ref} className="space-y-2">
      {rows.map((r, i) => (
        <li key={i}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
            <span className="min-w-0 truncate font-semibold text-[var(--text)]">{r.label}</span>
            <span className="shrink-0 tabular-nums text-[var(--text-muted)]">{fmt(r.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
              style={{
                width: seen ? `${(r.value / max) * 100}%` : '0%',
                background: `linear-gradient(90deg, ${RAMP[0]}, ${RAMP[1]} 60%, ${RAMP[2]})`,
                transitionDelay: `${i * 70}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
