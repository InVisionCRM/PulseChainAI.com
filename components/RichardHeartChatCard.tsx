'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { Message } from '@/types';
import { useApiKey } from '@/lib/hooks/useApiKey';

interface RichardHeartChatCardProps {
  className?: string;
  variant?: 'default' | 'compact';
}

const MicIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
    <path d="M12 21v-4" />
  </svg>
);

const RichardHeartChatCard: React.FC<RichardHeartChatCardProps> = ({
  className = '',
  variant = 'default',
}) => {
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

  const containerStyles = useMemo(() => {
    const base =
      'relative overflow-hidden rounded-[32px] border border-white/25 bg-gradient-to-br from-[#4c1d95]/70 via-[#7e22ce]/65 to-[#a855f7]/70 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-[5px]';
    const sizing =
      variant === 'compact'
        ? 'min-h-[220px] p-5'
        : 'min-h-[320px] p-7 sm:p-8';
    return `${base} ${sizing} ${className}`;
  }, [className, variant]);

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
                  text: 'Connection glitched. Ask again and we’ll keep it rolling.',
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

  const latestMessages = useMemo(
    () => messages.slice(-3),
    [messages]
  );

  return (
    <div className={containerStyles}>
      <div className="absolute -top-4 left-6 h-14 w-14 rounded-full bg-gradient-to-br from-white/60 to-white/10 border border-white/40 shadow-[0_10px_30px_rgba(0,0,0,0.25)] flex items-center justify-center text-[10px] tracking-[0.4em] uppercase text-white/70">
        RH
      </div>

      <div className="flex flex-col h-full gap-4 pt-10">
        <div className="flex-1">
          {latestMessages.map((msg) => (
            <p
              key={msg.id}
              className={`text-base sm:text-lg leading-relaxed ${
                msg.sender === 'user' ? 'text-white/70 italic mb-2' : 'text-white'
              }`}
            >
              {msg.text}
            </p>
          ))}
          {isSending && (
            <p className="text-white/60 text-sm mt-2">Let me think about that…</p>
          )}
        </div>

        <div className="relative mt-2">
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
            placeholder="Start typing or speaking..."
            className="w-full h-12 rounded-full bg-white/5 border border-white/15 pl-5 pr-14 text-sm placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
            disabled={isSending}
          />
          <button
            type="button"
            onClick={() => {
              sendMessage(input);
              setInput('');
            }}
            disabled={!input.trim() || isSending}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-purple-700 flex items-center justify-center shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <MicIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RichardHeartChatCard;
