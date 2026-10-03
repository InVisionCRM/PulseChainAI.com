'use client';

// Home-page promo for the token page's AI code agent (the "Code" tab): a slim
// terminal strip that types the questions the agent actually answers, linking
// straight into the Morbius token's Code tab so the first click lands on a
// working example.
//
// The copy describes what the agent does — it reads the verified source and
// answers questions about it — and never shows a result, because a made-up
// "0% tax, renounced" line would be a claim about a real contract.

import Link from 'next/link';
import { PINNED_TOKENS } from '@/lib/screener/pinned';
import { useTypewriter } from './AdBanner';

/** Questions the agent answers out of the box — its own starter and follow-up
 *  prompts in components/TokenAIChat.tsx. */
const QUESTIONS = [
  'does this token have taxes?',
  'what does this contract do?',
  'can the owner mint more tokens?',
  'what powers does the owner have?',
];

const MORBIUS = PINNED_TOKENS.find((t) => t.symbol === 'Morbius')!;
const HREF = `/geicko?address=${MORBIUS.address}&tab=contract`;

const MONO = { fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' } as const;

export default function AiCodeAgentAd() {
  const q = useTypewriter(QUESTIONS);

  return (
    <Link
      href={HREF}
      aria-label="Try the AI code agent on the Morbius token's Code tab"
      className="group relative block h-12 w-full overflow-hidden rounded-lg border border-[#39FF88]/25 bg-[#0B1020] sm:h-14"
      style={MONO}
    >
      {/* Faint scanlines and a green glow from the left — a terminal, not a poster. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(57,255,136,0.05) 0 1px, transparent 1px 3px), radial-gradient(120% 140% at 0% 50%, rgba(57,255,136,0.16), transparent 60%)',
        }}
      />

      <div className="relative flex h-full items-center gap-3 px-3 sm:px-4">
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12px] text-[#E6FFF0] sm:text-[14px]">
            <span className="mr-2 hidden rounded bg-[#39FF88]/15 px-1 align-[0.1em] text-[9px] font-bold uppercase tracking-wider text-[#39FF88] sm:inline">
              New
            </span>
            <span className="text-[#39FF88]">&gt; ask_ai(</span>
            <span className="text-[#E6FFF0]">&quot;{q}</span>
            <span className="ml-px inline-block h-[1em] w-[7px] animate-pulse bg-[#39FF88] align-[-0.15em]" />
            <span className="text-[#E6FFF0]">&quot;</span>
            <span className="text-[#39FF88]">)</span>
          </div>
          <div className="hidden truncate text-[11px] text-[#39FF88]/60 sm:block">
            AI reads any token&apos;s verified contract and answers in plain English
          </div>
        </div>

        <span className="shrink-0 rounded-full border border-[#39FF88]/60 bg-[#39FF88]/10 px-3 py-1 text-[11px] font-bold text-[#39FF88] shadow-[0_0_12px_rgba(57,255,136,0.25)] transition-colors group-hover:bg-[#39FF88] group-hover:text-[#0B1020]">
          Ask the AI →
        </span>
      </div>

    </Link>
  );
}
