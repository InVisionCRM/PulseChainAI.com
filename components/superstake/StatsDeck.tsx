'use client';

// "All the numbers" — the button beside "Share a card", and the deck it opens.
//
// The page explains; this reports. A strip of today/7d/30d figures up top, then
// four views: HEX added to the stake day by day (the transfer record, checked
// against the chain before it is served), each cycle as a ledger, the market
// it runs on, and the HEX side. Everything comes from data the page already
// holds plus /api/superstake/inflows, which is fetched as soon as the page
// loads so the deck is usually ready by the time anyone opens it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChartBar, IconRefresh, IconX } from '@tabler/icons-react';
import type { SuperStakeSnapshot } from '@/lib/superstake/model';
import type { InflowsPayload } from '@/app/api/superstake/inflows/route';
import DailyPanel from './stats/DailyPanel';
import CyclePanel from './stats/CyclePanel';
import MarketPanel from './stats/MarketPanel';
import HexPanel from './stats/HexPanel';
import {
  GRAD, MONO, RangeTabs, SERIES, Tile, VIZ_VARS, ago, dayLong, hex, sameRestakes, usd, type RangeId,
} from './stats/shared';

const TABS = [
  { id: 'daily', label: 'HEX added daily', ranged: true },
  { id: 'cycles', label: 'Cycle by cycle', ranged: false },
  { id: 'market', label: 'Market', ranged: true },
  { id: 'hex', label: 'HEX side', ranged: false },
] as const;
type Tab = (typeof TABS)[number]['id'];

type Load =
  | { state: 'loading' }
  | { state: 'ok'; data: InflowsPayload }
  | { state: 'fail'; reason: string };

export interface StatsDeckProps {
  /** The page's cycle record — rebuilt live when `fresh`, the baked snapshot otherwise. */
  snap: SuperStakeSnapshot;
  fresh: boolean;
  globalTShares: number | null;
  pHex: number | null;
  pSsh: number | null;
}

export default function StatsDeck(props: StatsDeckProps) {
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const trigger = useRef<HTMLButtonElement | null>(null);

  const fetchInflows = useCallback(() => {
    setLoad({ state: 'loading' });
    fetch('/api/superstake/inflows')
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok || !body?.days) throw new Error(body?.error ?? `HTTP ${r.status}`);
        setLoad({ state: 'ok', data: body as InflowsPayload });
      })
      .catch((e: unknown) => setLoad({ state: 'fail', reason: e instanceof Error ? e.message : 'request failed' }));
  }, []);
  useEffect(fetchInflows, [fetchInflows]);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--text)] transition-transform hover:-translate-y-px hover:bg-[var(--surface-2)]"
      >
        <IconChartBar className="h-3.5 w-3.5" />
        All the numbers
      </button>
      {open && <Deck {...props} load={load} retry={fetchInflows} onClose={close} />}
    </>
  );
}

function Deck({
  snap, fresh, globalTShares, pHex, pSsh, load, retry, onClose,
}: StatsDeckProps & { load: Load; retry: () => void; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('daily');
  const [range, setRange] = useState<RangeId>('90');
  const closeRef = useRef<HTMLButtonElement | null>(null);
  // Read once per open: the "ago" labels describe the moment the deck opened.
  const [now] = useState(() => Date.now());

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const active = TABS.find((t) => t.id === tab)!;
  const data = load.state === 'ok' ? load.data : null;
  const aligned = !!data && sameRestakes(snap.cycles, data);

  // z-[130], the same layer as the share-card picker: above the sticky banner
  // (z-30), the bottom nav (z-50) and the action dock (z-[60]). The panel is
  // `self-start` at every width — left to the flex default it stretches to the
  // overlay's height, and on a phone everything past the first screen then
  // renders with no background behind it.
  const dialog = (
    <div
      className="fixed inset-0 z-[130] flex justify-center overflow-y-auto overscroll-contain bg-black/70 backdrop-blur-sm md:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ssk-deck-title"
        className={`${VIZ_VARS} relative min-h-full w-full max-w-[1080px] self-start border-[var(--line)] bg-[var(--panel)] md:my-4 md:min-h-0 md:rounded-2xl md:border`}
      >
        {/* header: title and close, then the tabs — the only part that stays put
            while the body scrolls, so it's kept to what a phone can spare */}
        <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--panel)] md:rounded-t-2xl">
          <div className="flex items-center justify-between gap-3 px-4 pb-1.5 pt-2.5">
            <h2 id="ssk-deck-title" className="text-[17px] font-bold tracking-[-0.02em] text-[var(--text)]">
              All the numbers
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2.5">
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Views">
              {TABS.map((t) => {
                const on = t.id === tab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      on ? 'border-transparent text-white' : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface)]'
                    }`}
                    style={on ? { background: GRAD } : undefined}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            {active.ranged && <RangeTabs value={range} onChange={setRange} />}
          </div>
        </div>

        <div className="flex flex-col gap-5 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <p className="-mb-2 text-[10.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]" style={{ fontFamily: MONO }}>
            {data
              ? `Transfers checked against the chain at block ${data.block.toLocaleString()} · ${new Date(data.blockTs * 1000).toUTCString().slice(17, 22)} UTC`
              : 'Reading every transfer into the stake…'}
            {' · '}
            {fresh ? 'cycle record rebuilt live' : `cycle record from the ${snap.meta.asOf} snapshot`}
          </p>
          {data ? (
            <Glance data={data} snap={snap} aligned={aligned} pHex={pHex} now={now} />
          ) : (
            <Waiting load={load} retry={retry} />
          )}

          <div role="tabpanel" aria-label={active.label}>
            {tab === 'market' && (
              <MarketPanel series={snap.series} range={range} pSshNow={pSsh} pHexNow={pHex} />
            )}
            {tab === 'daily' && data && (
              <DailyPanel inflows={data} series={snap.series} range={range} pHexNow={pHex} now={now} />
            )}
            {tab === 'cycles' && data && <CyclePanel cycles={snap.cycles} inflows={data} />}
            {tab === 'hex' && data && (
              <HexPanel
                cycles={snap.cycles}
                series={snap.series}
                globalTShares={globalTShares}
                waiting={data.waiting}
                aligned={aligned}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(dialog, document.body) : null;
}

/** Today, the week, the month — the figures someone opens the deck for. */
function Glance({
  data, snap, aligned, pHex, now,
}: { data: InflowsPayload; snap: SuperStakeSnapshot; aligned: boolean; pHex: number | null; now: number }) {
  const { tax, direct, refl, n } = data.days;
  const total = (k: number) => tax[k] + direct[k] + refl[k];
  const lastK = tax.length - 1;
  const sum = (days: number) => {
    let s = 0;
    for (let k = Math.max(0, lastK - days + 1); k <= lastK; k++) s += total(k);
    return s;
  };
  const active30 = Array.from({ length: Math.min(30, lastK + 1) }, (_, j) => n[lastK - j]).filter((x) => x > 0).length;

  const running = snap.cycles[snap.cycles.length - 1];
  const cur = data.cycles[data.cycles.length - 1];
  const thisCycle = cur.tax + cur.direct + cur.refl;
  const today = data.days.d0 + lastK;
  const elapsed = Math.max(1, today - running.d0 + 1);
  const latest = data.latest[0];
  const week = sum(7);

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      <Tile label="Added today" value={`${hex(total(lastK))} HEX`} sub={`${n[lastK]} ${n[lastK] === 1 ? 'add' : 'adds'} · UTC day so far`} />
      <Tile label="Last 7 days" value={`${hex(week)} HEX`} sub={pHex ? `≈ ${usd(week * pHex)} at today's price` : undefined} />
      <Tile label="Last 30 days" value={`${hex(sum(30))} HEX`} sub={`${active30} of 30 days had an add`} />
      {/* Cycle number, day count and end date come from the cycle record, so
          they're only quoted when it describes the same restakes as the transfers. */}
      <Tile
        label={aligned ? `Cycle ${running.i} so far` : 'Since the last restake'}
        value={`${hex(thisCycle)} HEX`}
        sub={aligned ? `day ${elapsed} of ${running.d1 - running.d0} · ${hex(thisCycle / elapsed)} a day` : `${cur.n} adds`}
      />
      <Tile
        label="Waiting to be staked"
        value={`${hex(data.waiting)} HEX`}
        sub={aligned ? `joins the stake at the end-stake on ${dayLong(running.d1)}` : 'joins the stake at the next end-stake'}
      />
      <Tile
        label="Last add"
        value={latest ? ago(latest.ts, now) : '—'}
        sub={latest ? `${hex(latest.hex)} HEX · ${SERIES[latest.source].label.toLowerCase()}` : undefined}
      />
    </div>
  );
}

function Waiting({ load, retry }: { load: Load; retry: () => void }) {
  if (load.state === 'fail') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--app-bg)] p-3 text-[12.5px] text-[var(--text-muted)]">
        <span>
          The transfer record couldn&apos;t be read and checked right now, so nothing from it is shown.{' '}
          <span className="text-[var(--text-faint)]">({load.reason})</span>
        </span>
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--text)] hover:bg-[var(--surface)]"
        >
          <IconRefresh className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    );
  }
  return (
    <p className="rounded-xl border border-[var(--line)] bg-[var(--app-bg)] p-3 text-[12.5px] text-[var(--text-muted)]">
      Reading every HEX transfer into the stake contract and checking the total against its on-chain
      balance…
    </p>
  );
}
