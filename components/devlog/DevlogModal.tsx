"use client";

// The devlog modal — "what changed while you were away", ranked biggest-first.
//
// Shape follows the changelogs that do this well (Linear, Raycast): one entry
// per change, a screenshot for the big ones and text alone for the small ones,
// so the visual weight of the page matches the actual weight of the work. The
// skin is ours: hex rank badges, an impact meter, mono labels.
//
// Mounted once in the root layout and opened by a window event, so any nav —
// desktop sidebar, mobile More drawer — can raise it without prop-drilling a
// setState through the tree. Same pattern the Sleuth chat uses for `sleuth-ask`.

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { IconX, IconArrowRight } from '@tabler/icons-react';
import { INTRO_DONE_EVENT, isIntroActive } from '@/components/IntroSplash';
import {
  DEVLOG_ENTRIES,
  DEVLOG_PERIOD,
  DEVLOG_TOTALS,
  DEVLOG_VERSION,
  type DevlogEntry,
  type DevlogKind,
} from './entries';

export const DEVLOG_EVENT = 'open-devlog';
const SEEN_KEY = 'morbius-devlog-seen';
/** Breathing room after the splash clears before the devlog slides in. */
const AFTER_INTRO_MS = 450;
/** Same, when there was no splash to wait for. */
const COLD_OPEN_MS = 900;
/**
 * If the splash claims the screen but never announces it's done (torn down
 * mid-fade, a stray error), don't sit on the devlog forever. Comfortably past
 * the splash's own 6s cap plus its fade.
 */
const INTRO_WAIT_CEILING_MS = 9000;

/** Mark the current devlog as read and let the nav dots know. */
function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, DEVLOG_VERSION);
    window.dispatchEvent(new Event('devlog-seen'));
  } catch {
    /* private mode — the dot just stays, which is harmless */
  }
}

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === DEVLOG_VERSION;
  } catch {
    // Can't tell, so don't pop up uninvited.
    return true;
  }
}

/** Raise the devlog from anywhere (nav tiles, sidebar, a link). */
export function openDevlog() {
  window.dispatchEvent(new CustomEvent(DEVLOG_EVENT));
}

/**
 * True when this visitor hasn't opened the current devlog yet. Starts false so
 * the server-rendered markup and the first client paint agree — the dot fades
 * in a tick later rather than hydrating mismatched.
 */
export function useDevlogUnseen(): boolean {
  const [unseen, setUnseen] = useState(false);
  useEffect(() => {
    const sync = () => {
      try {
        setUnseen(localStorage.getItem(SEEN_KEY) !== DEVLOG_VERSION);
      } catch {
        setUnseen(false);
      }
    };
    sync();
    window.addEventListener('devlog-seen', sync);
    return () => window.removeEventListener('devlog-seen', sync);
  }, []);
  return unseen;
}

const KIND_STYLE: Record<DevlogKind, { label: string; chip: string; rail: string; meter: string }> = {
  new: {
    label: 'NEW',
    chip: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
    rail: 'bg-emerald-400/70',
    meter: 'bg-emerald-400',
  },
  upgrade: {
    label: 'UPGRADE',
    chip: 'border-orange-400/40 bg-orange-400/10 text-orange-300',
    rail: 'bg-orange-400/70',
    meter: 'bg-orange-400',
  },
  fix: {
    label: 'FIX',
    chip: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
    rail: 'bg-sky-400/70',
    meter: 'bg-sky-400',
  },
};

/** Five blocks, filled to the entry's weight. */
function ImpactMeter({ impact, kind }: { impact: number; kind: DevlogKind }) {
  return (
    <span className="flex items-center gap-[3px]" aria-label={`Impact ${impact} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`h-1.5 w-2 rounded-[1px] ${n <= impact ? KIND_STYLE[kind].meter : 'bg-[var(--line-strong)]'}`}
        />
      ))}
    </span>
  );
}

function EntryCard({ entry, rank }: { entry: DevlogEntry; rank: number }) {
  const style = KIND_STYLE[entry.kind];
  return (
    <article className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      {/* Accent rail, coloured by what kind of change this is. */}
      <span className={`absolute inset-y-0 left-0 w-[3px] ${style.rail}`} aria-hidden />

      <div className="p-4 pl-5 sm:p-5 sm:pl-6">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Rank badge — the ordering is the point of this list, so it gets
              its own object rather than living in the title string. */}
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--line-strong)] bg-[var(--surface-2)] font-mono text-sm font-bold text-[var(--text)]"
            aria-hidden
          >
            {String(rank).padStart(2, '0')}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`rounded border px-1.5 py-px font-mono text-[10px] font-semibold tracking-wider ${style.chip}`}>
                {style.label}
              </span>
              <ImpactMeter impact={entry.impact} kind={entry.kind} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                {entry.when}
                {entry.prs ? ` · ${entry.prs} PRs` : ''}
              </span>
            </div>

            <h3 className="mt-1.5 text-base font-semibold leading-tight text-[var(--text)] sm:text-lg">
              {entry.title}
            </h3>
            <p className="text-[13px] italic leading-snug text-[var(--text-faint)]">{entry.kicker}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">{entry.body}</p>

            {entry.href && (
              <a
                href={entry.href}
                className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-orange-400 transition-colors hover:text-orange-300"
              >
                Take a look <IconArrowRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Majors carry a capture of the real thing; minors stay text-only, so
            the page's visual weight tracks the actual weight of the change. */}
        {entry.image && (
          <div className="mt-3.5 flex justify-center overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-1">
            {/* `contain`, not `cover`: these are screenshots, and cropping one
                to fill a box cuts off the very thing the entry is pointing at.
                Portrait panels letterbox instead, which is the honest trade. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.image}
              alt={entry.imageAlt || entry.title}
              loading="lazy"
              decoding="async"
              className="max-h-[400px] w-auto max-w-full rounded object-contain"
            />
          </div>
        )}
      </div>
    </article>
  );
}

export default function DevlogModal() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      // Opening is what counts as reading it; clear the dot immediately so the
      // nav stops nagging even if they close it a second later.
      markSeen();
    };
    window.addEventListener(DEVLOG_EVENT, onOpen);
    return () => window.removeEventListener(DEVLOG_EVENT, onOpen);
  }, []);

  /**
   * Pop up by itself on a cold open, once per DEVLOG_VERSION — a returning
   * visitor should be told what changed without having to go looking for it.
   *
   * The wait matters: the intro splash owns the screen for up to 6s on a fresh
   * session at z-100, and this modal is z-200, so opening straight away would
   * drop the devlog on top of the splash. Ask the splash whether it's up, and
   * if it is, go after it finishes.
   */
  useEffect(() => {
    if (alreadySeen()) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let unbind = () => {};

    const show = () => {
      if (cancelled) return;
      setOpen(true);
      markSeen();
    };

    // One tick before asking, so IntroSplash's own effect has certainly run and
    // staked its claim — that removes any dependency on sibling effect order.
    timers.push(
      setTimeout(() => {
        if (cancelled) return;

        if (!isIntroActive()) {
          timers.push(setTimeout(show, COLD_OPEN_MS));
          return;
        }

        const onIntroDone = () => {
          unbind();
          timers.push(setTimeout(show, AFTER_INTRO_MS));
        };
        window.addEventListener(INTRO_DONE_EVENT, onIntroDone);
        const ceiling = setTimeout(() => {
          unbind();
          show();
        }, INTRO_WAIT_CEILING_MS);
        timers.push(ceiling);
        unbind = () => {
          window.removeEventListener(INTRO_DONE_EVENT, onIntroDone);
          clearTimeout(ceiling);
        };
      }, 200),
    );

    return () => {
      cancelled = true;
      unbind();
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    // Lock the page behind the modal so a scroll gesture inside it can't leak
    // through to the page underneath.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Devlog — recent updates"
        >
          <motion.div
            className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--line-strong)] bg-[var(--panel)] shadow-2xl sm:max-h-[88vh] sm:max-w-3xl sm:rounded-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative shrink-0 overflow-hidden border-b border-[var(--line-strong)] bg-[var(--surface-2)] px-4 py-4 sm:px-6 sm:py-5">
              {/* Faint grid, purely decorative. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.14]"
                style={{
                  backgroundImage:
                    'linear-gradient(var(--line-strong) 1px, transparent 1px), linear-gradient(90deg, var(--line-strong) 1px, transparent 1px)',
                  backgroundSize: '22px 22px',
                }}
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-center font-mono text-xl font-bold tracking-[0.2em] text-[var(--text)] sm:text-2xl">
                    DEVLOG
                    <motion.span
                      className="ml-1 inline-block h-[0.95em] w-[0.5em] bg-orange-500"
                      animate={{ opacity: [1, 1, 0, 0] }}
                      transition={{ duration: 1.1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
                      aria-hidden
                    />
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {DEVLOG_PERIOD} · biggest first
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                    <span>
                      <span className="text-orange-400">{DEVLOG_TOTALS.prs}</span> pull requests
                    </span>
                    <span>
                      <span className="text-orange-400">{DEVLOG_TOTALS.commits}</span> commits
                    </span>
                    <span>
                      <span className="text-orange-400">{DEVLOG_ENTRIES.length}</span> things worth telling you about
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close the devlog"
                  className="shrink-0 rounded-lg border border-[var(--line)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Entries */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-5">
              {DEVLOG_ENTRIES.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  // Only the first screenful is worth staggering; past that it
                  // just delays content the reader is already scrolling toward.
                  transition={{ delay: Math.min(i, 6) * 0.045, duration: 0.25 }}
                >
                  <EntryCard entry={entry} rank={i + 1} />
                </motion.div>
              ))}

              <p className="px-1 pb-1 pt-2 text-center text-[11px] leading-relaxed text-[var(--text-faint)]">
                Every screenshot above is the real app reading live PulseChain data.
                <br />
                This only pops up once — reopen it any time from{' '}
                <span className="text-[var(--text-muted)]">What&apos;s New</span> in the menu.
                <br className="hidden sm:block" /> scan.Morbius.io
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
