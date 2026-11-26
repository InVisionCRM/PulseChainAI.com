'use client';

// Look up one wallet's SuperStake: a search row along the bottom of the page's
// banner, and a results panel under the banner that stays on every tab. Built
// from the stats deck's own tiles and table so it reads as part of the page.
//
// Position, rewards and payouts come from /api/superstake/wallet (pSSH, its
// dividend tracker and the HEX subgraph — see that route for how payouts
// work). Trading reuses the token page's /api/geicko/holder-detail, which only
// sees PulseX swaps; the panel says so rather than letting it pass for the
// wallet's whole history.

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { IconExternalLink, IconRefresh, IconSearch, IconX } from '@tabler/icons-react';
import type { SuperStakeCycle } from '@/lib/superstake/model';
import type { SuperStakeWalletPayload } from '@/app/api/superstake/wallet/route';
import type { HolderDetail } from '@/components/geicko/GeickoHoldersTab';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import {
  DataTable, GRAD, Head, MONO, Tile, ago, dayShort, hex, price, usd, type Col,
} from '@/components/superstake/stats/shared';

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;

type Load<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'done'; data: T };

const tokens = (n: number) => Math.round(n).toLocaleString();
const date = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const dateTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/* ───────────────────────────── the search row ───────────────────────────── */

/** Sits inside the sticky banner, under the stat strip. */
export function WalletSearch({ onLookup }: { onLookup: (address: string) => void }) {
  const [value, setValue] = useState('');
  const [bad, setBad] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = value.trim();
    if (!ADDR_RX.test(a)) {
      setBad(true);
      return;
    }
    setBad(false);
    onLookup(a.toLowerCase());
  };

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Look up a wallet's SuperStake"
      className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 sm:px-2.5"
    >
      <IconSearch aria-hidden className="h-3.5 w-3.5 flex-none text-[var(--text-faint)]" />
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (bad) setBad(false);
        }}
        placeholder="Look up a wallet: 0x…"
        aria-label="Wallet address"
        aria-invalid={bad}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        // 16px on phones: anything smaller makes iOS zoom the page on focus.
        className="min-w-0 flex-1 bg-transparent text-[16px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] sm:text-[12.5px]"
        style={{ fontFamily: MONO }}
      />
      {bad && (
        <span role="alert" className="flex-none text-[11px] text-red-400">
          Full 0x address needed
        </span>
      )}
      <button
        type="submit"
        className="flex-none rounded-md px-2.5 py-1 text-[11px] font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]"
        style={{ background: GRAD }}
      >
        Look up
      </button>
    </form>
  );
}

/* ───────────────────────────── the results panel ───────────────────────────── */

interface CycleRow {
  key: string;
  label: string;
  from: number | null;
  to: number | null;
  running: boolean;
  hex: number;
  count: number;
}

export function WalletPanel({
  address, token, cycles, pHex, pSsh, scrollMargin, onClose,
}: {
  address: string;
  /** pSSH, for the trading lookup. */
  token: string;
  /** The page's cycle record (live rebuild, or the snapshot). */
  cycles: SuperStakeCycle[] | null;
  pHex: number | null;
  pSsh: number | null;
  /** Height of the sticky banner, so scrolling here doesn't land under it. */
  scrollMargin: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [wallet, setWallet] = useState<Load<SuperStakeWalletPayload>>({ state: 'loading' });
  const [trades, setTrades] = useState<Load<HolderDetail>>({ state: 'loading' });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [address]);

  useEffect(() => {
    let alive = true;
    setWallet({ state: 'loading' });
    setTrades({ state: 'loading' });
    (async () => {
      const r = await fetch(`/api/superstake/wallet?address=${address}`).catch(() => null);
      const j = r ? await r.json().catch(() => null) : null;
      if (!alive) return;
      const w: Load<SuperStakeWalletPayload> =
        r?.ok && j && !j.error
          ? { state: 'done', data: j }
          : { state: 'error', message: j?.error ?? "The lookup didn't answer. Try again in a moment." };
      setWallet(w);
      setNow(Date.now());

      // The balance lets the trade record tell a full cost basis from a partial one.
      const bal = w.state === 'done' ? `&balance=${encodeURIComponent(w.data.balance)}` : '';
      const tr = await fetch(
        `/api/geicko/holder-detail?token=${token}&wallet=${address}&network=pulsechain${bal}`,
      ).catch(() => null);
      const tj = tr ? await tr.json().catch(() => null) : null;
      if (!alive) return;
      setTrades(
        tr?.ok && tj && !tj.error
          ? { state: 'done', data: tj }
          : { state: 'error', message: tj?.error ?? "The trade record didn't answer. Try again in a moment." },
      );
    })();
    return () => {
      alive = false;
    };
  }, [address, token]);

  // HEX received, totalled into the cycle it arrived in.
  const rows = useMemo<CycleRow[] | null>(() => {
    if (wallet.state !== 'done' || !cycles?.length) return null;
    const days = wallet.data.payouts.days;
    if (!days.length) return [];
    const sorted = [...cycles].sort((a, b) => a.i - b.i);
    const out: CycleRow[] = sorted.map((c, k) => ({
      key: `c${c.i}`,
      label: `Cycle ${c.i}`,
      from: c.d0,
      to: k + 1 < sorted.length ? sorted[k + 1].d0 - 1 : null,
      running: !c.done,
      hex: 0,
      count: 0,
    }));
    const before: CycleRow = { key: 'before', label: 'Before cycle 1', from: null, to: sorted[0].d0 - 1, running: false, hex: 0, count: 0 };
    for (const d of days) {
      let idx = -1;
      for (let k = sorted.length - 1; k >= 0; k--) {
        if (sorted[k].d0 <= d.day) {
          idx = k;
          break;
        }
      }
      const row = idx < 0 ? before : out[idx];
      row.hex += d.hex;
      row.count += d.count;
    }
    // From the first cycle it was paid in through the running one, newest first.
    const first = out.findIndex((r) => r.count > 0);
    const shown = first < 0 ? [] : out.slice(first);
    return [...(before.count ? [before] : []), ...shown].reverse();
  }, [wallet, cycles]);

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <section
      ref={ref}
      aria-label={`SuperStake for wallet ${short}`}
      className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:p-5"
      style={{ scrollMarginTop: scrollMargin + 8 }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9.5px] uppercase tracking-[0.15em] text-[var(--text-faint)]" style={{ fontFamily: MONO }}>
            SuperStake · wallet
          </div>
          <a
            href={pulsechainAddressUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 break-all text-[13px] font-bold text-[var(--text)] hover:underline"
            style={{ fontFamily: MONO }}
            title={address}
          >
            {/* The full address wraps mid-string on a phone; the short form reads cleaner there. */}
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{address}</span>
            <IconExternalLink aria-hidden className="h-3.5 w-3.5 flex-none text-[var(--text-faint)]" />
          </a>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close wallet lookup"
          className="flex-none rounded-lg border border-[var(--line)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      {wallet.state === 'loading' && <Waiting text="Reading pSSH and its payout tracker…" />}
      {wallet.state === 'error' && <Failed text={wallet.message} />}
      {wallet.state === 'done' && (
        <div className="flex flex-col gap-5">
          <Position w={wallet.data} pSsh={pSsh} />
          <Rewards w={wallet.data} pHex={pHex} now={now} />
          <Payouts w={wallet.data} rows={rows} />
        </div>
      )}

      <div className="mt-5">
        <Head title="Trading" sub="pSSH swaps this wallet sent on PulseX" />
        <div className="mt-2.5">
          {trades.state === 'loading' && <Waiting text="Reading PulseX swaps — this one takes a few seconds…" />}
          {trades.state === 'error' && <Failed text={trades.message} />}
          {trades.state === 'done' && (
            <Trading d={trades.data} balance={wallet.state === 'done' ? wallet.data.balance : null} />
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── sections ───────────────────────────── */

function Position({ w, pSsh }: { w: SuperStakeWalletPayload; pSsh: number | null }) {
  const share = w.circulating > 0 ? (w.balance / w.circulating) * 100 : null;
  const min = tokens(w.minForRewards);
  const status = w.excluded
    ? { value: 'Excluded', sub: 'Excluded from payouts by the pSSH contract' }
    : w.inPayoutList
      ? { value: 'Earning', sub: `Holds the ${min} pSSH minimum` }
      : w.balance > 0
        ? { value: 'Not earning', sub: `Below the ${min} pSSH minimum, so it is paid nothing` }
        : { value: 'Not a holder', sub: 'Holds no pSSH' };
  return (
    <div>
      <Head title="Position" />
      <div className={`mt-2.5 grid grid-cols-2 gap-2 ${w.bot || w.feeExempt ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <Tile
          label="pSSH held"
          value={tokens(w.balance)}
          sub={pSsh != null && w.balance > 0 ? `≈ ${usd(w.balance * pSsh)} at ${price(pSsh)}` : undefined}
        />
        <Tile
          label="Share of supply"
          value={share == null ? '—' : share > 0 && share < 0.01 ? '<0.01%' : `${share.toFixed(2)}%`}
          sub={`of ${tokens(w.circulating)} pSSH in circulation`}
        />
        {/* Third of three: full width on a phone's two-column grid rather than half a row. */}
        <div className={`grid ${w.bot || w.feeExempt ? '' : 'col-span-2 lg:col-span-1'}`}>
          <Tile label="Payouts" value={status.value} sub={status.sub} />
        </div>
        {(w.bot || w.feeExempt) && (
          <Tile
            label="Contract flags"
            value={[w.bot && 'Bot-flagged', w.feeExempt && 'Toll-exempt'].filter(Boolean).join(' · ')}
            sub={w.feeExempt ? 'Trades without the 5.5% toll' : 'Flagged by pSSH’s own bot check'}
          />
        )}
      </div>
    </div>
  );
}

function Rewards({ w, pHex, now }: { w: SuperStakeWalletPayload; pHex: number | null; now: number }) {
  const r = w.rewards;
  if (r.earned === 0 && !w.inPayoutList) {
    return (
      <div>
        <Head title="Rewards" sub="HEX from the payout tracker" />
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">This wallet has never been paid any HEX by SuperStake.</p>
      </div>
    );
  }
  return (
    <div>
      <Head title="Rewards" sub="HEX from the payout tracker" />
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Tile
          label="Earned, all-time"
          value={`${hex(r.earned)} HEX`}
          sub={pHex != null ? `≈ ${usd(r.earned * pHex)} at today’s pHEX` : undefined}
        />
        <Tile label="Paid to wallet" value={`${hex(r.paid)} HEX`} sub={`${w.payouts.count.toLocaleString()} payouts`} />
        <Tile
          label="Waiting"
          value={`${hex(r.waiting)} HEX`}
          sub={
            r.waiting > 0
              ? 'Sent automatically when this wallet moves pSSH, or when the payout loop reaches it'
              : 'Nothing waiting'
          }
        />
        <Tile
          label="Last payout"
          value={r.lastPaidTs ? ago(r.lastPaidTs, now) : 'Never'}
          sub={r.lastPaidTs ? date(r.lastPaidTs) : undefined}
        />
        <Tile
          label="Payout queue"
          value={r.holdersAhead != null ? `${r.holdersAhead.toLocaleString()} ahead` : 'Not in it'}
          sub={
            r.holdersAhead != null
              ? `of ${r.listSize.toLocaleString()} wallets · the loop moves on each pSSH sell`
              : `Only wallets holding ${tokens(w.minForRewards)}+ pSSH are queued`
          }
        />
      </div>
    </div>
  );
}

function Payouts({ w, rows }: { w: SuperStakeWalletPayload; rows: CycleRow[] | null }) {
  const p = w.payouts;
  if (!p.count) return null;
  const max = rows?.reduce((m, r) => Math.max(m, r.hex), 0) ?? 0;
  const cols: Col<CycleRow>[] = [
    {
      key: 'cycle',
      label: 'Cycle',
      text: true,
      cell: (r) => (
        <span className="font-semibold">
          {r.label}
          {r.running && <span className="ml-1.5 text-[10.5px] font-normal text-[var(--text-faint)]">running</span>}
        </span>
      ),
    },
    {
      key: 'dates',
      label: 'Dates',
      text: true,
      cell: (r) => `${r.from != null ? dayShort(r.from) : '…'} – ${r.to != null ? dayShort(r.to) : 'now'}`,
    },
    { key: 'count', label: 'Payouts', cell: (r) => r.count.toLocaleString() },
    { key: 'hex', label: 'HEX received', cell: (r) => (r.count ? hex(r.hex) : '—') },
    {
      key: 'bar',
      label: '',
      cell: (r) => (
        <span className="ml-auto block h-1.5 w-20 overflow-hidden rounded bg-[var(--line)] sm:w-28">
          <span
            className="block h-full rounded"
            style={{ width: `${max > 0 ? (r.hex / max) * 100 : 0}%`, background: GRAD }}
          />
        </span>
      ),
    },
  ];
  return (
    <div>
      <Head title="Payout history" sub="HEX the tracker sent this wallet, by the cycle it arrived in" />
      <div className="mt-2.5">
        {rows == null ? (
          <Waiting text="Waiting for the cycle record…" />
        ) : (
          <DataTable cols={cols} rows={rows} rowKey={(r) => r.key} first={8} step={20} muted={(r) => r.count === 0} />
        )}
        <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-faint)]">
          {p.paidSince > 0
            ? `The record runs to ${dateTime(p.blockTs)}; ${hex(p.paidSince)} HEX paid after that isn't in the table yet.`
            : `${p.count.toLocaleString()} payouts adding up exactly to the ${hex(w.rewards.paid)} HEX the tracker says it has paid this wallet.`}
        </p>
      </div>
    </div>
  );
}

function Trading({ d, balance }: { d: HolderDetail; balance: number | null }) {
  const t = d.trades;
  if (!d.supported || !d.hasData || !t || t.swaps === 0) {
    return <p className="text-[13px] text-[var(--text-muted)]">No PulseX swaps of pSSH from this wallet.</p>;
  }
  const pnl = d.pnl;
  const lp = d.lp;
  const lpActive = lp?.positions.filter((x) => x.active).length ?? 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Bought" value={usd(t.buyUsd)} sub={`${t.buyCount} buys · ${tokens(t.buyTokens)} pSSH`} />
        <Tile label="Sold" value={usd(t.sellUsd)} sub={`${t.sellCount} sells · ${tokens(t.sellTokens)} pSSH`} />
        <Tile
          label="Realized P&L"
          value={pnl ? usd(pnl.realizedUsd) : '—'}
          sub={pnl?.avgCostUsd != null ? `avg cost ${price(pnl.avgCostUsd)}` : undefined}
        />
        <Tile label="First buy" value={t.firstBuyTs ? date(t.firstBuyTs) : '—'} sub={t.lastSellTs ? `last sell ${date(t.lastSellTs)}` : undefined} />
        <Tile
          label="Liquidity"
          value={lp?.isProvider ? 'Providing' : lp?.everProvided ? 'Provided before' : 'Never'}
          sub={lpActive ? `${lpActive} active position${lpActive === 1 ? '' : 's'}` : undefined}
        />
      </div>
      <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-faint)]">
        {pnl && !pnl.basisComplete
          ? `P&L only covers the ${tokens(pnl.swapTrackedTokens)} pSSH this wallet bought on PulseX${
              balance != null ? ` — it holds ${tokens(balance)}` : ''
            }; the rest arrived another way, so it has no cost basis here. `
          : ''}
        {d.note}
      </p>
    </>
  );
}

/* ───────────────────────────── states ───────────────────────────── */

function Waiting({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-[var(--text-faint)]">
      <IconRefresh aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
      {text}
    </div>
  );
}

function Failed({ text }: { text: string }) {
  return (
    <p role="alert" className="text-[12.5px] text-red-400">
      {text}
    </p>
  );
}
