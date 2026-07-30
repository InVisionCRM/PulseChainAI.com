'use client';

// Every pSSH pair that has ever traded, individually. This is what funds the
// machine: the 5.5% comes off trades in these pools, so the spread matters as
// much as the total. Reuses /api/geicko/volume, which reads the subgraph's
// untrackedVolumeUSD — the tracked column reports $0 for any pair of two
// non-whitelisted tokens, which would silently delete most of this list.

import { useEffect, useState } from 'react';
import { Donut } from '@/components/lab/charts';
import { useSweep } from '@/components/lab/gauges';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(90deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';
/** Enough to cover everything that actually moves; the tail is fractions of a percent. */
const SHOW = 20;
/** The brand ramp, sampled — so the donut reads as the same family as the bars. */
const SLICE = ['#7E089D', '#AE176A', '#D83639', '#E96635', '#FB9438'];
/** Everything outside the top few, drawn muted so it recedes. */
const REST_COLOR = 'var(--surface-3)';
/** How many pairs get their own slice before the rest are pooled. */
const DONUT_SLICES = 5;

interface PairVol {
  label: string;
  volumeUsd: number;
}
interface VolumePayload {
  byPair?: PairVol[];
  pairTotals?: { count: number; volumeUsd: number; shownVolumeUsd: number };
}

const usd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : `$${n.toFixed(0)}`;

/** One digit shorter, for the donut's hole — the exact figure is in the header
 *  right above it, and the full form overflows the ring. */
const usdShort = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}k` : `$${n.toFixed(0)}`;

/** One row's bar. Fills from zero on arrival, staggered down the list. */
function VolumeBar({ pct, index }: { pct: number; index: number }) {
  const w = useSweep(pct);
  return (
    <span
      className="block h-full rounded transition-[width] duration-700 ease-out"
      style={{ width: `${w}%`, background: GRAD, transitionDelay: `${Math.min(index, 12) * 45}ms` }}
    />
  );
}

export default function PairVolume({ token }: { token: string }) {
  const [data, setData] = useState<VolumePayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/geicko/volume?network=pulsechain&token=${token}&pairs=${SHOW}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d?.byPair?.length) setData(d);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [token]);

  if (failed) return null;

  const pairs = data?.byPair ?? [];
  const totals = data?.pairTotals;
  const max = pairs.length ? pairs[0].volumeUsd : 1;
  const rest = totals ? totals.volumeUsd - totals.shownVolumeUsd : 0;
  const restCount = totals ? totals.count - pairs.length : 0;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[clamp(17px,2.4vw,21px)] font-bold tracking-[-0.02em] text-[var(--text)]">
          Where the volume comes from
        </h2>
        <span className="text-[12.5px] text-[var(--text-faint)]">
          {totals ? (
            <>
              <b className="text-[var(--text-muted)]">{usd(totals.volumeUsd)}</b> across{' '}
              <b className="text-[var(--text-muted)]">{totals.count}</b> pairs, all time
            </>
          ) : (
            'loading…'
          )}
        </span>
      </div>

      {!data ? (
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-[var(--surface)]" />
          ))}
        </div>
      ) : (
        <>
          {/* The shape of it, before the detail. Same numbers as the list —
              top few by name, everything else pooled so the tail doesn't
              become forty unreadable slivers. */}
          {totals && pairs.length > DONUT_SLICES && (
            <div className="mt-4 max-w-[520px] border-b border-[var(--line)] pb-4">
              <Donut
                size={150}
                centerLabel={usdShort(totals.volumeUsd)}
                centerSub="all time"
                slices={[
                  ...pairs.slice(0, DONUT_SLICES).map((p, i) => ({
                    label: p.label,
                    value: p.volumeUsd,
                    color: SLICE[i % SLICE.length],
                  })),
                  {
                    label: `${totals.count - DONUT_SLICES} smaller pairs`,
                    value: Math.max(
                      0,
                      totals.volumeUsd -
                        pairs.slice(0, DONUT_SLICES).reduce((a, b) => a + b.volumeUsd, 0),
                    ),
                    color: REST_COLOR,
                  },
                ]}
              />
            </div>
          )}

          <ol className="mt-4 grid gap-1.5">
            {pairs.map((p, idx) => {
              const pct = totals?.volumeUsd ? (p.volumeUsd / totals.volumeUsd) * 100 : 0;
              return (
                <li key={p.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12.5px] font-semibold text-[var(--text)]">
                        {p.label}
                      </span>
                      <span
                        className="shrink-0 text-[10px] tabular-nums text-[var(--text-faint)]"
                        style={{ fontFamily: MONO }}
                      >
                        {pct >= 0.1 ? `${pct.toFixed(1)}%` : '<0.1%'}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-[var(--line)]">
                      <VolumeBar pct={Math.max(1.5, (p.volumeUsd / max) * 100)} index={idx} />
                    </div>
                  </div>
                  <span className="w-[68px] shrink-0 text-right text-[12.5px] font-bold tabular-nums text-[var(--text)]">
                    {usd(p.volumeUsd)}
                  </span>
                </li>
              );
            })}
          </ol>

          {restCount > 0 && (
            <p className="mt-3 border-t border-[var(--line)] pt-2.5 text-[11px] text-[var(--text-faint)]">
              Plus <b className="text-[var(--text-muted)]">{restCount}</b> smaller pairs adding{' '}
              <b className="text-[var(--text-muted)]">{usd(rest)}</b> between them.
            </p>
          )}
        </>
      )}
    </div>
  );
}
