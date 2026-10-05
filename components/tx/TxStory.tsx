// A PulseChain transaction told as a story: one plain-English headline, then
// numbered steps down a line — who sent it, what it called, every token hop,
// the fee — and the raw details underneath.
//
// Rendered on the server. The two pieces that come from the explorer (the
// function's name and the contract's name) arrive as slots the page streams
// in, so the story renders from the RPC data without waiting on them.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { IconCheck, IconClock, IconExternalLink, IconGasStation, IconX } from '@tabler/icons-react';
import type { TxView, TxTransfer } from '@/lib/pulsechainTx';
import { pulsechainAddressUrl, pulsechainTxUrl, PULSECHAIN_EXPLORER_NAME } from '@/lib/pulsechainExplorer';
import { geickoHref } from '@/lib/geicko/link';
import { formatTokenAmount } from '@/lib/utils';
import { TokenLogo } from '@/components/geicko/GeickoPairModal';
import { CopyHash } from './CopyHash';

const NAVY = '#0C2340';
const ORANGE = '#ff9e00';
const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const ZERO = '0x0000000000000000000000000000000000000000';

const STATUS: Record<TxView['status'], { label: string; color: string; Icon: typeof IconCheck }> = {
  success: { label: 'Confirmed', color: '#34d399', Icon: IconCheck },
  failed: { label: 'Failed', color: '#f87171', Icon: IconX },
  pending: { label: 'Pending', color: '#fbbf24', Icon: IconClock },
};

export const shortHex = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;
const pls = (wei: string | bigint) => `${formatTokenAmount(wei.toString(), 18)} PLS`;

function when(ts: number) {
  const d = new Date(ts * 1000);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${date} · ${time} UTC`;
}

// ── The headline ────────────────────────────────────────────────────────────

interface Amount { symbol: string; text: string; token: string | null }

/**
 * What `party` ended up sending and receiving, netted per token. Netting is
 * what makes the headline true: a token that only passes through (in, then
 * straight back out) nets to zero and drops out, so an arbitrage reads as its
 * profit rather than every hop. Native PLS counts only as the sender's value.
 */
function netFlows(view: TxView, party: string): { sent: Amount[]; received: Amount[] } {
  const net = new Map<string, { t: TxTransfer; n: bigint }>();
  for (const t of view.transfers) {
    if (t.amount == null || t.decimals == null) continue; // NFTs / unknown decimals: steps only
    const d = (t.to === party ? 1n : 0n) - (t.from === party ? 1n : 0n);
    if (d === 0n) continue;
    const cur = net.get(t.token) ?? { t, n: 0n };
    cur.n += d * BigInt(t.amount);
    net.set(t.token, cur);
  }
  const amt = ({ t }: { t: TxTransfer }, n: bigint): Amount => ({
    symbol: t.symbol ?? shortHex(t.token),
    text: formatTokenAmount((n < 0n ? -n : n).toString(), t.decimals!),
    token: t.token,
  });
  const sent: Amount[] = [];
  const received: Amount[] = [];
  if (party === view.from && BigInt(view.valueWei) > 0n) {
    sent.push({ symbol: 'PLS', text: formatTokenAmount(view.valueWei, 18), token: null });
  }
  for (const v of net.values()) {
    if (v.n < 0n) sent.push(amt(v, v.n));
    if (v.n > 0n) received.push(amt(v, v.n));
  }
  return { sent, received };
}

const list = (a: Amount[]) => a.map((x) => `${x.text} ${x.symbol}`).join(' + ');

function Headline({ view, called }: { view: TxView; called: ReactNode }) {
  const big = (children: ReactNode) => (
    <h1 className="font-jost text-[26px] font-bold leading-tight text-white sm:text-[32px]">{children}</h1>
  );
  const sub = (children: ReactNode) => <p className="mt-1.5 text-sm text-white/60">{children}</p>;

  if (view.status === 'pending') return <>{big('Waiting to be confirmed')}{sub('Sent to the network, not yet in a block.')}</>;
  if (view.status === 'failed') {
    return (
      <>
        {big('Failed — nothing moved')}
        {sub(<>Every change was undone. The sender still paid the {view.feeWei ? pls(view.feeWei) : ''} network fee.</>)}
      </>
    );
  }
  if (!view.to) return <>{big('Deployed a new contract')}{sub(<>by <Addr a={view.from} /></>)}</>;
  // A bare PLS send — unless the receiving contract sent tokens back, which the
  // net-flow headline below tells properly.
  if (view.selector == null && !view.transfers.length) return <>{big(`Sent ${pls(view.valueWei)}`)}{sub(<>from <Addr a={view.from} /> to <Addr a={view.to} /></>)}</>;

  for (const party of [view.from, view.to]) {
    const { sent, received } = netFlows(view, party);
    if (!sent.length && !received.length) continue;
    const text = sent.length && received.length
      ? <>Swapped {list(sent)} <span style={{ color: ORANGE }}>→</span> {list(received)}</>
      : sent.length ? <>Sent {list(sent)}</> : <>Received {list(received)}</>;
    const hops = view.transfers.length;
    return (
      <>
        {big(text)}
        {sub(
          <>
            {party === view.from ? <>by <Addr a={party} /></> : <>for contract <Addr a={party} />, called by <Addr a={view.from} /></>}
            {hops > 1 ? ` · ${hops} token hops` : ''}
          </>,
        )}
      </>
    );
  }
  return <>{big(<>Called {called}</>)}{sub(<>by <Addr a={view.from} />{view.transfers.length ? ` · ${view.transfers.length} token transfer${view.transfers.length === 1 ? '' : 's'}` : ''}</>)}</>;
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Addr({ a }: { a: string }) {
  return (
    <a
      href={pulsechainAddressUrl(a)}
      target="_blank"
      rel="noopener noreferrer"
      title={a}
      className="text-white/85 underline decoration-white/25 underline-offset-2 hover:decoration-white"
      style={{ fontFamily: MONO, fontSize: '0.92em' }}
    >
      {shortHex(a)}
    </a>
  );
}

/** An address as a person would name it in this transaction. */
function Who({ a, view }: { a: string; view: TxView }) {
  if (a === ZERO) return <span className="text-white/60">newly minted</span>;
  if (a === view.from) return <><span className="text-white/60">sender</span> <Addr a={a} /></>;
  if (a === view.to) return <><span className="text-white/60">contract</span> <Addr a={a} /></>;
  return <Addr a={a} />;
}

function WhoTo({ a, view }: { a: string; view: TxView }) {
  if (a === ZERO) return <span className="text-white/60">burned</span>;
  return <Who a={a} view={view} />;
}

function Step({ n, icon, title, children, delay }: { n: number | null; icon?: ReactNode; title: ReactNode; children?: ReactNode; delay: number }) {
  return (
    <li className="tx-step relative pb-6 pl-12 last:pb-0" style={{ animationDelay: `${delay}ms` }}>
      <span
        className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 text-[12px] font-bold"
        style={{ borderColor: ORANGE, background: NAVY, color: ORANGE, fontFamily: MONO }}
      >
        {icon ?? n}
      </span>
      <div className="pt-1 text-[15px] font-medium leading-snug text-white">{title}</div>
      {children ? <div className="mt-1 text-[13px] leading-relaxed text-white/60">{children}</div> : null}
    </li>
  );
}

function amountOf(t: TxTransfer) {
  if (t.tokenId != null) return `#${t.tokenId}`;
  if (t.decimals == null) return `${t.amount} (raw units)`;
  return formatTokenAmount(t.amount ?? '0', t.decimals);
}

const STYLE = `
.tx-step{animation:tx-in .5s cubic-bezier(.2,.8,.3,1) both}
.tx-line{transform-origin:top;animation:tx-line 1.2s cubic-bezier(.3,.7,.3,1) .1s both}
.tx-head{animation:tx-in .6s cubic-bezier(.2,.8,.3,1) both}
@keyframes tx-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes tx-line{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){.tx-step,.tx-line,.tx-head{animation:none}}
`;

/** Long swaps route through dozens of hops; the first few tell the story. */
const SHOWN_HOPS = 12;

export function TxStory({ view, toName, called, calledArgs }: { view: TxView; toName: ReactNode; called: ReactNode; calledArgs: ReactNode }) {
  const s = STATUS[view.status];
  const shown = view.transfers.slice(0, SHOWN_HOPS);
  const hidden = view.transfers.slice(SHOWN_HOPS);
  let n = 1;
  const delay = (i: number) => 150 + i * 90;

  const hop = (t: TxTransfer, i: number, step: number) => (
    <Step
      key={i}
      n={step}
      delay={delay(step)}
      title={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TokenLogo address={t.token} symbol={t.symbol ?? undefined} size={22} className="!ring-[#0C2340]" />
          <span style={{ fontFamily: MONO }}>{amountOf(t)}</span>
          <Link href={geickoHref(t.token)} className="font-semibold hover:underline" style={{ color: ORANGE }} title={t.token}>
            {t.symbol ?? shortHex(t.token)}
          </Link>
        </span>
      }
    >
      <Who a={t.from} view={view} /> <span className="text-white/40">→</span> <WhoTo a={t.to} view={view} />
    </Step>
  );

  return (
    <div className="mx-auto w-full max-w-2xl" style={{ fontFamily: 'var(--font-poppins), ui-sans-serif, sans-serif' }}>
      <style>{STYLE}</style>
      <section
        className="overflow-hidden rounded-3xl border border-white/10 p-5 sm:p-8"
        style={{
          background: `radial-gradient(120% 80% at 100% 0%, rgba(255,158,0,.10), transparent 55%), ${NAVY}`,
        }}
      >
        <div className="tx-head">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold"
              style={{ color: s.color, background: `${s.color}1a`, border: `1px solid ${s.color}55` }}
            >
              <s.Icon className="h-3.5 w-3.5" /> {s.label}
            </span>
            {view.timestamp != null && view.blockNumber != null ? (
              <span className="text-white/55">
                {when(view.timestamp)} · block {view.blockNumber.toLocaleString('en-US')}
              </span>
            ) : null}
          </div>
          <Headline view={view} called={called} />
        </div>

        <div className="my-6 h-px bg-white/10" />

        <ol className="relative">
          <span className="tx-line absolute bottom-4 left-[15px] top-4 w-0.5 rounded-full" style={{ background: `linear-gradient(${ORANGE}, ${ORANGE}33)` }} aria-hidden />
          <Step n={n++} delay={delay(0)} title={<>Sent by <Addr a={view.from} /></>}>
            {view.timestamp != null ? when(view.timestamp) : 'Not in a block yet'}
          </Step>

          {!view.to ? (
            <Step n={n++} delay={delay(1)} title="Deployed a new contract">
              {view.createdContract ? <>at <Addr a={view.createdContract} /></> : null}
              {BigInt(view.valueWei) > 0n ? <> · with {pls(view.valueWei)}</> : null}
            </Step>
          ) : view.selector == null ? (
            <Step n={n++} delay={delay(1)} title={<>Sent {pls(view.valueWei)}</>}>
              to <Addr a={view.to} />
            </Step>
          ) : (
            <Step n={n++} delay={delay(1)} title={<>Called {called}</>}>
              on {toName} <Addr a={view.to} />
              {BigInt(view.valueWei) > 0n ? <> · with {pls(view.valueWei)}</> : null}
              {calledArgs}
            </Step>
          )}

          {view.status === 'failed' ? (
            <Step n={null} icon={<IconX className="h-4 w-4" />} delay={delay(2)} title="Reverted">
              The contract rejected it, so every change was undone and no tokens moved.
            </Step>
          ) : null}

          {shown.map((t, i) => hop(t, i, n++))}

          {hidden.length ? (
            <li className="tx-step relative pb-6 pl-12" style={{ animationDelay: `${delay(n)}ms` }}>
              <details className="group">
                <summary className="cursor-pointer list-none pt-1 text-[14px] font-medium" style={{ color: ORANGE }}>
                  <span className="group-open:hidden">Show {hidden.length} more token hop{hidden.length === 1 ? '' : 's'}</span>
                  <span className="hidden group-open:inline">Hide</span>
                </summary>
                <ol className="-ml-12 mt-4">{hidden.map((t, i) => hop(t, SHOWN_HOPS + i, n + i))}</ol>
              </details>
            </li>
          ) : null}

          <Step
            n={null}
            icon={<IconGasStation className="h-4 w-4" />}
            delay={delay(n + 1)}
            title={view.feeWei == null ? 'Network fee: known once mined' : <>Paid {pls(view.feeWei)} network fee</>}
          >
            {view.gasUsed != null ? `${view.gasUsed.toLocaleString('en-US')} gas` : null}
          </Step>
        </ol>
      </section>

      <Details view={view} />
    </div>
  );
}

function Details({ view }: { view: TxView }) {
  const row = (k: string, v: ReactNode) => (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] py-2.5 first:border-t-0">
      <span className="text-[12px] text-[var(--text-muted)]">{k}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right text-[13px] text-[var(--text)]" style={{ fontFamily: MONO }}>{v}</span>
    </div>
  );
  const link = (a: string) => (
    <a href={pulsechainAddressUrl(a)} target="_blank" rel="noopener noreferrer" className="truncate hover:underline" title={a}>{shortHex(a)}</a>
  );
  return (
    <section className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-2">
      {row('Transaction', <><span className="truncate" title={view.hash}>{shortHex(view.hash)}</span><CopyHash value={view.hash} /></>)}
      {row('From', link(view.from))}
      {row('To', view.to ? link(view.to) : view.createdContract ? <>new {link(view.createdContract)}</> : '—')}
      {row('Value', pls(view.valueWei))}
      {row('Nonce', view.nonce)}
      {row('Events', view.eventCount)}
      <div className="border-t border-[var(--line)] py-3 text-center">
        <a
          href={pulsechainTxUrl(view.hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Full detail on {PULSECHAIN_EXPLORER_NAME} <IconExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </section>
  );
}

/** No story to tell: the hash is malformed, or no node knows it. */
export function TxMissing({ hash, reason }: { hash: string; reason: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl" style={{ fontFamily: 'var(--font-poppins), ui-sans-serif, sans-serif' }}>
      <section className="rounded-3xl border border-white/10 p-5 sm:p-8" style={{ background: NAVY }}>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-[12px] font-semibold text-white/70">
          Not found
        </span>
        <h1 className="mt-4 font-jost text-[26px] font-bold leading-tight text-white sm:text-[32px]">No transaction to show</h1>
        <p className="mt-2 break-all text-[13px] text-white/50" style={{ fontFamily: MONO }}>{hash}</p>
        <p className="mt-4 text-sm leading-relaxed text-white/70">{reason}</p>
      </section>
    </div>
  );
}

// ── Explorer slots ──────────────────────────────────────────────────────────

/** The contract's name before its address. */
export function ToName({ name }: { name: string | null }) {
  return name ? <span className="font-semibold text-white">{name}</span> : null;
}

type Names = { methodCall: string | null; params: { name: string; type: string; value: string }[] } | null;

/** The function's name, or its raw ID when it has none. */
export function CalledName({ selector, names }: { selector: string; names: Names }) {
  const fn = names?.methodCall ? names.methodCall.slice(0, names.methodCall.indexOf('(')) : null;
  return fn ? <span style={{ color: ORANGE }}>{fn}</span> : <span style={{ fontFamily: MONO, color: ORANGE }}>{selector}</span>;
}

/** The function's arguments, or why there are none to show. */
export function CalledArgs({ names }: { names: Names }) {
  if (!names) return <div className="mt-1 text-[12px] text-white/45">Function name unavailable — the explorer isn&apos;t answering.</div>;
  if (!names.methodCall) return <div className="mt-1 text-[12px] text-white/45">Contract not verified, so the function has no public name.</div>;
  if (!names.params.length) return null;
  return (
    <ul className="mt-2 space-y-1 rounded-xl bg-black/20 px-3 py-2 text-[12px]">
      {names.params.map((p, i) => (
        <li key={i} className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 text-white/50">{p.name || `arg${i}`}</span>
          <span className="min-w-0 break-all text-right text-white/85" style={{ fontFamily: MONO }} title={p.type}>
            {p.type === 'address' ? <Addr a={p.value} /> : p.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Shown while an explorer slot streams in. */
export function NamesPending() {
  return <span className="animate-pulse text-white/50">a contract…</span>;
}
