'use client';

// The controls behind the share picker's "Build" tab.
//
// Pick up to nine figures and they lay themselves out — the count decides the
// grid, and the first pick can take the headline. Deliberately no free-form
// dragging: these get read at thumbnail size in a feed, and an auto-layout is
// the difference between "every combination looks designed" and "some of them
// are unreadable".

import { IconGripVertical, IconX } from '@tabler/icons-react';
import {
  MAX_METRICS, type AccentName, type CustomSpec,
} from '@/lib/geicko/shareCard';
import { METRIC_BY_ID, METRIC_GROUPS, metricsForChain, type MetricDef } from '@/lib/geicko/metrics';
import type { ChainKey } from '@/lib/geicko/shareCard';
import { SHARE_GRAD } from './ShareCardModal';

export interface CardBuilderProps {
  chain: ChainKey;
  spec: CustomSpec;
  onChange: (next: CustomSpec) => void;
}

const chip =
  'rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40';
const off = 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface)]';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[68px] shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-faint)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Choice<T extends string>({
  value, options, onPick,
}: { value: T; options: { key: T; label: string }[]; onPick: (v: T) => void }) {
  return (
    <>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(o.key)}
            aria-pressed={on}
            className={`${chip} ${on ? 'border-transparent text-white' : off}`}
            style={on ? { background: SHARE_GRAD } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </>
  );
}

export default function CardBuilder({ chain, spec, onChange }: CardBuilderProps) {
  const available = metricsForChain(chain);
  const picked = spec.metrics;
  const full = picked.length >= MAX_METRICS;
  const set = (patch: Partial<CustomSpec>) => onChange({ ...spec, ...patch });

  const toggle = (m: MetricDef) => {
    if (picked.includes(m.id)) set({ metrics: picked.filter((x) => x !== m.id) });
    else if (!full) set({ metrics: [...picked, m.id] });
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= picked.length) return;
    const next = [...picked];
    [next[i], next[j]] = [next[j], next[i]];
    set({ metrics: next });
  };

  return (
    <div className="space-y-3">
      {/* what's on the card, in order */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-faint)]">
            On the card · {picked.length}/{MAX_METRICS}
          </span>
          {picked.length > 0 && (
            <button
              type="button"
              onClick={() => set({ metrics: [] })}
              className="text-[11px] font-semibold text-[var(--text-faint)] hover:text-[var(--text)]"
            >
              Clear
            </button>
          )}
        </div>
        {picked.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--line)] px-3 py-4 text-center text-[11px] text-[var(--text-faint)]">
            Pick a figure below. The first one becomes the headline.
          </p>
        ) : (
          <ul className="space-y-1">
            {picked.map((id, i) => {
              const m = METRIC_BY_ID.get(id);
              if (!m) return null;
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5"
                >
                  <IconGripVertical className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--text)]">
                    {i === 0 && spec.hero && (
                      <span className="mr-1.5 rounded bg-[var(--surface-2)] px-1 py-0.5 text-[9px] uppercase tracking-wider text-[var(--text-faint)]">
                        headline
                      </span>
                    )}
                    {m.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${m.label} up`}
                    className="px-1 text-[13px] leading-none text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === picked.length - 1}
                    aria-label={`Move ${m.label} down`}
                    className="px-1 text-[13px] leading-none text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(m)}
                    aria-label={`Remove ${m.label}`}
                    className="rounded p-0.5 text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* the catalogue */}
      <div className="max-h-[26vh] space-y-2 overflow-y-auto overscroll-contain md:max-h-[24vh]">
        {METRIC_GROUPS.map((g) => {
          const items = available.filter((m) => m.group === g.key);
          if (!items.length) return null;
          return (
            <div key={g.key}>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-faint)]">
                {g.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((m) => {
                  const on = picked.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(m)}
                      disabled={!on && full}
                      aria-pressed={on}
                      className={`${chip} ${on ? 'border-transparent text-white' : off}`}
                      style={on ? { background: SHARE_GRAD } : undefined}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* style */}
      <div className="space-y-2 border-t border-[var(--line)] pt-3">
        <Row label="Theme">
          <Choice
            value={spec.palette}
            onPick={(palette) => set({ palette })}
            options={[
              { key: 'midnight' as const, label: 'Midnight' },
              { key: 'carbon' as const, label: 'Carbon' },
              { key: 'paper' as const, label: 'Paper' },
              { key: 'wash' as const, label: 'Wash' },
            ]}
          />
        </Row>
        <Row label="Accent">
          <Choice
            value={spec.accent}
            onPick={(accent: AccentName) => set({ accent })}
            options={[
              { key: 'brand' as const, label: 'Brand' },
              { key: 'amber' as const, label: 'Amber' },
              { key: 'magenta' as const, label: 'Magenta' },
              { key: 'green' as const, label: 'Green' },
              { key: 'mono' as const, label: 'Mono' },
            ]}
          />
        </Row>
        <Row label="Logo">
          <Choice
            value={spec.logo}
            onPick={(logo) => set({ logo })}
            options={[
              { key: 'round' as const, label: 'Round' },
              { key: 'square' as const, label: 'Square' },
              { key: 'ring' as const, label: 'Ring' },
              { key: 'plain' as const, label: 'Plain' },
              { key: 'none' as const, label: 'None' },
            ]}
          />
        </Row>
        <Row label="Banner">
          <Choice
            value={spec.header}
            onPick={(header) => set({ header })}
            options={[
              { key: 'off' as const, label: 'Off' },
              { key: 'band' as const, label: 'Top band' },
              { key: 'full' as const, label: 'Full bleed' },
            ]}
          />
        </Row>
        <Row label="Tiles">
          <Choice
            value={spec.tiles}
            onPick={(tiles) => set({ tiles })}
            options={[
              { key: 'panel' as const, label: 'Panels' },
              { key: 'bare' as const, label: 'Bare' },
            ]}
          />
        </Row>
        <Row label="Chart">
          <Choice
            value={spec.chart}
            onPick={(chart) => set({ chart })}
            options={[
              { key: 'none' as const, label: 'None' },
              { key: 'volume' as const, label: 'Volume' },
              { key: 'price' as const, label: 'Price' },
            ]}
          />
        </Row>
        <Row label="Headline">
          <Choice
            value={spec.hero ? 'on' : 'off'}
            onPick={(v) => set({ hero: v === 'on' })}
            options={[
              { key: 'on' as const, label: 'Big first figure' },
              { key: 'off' as const, label: 'All tiles' },
            ]}
          />
        </Row>
        <div className="flex items-center gap-2">
          <span className="w-[68px] shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-faint)]">
            Caption
          </span>
          <input
            value={spec.caption}
            onChange={(e) => set({ caption: e.target.value.slice(0, 80) })}
            placeholder="Your own line — optional"
            maxLength={80}
            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--line-strong)]"
          />
        </div>
      </div>

      <p className="text-[10px] leading-snug text-[var(--text-faint)]">
        Saved on this device and reused for every token you open. Figures your
        chain can&apos;t answer aren&apos;t offered; anything still loading draws as
        &ldquo;—&rdquo; rather than a zero.
      </p>
    </div>
  );
}
