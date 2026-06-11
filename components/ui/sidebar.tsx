"use client";
import { cn } from "@/lib/utils";
import React, { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { IconX } from "@tabler/icons-react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/types";
import { useApiKey } from "@/lib/hooks/useApiKey";

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
  return (
    <aside
      className={cn(
        "hidden md:flex h-full w-[230px] shrink-0 flex-col",
        "bg-white/5 backdrop-blur-xl border-r border-white/10",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Morbiusbanner.png"
        alt="Morbius Banner"
        className="w-full h-auto object-cover max-h-24 shrink-0 border-b border-white/10"
      />
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col px-2 pb-3">
        {children}
        <RichardHeartChat />
      </div>
    </aside>
  );
};

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
          ? "bg-white/10 text-orange-300"
          : "text-white/80 hover:bg-white/5 hover:text-white",
        className,
      )}
      {...props}
    >
      {link.icon}
      <span
        className={cn(
          "text-xs md:text-sm whitespace-pre inline-block",
          active ? "text-orange-300 font-medium" : "text-white",
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
        className="mt-auto mb-1 flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
      >
        <div className="w-8 h-8 rounded-full border border-white/30 overflow-hidden flex-shrink-0">
          <Image
            src="/RH.png"
            alt="Richard Heart"
            width={32}
            height={32}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>
        <span className="text-white text-sm font-medium">Chat with RH</span>
      </button>
    );
  }

  return (
    <div className="mt-auto mb-1 flex flex-col bg-white/5 rounded-lg border border-white/10 p-4 max-h-[400px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-white/30 overflow-hidden flex-shrink-0">
            <Image
              src="/RH.png"
              alt="Richard Heart"
              width={32}
              height={32}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
          <span className="text-white text-sm font-semibold">Richard Heart</span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-white/70 hover:text-white"
        >
          <IconX className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mb-3 space-y-2 min-h-0">
        {messages.map((msg) =>
          msg.sender === 'user' ? (
            <p
              key={msg.id}
              className="text-sm text-white/70 italic"
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
                    <p className="text-white text-sm leading-relaxed my-1">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-white">{children}</strong>
                  ),
                }}
              >
                {msg.text}
              </ReactMarkdown>
            </div>
          )
        )}
        {isSending && (
          <p className="text-white/60 text-xs">Let me think about that…</p>
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
          className="w-full h-9 rounded-lg bg-black/40 border border-white/15 px-3 pr-10 text-xs text-white placeholder-white/50 focus:outline-none focus:border-orange-500/60"
          disabled={isSending}
        />
        <button
          onClick={() => {
            sendMessage(input);
            setInput('');
          }}
          disabled={!input.trim() || isSending}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center text-xs transition"
        >
          →
        </button>
      </div>
    </div>
  );
};
