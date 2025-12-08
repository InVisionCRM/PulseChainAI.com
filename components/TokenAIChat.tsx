'use client';

import React, { useState, useCallback, useRef, useEffect, type JSX } from 'react';
import { LoaderThree } from "@/components/ui/loader";
import type { Message, ContractData, TokenInfo, DexScreenerData } from '../types';
import SendIcon from '@/components/icons/SendIcon';
import { fetchContract, fetchTokenInfo, fetchDexScreenerData } from '@/services/pulsechainService';

interface TokenAIChatProps {
  contractAddress?: string;
  compact?: boolean;
  className?: string;
}

export default function TokenAIChat({ contractAddress, compact = false, className }: TokenAIChatProps): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [contractData, setContractData] = useState<ContractData | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [dexData, setDexData] = useState<DexScreenerData | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [activeTabbedContent, setActiveTabbedContent] = useState<number>(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    const loadMetadata = async () => {
      if (!contractAddress) {
        setContractData(null);
        setTokenInfo(null);
        setDexData(null);
        return;
      }

      setIsLoadingMetadata(true);
      setMetadataError(null);

      try {
        const [contractRes, tokenRes, dexRes] = await Promise.all([
          fetchContract(contractAddress).catch(() => null),
          fetchTokenInfo(contractAddress).catch(() => null),
          fetchDexScreenerData(contractAddress).catch(() => null),
        ]);

        if (cancelled) return;

        setContractData(contractRes?.data || null);
        setTokenInfo(tokenRes?.data || null);
        setDexData(dexRes?.data || null);
      } catch (error) {
        if (!cancelled) {
          setMetadataError(
            error instanceof Error ? error.message : 'Failed to load token metadata'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMetadata(false);
        }
      }
    };

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [contractAddress]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), text, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setIsLoadingChat(true);

    try {
      const payloadContractData: (ContractData & { address_hash?: string }) | null = contractData
        ? { ...contractData }
        : contractAddress
        ? {
            name: 'Unknown Contract',
            source_code: '',
            compiler_version: '',
            optimization_enabled: false,
            is_verified: false,
            abi: [],
            creator_address_hash: null,
            creation_tx_hash: null,
            address_hash: contractAddress,
          }
        : null;

      if (payloadContractData && contractAddress) {
        payloadContractData.address_hash = contractAddress;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          contractAddress: contractAddress || null,
          contractData: payloadContractData,
          tokenInfo,
          dexScreenerData: dexData,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const aiMessage: Message = { id: (Date.now() + 1).toString(), text: data.response, sender: 'ai' };
      setMessages(prev => [...prev, aiMessage]);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: `Error: ${errorMessage}`, sender: 'ai' }]);
    } finally {
      setIsLoadingChat(false);
    }
  }, [contractAddress, contractData, tokenInfo, dexData]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const messageText = chatInput;
    setChatInput('');
    await sendMessage(messageText);
  }, [chatInput, sendMessage]);

  const renderMessageText = (text: string) => {
    // Enhanced markdown parser with tabbed content and hashtags
    const renderMarkdown = (content: string): React.ReactNode => {
      // Handle tabbed content first
      const tabRegex = /\[TAB:([^\]]+)\]([\s\S]*?)\[\/TAB\]/g;
      const tabMatches = [...content.matchAll(tabRegex)];

      if (tabMatches.length > 0) {
        const tabs = tabMatches.map(match => ({
          title: match[1],
          content: match[2]
        }));

        return (
          <div key="tabbed-content" className="my-2">
            <div className="flex border-b border-gray-700 mb-2">
              {tabs.map((tab, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTabbedContent(index)}
                  className={`px-2 py-1 text-xs font-medium transition-colors ${
                    activeTabbedContent === index
                      ? 'text-white border-b-2 border-purple-500'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.title}
                </button>
              ))}
            </div>
            <div className="p-2 bg-gray-950 rounded border border-gray-800">
              {renderMarkdown(tabs[activeTabbedContent].content)}
            </div>
          </div>
        );
      }

      // Split by code blocks
      const codeBlockParts = content.split(/(```[\s\S]*?```)/g);

      return codeBlockParts.map((block, blockIndex) => {
        if (block.startsWith('```') && block.endsWith('```')) {
          // Handle code blocks
          const code = block.slice(3, -3);
          const languageMatch = code.match(/^[a-zA-Z]+\n/);
          const language = languageMatch ? languageMatch[0].trim().toLowerCase() : 'solidity';
          const codeContent = languageMatch ? code.substring(language.length + 1) : code;

          return (
            <pre key={blockIndex} className="bg-gray-950 rounded p-2 my-2 overflow-x-auto border border-gray-800 text-xs">
              <code className="text-white font-mono">{codeContent}</code>
            </pre>
          );
        }

        // Process text with markdown
        const lines = block.split('\n');
        return (
          <div key={blockIndex}>
            {lines.map((line, lineIndex) => {
              // Headers
              if (line.startsWith('### ')) {
                return <h3 key={lineIndex} className="text-sm font-bold text-white mt-2 mb-1">{line.substring(4)}</h3>;
              }
              if (line.startsWith('## ')) {
                return <h2 key={lineIndex} className="text-base font-bold text-white mt-2 mb-1">{line.substring(3)}</h2>;
              }
              if (line.startsWith('# ')) {
                return <h1 key={lineIndex} className="text-lg font-bold text-white mt-2 mb-1">{line.substring(2)}</h1>;
              }

              // Lists
              if (line.match(/^[\-\*]\s/)) {
                return (
                  <p key={lineIndex} className="ml-4 text-md font-bold text-white">
                    • {line.substring(2)}
                  </p>
                );
              }

              // Bold and italic
              let processedLine: React.ReactNode = line;

              // Bold
              const boldRegex = /\*\*(.+?)\*\*/g;
              const boldParts = line.split(boldRegex);
              if (boldParts.length > 1) {
                // Remove bold markdown markers but keep the text
                processedLine = boldParts
                  .map((part, i) => (i % 2 === 0 ? part : part))
                  .join('');
              }

              return <p key={lineIndex} className="text-xs text-white mb-1">{processedLine}</p>;
            })}
          </div>
        );
      });
    };

    return <div className="space-y-1">{renderMarkdown(text)}</div>;
  };

  const quickQuestions = [
    "Analyze this contract",
    "Does this token have taxes",
    "What does this contract do?"
  ];

  return (
    <div
      className={`relative flex flex-col h-full min-h-full w-full flex-1 overflow-hidden rounded-lg border border-purple-300/40 bg-[url('/Mirage.jpg')] bg-cover bg-center bg-no-repeat bg-purple-900/10 backdrop-blur-2xl shadow-[0_0_25px_rgba(0,0,0,0.35)] ${compact ? 'text-[11px]' : 'text-sm'} ${className ?? ''}`}
    >
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />
      <div className="relative px-3 pt-1 text-center space-y-1">
        <div className="w-full rounded-md px-4 py-3 text-center">
          <h2 className="text-lg sm:text-xl font-bold text-slate-500">
            <span className="text-purple-500">MORBIUS</span> Contract Reader
          </h2>
        </div>
      </div>
      <div className="relative flex flex-col h-full flex-1 min-h-0">
      {(isLoadingMetadata || metadataError) && (
        <div className="mb-2 text-[11px]">
          {isLoadingMetadata && (
            <p className="text-blue-100/80">Loading token context&hellip;</p>
          )}
          {metadataError && (
            <p className="text-red-300">{metadataError}</p>
          )}
        </div>
      )}
      <div ref={chatContainerRef} className="flex-grow min-h-0 overflow-y-auto space-y-2 p-3 bg-transparent">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 h-full flex flex-col items-center justify-center gap-2">
            {isLoadingChat ? (
              <>
                <LoaderThree />
                <p className="text-xs">Analyzing...</p>
              </>
            ) : (
              <div className="w-full max-w-md">
                <div className="flex flex-col items-center gap-2">
                  {quickQuestions.map((question, index) => {
                    const colorClasses = [
                      "bg-purple-900/30 hover:bg-purple-800/40 border-white/20",
                      "bg-purple-900/30 hover:bg-purple-800/40 border-white/20",
                      "bg-purple-900/30 hover:bg-purple-800/40 border-white/20"
                    ];

                    return (
                      <button
                        key={index}
                        onClick={() => sendMessage(question)}
                        className={`inline-flex px-3 py-2 rounded-full border ${colorClasses[index]} transition-all duration-200 text-md text-white backdrop-blur-xl shadow-[0_10px_25px_rgba(0,0,0,0.25)]`}
                      >
                        {question}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[95%] rounded-lg px-3 py-2 bg-slate-500/50 border border-white/20 backdrop-blur-xl shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
              {msg.sender === 'user' ? (
                <div className="text-white text-sm font-bold">
                  {msg.text}
                </div>
              ) : (
                <div className="space-y-1 text-white">
                  {msg.text === '...' ? (
                    <LoaderThree />
                  ) : (
                    <div className="text-white text-sm font-bold">{renderMessageText(msg.text)}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoadingChat && messages[messages.length - 1]?.sender === 'user' && (
          <div className="flex justify-start">
            <div className="max-w-[95%] rounded-lg px-2 py-2 bg-purple-800/60 text-blue-50 border border-purple-300/40">
              <LoaderThree />
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSendMessage} className="border-t border-white/15 flex items-center gap-2 bg-white/5 backdrop-blur-xl flex-shrink-0 p-2 rounded-b-lg">
        <textarea
          rows={1}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask about the contract..."
          className="flex-grow bg-white/10 backdrop-blur-xl border-[2px] border-white/30 rounded px-3 py-2 text-base text-white placeholder:text-base placeholder:font-semibold placeholder:text-white font-bold focus:ring-2 focus:ring-purple-300 focus:outline-none transition resize-none shadow-[0_10px_25px_rgba(0,0,0,0.2)]"
          disabled={isLoadingChat}
        />
        <button
          type="submit"
          disabled={isLoadingChat || !chatInput.trim()}
          className="bg-white/20 text-white p-2 rounded-full border border-white/30 hover:bg-white/30 disabled:bg-white/10 disabled:cursor-not-allowed transition-colors shadow-[0_10px_25px_rgba(0,0,0,0.25)] backdrop-blur-xl"
          title="Send message"
        >
          <SendIcon className="w-4 h-4 text-white"/>
        </button>
      </form>
      </div>
    </div>
  );
}
