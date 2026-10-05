// A PulseChain transaction printed as a paper receipt: who paid whom, the
// tokens that moved as line items, the network fee as the total.
//
// Rendered on the server. The two pieces that come from the explorer (the
// function's name and the contract's name) arrive as slots the page streams
// in, so the receipt prints from the RPC data without waiting on them.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { IconExternalLink } from '@tabler/icons-react';
import type { TxView, TxTransfer } from '@/lib/pulsechainTx';
import { pulsechainAddressUrl, pulsechainTxUrl, PULSECHAIN_EXPLORER_NAME } from '@/lib/pulsechainExplorer';
import { geickoHref } from '@/lib/geicko/link';
import { formatTokenAmount } from '@/lib/utils';
import { CopyHash } from './CopyHash';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';

// Paper and ink. The orange is decoration only (band, perforation, rule) —
// on paper it is too light to carry text.
const PAPER = '#f4efe6';
const INK = '#22201c';
const MUTED = '#6b6358';
const ORANGE = '#ff9e00';

const STAMP: Record<TxView['status'] | 'void', { label: string; color: string }> = {
  success: { label: 'Confirmed', color: '#1d6b45' },
  failed: { label: 'Failed', color: '#b3261e' },
  pending: { label: 'Pending', color: '#9a5200' },
  void: { label: 'Void', color: '#b3261e' },
};

export const shortHex = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

const pls = (wei: string) => `${formatTokenAmount(wei, 18)} PLS`;

function when(ts: number) {
  const d = new Date(ts * 1000);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
  return `${date} · ${time} UTC`;
}

const STYLE = `
.rcpt-paper{position:relative;background-color:${PAPER};
  background-image:repeating-linear-gradient(0deg,rgba(34,32,28,.018) 0 1px,transparent 1px 3px);
  box-shadow:0 18px 40px -18px rgba(0,0,0,.55),0 2px 6px rgba(0,0,0,.18)}
.rcpt-paper::after{content:'';position:absolute;left:0;right:0;bottom:-7px;height:7px;
  background:radial-gradient(circle at 7px 0,${PAPER} 6.5px,transparent 7px) 0 0/14px 7px repeat-x}
.rcpt-rule{border-top:1.5px dashed rgba(34,32,28,.28)}
.rcpt-print{animation:rcpt-print 1.1s cubic-bezier(.25,.8,.3,1) both}
.rcpt-stamp{animation:rcpt-stamp .45s cubic-bezier(.3,1.6,.5,1) 1.05s both}
@keyframes rcpt-print{from{transform:translateY(-100%)}to{transform:none}}
@keyframes rcpt-stamp{from{opacity:0;transform:rotate(-6deg) scale(1.9)}to{opacity:.9;transform:rotate(-6deg) scale(1)}}
@media (prefers-reduced-motion:reduce){.rcpt-print,.rcpt-stamp{animation:none}.rcpt-stamp{opacity:.9;transform:rotate(-6deg)}}
`;

/** The printer slot the receipt feeds out of, and the paper itself. */
function Printer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[440px]" style={{ fontFamily: MONO }}>
      <style>{STYLE}</style>
      <div className="relative z-10 mx-[-10px] h-4 rounded-full bg-[#15130f] shadow-[inset_0_-3px_0_rgba(255,255,255,.06)]" />
      {/* Clips the paper while it is still inside the slot; the padding leaves room for its shadow and torn edge. */}
      <div className="-mx-4 -mt-2 overflow-hidden px-4 pb-8">
        <div className="rcpt-print">
          <div className="rcpt-paper px-5 pb-6 pt-6 text-[12.5px] leading-relaxed sm:px-7" style={{ color: INK }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stamp({ kind }: { kind: keyof typeof STAMP }) {
  const s = STAMP[kind];
  return (
    <div className="mt-3 text-center">
      <span
        className="rcpt-stamp inline-block rounded-md border-[3px] px-2.5 py-0.5 text-[15px] font-extrabold uppercase tracking-[0.18em]"
        style={{ color: s.color, borderColor: s.color, transform: 'rotate(-6deg)', opacity: 0.9 }}
      >
        {s.label}
      </span>
    </div>
  );
}

function Header({ sub }: { sub: ReactNode }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full" style={{ background: ORANGE }} />
      <div className="text-[15px] font-extrabold uppercase tracking-[0.3em]">PulseChain</div>
      <div className="text-[10.5px] uppercase tracking-[0.28em]" style={{ color: MUTED }}>Transaction receipt</div>
      <div className="mt-2 text-[11.5px]" style={{ color: MUTED }}>{sub}</div>
    </div>
  );
}

const Rule = () => <div className="rcpt-rule my-4" />;

function Label({ children }: { children: ReactNode }) {
  return <div className="text-[10.5px] font-bold uppercase tracking-[0.2em]" style={{ color: MUTED }}>{children}</div>;
}

function AddrLink({ addr }: { addr: string }) {
  return (
    <a
      href={pulsechainAddressUrl(addr)}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
      title={addr}
    >
      {shortHex(addr)}
    </a>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.2em]" style={{ color: MUTED }}>{label}</span>
      <span className="flex min-w-0 items-center justify-end gap-1.5 text-right">{children}</span>
    </div>
  );
}

function amountOf(t: TxTransfer) {
  if (t.tokenId != null) return `#${t.tokenId}`;
  if (t.decimals == null) return `${t.amount} raw`;
  return formatTokenAmount(t.amount ?? '0', t.decimals);
}

function LineItem({ t }: { t: TxTransfer }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <Link href={geickoHref(t.token)} className="truncate font-bold hover:underline" title={t.token}>
          {t.symbol ?? shortHex(t.token)}
        </Link>
        <span className="shrink-0 tabular-nums font-bold">{amountOf(t)}</span>
      </div>
      <div className="text-[11px]" style={{ color: MUTED }}>
        <AddrLink addr={t.from} /> → <AddrLink addr={t.to} />
      </div>
    </li>
  );
}

/** Bars drawn from the hash's own hex digits — the same hash, the same barcode. */
function Barcode({ hash }: { hash: string }) {
  let x = 0;
  const bars = [...hash.slice(2)].map((c) => {
    const n = Number.parseInt(c, 16);
    const w = 1 + (n % 3);
    const bar = { x, w };
    x += w + 1 + ((n >> 2) % 2);
    return bar;
  });
  return (
    <svg viewBox={`0 0 ${x} 30`} preserveAspectRatio="none" className="mx-auto h-9 w-full max-w-[300px]" aria-hidden>
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={30} fill={INK} />)}
    </svg>
  );
}

export function TxReceipt({ view, toName, called }: { view: TxView; toName: ReactNode; called: ReactNode }) {
  const valueWei = BigInt(view.valueWei);
  const feeWei = view.feeWei == null ? null : BigInt(view.feeWei);
  return (
    <Printer>
      <Header
        sub={
          view.timestamp != null && view.blockNumber != null ? (
            <>
              {when(view.timestamp)}
              <br />
              Block {view.blockNumber.toLocaleString('en-US')}
            </>
          ) : (
            'Waiting to be included in a block'
          )
        }
      />
      <Stamp kind={view.status} />
      <Rule />
      <div className="space-y-1.5">
        <Row label="Tx">
          <span className="truncate" title={view.hash}>{shortHex(view.hash)}</span>
          <CopyHash value={view.hash} />
        </Row>
        <Row label="From"><AddrLink addr={view.from} /></Row>
        <Row label="To">
          {view.to ? (
            <>
              {toName}
              <AddrLink addr={view.to} />
            </>
          ) : view.createdContract ? (
            <>
              <span>New contract</span>
              <AddrLink addr={view.createdContract} />
            </>
          ) : (
            <span>Contract creation</span>
          )}
        </Row>
      </div>
      <Rule />
      <Label>Called</Label>
      <div className="mt-1">
        {view.selector == null ? (
          <span>{view.to ? 'Plain PLS transfer' : 'Contract deployment'}</span>
        ) : (
          called
        )}
      </div>
      <Rule />
      <Label>Tokens moved{view.transfers.length ? ` · ${view.transfers.length}` : ''}</Label>
      {view.transfers.length ? (
        <ol className="mt-2 space-y-2.5">
          {view.transfers.map((t, i) => <LineItem key={i} t={t} />)}
        </ol>
      ) : (
        <div className="mt-1" style={{ color: MUTED }}>
          {view.status === 'pending' ? 'Known once the transaction is mined' : 'No token transfers'}
        </div>
      )}
      <Rule />
      <div className="space-y-1">
        <Row label="Value"><span className="tabular-nums">{pls(view.valueWei)}</span></Row>
        <Row label="Network fee"><span className="tabular-nums">{feeWei == null ? '—' : pls(view.feeWei!)}</span></Row>
      </div>
      <div className="my-3 h-[3px]" style={{ borderTop: `1.5px solid ${INK}`, borderBottom: `1.5px solid ${INK}` }} />
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[12px] font-extrabold uppercase tracking-[0.2em]">Total paid</span>
        <span className="relative text-[17px] font-extrabold tabular-nums">
          {feeWei == null ? '—' : pls((valueWei + feeWei).toString())}
          <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full" style={{ background: ORANGE }} />
        </span>
      </div>
      <div className="mt-1 text-right text-[10.5px]" style={{ color: MUTED }}>value + fee, paid by the sender</div>
      <Rule />
      <div className="text-center text-[11px]" style={{ color: MUTED }}>
        {view.eventCount} event{view.eventCount === 1 ? '' : 's'} · nonce {view.nonce}
        {view.gasUsed != null ? ` · ${view.gasUsed.toLocaleString('en-US')} gas` : ''}
      </div>
      <div className="mt-3"><Barcode hash={view.hash} /></div>
      <div className="mt-3 text-center">
        <a
          href={pulsechainTxUrl(view.hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.18em] underline decoration-dotted underline-offset-4 hover:decoration-solid"
        >
          Full detail on {PULSECHAIN_EXPLORER_NAME} <IconExternalLink className="h-3 w-3" />
        </a>
      </div>
    </Printer>
  );
}

/** No receipt to print: the hash is malformed, or no node knows it. */
export function VoidReceipt({ hash, reason }: { hash: string; reason: ReactNode }) {
  return (
    <Printer>
      <Header sub="Nothing to print" />
      <Stamp kind="void" />
      <Rule />
      <Row label="Tx"><span className="truncate" title={hash}>{hash.length > 14 ? shortHex(hash) : hash}</span></Row>
      <Rule />
      <p className="text-[12px]" style={{ color: INK }}>{reason}</p>
    </Printer>
  );
}

/** Explorer slot: the contract's name before its address on the To line. */
export function ToName({ name }: { name: string | null }) {
  return name ? <span className="truncate font-bold">{name}</span> : null;
}

/** Explorer slot: the function that was called, with its arguments. */
export function Called({
  selector,
  names,
}: {
  selector: string;
  names: { methodCall: string | null; params: { name: string; type: string; value: string }[] } | null;
}) {
  if (!names) {
    return (
      <div>
        <span className="font-bold">{selector}</span>
        <div className="text-[11px]" style={{ color: MUTED }}>Function name unavailable — the explorer isn&apos;t answering.</div>
      </div>
    );
  }
  if (!names.methodCall) {
    return (
      <div>
        <span className="font-bold">{selector}</span>
        <div className="text-[11px]" style={{ color: MUTED }}>Contract not verified, so the function has no public name.</div>
      </div>
    );
  }
  const fn = names.methodCall.slice(0, names.methodCall.indexOf('('));
  return (
    <div>
      <span className="break-all font-bold">{fn}</span>
      {names.params.length ? (
        <ul className="mt-1 space-y-0.5 text-[11.5px]">
          {names.params.map((p, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="shrink-0" style={{ color: MUTED }}>{p.name || `arg${i}`}</span>
              <span className="min-w-0 break-all text-right" title={p.type}>
                {p.type === 'address' ? <AddrLink addr={p.value} /> : p.value}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Shown while the explorer slot streams in. */
export function NamesPending() {
  return <span className="animate-pulse" style={{ color: MUTED }}>reading…</span>;
}
