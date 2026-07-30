'use client';

// Buy and the project's links, floating over /superstake.
//
// They used to sit in the header, which meant the call to action was only in
// reach before the reader had been given any reason to act on it. Here it holds
// at every scroll position instead. On a phone it spreads into a bar along the
// bottom edge so the button lands under a thumb.
//
// Bottom-right is free on this route: the Richard Heart chat card only renders
// on /admin-stats and the Gumshoe widget only on token pages.

import { useEffect, useState } from 'react';
import { IconArrowRight } from '@tabler/icons-react';

const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';

/**
 * Read off the pSSH DexScreener token profile — the same source the geicko page
 * reads socials from — rather than typed from memory.
 */
const LINKS = [
  { href: 'https://superstake.win', label: 'superstake.win', icon: Globe },
  { href: 'https://x.com/superstakewin', label: '@superstakewin on X', icon: XMark },
  { href: 'https://t.me/superstakehex', label: 'Telegram', icon: Telegram },
] as const;

export interface ActionDockProps {
  /** pSSH contract, for the swap link and the scanner link. */
  token: string;
}

export default function ActionDock({ token }: ActionDockProps) {
  // Same swap URL shape the portfolio's token card already links to.
  const buyHref = `https://app.pulsex.com/swap?outputCurrency=${token}`;
  // Anything floating over a page covers some of it. Once the reader is past
  // the headline the dock narrows to the button alone — a third of the width —
  // and opens again on hover or keyboard focus. The buy link never leaves.
  const [tight, setTight] = useState(false);
  useEffect(() => {
    // The app scrolls its `<main>`, not the window, so a listener bound to
    // `window` never hears anything. Capturing on the document catches the
    // scroll whichever element is actually doing it.
    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement | Document;
      const top = el instanceof HTMLElement ? el.scrollTop : window.scrollY;
      setTight(top > 240);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  return (
    <>
      {/* ── phone: a bar along the bottom edge ── */}
      <div
        className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-between gap-3 border-t border-[var(--line)] px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2.5 md:hidden"
        style={{
          background:
            'linear-gradient(180deg,color-mix(in srgb,var(--app-bg) 40%,transparent),var(--app-bg) 42%)',
        }}
      >
        <Links token={token} />
        <Buy href={buyHref} />
      </div>

      {/* ── desktop: a dock off the bottom-right corner ── */}
      <div
        className="group fixed bottom-4 right-4 z-[60] hidden items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[color-mix(in_srgb,var(--panel)_92%,transparent)] p-1.5 shadow-2xl shadow-black/50 backdrop-blur md:flex"
        onFocus={() => setTight(false)}
      >
        <span
          className={`flex items-center overflow-hidden transition-[max-width,opacity] duration-300 group-hover:max-w-[140px] group-hover:opacity-100 group-focus-within:max-w-[140px] group-focus-within:opacity-100 motion-reduce:transition-none ${
            tight ? 'max-w-0 opacity-0' : 'max-w-[140px] opacity-100'
          }`}
        >
          <Links token={token} />
          <span aria-hidden className="my-0.5 ml-2 w-px self-stretch bg-[var(--line)]" />
        </span>
        <Buy href={buyHref} />
      </div>
    </>
  );
}

function Links({ token }: { token: string }) {
  const cls =
    'grid h-7 w-7 place-items-center rounded-full border border-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--line)] hover:bg-[var(--surface)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--line-strong)] md:h-7 md:w-7';
  return (
    <span className="flex items-center gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={cls}
        >
          <Icon />
        </a>
      ))}
      <a href={`/geicko?address=${token}`} aria-label="pSSH on the scanner" title="pSSH on the scanner" className={cls}>
        <Scanner />
      </a>
    </span>
  );
}

function Buy({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold tracking-[-0.01em] text-white transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none motion-reduce:hover:scale-100"
      style={{ background: GRAD }}
    >
      Buy pSSH
      <IconArrowRight className="h-3.5 w-3.5" />
    </a>
  );
}

/* ── icons: inline so the dock costs no extra request ────────────────────── */

function Globe() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] fill-current" aria-hidden>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 9h-3a15 15 0 0 0-1.2-5.3A8 8 0 0 1 18.9 11ZM12 4.2c.8 1.1 1.6 3.2 1.8 6.8h-3.6c.2-3.6 1-5.7 1.8-6.8ZM4.3 13h3c.1 2 .5 3.9 1.2 5.3A8 8 0 0 1 4.3 13Zm3-2h-3a8 8 0 0 1 4.2-5.3A15 15 0 0 0 7.3 11ZM12 19.8c-.8-1.1-1.6-3.2-1.8-6.8h3.6c-.2 3.6-1 5.7-1.8 6.8Zm2.7-1.5c.7-1.4 1.1-3.3 1.2-5.3h3a8 8 0 0 1-4.2 5.3Z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] fill-current" aria-hidden>
      <path d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5.1 21H2l7.3-8.3L2.4 3h6.4l4.4 5.8L17.5 3Zm-1.1 16.1h1.7L7.7 4.8H5.9l10.5 14.3Z" />
    </svg>
  );
}

function Telegram() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] fill-current" aria-hidden>
      <path d="M21.7 4.3 18.6 19c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.8-8c.4-.3-.1-.5-.6-.2L6.6 13.1l-4.7-1.5c-1-.3-1-1 .2-1.5l18.3-7c.9-.3 1.6.2 1.3 1.2Z" />
    </svg>
  );
}

function Scanner() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] fill-current" aria-hidden>
      <path d="M10.5 3a7.5 7.5 0 1 1-4.6 13.4l-2.6 2.6a1.2 1.2 0 0 1-1.7-1.7l2.6-2.6A7.5 7.5 0 0 1 10.5 3Zm0 2.4a5.1 5.1 0 1 0 0 10.2 5.1 5.1 0 0 0 0-10.2Z" />
    </svg>
  );
}
