'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '@/types';
import { useApiKey } from '@/lib/hooks/useApiKey';
import { motion, AnimatePresence } from 'motion/react';

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

  const containerStyles = useMemo(() => {
    const base =
      'relative overflow-hidden rounded-[32px] border border-white/25 bg-gradient-to-br from-[#4c1d95]/70 via-[#7e22ce]/65 to-[#a855f7]/70 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-[5px] max-h-[80vh]';
    const sizing =
      variant === 'compact'
        ? 'w-[320px] h-[360px] sm:h-[400px] p-5'
        : 'w-[400px] sm:w-[480px] h-[520px] sm:h-[560px] p-7 sm:p-8';
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

  return (
    <div className="fixed right-0 bottom-[100px] z-[100]">
      {/* Collapsed Tag */}
      {!isExpanded && (
        <motion.button
          initial={{ x: 0 }}
          animate={{ x: 0 }}
          exit={{ x: 0 }}
          onClick={() => setIsExpanded(true)}
          className="flex items-center justify-center h-14 w-14 rounded-l-lg bg-gradient-to-br from-[#4c1d95]/70 via-[#7e22ce]/65 to-[#a855f7]/70 border border-white/25 border-r-0 shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-[5px] hover:from-[#5a2199]/80 hover:via-[#8e2dd8]/75 hover:to-[#b865ff]/80 transition-all"
        >
          <div className="h-10 w-10 rounded-full border border-white/40 shadow-[0_5px_15px_rgba(0,0,0,0.2)] overflow-hidden flex items-center justify-center bg-white/10">
            <Image
              src="/RH.png"
              alt="Richard Heart"
              width={40}
              height={40}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
        </motion.button>
      )}

      {/* Expanded Card */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={containerStyles}
          >
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              aria-label="Close chat"
              title="Close chat"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="absolute top-4 left-1/2 -translate-x-1/2 h-14 w-14 rounded-full border border-white/40 shadow-[0_10px_30px_rgba(0,0,0,0.25)] overflow-hidden flex items-center justify-center bg-white/10">
              <Image
                src="/RH.png"
                alt="Richard Heart"
                width={56}
                height={56}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>

            <div className="flex flex-col h-full gap-4 pt-10 min-h-0">
              <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                <div className="space-y-3">
                  {messages.map((msg) =>
                    msg.sender === 'user' ? (
                      <p
                        key={msg.id}
                        className="text-base sm:text-lg leading-relaxed text-white/70 italic mb-2"
                      >
                        {msg.text}
                      </p>
                    ) : (
                      <div
                        key={msg.id}
                        className="prose prose-invert prose-p:leading-relaxed prose-p:my-3 prose-strong:text-white prose-strong:font-semibold text-base sm:text-lg"
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => (
                              <p className="text-white leading-relaxed">{children}</p>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-white">{children}</strong>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-outside pl-5 space-y-1 text-white">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal list-outside pl-5 space-y-1 text-white">
                                {children}
                              </ol>
                            ),
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    )
                  )}
                  {isSending && (
                    <p className="text-white/60 text-sm mt-2">Let me think about that…</p>
                  )}
                </div>
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
                  aria-label="Send message"
                  title="Send message"
                >
                  <MicIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RichardHeartChatCard;
