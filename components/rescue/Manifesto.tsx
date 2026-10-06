'use client';

// The Good Accounting Manifesto — why the keeper exists, told once.
//
// An intro card on the Rescue Wall: the room goes nearly dark, a warm light
// comes up along the bottom of the screen, and a sheet of dark paper rises into
// it. Backdrop, light and paper each fade on their own clock, in and out, so
// the close is as deliberate as the open.
//
// Shown by itself on a visitor's first visit (after the intro splash and the
// devlog have had their turn), then only when asked for via openManifesto().
//
// Every figure is either live (passed in from the page's own totals) or a
// measured constant with its date beside it. Nothing here is rounded up for
// effect: a manifesto that gets one number wrong loses the argument.

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { IconX } from '@tabler/icons-react';
import { INTRO_DONE_EVENT, isIntroActive } from '@/components/IntroSplash';
import { DEVLOG_CLOSED_EVENT, devlogWillOpen } from '@/components/devlog/DevlogModal';

export const MANIFESTO_EVENT = 'open-manifesto';
const SEEN_KEY = 'rescue-manifesto-seen-v1';

/** Raise the manifesto from anywhere on the page. */
export function openManifesto() {
  window.dispatchEvent(new CustomEvent(MANIFESTO_EVENT));
}

export interface ManifestoFigures {
  rescues: number;
  wallets: number;
  keptHex: number;
  bleedStoppedPerDay: number;
  gasPls: number;
  /** Half of every settled penalty, minted to the Origin Address. */
  originHex: number;
}

const INK = '#e6ded1';
const INK_SOFT = '#bfb6a7';
const ORANGE = '#ff9e00';

const big = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : `${Math.round(n)}`;

// Paper grain: fractal noise, tinted and faint, so the sheet reads as paper
// without the texture ever competing with the words.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .9 0 0 0 0 .85 0 0 0 0 .75 0 0 0 .05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Manifesto({ figures }: { figures: ManifestoFigures }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  const markSeen = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* private mode: it may show again next visit, which is harmless */
    }
  };

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      markSeen();
    };
    window.addEventListener(MANIFESTO_EVENT, onOpen);
    return () => window.removeEventListener(MANIFESTO_EVENT, onOpen);
  }, []);

  // First visit: wait for the intro splash, then the devlog, then rise.
  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      /* can't tell: don't open uninvited */
    }
    if (seen) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const unbinds: (() => void)[] = [];
    const show = () => {
      if (cancelled) return;
      setOpen(true);
      markSeen();
    };
    const after = (event: string, then: () => void) => {
      const on = () => then();
      window.addEventListener(event, on, { once: true });
      unbinds.push(() => window.removeEventListener(event, on));
    };
    const afterDevlog = () => {
      if (devlogWillOpen()) after(DEVLOG_CLOSED_EVENT, () => timers.push(setTimeout(show, 600)));
      else timers.push(setTimeout(show, 700));
    };
    // One tick, so the splash and the devlog have claimed the screen first.
    timers.push(
      setTimeout(() => {
        if (isIntroActive()) after(INTRO_DONE_EVENT, () => timers.push(setTimeout(afterDevlog, 450)));
        else afterDevlog();
      }, 250),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      unbinds.forEach((u) => u());
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 50);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open, close]);

  const dur = (s: number) => (reduce ? 0.2 : s);

  return (
    <AnimatePresence>
      {open && (
        <div key="manifesto" className="fixed inset-0 z-[210]" role="dialog" aria-modal="true" aria-labelledby="manifesto-title">
          {/* The room goes dark. */}
          <motion.div
            className="absolute inset-0 bg-[#040405]/[0.97]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: dur(0.9), ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: dur(0.9), ease: EASE, delay: reduce ? 0 : 0.35 } }}
            onClick={close}
          />
          {/* Footlights: a warm white wash along the bottom of the screen. */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[60vh]"
            style={{
              background:
                'linear-gradient(to top, rgba(255,240,222,0.14), transparent 16%), radial-gradient(75% 60% at 50% 100%, rgba(255,236,214,0.30) 0%, rgba(255,220,182,0.10) 42%, transparent 74%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: dur(1.6), ease: EASE, delay: reduce ? 0 : 0.5 } }}
            exit={{ opacity: 0, transition: { duration: dur(0.7), ease: EASE } }}
          />

          <div className="pointer-events-none absolute inset-0 flex items-end justify-center px-4 pb-4 pt-10 sm:items-center sm:pb-10">
            {/* The paper rises into the light. */}
            <motion.article
              className="pointer-events-auto relative flex max-h-[86vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[6px]"
              style={{
                backgroundColor: '#1b1916',
                backgroundImage: `linear-gradient(to top, rgba(255,226,186,0.13), rgba(255,226,186,0.03) 28%, transparent 55%), ${GRAIN}`,
                boxShadow:
                  '0 40px 90px -30px rgba(0,0,0,0.9), 0 18px 40px -18px rgba(255,214,170,0.22), inset 0 -1px 0 rgba(255,228,196,0.18)',
              }}
              initial={{ opacity: 0, y: reduce ? 0 : 56 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur(1.15), ease: EASE, delay: reduce ? 0 : 0.6 } }}
              exit={{ opacity: 0, y: reduce ? 0 : 24, transition: { duration: dur(0.45), ease: EASE } }}
            >
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close the manifesto"
                className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-[#bfb6a7]/70 outline-none transition-colors hover:bg-white/5 hover:text-[#e6ded1] focus-visible:ring-1 focus-visible:ring-[#e6ded1]/40"
              >
                <IconX className="h-4 w-4" />
              </button>

              <div
                className="overflow-y-auto px-6 pb-8 pt-9 font-poppins text-[15px] font-semibold leading-[1.8] sm:px-11 sm:pb-11 sm:pt-12"
                style={{ color: INK_SOFT }}
              >
                <p className="text-[10.5px] uppercase tracking-[0.32em]" style={{ color: ORANGE }}>
                  The Good Accounting Manifesto
                </p>
                <h2 id="manifesto-title" className="mt-3 text-[27px] leading-[1.2] sm:text-[33px]" style={{ color: INK }}>
                  Set it and forget it.
                  <br />
                  We meant it.
                </h2>

                <div className="mt-7 space-y-5">
                  <p>
                    HEX made a promise: stake, walk away, come back richer.
                    <br />
                    Then it hid a clock in the fine print.
                  </p>
                  <p>
                    Miss your end date by two weeks and your stake starts to bleed, 1/700th a day, every day,
                    until nothing is left. Not because you did anything wrong. Because you had a life.
                  </p>
                  <p>
                    People lose jobs. Have kids. Get sick. Lose passwords. Step away, and come back. That
                    isn&apos;t a failure of the staker. It&apos;s being human. A good product doesn&apos;t punish you for it.
                  </p>

                  <Section title="Follow the penalty.">
                    Every HEX a late stake loses is split down the middle. Half is minted straight to the Origin
                    Address. The other half goes to &ldquo;the stakers,&rdquo; shared out by size, so the biggest
                    wallets take the biggest cut. Your bad week was never spread across the community. It was
                    funneled to the top.
                  </Section>

                  <Section title="So we turned off the clock.">
                    Anyone can call good accounting on anyone&apos;s stake. It locks the penalty where it stands,
                    for good. Nothing taken. Nothing moved. The HEX stays the owner&apos;s, waiting for them. So we
                    did it, for strangers, every hour.
                  </Section>
                </div>

                <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[#e6ded1]/10 py-6 sm:grid-cols-3">
                  <Fig k="stakes frozen" v={figures.rescues.toLocaleString('en-US')} />
                  <Fig k="wallets" v={figures.wallets.toLocaleString('en-US')} />
                  <Fig k="HEX kept whole" v={big(figures.keptHex)} />
                  <Fig k="HEX a day of bleeding stopped" v={big(figures.bleedStoppedPerDay)} />
                  <Fig k="PLS in gas, paid by us" v={big(figures.gasPls)} />
                </dl>

                <div className="mt-8 space-y-5">
                  <p style={{ color: INK }}>
                    Which is worth more: an Origin Address that keeps getting bigger, or{' '}
                    {figures.wallets.toLocaleString('en-US')} wallets that still have HEX in them?
                  </p>
                  <Section title="One day.">
                    One day the market turns. Someone thinks, &ldquo;Didn&apos;t I have a HEX stake?&rdquo; They
                    check, bracing for zero. It&apos;s still there. Five thousand HEX or five million. And next to it,
                    two words: <span style={{ color: INK }}>good accounted.</span>
                  </Section>
                  <p>
                    That&apos;s what this community is supposed to be. Not a trap for the distracted. People looking
                    out for people they&apos;ve never met.
                  </p>
                  <p className="text-[18px] leading-[1.55]" style={{ color: INK }}>
                    You don&apos;t have to watch the clock anymore. We are.
                    <br />
                    That&apos;s what a real Hexican does.
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-[12px] tracking-wide" style={{ color: INK_SOFT }}>
                    Morbius <span className="text-[#bfb6a7]/50">×</span> SuperStake
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-full border border-[#e6ded1]/20 px-5 py-2 text-[13px] transition-colors hover:border-[#ff9e00]/60 hover:text-[#e6ded1]"
                  >
                    See the Rescue Wall
                  </button>
                </div>
                <p className="mt-6 text-[11px] font-medium leading-relaxed text-[#bfb6a7]/55">
                  Stakes of 10K–25M HEX are covered. The keeper runs for as long as it has fuel. Figures are live
                  from the chain; {big(figures.originHex)} HEX of the penalties these freezes settled went to the
                  Origin Address.
                </p>
              </div>
            </motion.article>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[16.5px]" style={{ color: INK }}>
        {title}
      </h3>
      <p className="mt-1.5">{children}</p>
    </div>
  );
}

function Fig({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase leading-snug tracking-[0.14em] text-[#bfb6a7]/70">{k}</dt>
      <dd className="mt-1 text-[22px] leading-none" style={{ color: INK }}>
        {v}
      </dd>
    </div>
  );
}

/** A quiet link that reopens the manifesto after its first showing. */
export function ManifestoLink({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openManifesto}
      className={`font-poppins text-[12.5px] font-semibold text-white/60 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-[#ff9e00] ${className}`}
    >
      Why we do this →
    </button>
  );
}
