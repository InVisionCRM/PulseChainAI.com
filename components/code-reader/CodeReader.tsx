'use client';

// The AI Code Reader: any PulseChain contract's verified source and functions,
// with an AI to ask about it. A contract arrives as ?address= — from the site's
// search (SearchModal in code-reader mode, also opened from this page) — so
// picking another one only changes the URL and the reader reloads for it.
//
// "Terminal Ember": the site's navy and orange, set like a code editor, with
// JetBrains Mono for the machine parts and Jost for the human ones. The page is
// dark in either site theme: its root takes the `dark` class and re-tints the
// theme tokens, so the shared SourceCodeTab inside follows along.

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IconArrowUp, IconCheck, IconCopy, IconExternalLink, IconRefresh, IconSearch } from '@tabler/icons-react';
import SearchModal from '@/components/Screener/SearchModal';
import { useScreenerWatchlist } from '@/components/Screener/watchlist';
import SourceCodeTab from '@/components/SourceCodeTab';
import { lookupContract, type ContractLookup } from '@/lib/blockscout';
import { PULSECHAIN_EXPLORER_NAME, pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import { fetchContract, fetchReadMethodsWithValues } from '@/services';
import { isAddressValid } from '@/services/core/errors';
import type { ContractData, ReadMethodWithValue } from '@/services/core/types';

const THEME = {
  '--app-bg': '#0A0F1A',
  '--panel': '#0E1524',
  '--surface': 'rgba(255, 255, 255, 0.03)',
  '--surface-2': 'rgba(255, 255, 255, 0.06)',
  '--surface-3': 'rgba(255, 255, 255, 0.10)',
  '--line': '#1B2537',
  '--line-soft': '#141C2C',
  '--line-strong': '#2A364C',
  '--text': '#E7EBF3',
  '--text-muted': '#8D97AB',
  '--text-faint': '#5B667C',
  '--ember': '#FB9438',
  '--code-accent': '#FB9438',
  backgroundColor: '#0A0F1A',
  backgroundImage:
    'radial-gradient(900px 420px at 12% -8%, rgba(251, 148, 56, 0.11), transparent 62%),' +
    'radial-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px)',
  backgroundSize: 'auto, 22px 22px',
} as React.CSSProperties;

const STYLES = `
.cr-mono { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; }
@keyframes cr-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes cr-blink { 50% { opacity: 0; } }
@keyframes cr-shimmer { from { background-position: -480px 0; } to { background-position: 480px 0; } }
.cr-rise { animation: cr-rise 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
/* The two workspace panels rise only where they appear together. On a phone
   they're switched by display, which would replay the rise on every switch. */
@media (min-width: 1024px) { .cr-panel { animation: cr-rise 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both; } }
.cr-caret { animation: cr-blink 1.05s steps(1) infinite; color: var(--ember); }
.cr-shimmer {
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(251,148,56,0.10) 50%, rgba(255,255,255,0.04) 100%);
  background-size: 960px 100%;
  animation: cr-shimmer 1.6s linear infinite;
}
@media (prefers-reduced-motion: reduce) { .cr-rise, .cr-panel, .cr-caret, .cr-shimmer { animation: none; } }
`;

export default function CodeReader() {
  const raw = useSearchParams().get('address')?.trim() ?? '';
  const address = isAddressValid(raw) ? raw : null;
  const watchlist = useScreenerWatchlist();
  const [searchOpen, setSearchOpen] = useState(false);
  // With nothing to read — arriving, or tapping the nav entry from a contract —
  // the search is what the page is for.
  useEffect(() => {
    if (!raw) setSearchOpen(true);
  }, [raw]);

  // "/" opens the search, as it does on the screener.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && !t.isContentEditable) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openSearch = () => setSearchOpen(true);

  return (
    <div className="dark relative min-h-screen text-[var(--text)]" style={THEME}>
      <style>{STYLES}</style>
      <div className="mx-auto w-full max-w-7xl px-3 pb-10 pt-4 md:px-6 md:pt-6">
        {address ? (
          <Reader key={address} address={address} onSearch={openSearch} />
        ) : (
          <Landing invalid={raw || null} onSearch={openSearch} />
        )}
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} watchlist={watchlist} forCodeReader />
    </div>
  );
}

function Eyebrow() {
  return (
    <p className="cr-mono text-[11px] uppercase tracking-[0.22em] text-[var(--ember)]">
      &gt;_ AI Code Reader <span className="text-[var(--text-faint)]">· PulseChain</span>
    </p>
  );
}

function SearchBar({ onOpen, large = false }: { onOpen: () => void; large?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search a token or contract to read"
      className={`group flex w-full items-center gap-3 rounded-lg border border-[var(--line-strong)] bg-[var(--panel)] text-left transition-colors hover:border-[color:var(--ember)] ${
        large ? 'px-4 py-4' : 'px-3.5 py-2.5'
      }`}
    >
      <IconSearch className="h-4 w-4 shrink-0 text-[var(--ember)]" />
      <span className={`cr-mono flex-1 truncate text-[var(--text-muted)] transition-colors group-hover:text-[var(--text)] ${large ? 'text-[14px]' : 'text-[12px]'}`}>
        search a token or paste any contract address
      </span>
      <kbd className="cr-mono hidden shrink-0 rounded border border-[var(--line-strong)] px-1.5 py-0.5 text-[10px] text-[var(--text-faint)] sm:inline-block">
        /
      </kbd>
    </button>
  );
}

function Landing({ invalid, onSearch }: { invalid: string | null; onSearch: () => void }) {
  return (
    <section className="mx-auto max-w-3xl pt-10 md:pt-20">
      <div className="cr-rise">
        <Eyebrow />
      </div>
      <h1 className="cr-rise mt-4 font-jost text-[36px] font-semibold leading-[1.04] tracking-tight md:text-[56px]" style={{ animationDelay: '60ms' }}>
        Read any PulseChain contract<span className="text-[var(--ember)]">.</span>
      </h1>
      <p className="cr-rise mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--text-muted)]" style={{ animationDelay: '120ms' }}>
        Search a token or paste a contract address. You get its verified source, every function, and an AI you can ask
        about it.
      </p>
      <div className="cr-rise mt-8" style={{ animationDelay: '180ms' }}>
        <SearchBar onOpen={onSearch} large />
      </div>
      {invalid ? (
        <p className="cr-mono mt-3 break-all text-[12px] text-red-400">“{invalid}” isn’t a contract address.</p>
      ) : null}
    </section>
  );
}

type Source = { status: 'loading' } | { status: 'ready'; data: ContractData } | { status: 'failed' };

function Reader({ address, onSearch }: { address: string; onSearch: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [lookup, setLookup] = useState<ContractLookup>({ status: 'loading' });
  const [source, setSource] = useState<Source>({ status: 'loading' });
  const [readValues, setReadValues] = useState<ReadMethodWithValue[]>([]);
  // Phones show one panel at a time; wide screens show both side by side.
  const [view, setView] = useState<'code' | 'chat'>('code');

  useEffect(() => {
    let alive = true;
    setLookup({ status: 'loading' });
    setSource({ status: 'loading' });
    lookupContract(address).then((result) => {
      if (alive) setLookup(result);
    });
    fetchContract(address).then((result) => {
      if (alive) setSource(result.success && result.data ? { status: 'ready', data: result.data } : { status: 'failed' });
    });
    return () => {
      alive = false;
    };
  }, [address, attempt]);

  const contract = source.status === 'ready' && source.data.source_code ? source.data : null;

  // Live values for the read functions, once there is source to show them in.
  useEffect(() => {
    if (!contract) return;
    let alive = true;
    fetchReadMethodsWithValues(address).then((result) => {
      if (alive && result.success && result.data) setReadValues(result.data);
    });
    return () => {
      alive = false;
    };
  }, [address, contract]);

  const name = contract?.name || (lookup.status === 'contract' ? lookup.name : null);
  const verified = contract ? true : lookup.status === 'contract' ? lookup.verified : null;
  const settled = source.status !== 'loading' && lookup.status !== 'loading';

  let body: React.ReactNode;
  if (lookup.status === 'not-contract') {
    body = (
      <Notice kicker="no contract" title="There’s no contract at this address" onSearch={onSearch}>
        On PulseChain this address is a wallet or has never been used, so there is no code to read.
      </Notice>
    );
  } else if (contract) {
    body = <Workspace contract={contract} address={address} readValues={readValues} view={view} onView={setView} />;
  } else if (!settled) {
    body = <Loading />;
  } else if (lookup.status === 'contract' && !lookup.verified) {
    body = (
      <Notice kicker="unverified" title="This contract’s source isn’t verified" onSearch={onSearch}>
        The contract exists, but its source code hasn’t been verified on PulseChain’s explorer or on Sourcify, so
        there’s nothing to read or ask about.
      </Notice>
    );
  } else {
    body = (
      <Notice
        kicker="no answer"
        title="Couldn’t load this contract"
        onSearch={onSearch}
        action={
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="cr-mono inline-flex items-center gap-2 rounded-md bg-[var(--ember)] px-3.5 py-2 text-[12px] font-semibold text-[#0A0F1A] transition-opacity hover:opacity-90"
          >
            <IconRefresh className="h-3.5 w-3.5" /> try again
          </button>
        }
      >
        Neither PulseChain’s explorer nor Sourcify returned its source just now.
      </Notice>
    );
  }

  return (
    <>
      <div className="cr-rise flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Eyebrow />
        <div className="w-full md:max-w-md">
          <SearchBar onOpen={onSearch} />
        </div>
      </div>
      {lookup.status !== 'not-contract' ? (
        <Header address={address} name={name} verified={verified} contract={contract} pending={!settled && !name} />
      ) : null}
      {body}
    </>
  );
}

function Header({
  address,
  name,
  verified,
  contract,
  pending,
}: {
  address: string;
  name: string | null;
  verified: boolean | null;
  contract: ContractData | null;
  pending: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  const fns = (contract?.abi ?? []).filter((f) => f.type === 'function');
  const reads = fns.filter((f) => f.stateMutability === 'view' || f.stateMutability === 'pure').length;

  return (
    <header className="cr-rise mt-6 md:mt-8" style={{ animationDelay: '60ms' }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {pending ? (
          <span className="cr-shimmer block h-9 w-64 rounded-md" aria-label="Loading contract name" />
        ) : (
          <h1 className="break-all font-jost text-[28px] font-semibold leading-tight tracking-tight md:text-[38px]">
            {name ?? 'Unnamed contract'}
          </h1>
        )}
        {verified !== null ? (
          <span
            className={`cr-mono rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
              verified ? 'border-[color:var(--ember)] text-[var(--ember)]' : 'border-red-400/50 text-red-400'
            }`}
          >
            {verified ? 'verified source' : 'unverified'}
          </span>
        ) : null}
      </div>
      <div className="cr-mono mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[var(--text-muted)]">
        <span className="break-all text-[var(--text)]">{address}</span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy address"
          className="inline-flex items-center gap-1 transition-colors hover:text-[var(--ember)]"
        >
          {copied ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
          {copied ? 'copied' : 'copy'}
        </button>
        <a
          href={pulsechainAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 transition-colors hover:text-[var(--ember)]"
        >
          {PULSECHAIN_EXPLORER_NAME} <IconExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      {contract ? (
        <div className="cr-mono mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--text-faint)]">
          {contract.compiler_version ? <Chip>solc {contract.compiler_version.replace(/^v/, '')}</Chip> : null}
          <Chip>optimizer {contract.optimization_enabled ? 'on' : 'off'}</Chip>
          <Chip>
            {reads} read · {fns.length - reads} write
          </Chip>
        </div>
      ) : null}
    </header>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5">{children}</span>;
}

function PanelBar({ label }: { label: string }) {
  return (
    <div className="cr-mono flex items-center gap-2 border-b border-[var(--line)] px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--ember)] shadow-[0_0_8px_var(--ember)]" />
      {label}
    </div>
  );
}

function Notice({
  kicker,
  title,
  children,
  action,
  onSearch,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  onSearch: () => void;
}) {
  return (
    <section className="cr-rise mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 md:p-8" style={{ animationDelay: '120ms' }}>
      <p className="cr-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ember)]">{kicker}</p>
      <h2 className="mt-2 font-jost text-[22px] font-semibold md:text-[26px]">{title}</h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--text-muted)]">{children}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {action}
        <button
          type="button"
          onClick={onSearch}
          className="cr-mono inline-flex items-center gap-2 rounded-md border border-[var(--line-strong)] px-3.5 py-2 text-[12px] text-[var(--text)] transition-colors hover:border-[color:var(--ember)]"
        >
          <IconSearch className="h-3.5 w-3.5" /> search another
        </button>
      </div>
    </section>
  );
}

function Loading() {
  return (
    <section className="cr-rise mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)]" style={{ animationDelay: '120ms' }}>
      <PanelBar label="source" />
      <div className="space-y-2.5 p-5">
        {[72, 46, 84, 58, 38, 76, 52, 64].map((w, i) => (
          <div key={i} className="cr-shimmer h-3 rounded" style={{ width: `${w}%` }} />
        ))}
        <p className="cr-mono pt-3 text-[12px] text-[var(--text-muted)]">
          fetching source from the explorer and Sourcify<span className="cr-caret">▍</span>
        </p>
      </div>
    </section>
  );
}

function Workspace({
  contract,
  address,
  readValues,
  view,
  onView,
}: {
  contract: ContractData;
  address: string;
  readValues: ReadMethodWithValue[];
  view: 'code' | 'chat';
  onView: (v: 'code' | 'chat') => void;
}) {
  const fns = contract.abi.filter((f) => f.type === 'function');
  const abiReads = fns.filter((f) => f.stateMutability === 'view' || f.stateMutability === 'pure');
  const writes = fns.filter((f) => f.stateMutability === 'nonpayable' || f.stateMutability === 'payable');

  return (
    <div className="mt-6">
      <div className="cr-mono mb-3 grid grid-cols-2 gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1 text-[12px] lg:hidden">
        {(['code', 'chat'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => onView(v)}
            className={`rounded-md py-2 uppercase tracking-[0.16em] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[color:var(--ember)] ${
              view === v ? 'bg-[var(--ember)] font-semibold text-[#0A0F1A]' : 'text-[var(--text-muted)]'
            }`}
          >
            {v === 'code' ? 'Code' : 'Ask AI'}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <section
          className={`cr-panel min-w-0 rounded-xl border border-[var(--line)] bg-[var(--panel)] ${view === 'code' ? '' : 'hidden'} lg:block`}
          style={{ animationDelay: '120ms' }}
        >
          <PanelBar label="source" />
          <div className="p-3 md:p-4">
            <SourceCodeTab
              sourceCode={contract.source_code}
              readFunctions={readValues.length > 0 ? readValues : abiReads}
              writeFunctions={writes}
            />
          </div>
        </section>
        <section
          className={`cr-panel ${view === 'chat' ? 'flex' : 'hidden'} lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-8rem)]`}
          style={{ animationDelay: '180ms' }}
        >
          <ChatPanel contract={contract} address={address} />
        </section>
      </div>
    </div>
  );
}

interface ChatMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
  failed?: boolean;
}

const QUICK_QUESTIONS = [
  'What does this contract do?',
  'Are there any taxes or fees?',
  'What can the owner change?',
  'Is anything here risky?',
];

function ChatPanel({ contract, address }: { contract: ContractData; address: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || sending) return;
    setMessages((m) => [...m, { id: Date.now(), role: 'user', text }]);
    setDraft('');
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The route builds its prompt from the contract's name, source and address.
        body: JSON.stringify({
          message: text,
          mode: 'pro',
          contractData: { name: contract.name, source_code: contract.source_code, address },
        }),
      });
      const json = await res.json().catch(() => null);
      const reply: ChatMessage =
        res.ok && typeof json?.response === 'string'
          ? { id: Date.now(), role: 'ai', text: json.response }
          : { id: Date.now(), role: 'ai', text: json?.error ?? `The AI didn’t answer (HTTP ${res.status}).`, failed: true };
      setMessages((m) => [...m, reply]);
    } catch {
      setMessages((m) => [...m, { id: Date.now(), role: 'ai', text: 'Couldn’t reach the AI — check your connection and try again.', failed: true }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-[62vh] w-full flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)] lg:min-h-0">
      <PanelBar label="ask the ai" />
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div>
            <p className="font-jost text-[18px] font-medium">Ask about {contract.name || 'this contract'}</p>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">The AI reads this contract’s source before it answers.</p>
            <div className="mt-4 grid gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  className="cr-mono rounded-md border border-[var(--line)] px-3 py-2 text-left text-[12px] text-[var(--text-muted)] transition-colors hover:border-[color:var(--ember)] hover:text-[var(--text)]"
                >
                  <span className="text-[var(--ember)]">→</span> {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-lg border border-[rgba(251,148,56,0.4)] bg-[rgba(251,148,56,0.1)] px-3 py-2 text-[14px]">
                  {m.text}
                </p>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2.5">
                <span className={`cr-mono mt-0.5 shrink-0 text-[13px] ${m.failed ? 'text-red-400' : 'text-[var(--ember)]'}`}>&gt;</span>
                {m.failed ? (
                  <p className="text-[14px] text-red-400">{m.text}</p>
                ) : (
                  <div className="min-w-0 flex-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN}>
                      {m.text}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ),
          )
        )}
        {sending ? (
          <p className="cr-mono text-[12px] text-[var(--text-muted)]">
            reading the contract<span className="cr-caret">▍</span>
          </p>
        ) : null}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className="flex items-center gap-2 border-t border-[var(--line)] p-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="ask anything about this contract…"
          aria-label="Ask the AI about this contract"
          className="cr-mono min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--app-bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[color:var(--ember)]"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Ask"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--ember)] text-[#0A0F1A] transition-opacity disabled:opacity-35"
        >
          <IconArrowUp className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

// The chat route answers in markdown — headings, lists, tables, code.
const MARKDOWN: Components = {
  h1: ({ children }) => <h3 className="mb-1 mt-3 font-jost text-[16px] font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-1 mt-3 font-jost text-[16px] font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 mt-3 font-jost text-[14px] font-semibold first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="my-1.5 text-[14px] leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5 text-[14px] marker:text-[var(--ember)]">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5 text-[14px] marker:text-[var(--ember)]">{children}</ol>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--ember)] underline underline-offset-2">
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-[var(--line)]" />,
  pre: ({ children }) => (
    <pre className="cr-mono my-2 overflow-x-auto rounded-md border border-[var(--line)] bg-[#070B14] p-3 text-[12px] leading-relaxed [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[var(--text)]">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="cr-mono rounded bg-[var(--surface-2)] px-1 py-0.5 text-[12px] text-[var(--ember)]">{children}</code>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="cr-mono w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-[var(--line)] px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-[var(--line)] px-2 py-1 align-top">{children}</td>,
};
