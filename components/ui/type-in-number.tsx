'use client';

// A slider's read-out that turns into a text box when clicked, so the value can
// be typed as well as dragged. Enter or leaving the box commits; Escape keeps
// the old value. What's typed is clamped to the slider's own range and snapped
// to its step, so a typed value is always one the slider could have reached.
// "$12,500", "12.5k", "1.2m" and "-5%" all read as numbers; anything else that
// isn't a plain number leaves the value as it was rather than being guessed at.

import { useState } from 'react';

/** The number typed — `$`, commas, spaces and `%` aside, with an optional k/m — or null. */
export function parseTyped(text: string): number | null {
  const m = text.toLowerCase().replace(/[$,%\s]/g, '').match(/^(-?(?:\d+\.?\d*|\.\d+))([km])?$/);
  if (!m) return null;
  return Number(m[1]) * (m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1);
}

const decimalsOf = (step: number) => (String(step).split('.')[1] ?? '').length;

function snap(n: number, min: number, max: number, step: number): number {
  const stepped = Number((min + Math.round((n - min) / step) * step).toFixed(decimalsOf(step)));
  return Math.min(max, Math.max(min, stepped));
}

export function TypeInNumber({
  value, display, min, max, step, onChange, label, className, inputClassName,
}: {
  value: number;
  /** The read-out as it shows when not being edited. */
  display: React.ReactNode;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  /** What the value is, for screen readers. */
  label: string;
  /** Type styles, shared by the read-out and the box so editing doesn't jump. */
  className?: string;
  /** The box's own border and fill. */
  inputClassName?: string;
}) {
  // The text being typed, and what the box opened with — null while closed.
  const [draft, setDraft] = useState<{ text: string; opened: string } | null>(null);

  const open = () => {
    const text = String(Number(value.toFixed(decimalsOf(step))));
    setDraft({ text, opened: text });
  };
  const commit = () => {
    if (!draft) return;
    setDraft(null);
    // Opening and leaving unchanged must not round the value to the step.
    if (draft.text === draft.opened) return;
    const n = parseTyped(draft.text);
    if (n !== null) onChange(snap(n, min, max, step));
  };

  if (draft) {
    return (
      <input
        autoFocus
        value={draft.text}
        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') setDraft(null);
        }}
        inputMode="decimal"
        aria-label={`${label} value`}
        size={Math.max(4, draft.text.length + 1)}
        className={`${className ?? ''} ${inputClassName ?? ''} min-w-0 text-right outline-none`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      title="Click to type a value"
      aria-label={`${label}: click to type a value`}
      className={`${className ?? ''} cursor-text underline decoration-[var(--text-faint)] decoration-dotted decoration-1 underline-offset-4`}
    >
      {display}
    </button>
  );
}
