'use client';

// What good-accounting actually does, drawn rather than explained.
//
// The mechanic is genuinely hard to describe in a sentence — "a matured stake
// keeps losing 1/700th a day until someone calls a function that freezes it" is
// four unfamiliar ideas at once — but it is easy to SHOW: two identical stakes,
// one left alone and one frozen, running side by side on the same clock.
//
// The left track bleeds all the way down. The right track bleeds at the same
// rate until the freeze, then stops dead and stays. Same start, same clock, and
// by the end of the loop the difference is the whole argument for the keeper.
//
// Honest by construction: both tracks share one animation timeline, the freeze
// lands at the 14-day grace plus a little (where the keeper actually acts), and
// the decay is linear at 1/700th a day, which is what the contract does.

import { useEffect, useRef, useState } from 'react';

/** One loop of the story, in ms. Slow enough to read, short enough to re-watch. */
const CYCLE_MS = 9_000;
/** Where in the loop the keeper freezes the right-hand stake. */
const FREEZE_AT = 0.42;
/** How far the unfrozen stake has bled by the end of the loop. */
const END_LOSS = 0.86;

export function GoodAccountingDiagram() {
  const [t, setT] = useState(0);
  const [reduced, setReduced] = useState(false);
  const frame = useRef<number>(0);
  const start = useRef<number>(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    // Reduced motion gets the END of the story as a still frame — the contrast
    // is the content, so showing nothing would be showing nothing.
    if (reduced) {
      setT(1);
      return;
    }
    const step = (now: number) => {
      if (!start.current) start.current = now;
      setT((((now - start.current) % CYCLE_MS) / CYCLE_MS));
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [reduced]);

  // Both tracks bleed on the same clock; only one of them ever stops.
  const bleeding = Math.min(1, t / 1) * END_LOSS;
  const frozen = Math.min(t, FREEZE_AT) / 1 * END_LOSS;
  const isFrozen = t >= FREEZE_AT;
  const day = Math.round(t * 700 * END_LOSS);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-jost text-[15px] font-semibold text-[var(--text)]">
          The same stake, with and without us
        </h3>
        <span className="font-poppins text-[10px] uppercase tracking-wider text-[var(--text-faint)] tabular-nums">
          {reduced ? 'after ~600 days' : `day ${day} past grace`}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Track
          label="Left alone"
          sub="loses 1/700th every day"
          lost={bleeding}
          tone="bad"
          badge={null}
        />
        <Track
          label="Good-accounted"
          sub={isFrozen ? 'frozen — it cannot fall further' : 'still bleeding…'}
          lost={frozen}
          tone="good"
          badge={isFrozen ? 'frozen' : null}
        />
      </div>

      <p className="font-poppins mt-3 text-[12px] leading-relaxed text-[var(--text-muted)]">
        Both stakes matured on the same day and neither owner came back. Calling{' '}
        <code className="font-mono text-[11px] text-[var(--text)]">stakeGoodAccounting</code> on the
        second one locked its penalty where it stood. It pays the caller nothing, anyone may call it
        for anyone, and the HEX never stops belonging to its owner — it just stops shrinking.
      </p>
    </div>
  );
}

function Track({
  label,
  sub,
  lost,
  tone,
  badge,
}: {
  label: string;
  sub: string;
  lost: number;
  tone: 'good' | 'bad';
  badge: string | null;
}) {
  const kept = Math.max(0, 1 - lost);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-poppins text-[11px] font-semibold text-[var(--text)]">{label}</span>
        {badge && (
          <span className="font-poppins rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
            {badge}
          </span>
        )}
      </div>

      {/* The bar is the stake. What is left is what the owner would still get. */}
      <div className="mt-1.5 flex h-6 overflow-hidden rounded-md bg-[var(--surface-3)]">
        <div
          className="h-full"
          style={{
            width: `${kept * 100}%`,
            background: tone === 'good' ? '#06b6d4' : '#f59e0b',
            transition: 'width 60ms linear',
          }}
        />
        <div
          className="h-full flex-1"
          style={{ background: 'repeating-linear-gradient(45deg,#ef444455 0 6px,#ef444422 6px 12px)' }}
        />
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="font-poppins text-[10px] text-[var(--text-faint)]">{sub}</span>
        <span
          className={`font-poppins text-[11px] font-semibold tabular-nums ${
            tone === 'good' ? 'text-cyan-300' : 'text-amber-400'
          }`}
        >
          {Math.round(kept * 100)}% left
        </span>
      </div>
    </div>
  );
}
