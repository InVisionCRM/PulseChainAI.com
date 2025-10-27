'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { LoaderThree } from "@/components/ui/loader";
import type { Message, ContractData, TokenInfo, DexScreenerData } from '../types';
import SendIcon from '@/components/icons/SendIcon';

interface TokenAIChatProps {
  contractAddress?: string;
  compact?: boolean;
}

export default function TokenAIChat({ contractAddress, compact = false }: TokenAIChatProps): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [activeTabbedContent, setActiveTabbedContent] = useState<number>(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), text, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setIsLoadingChat(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          contractAddress: contractAddress || null,
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
  }, [contractAddress]);

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
                  <li key={lineIndex} className="ml-4 text-xs text-gray-300">
                    {line.substring(2)}
                  </li>
                );
              }

              // Bold and italic
              let processedLine: React.ReactNode = line;

              // Bold
              const boldRegex = /\*\*(.+?)\*\*/g;
              const boldParts = line.split(boldRegex);
              if (boldParts.length > 1) {
                processedLine = boldParts.map((part, i) =>
                  i % 2 === 0 ? part : <strong key={i} className="font-bold text-white">{part}</strong>
                );
              }

              return <p key={lineIndex} className="text-xs text-gray-300 mb-1">{processedLine}</p>;
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
    <div className={`flex flex-col h-full ${compact ? 'text-xs' : 'text-sm'}`}>
      <div ref={chatContainerRef} className="flex-grow overflow-y-auto space-y-2 p-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 h-full flex flex-col items-center justify-center gap-2">
            {isLoadingChat ? (
              <>
                <LoaderThree />
                <p className="text-xs">Analyzing...</p>
              </>
            ) : (
              <div className="w-full max-w-md">
                <p className="mb-2 text-xs">Ask a question about the contract...</p>

                {/* Question Templates */}
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 mb-2">Quick Questions:</p>
                  {quickQuestions.map((question, index) => {
                    const colorClasses = [
                      "bg-pink-900/20 hover:bg-pink-800/30 border-pink-700/30",
                      "bg-gray-950/20 hover:bg-gray-950/30 border-gray-900/30",
                      "bg-gray-950/20 hover:bg-gray-950/30 border-gray-900/30"
                    ];

                    return (
                      <button
                        key={index}
                        onClick={() => sendMessage(question)}
                        className={`w-full text-left p-2 rounded transition-all duration-200 text-xs text-gray-300 hover:text-white border ${colorClasses[index]}`}
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
            <div className={`max-w-[95%] rounded-lg px-2 py-2 ${msg.sender === 'user' ? 'bg-gray-950 text-white' : 'bg-gray-950 backdrop-blur-sm text-gray-200 border border-gray-900/50'}`}>
              {msg.sender === 'user' ? (
                <div className="text-white text-xs">
                  {msg.text}
                </div>
              ) : (
                <div className="space-y-1">
                  {msg.text === '...' ? (
                    <LoaderThree />
                  ) : (
                    renderMessageText(msg.text)
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoadingChat && messages[messages.length - 1]?.sender === 'user' && (
          <div className="flex justify-start">
            <div className="max-w-[95%] rounded-lg px-2 py-2 bg-gray-950 text-gray-200">
              <LoaderThree />
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSendMessage} className="border-t border-gray-800 flex items-center gap-2 bg-gray-950/20 backdrop-blur-xl flex-shrink-0 p-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask about the contract..."
          className="flex-grow bg-gray-950/30 backdrop-blur-sm border border-gray-700 rounded px-2 py-1 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:outline-none transition text-xs"
          disabled={isLoadingChat}
        />
        <button
          type="submit"
          disabled={isLoadingChat || !chatInput.trim()}
          className="bg-gray-950 text-white p-1.5 rounded-full hover:bg-gray-800 disabled:bg-gray-950 disabled:cursor-not-allowed transition-colors"
          title="Send message"
        >
          <SendIcon className="w-3 h-3"/>
        </button>
      </form>
    </div>
  );
}
