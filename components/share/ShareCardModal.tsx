'use client';

// Pick a card, get a 1080×1080 PNG. The canvas is the real output — the preview
// is that same canvas scaled down with CSS, so what you see is exactly what
// downloads rather than an approximation of it.
//
// This is SuperStake's picker generalised: it knows nothing about what it is
// drawing. Callers pass a card list and a `draw` function, and optionally a set
// of category tabs (the token pages split cards into All time / Short term).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconX, IconDownload, IconCopy, IconCheck, IconShare2 } from '@tabler/icons-react';

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
  /** Tab bar over the card list. Omit for a single flat list. */
  groups?: { key: string; label: string }[];
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

  // Switching tabs lands on that tab's first card rather than leaving the
  // preview on a card the list no longer shows.
  useEffect(() => {
    if (visible.length && !visible.some((k) => k.id === id)) setId(visible[0].id);
  }, [visible, id]);

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="my-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-sm font-bold text-[var(--text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
          <div className="order-2 md:order-1">
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
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors ${
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
            {/* Two columns even on desktop — a single long column would be
                mostly below the fold. */}
            <div className="grid max-h-[46vh] grid-cols-2 gap-1.5 overflow-y-auto md:max-h-[58vh]">
              {visible.map((k) => {
                const on = k.id === id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setId(k.id)}
                    aria-pressed={on}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      on
                        ? 'border-transparent text-white'
                        : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface)]'
                    }`}
                    style={on ? { background: SHARE_GRAD } : undefined}
                  >
                    <div className="text-[13px] font-bold">{k.name}</div>
                    <div className={`text-[11px] leading-snug ${on ? 'opacity-85' : 'text-[var(--text-faint)]'}`}>
                      {k.blurb}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* live preview — the very canvas that gets exported */}
          <div className="order-1 md:order-2">
            <div className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-xl border border-[var(--line)]">
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

            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={download}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition-transform hover:-translate-y-px"
                style={{ background: SHARE_GRAD }}
              >
                <IconDownload className="h-3.5 w-3.5" /> Download PNG
              </button>
              <button
                type="button"
                onClick={copy}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-60"
              >
                {copied ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy image'}
              </button>
              {canShare && (
                <button
                  type="button"
                  onClick={share}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  <IconShare2 className="h-3.5 w-3.5" /> Share
                </button>
              )}
            </div>
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
    </div>
  );
}
