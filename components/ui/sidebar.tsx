"use client";
import { cn } from "@/lib/utils";
import React, { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { IconRocket, IconX } from "@tabler/icons-react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/types";
import { useApiKey } from "@/lib/hooks/useApiKey";
import { WatchlistPanel } from "@/components/portfolio/WatchlistPanel";
import { InstallButton } from "@/components/pwa/InstallButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

/**
 * Static navigation column. Always visible on md+, sits in normal flow and
 * pushes content — no rail, no overlay, no animation. Styled to match the
 * portfolio/glass theme. Mobile navigation is handled by MobileBottomNav.
 */
export const SidebarBody = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  // The nav and the watchlist split the column's free height. Expanding hands
  // the nav's half over rather than overlaying it — same doubled list, without
  // a floating layer that has to guess at z-index and its own scrolling.
  const [watchlistExpanded, setWatchlistExpanded] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex h-full w-[230px] shrink-0 flex-col",
        "bg-[var(--surface)] backdrop-blur-xl border-r border-[var(--line)]",
        className,
      )}
    >
      {/* Compact brand header — small mark + wordmark, not the tall banner. */}
      <a href="/" className="flex items-center gap-2 px-3 py-2.5 shrink-0 border-b border-[var(--line)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/morbius-mark.png" alt="Morbius" className="h-7 w-7 shrink-0 rounded-lg object-contain" />
        <span className="text-[15px] font-bold tracking-tight text-[var(--text)]">Scan.Morbius</span>
      </a>

      {/* Nav — top portion. Scrolls internally if the links overflow. NOTE:
          this must NOT be a flex container — the children wrapper carries
          `flex-1`, which (in a flex parent) clamps it to the visible height
          while its real content overflows and paints over the watchlist
          below. Keeping this a plain block lets that flex-1 go inert so the
          content sizes naturally and this box scrolls it. */}
      {!watchlistExpanded && (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-2 pb-2">
          {children}
        </div>
      )}

      {/* Watchlist — takes the whole column between header and utilities once
          expanded, roughly double its usual height. */}
      <div className="flex flex-1 min-h-0 flex-col border-t border-[var(--line)] px-2 pt-2 pb-1">
        <WatchlistPanel
          variant="rail"
          expanded={watchlistExpanded}
          onToggleExpanded={() => setWatchlistExpanded((v) => !v)}
        />
      </div>

      {/* Utilities + chat — pinned to the very bottom, in that order. */}
      <SidebarUtilityRow />
      <div className="shrink-0 border-t border-[var(--line)] px-2 py-2">
        <RichardHeartChat />
      </div>
    </aside>
  );
};

/**
 * Get Morbius / Install / Theme, as three compact tiles above the chat button.
 *
 * Was a stacked icon-over-label row at the top of the nav, which cost about
 * 46px of the column; laid out horizontally at half that. Labels truncate
 * rather than wrap, so a narrower column degrades to icons on its own instead
 * of growing a second line. Flex-1 rather than a 3-up grid so the row stays
 * even when Install hides itself — already installed, or a browser with no
 * install prompt.
 */
const SidebarUtilityRow = () => (
  <div className="shrink-0 border-t border-[var(--line)] px-2 pt-2">
    <div className="flex items-stretch gap-1">
      <a
        href="https://pump.tires/token/0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1"
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1 text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
        title="Get Morbius"
      >
        <IconRocket className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
        <span className="truncate text-[10px] font-semibold leading-none">Morbius</span>
      </a>

      <InstallButton variant="tile" />
      <ThemeToggle variant="tile" />
    </div>
  </div>
);

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
}) => {
  const pathname = usePathname();
  const active = !link.href.startsWith('http') && pathname === link.href;
  return (
    <a
      href={link.href}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors",
        active
          ? "bg-[var(--surface-2)] text-orange-300"
          : "text-[var(--text)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
        className,
      )}
      {...props}
    >
      {link.icon}
      <span
        className={cn(
          "text-xs md:text-sm whitespace-pre inline-block",
          active ? "text-orange-300 font-medium" : "text-[var(--text)]",
        )}
      >
        {link.label}
      </span>
    </a>
  );
};

// Richard Heart Chat — collapsed button pinned to the column's bottom.
const RichardHeartChat = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'intro',
      text: "What's on your mind today? Markets, mindset, or something bold?",
      sender: 'ai',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { getApiKey } = useApiKey();

  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isSending) return;
      const trimmed = messageText.trim();

      const nextUserMessage: Message = {
        id: String(Date.now()),
        text: trimmed,
        sender: 'user',
      };
      const aiMessageId = String(Date.now() + 1);
      const aiPlaceholder: Message = { id: aiMessageId, text: '', sender: 'ai' };

      const historyPayload = [...messages, nextUserMessage];

      setMessages((prev) => [...prev, nextUserMessage, aiPlaceholder]);
      setIsSending(true);

      try {
        const userApiKey = getApiKey();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (userApiKey) headers['x-user-api-key'] = userApiKey;

        const res = await fetch('/api/richard-heart', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: trimmed,
            history: historyPayload,
          }),
        });
        if (!res.ok || !res.body) {
          throw new Error('No response body from server');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            accumulated += chunk;
            const textCopy = accumulated;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId ? { ...msg, text: textCopy } : msg
              )
            );
          }
        }

        if (!accumulated) {
          throw new Error('Empty response from model');
        }
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  text: "Connection glitched. Ask again and we'll keep it rolling.",
                }
              : msg
          )
        );
      } finally {
        setIsSending(false);
      }
    },
    [getApiKey, isSending, messages]
  );

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="mt-auto mb-1 flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--line)] transition-colors"
      >
        <div className="w-8 h-8 rounded-full border border-[var(--line-strong)] overflow-hidden flex-shrink-0">
          <Image
            src="/RH.png"
            alt="Richard Heart"
            width={32}
            height={32}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>
        <span className="text-[var(--text)] text-sm font-medium">Chat with RH</span>
      </button>
    );
  }

  return (
    <div className="mt-auto mb-1 flex flex-col bg-[var(--surface)] rounded-lg border border-[var(--line)] p-4 max-h-[400px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-[var(--line-strong)] overflow-hidden flex-shrink-0">
            <Image
              src="/RH.png"
              alt="Richard Heart"
              width={32}
              height={32}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
          <span className="text-[var(--text)] text-sm font-semibold">Richard Heart</span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <IconX className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mb-3 space-y-2 min-h-0">
        {messages.map((msg) =>
          msg.sender === 'user' ? (
            <p
              key={msg.id}
              className="text-sm text-[var(--text-muted)] italic"
            >
              {msg.text}
            </p>
          ) : (
            <div
              key={msg.id}
              className="prose prose-invert prose-sm max-w-none"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="text-[var(--text)] text-sm leading-relaxed my-1">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-[var(--text)]">{children}</strong>
                  ),
                }}
              >
                {msg.text}
              </ReactMarkdown>
            </div>
          )
        )}
        {isSending && (
          <p className="text-[var(--text-muted)] text-xs">Let me think about that…</p>
        )}
      </div>

      <div className="relative">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              sendMessage(input);
              setInput('');
            }
          }}
          placeholder="Type your message..."
          className="w-full h-9 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] px-3 pr-10 text-xs text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-orange-500/60"
          disabled={isSending}
        />
        <button
          onClick={() => {
            sendMessage(input);
            setInput('');
          }}
          disabled={!input.trim() || isSending}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text)] flex items-center justify-center text-xs transition"
        >
          →
        </button>
      </div>
    </div>
  );
};
