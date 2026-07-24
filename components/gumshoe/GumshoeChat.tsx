'use client';

// Gumshoe — the ask-anything on-chain analyst, as a floating chat widget on the
// geicko token pages. It's context-aware (knows the token you're viewing), talks
// to /api/gumshoe (Gemini function-calling over our on-chain tools), and uses the
// user's own Gemini key when they've added one (BYOK) — otherwise the shared
// free-tier key, which is rate-limited.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { IconSearch, IconX, IconArrowUp, IconLoader2, IconKey } from '@tabler/icons-react';
import { useApiKey } from '@/lib/hooks/useApiKey';

interface Msg { role: 'user' | 'assistant'; text: string; tools?: string[]; error?: boolean }

const SUGGESTIONS = [
  'How many of the holders are connected to the creator wallet?',
  'Are the first buyers connected — did the founder use multiple wallets?',
  'How many of these holders also hold HEX?',
  "Where did the biggest holder's money come from?",
];

// Friendly labels for the "checked …" chips.
const TOOL_LABELS: Record<string, string> = {
  get_token_overview: 'overview',
  get_forensics: 'forensics',
  analyze_connections: 'wallet connections',
  get_top_holders: 'holders',
  get_liquidity: 'liquidity',
  get_volume_history: 'volume',
  trace_wallet_funding: 'funding trace',
  classify_addresses: 'address labels',
  get_lp_position: 'LP position',
  resolve_token: 'token lookup',
  holder_overlap: 'holder overlap',
  check_wallet_link: 'wallet link',
};

const MD = {
  p: (p: any) => <p className="my-1 leading-relaxed" {...p} />,
  ul: (p: any) => <ul className="my-1 ml-4 list-disc space-y-0.5" {...p} />,
  ol: (p: any) => <ol className="my-1 ml-4 list-decimal space-y-0.5" {...p} />,
  li: (p: any) => <li className="leading-relaxed" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-[var(--text)]" {...p} />,
  h3: (p: any) => <h3 className="mt-2 mb-1 text-sm font-semibold text-[var(--text)]" {...p} />,
  h2: (p: any) => <h3 className="mt-2 mb-1 text-sm font-semibold text-[var(--text)]" {...p} />,
  code: (p: any) => <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]" {...p} />,
  a: (p: any) => <a className="text-[#FA4616] underline" target="_blank" rel="noopener noreferrer" {...p} />,
};

export default function GumshoeChat({
  token, network, symbol,
}: { token: string | null; network: string; symbol?: string | null }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const { apiKey, saveApiKey, hasApiKey } = useApiKey();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Render through a portal to <body> so the widget escapes the geicko page's
  // `isolate`/`overflow-hidden` stacking context — otherwise the global bottom
  // nav and footer paint over it and fixed positioning glitches on scroll.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, loading]);

  // Reset the thread when the token changes — a new subject is a new case.
  useEffect(() => { setMsgs([]); }, [token]);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput('');
    const history = msgs.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
    setMsgs((prev) => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const r = await fetch('/api/gumshoe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'x-user-api-key': apiKey } : {}) },
        body: JSON.stringify({ message: q, history, token, network }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        if (r.status === 429 || r.status === 401 || r.status === 503) setShowKey(true);
        setMsgs((prev) => [...prev, { role: 'assistant', text: d?.error || 'Something went wrong.', error: true }]);
      } else {
        setMsgs((prev) => [...prev, { role: 'assistant', text: d?.answer || 'No answer.', tools: d?.toolsUsed }]);
      }
    } catch {
      setMsgs((prev) => [...prev, { role: 'assistant', text: 'Network error — please try again.', error: true }]);
    } finally {
      setLoading(false);
    }
  }, [apiKey, loading, msgs, token, network]);

  const saveKey = () => {
    if (keyDraft.trim()) { saveApiKey(keyDraft.trim()); setKeyDraft(''); setShowKey(false); }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Floating button — hidden while the panel is open so it never overlaps
          the composer on mobile; the panel's header X handles closing. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask Sleuth"
          className="fixed bottom-20 right-4 z-[120] flex h-12 w-12 items-center justify-center rounded-full bg-[#FA4616] text-white shadow-lg shadow-black/40 transition-transform hover:scale-105 md:bottom-6"
        >
          <IconSearch className="h-5 w-5" />
        </button>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-[120] mx-auto flex h-[70vh] max-h-[640px] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl md:inset-x-auto md:right-4 md:bottom-24 md:h-[600px] md:w-[420px] md:rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FA4616]/15 text-[#FA4616]">
                <IconSearch className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-[var(--text)]">Sleuth</div>
                <div className="text-[10px] text-[var(--text-faint)]">
                  on-chain analyst{symbol ? ` · ${symbol}` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                title={hasApiKey() ? 'Your Gemini key is set' : 'Add your Gemini API key'}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-2)] ${hasApiKey() ? 'text-[var(--up)]' : 'text-[var(--text-faint)]'}`}
              >
                <IconKey className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-faint)] hover:bg-[var(--surface-2)]">
                <IconX className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* BYOK panel */}
          {showKey && (
            <div className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <div className="mb-1.5 text-[11px] text-[var(--text-muted)]">
                Add your own free Gemini API key to skip rate limits. Get one at
                {' '}<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] underline">aistudio.google.com/apikey</a>. Stored only in your browser.
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder={hasApiKey() ? 'Key set — enter a new one to replace' : 'AIza…'}
                  className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-xs text-[var(--text)] focus:border-[#FA4616]/60 focus:outline-none"
                />
                <button type="button" onClick={saveKey} disabled={!keyDraft.trim()} className="rounded-md bg-[#FA4616] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Save</button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {msgs.length === 0 && (
              <div className="pt-2">
                <p className="text-sm text-[var(--text-muted)]">
                  Ask me anything about {symbol ? <span className="font-semibold text-[var(--text)]">{symbol}</span> : 'this token'} — creator behavior, whether the first buyers are connected, holders, liquidity, volume, funding trails. I read the chain and answer from real data.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left text-xs text-[var(--text-muted)] transition-colors hover:border-[#FA4616]/40 hover:text-[var(--text)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-[#FA4616] px-3 py-2 text-sm text-white'
                      : `max-w-[92%] rounded-2xl rounded-bl-sm border px-3 py-2 text-sm ${m.error ? 'border-red-500/30 bg-red-500/5 text-red-300' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)]'}`
                  }
                >
                  {m.role === 'assistant' ? (
                    <div className="text-sm">
                      <ReactMarkdown components={MD as any}>{m.text}</ReactMarkdown>
                      {!!m.tools?.length && (
                        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-[var(--line)] pt-1.5">
                          <span className="text-[9px] uppercase tracking-wider text-[var(--text-faint)]">checked</span>
                          {m.tools.map((t) => (
                            <span key={t} className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] text-[var(--text-faint)]">
                              {TOOL_LABELS[t] ?? t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    m.text
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                Reading the chain…
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-[var(--line)] p-2">
            <div className="flex items-end gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 focus-within:border-[#FA4616]/50">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                rows={1}
                placeholder="Ask Sleuth…"
                className="max-h-24 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FA4616] text-white transition-opacity disabled:opacity-40"
              >
                <IconArrowUp className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 px-1 text-center text-[9px] text-[var(--text-faint)]">
              Sleuth reads on-chain data. Not financial advice. Can make mistakes — verify what matters.
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
