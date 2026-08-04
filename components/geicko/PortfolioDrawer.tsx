'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { IconBriefcase, IconPinned, IconX } from '@tabler/icons-react';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import { useInvestigateStore } from '@/lib/stores/investigateStore';
import { fmtAmount, fmtUsd } from '@/lib/format';

// "My portfolio while I'm on a token page" — a persistent dock chip that
// expands into a slide-over drawer (bottom sheet on phones).
//
// The design intent, in order:
//   1. The chip is ambient: total value and "N hold <SYMBOL>" are visible
//      without a click, so just landing on a token page tells you whether
//      you're exposed to it.
//   2. The drawer is a workbench, not a mirror of the portfolio page: your
//      wallets joined against THIS token, plus the "Investigating" tray of
//      holder wallets pinned from the holders tab — the scratch state that
//      used to evaporate on every navigation.
//   3. On desktop there is deliberately NO backdrop: the page stays fully
//      interactive with the drawer open, because the whole point is reading
//      the holder list and your wallets side by side.
//
// PulseChain only (the page mounts it only there): balances come from the
// PulseChain RPC pool and wallet values from the PulseChain basket.

interface WalletValue { usd: number }

const OPEN_KEY = 'geicko-portfolio-drawer';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function PortfolioDrawer({
  token,
  symbol,
  priceUsd,
  onViewHolder,
}: {
  /** Current token address (lowercased ok), null while the page resolves. */
  token: string | null;
  /** Current token symbol for labels. */
  symbol: string;
  /** Current token USD price, for valuing your position. */
  priceUsd: number | null;
  /** Opens the existing holder modal (portfolio / txs / stakes) for a wallet. */
  onViewHolder: (address: string) => void;
}) {
  const wallets = usePortfolioStore((s) => s.wallets);
  const pins = useInvestigateStore((s) => s.pins);
  const unpin = useInvestigateStore((s) => s.unpin);
  const clearPins = useInvestigateStore((s) => s.clear);

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, WalletValue>>({});
  // Balances are stored WITH the token they were fetched for, and only render
  // when that token is still the one on screen. Anything looser shows token
  // A's amounts labeled and priced as token B while navigating: an eager reset
  // in the effect isn't enough, because effects run after paint and the stale
  // frame still flashes. Tagging the data makes staleness unrepresentable.
  const [tokenBal, setTokenBal] = useState<{
    token: string;
    decimals: number | null;
    balances: Record<string, string | null>;
  } | null>(null);

  // Reopen state survives tab-to-tab navigation within the session.
  useEffect(() => {
    try { setOpen(sessionStorage.getItem(OPEN_KEY) === '1'); } catch { /* ignore */ }
  }, []);
  const toggle = useCallback((v: boolean) => {
    setOpen(v);
    try { sessionStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') toggle(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, toggle]);

  const walletAddrs = useMemo(
    () => wallets.map((w) => w.address.toLowerCase()),
    [wallets],
  );
  // One value fetch covers wallets AND pinned holders — same endpoint, one POST.
  const valueAddrs = useMemo(
    () => [...new Set([...walletAddrs, ...pins.map((p) => p.address)])],
    [walletAddrs, pins],
  );

  // Wallet $ values via the same basket estimate the holders table shows, so
  // the numbers agree across the page.
  useEffect(() => {
    if (valueAddrs.length === 0) { setValues({}); return; }
    let alive = true;
    fetch('/api/geicko/holder-values', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: valueAddrs, network: 'pulsechain' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.values) return;
        setValues(d.values as Record<string, WalletValue>);
      })
      .catch(() => { /* values stay blank; balances still work */ });
    return () => { alive = false; };
  }, [valueAddrs]);

  // Your balance of THE CURRENT token, per wallet.
  useEffect(() => {
    if (!token || walletAddrs.length === 0) { setTokenBal(null); return; }
    let alive = true;
    const fetchedFor = token.toLowerCase();
    fetch('/api/geicko/token-balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: fetchedFor, addresses: walletAddrs }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.supported) return;
        setTokenBal({
          token: fetchedFor,
          decimals: typeof d.decimals === 'number' ? d.decimals : null,
          balances: d.balances ?? {},
        });
      })
      .catch(() => { /* strip just doesn't render */ });
    return () => { alive = false; };
  }, [token, walletAddrs]);

  // Only the data fetched for the token on screen is usable.
  const current = token && tokenBal?.token === token.toLowerCase() ? tokenBal : null;
  const decimals = current?.decimals ?? null;

  const holding = useMemo(() => {
    if (!current || current.decimals == null) return [];
    const d = current.decimals;
    return walletAddrs
      .map((a) => ({ address: a, raw: current.balances[a] }))
      .filter((x): x is { address: string; raw: string } => !!x.raw && x.raw !== '0')
      .map((x) => ({ address: x.address, amount: Number(x.raw) / Math.pow(10, d) }))
      .sort((a, b) => b.amount - a.amount);
  }, [walletAddrs, current]);

  const totalUsd = useMemo(
    () => walletAddrs.reduce((s, a) => s + (values[a]?.usd ?? 0), 0),
    [walletAddrs, values],
  );

  const labelFor = (addr: string) =>
    wallets.find((w) => w.address.toLowerCase() === addr)?.label || null;

  // ----- chip (always mounted) -----
  const chip = (
    <button
      type="button"
      onClick={() => toggle(!open)}
      aria-expanded={open}
      aria-label="Toggle the portfolio drawer"
      className="fixed bottom-20 right-20 md:bottom-6 z-[110] flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[color-mix(in_srgb,var(--panel)_92%,transparent)] px-3 py-2 shadow-xl shadow-black/40 backdrop-blur transition-transform hover:scale-[1.03]"
    >
      <IconBriefcase className="h-4 w-4 text-[var(--text-muted)]" />
      <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--text)]">
        Portfolio
      </span>
      {wallets.length === 0 ? (
        <span className="text-[10px] text-[var(--text-faint)]">set up</span>
      ) : (
        <>
          {totalUsd > 0 && (
            <span className="text-[11px] font-bold tabular-nums text-[var(--text)]">{fmtUsd(totalUsd)}</span>
          )}
          {holding.length > 0 && (
            <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
              {holding.length} hold {symbol}
            </span>
          )}
          {pins.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-300">
              <IconPinned className="h-3 w-3" />{pins.length}
            </span>
          )}
        </>
      )}
    </button>
  );

  if (!open) return chip;

  // ----- drawer / sheet -----
  const row = 'flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[var(--line-soft)]';
  const viewBtn =
    'rounded border border-cyan-400/40 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-400/10 transition-colors flex-none';

  return (
    <>
      {chip}
      {/* Mobile-only backdrop; desktop keeps the page interactive on purpose. */}
      {/* z-order: the Sleuth FAB sits at z-[120], so the backdrop (121) dims it
          and the sheet (125) covers it while the drawer is open. */}
      <div
        className="fixed inset-0 z-[121] bg-black/50 md:hidden"
        onClick={() => toggle(false)}
        aria-hidden="true"
      />
      <aside
        role="complementary"
        aria-label="My portfolio"
        className={
          'fixed z-[125] flex flex-col overflow-hidden border border-[var(--line-strong)] bg-[var(--panel)] shadow-2xl shadow-black/60 ' +
          'inset-x-0 bottom-0 max-h-[70vh] rounded-t-2xl ' +
          'md:inset-x-auto md:right-0 md:top-14 md:bottom-3 md:max-h-none md:w-[336px] md:rounded-l-2xl md:rounded-tr-none md:border-r-0'
        }
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2.5">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--text)]">My portfolio</span>
            <span className="truncate text-[10px] text-[var(--text-faint)]">
              {wallets.length} wallet{wallets.length === 1 ? '' : 's'}{totalUsd > 0 ? ` · ${fmtUsd(totalUsd)}` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => toggle(false)}
            aria-label="Close"
            className="text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {wallets.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
              No wallets yet.
              <Link href="/portfolio" className="ml-1 font-semibold text-cyan-300 hover:underline">
                Add them on the portfolio page →
              </Link>
            </div>
          ) : (
            <>
              {/* Position in the CURRENT token — the reason this drawer exists. */}
              {token && (
                holding.length > 0 ? (
                  <div className="border-b border-[var(--line)] bg-cyan-400/[0.05] px-3.5 py-2.5">
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-cyan-300">
                      You hold {symbol} in {holding.length} of {wallets.length} wallet{wallets.length === 1 ? '' : 's'}
                    </div>
                    {holding.map((h) => (
                      <div key={h.address} className="flex items-baseline justify-between gap-2 py-0.5 text-[11px]">
                        <span className="font-mono text-[var(--text-muted)]">{labelFor(h.address) ?? short(h.address)}</span>
                        <span className="ml-auto font-bold tabular-nums text-[var(--text)]">
                          {fmtAmount(Math.floor(h.amount))} {symbol}
                        </span>
                        {priceUsd != null && priceUsd > 0 && (
                          <span className="w-14 text-right tabular-nums text-[var(--text-faint)]">
                            {fmtUsd(h.amount * priceUsd)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : decimals != null ? (
                  <div className="border-b border-[var(--line)] px-3.5 py-2 text-[10px] text-[var(--text-faint)]">
                    None of your wallets hold {symbol}.
                  </div>
                ) : null
              )}

              <div className="px-3.5 pb-1 pt-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                Wallets
              </div>
              {wallets.map((w) => {
                const a = w.address.toLowerCase();
                const v = values[a]?.usd;
                return (
                  <div key={a} className={row}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[11px] text-[var(--text)]">{short(a)}</div>
                      {w.label && <div className="text-[9px] text-[var(--text-faint)]">{w.label}</div>}
                    </div>
                    <span className="text-[12px] font-bold tabular-nums text-[var(--text)]">
                      {v != null ? fmtUsd(v) : '—'}
                    </span>
                    <button type="button" onClick={() => onViewHolder(a)} className={viewBtn}>
                      view
                    </button>
                  </div>
                );
              })}
              <div className="px-3.5 py-2 text-right">
                <Link href="/portfolio" className="text-[10px] font-semibold text-[var(--text-faint)] hover:text-[var(--text)]">
                  Manage wallets →
                </Link>
              </div>
            </>
          )}

          {/* Investigating tray — pins survive tab and token changes. */}
          <div className="flex items-center justify-between px-3.5 pb-1 pt-2 border-t border-[var(--line)]">
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-faint)]">
              Investigating{pins.length > 0 ? ` · ${pins.length}` : ''}
            </span>
            {pins.length > 0 && (
              <button type="button" onClick={clearPins} className="text-[9px] font-semibold text-cyan-300 hover:underline">
                clear
              </button>
            )}
          </div>
          {pins.length === 0 ? (
            <div className="px-3.5 pb-4 pt-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
              Open any holder on the Holders tab and press <b className="text-[var(--text-muted)]">Pin</b> — it
              stays here while you move between tabs and tokens.
            </div>
          ) : (
            pins.map((p) => (
              <div key={p.address} className={`${row} border-l-2 border-l-amber-400/50`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[11px] text-[var(--text)]">{short(p.address)}</div>
                  <div className="text-[9px] text-[var(--text-faint)]">
                    {p.rank != null ? `#${p.rank} holder` : 'pinned'}{p.symbol ? ` on ${p.symbol}` : ''}
                  </div>
                </div>
                {values[p.address]?.usd != null && (
                  <span className="text-[11px] font-bold tabular-nums text-[var(--text)]">
                    {fmtUsd(values[p.address].usd)}
                  </span>
                )}
                <button type="button" onClick={() => onViewHolder(p.address)} className={viewBtn}>
                  view
                </button>
                <button
                  type="button"
                  onClick={() => unpin(p.address)}
                  aria-label={`Unpin ${short(p.address)}`}
                  className="text-[var(--text-faint)] hover:text-[var(--text)] flex-none"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
