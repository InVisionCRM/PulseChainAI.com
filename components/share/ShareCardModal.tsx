'use client';

// Pick a card, get a 1080×1080 PNG. The canvas is the real output — the preview
// is that same canvas scaled down with CSS, so what you see is exactly what
// downloads rather than an approximation of it.
//
// This is SuperStake's picker generalised: it knows nothing about what it is
// drawing. Callers pass a card list and a `draw` function, and optionally a set
// of category tabs (the token pages split cards into All time / Short term).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconX, IconDownload, IconCopy, IconCheck, IconShare2, IconChevronLeft, IconChevronRight,
} from '@tabler/icons-react';

export const SHARE_GRAD =
  'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';

export interface ShareCardOption {
  id: string;
  name: string;
  blurb: string;
  /** Matches a `groups` key when the picker is split into tabs. */
  group?: string;
}

export interface ShareCardModalProps {
  /** Dialog heading. */
  title?: string;
  cards: ShareCardOption[];
  /**
   * Tab bar over the card list. A group may bring its own `panel` — the builder
   * tab replaces the card list with its controls and always draws `cardId`.
   */
  groups?: {
    key: string;
    label: string;
    /** Extra controls above this tab's card list. */
    panel?: React.ReactNode;
    /** The panel replaces the list rather than sitting over it. */
    hideCards?: boolean;
    /** Always draw this card while the tab is open. */
    cardId?: string;
  }[];
  /** Paint the chosen card. The logo is loaded here and handed back. */
  draw: (ctx: CanvasRenderingContext2D, id: string, logo: HTMLImageElement | null) => void;
  /** Bump to force a repaint — new data arriving, for instance. */
  drawKey?: unknown;
  logoSrc: string;
  /** Downloaded file is `${filePrefix}-${cardId}.png`. */
  filePrefix: string;
  shareTitle: string;
  shareText: string;
  /** Small print under the buttons, e.g. "figures as of …". */
  footNote?: string;
  /** Told which card is showing, so the caller can fetch what it needs. */
  onSelect?: (id: string) => void;
  /** The selected card is still waiting on data. */
  busy?: boolean;
  width?: number;
  height?: number;
  onClose: () => void;
}

export default function ShareCardModal({
  title = 'Share a card',
  cards,
  groups,
  draw,
  drawKey,
  logoSrc,
  filePrefix,
  shareTitle,
  shareText,
  footNote,
  onSelect,
  busy,
  width = 1080,
  height = 1080,
  onClose,
}: ShareCardModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [group, setGroup] = useState(groups?.[0]?.key ?? null);
  const visible = useMemo(
    () => (group ? cards.filter((k) => k.group === group) : cards),
    [cards, group],
  );
  const [id, setId] = useState(visible[0]?.id ?? cards[0]?.id ?? '');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const [logoReady, setLogoReady] = useState(false);

  const activeGroup = groups?.find((g) => g.key === group) ?? null;

  // Switching tabs lands on that tab's first card rather than leaving the
  // preview on a card the list no longer shows. A panel group draws its own.
  useEffect(() => {
    if (activeGroup?.cardId) {
      setId(activeGroup.cardId);
      return;
    }
    if (visible.length && !visible.some((k) => k.id === id)) setId(visible[0].id);
  }, [visible, id, activeGroup]);

  useEffect(() => {
    if (id) onSelect?.(id);
  }, [id, onSelect]);

  // Load the mark and let the app's fonts settle before the first paint,
  // otherwise the card renders in a fallback face and looks nothing like it should.
  useEffect(() => {
    let alive = true;
    if (!logoSrc) {
      setLogoReady(true);
      return () => {
        alive = false;
      };
    }
    const img = new Image();
    // Token art is served cross-origin; without this the canvas is tainted and
    // toBlob() throws when the card is saved.
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!alive) return;
      logoRef.current = img;
      setLogoReady(true);
    };
    img.onerror = () => {
      if (!alive) return;
      logoRef.current = null;
      setLogoReady(true);
    };
    img.src = logoSrc;
    return () => {
      alive = false;
    };
  }, [logoSrc]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !id) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const go = () => draw(ctx, id, logoRef.current);
    if (fonts?.ready) fonts.ready.then(go);
    else go();
  }, [id, draw, drawKey, logoReady]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const blob = useCallback(
    () =>
      new Promise<Blob | null>((res) =>
        canvasRef.current ? canvasRef.current.toBlob(res, 'image/png') : res(null),
      ),
    [],
  );

  const download = useCallback(async () => {
    const b = await blob();
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filePrefix}-${id}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [blob, filePrefix, id]);

  const copy = useCallback(async () => {
    setSaving(true);
    try {
      const b = await blob();
      if (b && navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } else {
        await download();
      }
    } catch {
      // Clipboard image writes are blocked in some browsers; a download always works.
      await download();
    } finally {
      setSaving(false);
    }
  }, [blob, download]);

  const share = useCallback(async () => {
    const b = await blob();
    if (!b) return;
    const file = new File([b], `${filePrefix}-${id}.png`, { type: 'image/png' });
    type Payload = { files?: File[]; title?: string; text?: string };
    const nav = navigator as Navigator & { canShare?: (d: Payload) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: shareTitle, text: shareText } as Payload).catch(() => {});
    } else {
      await download();
    }
  }, [blob, download, filePrefix, id, shareTitle, shareText]);

  const canShare =
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === 'function';

  // ── Carousel navigation over the visible cards ────────────────────────────
  // A panel group that forces its own card (hideCards) has nothing to page
  // through; everywhere else ‹ › arrows, dots, swipes and arrow keys all move
  // through the same list.
  const canPage = !activeGroup?.hideCards && visible.length > 1;
  const index = Math.max(0, visible.findIndex((k) => k.id === id));
  const go = useCallback(
    (dir: 1 | -1) => {
      if (!canPage) return;
      const list = visible;
      const at = Math.max(0, list.findIndex((k) => k.id === id));
      setId(list[(at + dir + list.length) % list.length].id);
    },
    [canPage, visible, id],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
  };

  const current = visible.find((k) => k.id === id) ?? cards.find((k) => k.id === id) ?? null;

  const iconBtn =
    'rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:opacity-50';

  // z-order on a token page: the portfolio chip is z-[110], the Sleuth FAB
  // z-[120] and the portfolio drawer z-[125] — at z-[100] all three floated over
  // this dialog and swallowed taps on the cards nearest the bottom. Above them,
  // below the devlog (z-[200]).
  const dialog = (
    <div
      className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/70 p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:items-center md:pb-3"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[500px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] md:my-auto">
        {/* Header: title on the left, icon-only actions on the right. */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5">
          <h2 className="truncate text-sm font-bold text-[var(--text)]">{title}</h2>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={download} aria-label="Download PNG" title="Download PNG" className={iconBtn}>
              <IconDownload className="h-4 w-4" />
            </button>
            <button type="button" onClick={copy} disabled={saving} aria-label="Copy image" title="Copy image" className={iconBtn}>
              {copied ? <IconCheck className="h-4 w-4 text-[var(--up)]" /> : <IconCopy className="h-4 w-4" />}
            </button>
            {canShare && (
              <button type="button" onClick={share} aria-label="Share" title="Share" className={iconBtn}>
                <IconShare2 className="h-4 w-4" />
              </button>
            )}
            <span className="mx-1 h-4 w-px bg-[var(--line)]" />
            <button type="button" onClick={onClose} aria-label="Close" className={iconBtn}>
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4 pb-5">
          {/* Category tabs, with the current card's name and blurb underneath. */}
          {groups && groups.length > 1 && (
            <div className="mb-2 flex gap-1.5">
              {groups.map((g) => {
                const on = g.key === group;
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setGroup(g.key)}
                    aria-pressed={on}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-[12px] font-bold transition-colors ${
                      on
                        ? 'border-transparent text-white'
                        : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface)]'
                    }`}
                    style={on ? { background: SHARE_GRAD } : undefined}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          )}
          {current && (
            <div className="mb-2.5 min-h-[38px] text-center">
              <div className="text-[13px] font-bold text-[var(--text)]">{current.name}</div>
              <div className="text-[11px] leading-snug text-[var(--text-faint)]">{current.blurb}</div>
            </div>
          )}

          {activeGroup?.panel && <div className="mb-3">{activeGroup.panel}</div>}

          {/* The carousel: the export canvas itself, arrows riding its edges. */}
          <div className="relative" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div key={id} className="anim-rise relative mx-auto w-full max-w-[420px] overflow-hidden rounded-xl border border-[var(--line)]">
              <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="block h-auto w-full"
                aria-label="Card preview"
              />
              {busy && (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                  Loading the figures…
                </div>
              )}
            </div>
            {canPage && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous card"
                  className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full border border-[var(--line)] bg-[var(--panel)]/90 p-2 text-[var(--text-muted)] shadow-lg backdrop-blur transition-colors hover:text-[var(--text)]"
                >
                  <IconChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next card"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full border border-[var(--line)] bg-[var(--panel)]/90 p-2 text-[var(--text-muted)] shadow-lg backdrop-blur transition-colors hover:text-[var(--text)]"
                >
                  <IconChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {/* Dots when they fit; a plain counter once they wouldn't. */}
          {canPage && (
            <div className="mt-2.5 flex items-center justify-center gap-1.5">
              {visible.length <= 10 ? (
                visible.map((k, i) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setId(k.id)}
                    aria-label={k.name}
                    aria-pressed={i === index}
                    className="rounded-full transition-all"
                    style={{
                      width: i === index ? 18 : 7,
                      height: 7,
                      background: i === index ? SHARE_GRAD : 'var(--line-strong)',
                    }}
                  />
                ))
              ) : (
                <span className="text-[11px] tabular-nums text-[var(--text-faint)]" style={{ fontFamily: MONO }}>
                  {index + 1} / {visible.length}
                </span>
              )}
            </div>
          )}

          {footNote && (
            <p
              className="mt-2 text-center text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]"
              style={{ fontFamily: MONO }}
            >
              {footNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(dialog, document.body) : null;
}
