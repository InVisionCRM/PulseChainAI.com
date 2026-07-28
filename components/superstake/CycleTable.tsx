'use client';

// Every finished cycle, scored on the same $100 question as the projection
// above it. Each row expands into what the machine did that cycle and what
// each side of the bet actually bought — the figures that explain the result
// rather than just stating it.

import { useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import { dayToISO, type CycleResult, type SuperStakeCycle } from '@/lib/superstake/model';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';

/** The contract that holds the stake — the same address the cycles route reads. */
const STAKER = '0xdc48205df8af83c97de572241bb92db45402aa0e';
const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';

export interface CycleRow {
  cycle: SuperStakeCycle;
  result: CycleResult;
}

const n0 = (v: number) => Math.round(v).toLocaleString();
const usd = (v: number, dp = 5) => (v > 0 ? `$${v.toFixed(dp)}` : '—');
const usdShort = (v: number) =>
  !Number.isFinite(v)
    ? '—'
    : v >= 1e6
      ? `$${(v / 1e6).toFixed(2)}M`
      : v >= 1e3
        ? `$${(v / 1e3).toFixed(1)}k`
        : `$${v.toFixed(2)}`;

export default function CycleTable({
  rows, coverage, amount, psshWins, running, daysLeft,
}: {
  rows: CycleRow[];
  /** Cycle number -> how many times over that cycle covered its own 1% payout. */
  coverage: Map<number, number>;
  amount: number;
  psshWins: number;
  /** The cycle currently open, if any — listed but not scored. */
  running?: SuperStakeCycle | null;
  daysLeft?: number;
}) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <h3 className="text-sm font-bold tracking-tight text-[var(--text)]">
          Every finished cycle, same ${amount}, same question
        </h3>
        <span className="text-xs text-[var(--text-faint)]">
          pSSH ahead in{' '}
          <b className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>
            {psshWins}
          </b>{' '}
          of {rows.length} · tap a row for the detail
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[660px] text-sm">
          <thead>
            <tr
              className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--text-faint)]"
              style={{ fontFamily: MONO }}
            >
              <th className="px-4 py-2 text-left font-medium">Cycle</th>
              <th className="px-3 py-2 text-left font-medium">Opened</th>
              <th className="px-3 py-2 text-right font-medium">pHEX</th>
              <th className="px-3 py-2 text-right font-medium">Volume</th>
              <th className="px-3 py-2 text-right font-medium">Stake</th>
              <th className="px-3 py-2 text-right font-medium">pSSH</th>
              <th className="px-3 py-2 text-right font-medium">Winner</th>
              <th className="w-8 px-2 py-2" aria-label="expand" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cycle, result }) => {
              const won = result.winner === 'pssh';
              const isOpen = open === cycle.i;
              const toggle = () => setOpen(isOpen ? null : cycle.i);
              return (
                <CycleRowPair
                  key={cycle.i}
                  cycle={cycle}
                  result={result}
                  won={won}
                  isOpen={isOpen}
                  toggle={toggle}
                  cover={coverage.get(cycle.i) ?? null}
                />
              );
            })}

            {/* The open cycle, listed so it never looks like a row is missing.
                It can't be scored — it hasn't paid out yet. */}
            {running && !running.done && (
              <tr className="border-t border-[var(--line)] bg-[var(--app-bg)]/40">
                <td className="px-4 py-2 tabular-nums text-[var(--text-muted)]">#{running.i}</td>
                <td className="px-3 py-2 tabular-nums text-[var(--text-muted)]">
                  {dayToISO(running.d0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--text-faint)]">
                  {usd(running.pH0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--text-faint)]">
                  {usdShort(running.vol)}
                </td>
                <td className="px-3 py-2 text-right text-[var(--text-faint)]">—</td>
                <td className="px-3 py-2 text-right text-[var(--text-faint)]">—</td>
                <td
                  className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]"
                  style={{ fontFamily: MONO }}
                  colSpan={2}
                >
                  running{typeof daysLeft === 'number' ? ` · ${daysLeft}d left` : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CycleRowPair({
  cycle, result, won, isOpen, toggle, cover,
}: {
  cycle: SuperStakeCycle;
  result: CycleResult;
  won: boolean;
  isOpen: boolean;
  toggle: () => void;
  cover: number | null;
}) {
  return (
    <>
      <tr
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        className={`cursor-pointer border-t border-[var(--line)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500/60 ${
          isOpen ? 'bg-[var(--surface)]' : 'hover:bg-[var(--surface)]'
        }`}
      >
        <td className="px-4 py-2 tabular-nums text-[var(--text-muted)]">#{cycle.i}</td>
        <td className="px-3 py-2 tabular-nums text-[var(--text-muted)]">{dayToISO(cycle.d0)}</td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-faint)]">
          {usd(cycle.pH0)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-faint)]">
          {usdShort(cycle.vol)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
          {n0(result.stakeYield)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
          {n0(result.psshYield)}
        </td>
        <td className="px-3 py-2 text-right">
          <span
            className={`text-xs font-bold ${won ? '' : 'text-[var(--text-muted)]'}`}
            style={
              won
                ? { backgroundImage: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
                : undefined
            }
          >
            {won ? 'pSSH' : 'stake'} {result.ratio.toFixed(2)}×
          </span>
        </td>
        <td className="px-2 py-2 text-right">
          <IconChevronDown
            className={`inline h-3.5 w-3.5 text-[var(--text-faint)] transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </td>
      </tr>

      {isOpen && (
        <tr className="border-t border-[var(--line)] bg-[var(--app-bg)]">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Block title={`What cycle ${cycle.i} did`}>
                <Item
                  k="Ran"
                  v={`${dayToISO(cycle.d0)} → ${dayToISO(cycle.d1)}`}
                  sub={`${cycle.d1 - cycle.d0} days`}
                />
                <Item k="HEX in the stake" v={`${n0(cycle.hex)} HEX`} />
                <Item k="T-shares" v={cycle.tsh.toFixed(2)} />
                <Item k="Native yield earned" v={`${n0(cycle.nY)} HEX`} />
                <Item k="Paid to holders" v={`${n0(cycle.pay)} HEX`} sub="1% of principal + yield" />
                <Item k="pSSH volume" v={usdShort(cycle.vol)} />
                {cover != null && (
                  <Item
                    k="Covered its own payout"
                    v={`${cover.toFixed(2)}×`}
                    good={cover >= 1}
                  />
                )}
              </Block>

              <Block title="If you staked the HEX">
                <Item k="Bought at" v={usd(result.pHex, 6)} />
                <Item k="HEX staked" v={n0(result.hexAmount)} />
                <Item k="T-shares earned" v={result.tShares.toFixed(3)} />
                <Item
                  k="Longer-pays-better"
                  v={`+${((result.lpbMultiplier - 1) * 100).toFixed(1)}%`}
                />
                <Item k="Earned" v={`${n0(result.stakeYield)} HEX`} strong />
              </Block>

              <Block title="If you held the pSSH" accent>
                <Item k="Bought at" v={usd(result.pSsh, 6)} sub="after the 5.5% tax" />
                <Item k="pSSH held" v={n0(result.psshAmount)} />
                <Item k="Share of supply" v={`${(result.supplyShare * 100).toFixed(4)}%`} />
                <Item k="End-stake payout" v={`${n0(result.payouts)} HEX`} />
                <Item k="Reflections" v={`${n0(result.reflections)} HEX`} sub="2.5% of volume" />
                <Item k="Earned" v={`${n0(result.psshYield)} HEX`} strong accent />
              </Block>
            </div>

            <a
              href={pulsechainAddressUrl(STAKER)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-3 inline-block text-[10.5px] text-[var(--text-faint)] underline-offset-2 transition-colors hover:text-[var(--text-muted)] hover:underline"
              style={{ fontFamily: MONO }}
            >
              HEX STAKE #{cycle.id} · VIEW THE STAKING CONTRACT
            </a>
          </td>
        </tr>
      )}
    </>
  );
}

function Block({
  title, accent, children,
}: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <div
        className="text-[9.5px] uppercase tracking-[0.13em]"
        style={
          accent
            ? { backgroundImage: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', fontFamily: MONO }
            : { color: 'var(--text-faint)', fontFamily: MONO }
        }
      >
        {title}
      </div>
      <dl className="mt-2 grid gap-1.5">{children}</dl>
    </div>
  );
}

function Item({
  k, v, sub, strong, accent, good,
}: {
  k: string; v: string; sub?: string; strong?: boolean; accent?: boolean; good?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[var(--line)] pt-1.5 first:border-t-0 first:pt-0">
      <dt className="text-[11.5px] leading-snug text-[var(--text-muted)]">
        {k}
        {sub && <span className="block text-[10px] text-[var(--text-faint)]">{sub}</span>}
      </dt>
      <dd
        className={`shrink-0 text-right tabular-nums ${
          strong ? 'text-[15px] font-bold' : 'text-[12.5px] font-semibold'
        }`}
        style={
          accent && strong
            ? { backgroundImage: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
            : good
              ? { color: 'var(--up)' }
              : { color: 'var(--text)' }
        }
      >
        {v}
      </dd>
    </div>
  );
}
