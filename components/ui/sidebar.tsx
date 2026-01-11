"use client";
import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconMenu2, IconX, IconSearch, IconSettings, IconDeviceGamepad2, IconHome, IconCode, IconCurrencyDollar, IconBook, IconHeart, IconMail, IconPhoneOutgoing, IconRocket, IconChevronRight } from "@tabler/icons-react";
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

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(true); // Start open on desktop

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate: animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

type MotionDivProps = React.ComponentProps<typeof motion.div>;

export const SidebarBody = (props: MotionDivProps & { children?: React.ReactNode }) => {
  const { children, ...rest } = props;
  return (
    <>
      <DesktopSidebar {...rest}>{children}</DesktopSidebar>
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof motion.div>, "children"> & { children?: React.ReactNode }) => {
  const { open, setOpen } = useSidebar();

  return (
    <>
      {/* Collapsed Sidebar - Always visible on desktop */}
      <motion.div
        className={cn(
          "hidden md:flex h-full w-12 flex-col bg-gradient-to-br from-[#2C3E50] via-[#34495E] to-[#3B6978] border-r border-orange-500/40 relative z-50",
          "before:absolute before:right-0 before:top-0 before:h-full before:w-[1px] before:bg-gradient-to-b before:from-transparent before:via-orange-500/30 before:to-transparent",
          className
        )}
        onClick={() => setOpen(true)}
        {...props}
      >
        <div className="flex flex-col h-full justify-center cursor-pointer">
          {/* 3 Breathing Chevron Right Icons */}
          <div className="flex flex-col items-center justify-center gap-3">
            <IconChevronRight className="h-5 w-5 text-orange-500/70 breathe-1" />
            <IconChevronRight className="h-5 w-5 text-orange-500/70 breathe-2" />
            <IconChevronRight className="h-5 w-5 text-orange-500/70 breathe-3" />
          </div>
        </div>
      </motion.div>

      {/* Expanded Sidebar - Slides in when open */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
            }}
            className={cn(
              "fixed h-full w-[40vh] left-0 top-0 bg-gradient-to-br from-[#2C3E50] via-[#34495E] to-[#3B6978] border-r border-orange-500/10 p-4 z-[100] flex flex-col justify-between",
              "before:absolute before:right-0 before:top-0 before:h-full before:w-[1px] before:bg-gradient-to-b before:from-transparent before:via-orange-500/30 before:to-transparent",
              className
            )}
          >
            <div className="flex flex-col h-full">
              {/* Morbius Banner at top */}
              <div className="absolute top-0 left-0 right-0 z-40">
                <img
                  src="/Morbiusbanner.png"
                  alt="Morbius Banner"
                  className="w-full h-auto object-cover max-h-24"
                />
              </div>

              {/* Close button repositioned */}
              <div
                className="absolute top-2 right-2 z-50 text-white cursor-pointer"
                onClick={() => setOpen(false)}
              >
                <IconX className="h-6 w-6" />
              </div>

              <div className="mt-14 overflow-y-auto scrollbar-hide flex-1 flex flex-col min-h-0">
                {children}
                <RichardHeartChat />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Richard Heart Chat Component for Sidebar
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
        className="mt-auto mb-4 flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/30 transition-colors"
      >
        <div className="w-8 h-8 rounded-full border border-white/40 overflow-hidden flex-shrink-0">
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
    <div className="mt-auto mb-4 flex flex-col bg-purple-600/20 rounded-lg border border-purple-500/30 p-4 max-h-[400px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-white/40 overflow-hidden flex-shrink-0">
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
          className="w-full h-9 rounded-lg bg-white/5 border border-white/15 px-3 pr-10 text-xs text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
          disabled={isSending}
        />
        <button
          onClick={() => {
            sendMessage(input);
            setInput('');
          }}
          disabled={!input.trim() || isSending}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center text-xs transition"
        >
          →
        </button>
      </div>
    </div>
  );
};

const Logo = () => {
  return (
    <div className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal">
      <img 
        src="/MobiusLogoClean.png" 
        alt="Mobius Logo" 
        className="h-6 w-6 shrink-0 object-contain"
      />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium whitespace-pre text-white"
      >
        Morbius.io
      </motion.span>
    </div>
  );
};

const LogoIcon = () => {
  return (
    <div className="relative z-20 flex items-center justify-center py-0">
      <img 
        src="/MobiusLogoClean.png" 
        alt="Mobius Logo" 
        className="h-10 w-10 shrink-0 object-contain"
      />
    </div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();

  return (
    <>
      
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
            }}
            className={cn(
              "fixed h-full w-[40vh] left-0 top-0 bg-gradient-to-br from-[#2C3E50] via-[#34495E] to-[#3B6978] border-r border-orange-500/10 p-4 z-[100] flex flex-col justify-between",
              "before:absolute before:right-0 before:top-0 before:h-full before:w-[1px] before:bg-gradient-to-b before:from-transparent before:via-orange-500/30 before:to-transparent",
              className
            )}
          >
            <div className="flex flex-col justify-between h-full">
              {/* Morbius Banner at top */}
              <div className="absolute top-0 left-0 right-0 z-40">
                <img
                  src="/Morbiusbanner.png"
                  alt="Morbius Banner"
                  className="w-full h-auto object-cover max-h-24"
                />
              </div>

              {/* Close button repositioned */}
              <div
                className="absolute top-2 right-2 z-50 text-white cursor-pointer"
                onClick={() => setOpen(false)}
              >
                <IconX className="h-6 w-6" />
              </div>

              <div className="mt-14 overflow-y-auto scrollbar-hide">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
  return (
    <a
      href={link.href}
      className={cn(
        "flex items-center py-2 justify-start justify-center gap-2",
        className
      )}
      {...props}
    >
      {link.icon}
      <span className="text-white text-xs md:text-sm whitespace-pre inline-block">
        {link.label}
      </span>
    </a>
  );
};
