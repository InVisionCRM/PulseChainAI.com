'use client';

// Effects and motion — the surface treatments.
//
// All CSS: transitions, keyframes from globals.css, and Tailwind utilities.
// No animation library, so none of this costs a bundle and all of it composes
// with whatever it wraps.
//
// Everything here honours `prefers-reduced-motion` through Tailwind's
// `motion-reduce:` variant rather than a JS check, so it degrades even before
// hydration.

import { useEffect, useRef, useState } from 'react';

/** Fires once on first sight. Shared by the reveal components below. */
function useSeen<T extends HTMLElement>(threshold = 0.15) {
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
      { threshold },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/** Slides and fades in when scrolled to. The workhorse of the set. */
export function Reveal({
  children,
  from = 'up',
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  from?: 'up' | 'down' | 'left' | 'right' | 'none';
  delay?: number;
  className?: string;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const offset = {
    up: 'translate-y-4',
    down: '-translate-y-4',
    left: 'translate-x-4',
    right: '-translate-x-4',
    none: '',
  }[from];

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        seen ? 'translate-x-0 translate-y-0 opacity-100' : `${offset} opacity-0`
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** Reveals its children one after another. Pass the stagger in ms. */
export function Stagger({
  children,
  step = 90,
  from = 'up',
  className = '',
}: {
  children: React.ReactNode;
  step?: number;
  from?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className={className}>
      {items.map((child, i) => (
        <Reveal key={i} from={from} delay={i * step}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}

/**
 * Gradient border. A brand-ramp ring that doesn't bleed into the fill —
 * the outer element carries the gradient, the inner one covers all but a
 * hairline of it.
 */
export function GradientBorder({
  children,
  className = '',
  radius = 'rounded-2xl',
  animate = false,
}: {
  children: React.ReactNode;
  className?: string;
  radius?: string;
  /** Rotates the ramp around the border. */
  animate?: boolean;
}) {
  return (
    <div
      className={`${radius} p-[1.5px] ${animate ? 'animate-[lab-hue_6s_linear_infinite] motion-reduce:animate-none' : ''}`}
      style={{
        background: 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)',
      }}
    >
      <div className={`${radius} h-full w-full bg-[var(--panel)] ${className}`}>{children}</div>
    </div>
  );
}

/** A card that lifts and glows on hover. Restrained on purpose — one step. */
export function GlowCard({
  children,
  className = '',
  glow = '#D83639',
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <div
      className={`group relative rounded-2xl border border-[var(--line)] bg-[var(--panel)] transition-all duration-300 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 ${className}`}
      style={{ ['--lab-glow' as string]: glow }}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ boxShadow: `0 0 28px -6px ${glow}` }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * Spotlight — a soft light follows the cursor across the card. Pure CSS custom
 * properties driven by one mousemove handler; no re-render per frame.
 */
export function Spotlight({
  children,
  className = '',
  color = 'rgba(216,54,57,0.16)',
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--x', `${e.clientX - r.left}px`);
        el.style.setProperty('--y', `${e.clientY - r.top}px`);
      }}
      className={`group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(220px circle at var(--x, 50%) var(--y, 50%), ${color}, transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Brand-gradient text. Optionally animates the ramp across the glyphs. */
export function GradientText({
  children,
  className = '',
  animate = false,
}: {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}) {
  return (
    <span
      className={`bg-clip-text text-transparent ${animate ? 'animate-[lab-pan_5s_linear_infinite] motion-reduce:animate-none' : ''} ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438,#7E089D)',
        backgroundSize: animate ? '250% 100%' : '100% 100%',
      }}
    >
      {children}
    </span>
  );
}

/** Aurora — a slow drifting wash for a hero background. Sits behind content. */
export function Aurora({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div
        className="absolute -top-1/2 left-[10%] aspect-square w-2/3 rounded-full opacity-[0.22] blur-3xl animate-[lab-drift_18s_ease-in-out_infinite] motion-reduce:animate-none"
        style={{ background: 'radial-gradient(circle,#7E089D,transparent 60%)' }}
      />
      <div
        className="absolute -bottom-1/2 right-[5%] aspect-square w-1/2 rounded-full opacity-[0.18] blur-3xl animate-[lab-drift_22s_ease-in-out_infinite_reverse] motion-reduce:animate-none"
        style={{ background: 'radial-gradient(circle,#FB9438,transparent 60%)' }}
      />
    </div>
  );
}

/** Shimmer skeleton. Use while real content loads — never as filler. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-[var(--surface-2)] ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0 -translate-x-full animate-[lab-sheen_1.6s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent motion-reduce:animate-none" />
    </div>
  );
}

/** A pulsing ring — draws the eye to a live or urgent thing. */
export function PulseDot({
  color = '#4ade80',
  size = 8,
  className = '',
}: {
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex ${className}`} style={{ width: size, height: size }}>
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none"
        style={{ background: color }}
      />
      <span className="relative inline-flex h-full w-full rounded-full" style={{ background: color }} />
    </span>
  );
}

/** Flips between two faces on hover. Good for a stat that has a "why". */
export function FlipCard({
  front,
  back,
  className = '',
  height = 150,
}: {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <div className={`group [perspective:1200px] ${className}`} style={{ height }}>
      <div className="relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] motion-reduce:transition-none">
        <div className="absolute inset-0 grid place-items-center rounded-2xl border border-[var(--line)] bg-[var(--panel)] [backface-visibility:hidden]">
          {front}
        </div>
        <div className="absolute inset-0 grid place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] [transform:rotateY(180deg)] [backface-visibility:hidden]">
          {back}
        </div>
      </div>
    </div>
  );
}
