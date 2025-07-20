'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from "motion/react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import type { Message } from '../../types';
import LoadingSpinner from '@/components/icons/LoadingSpinner';
import SendIcon from '@/components/icons/SendIcon';
import { useApiKey } from '../../lib/hooks/useApiKey';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { getApiKey } = useApiKey();

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoadingChat) return;

    const userMessage: Message = { id: Date.now().toString(), text: messageText, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setIsLoadingChat(true);

    try {
      const userApiKey = getApiKey();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (userApiKey) {
        headers['x-user-api-key'] = userApiKey;
      }

      const response = await fetch('/api/marcus-johnson', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: messageText,
          history: messages
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const aiMessage: Message = { 
        id: (Date.now() + 1).toString(), 
        text: data.response, 
        sender: 'ai' 
      };
      
      setMessages(prev => [...prev, aiMessage]);

    } catch (e) {
      const errorMessage = (e as Error).message;
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: `Error: ${errorMessage}`, sender: 'ai' }]);
    } finally {
      setIsLoadingChat(false);
    }
  }, [isLoadingChat, messages]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const messageText = chatInput;
    setChatInput('');
    await sendMessage(messageText);
  }, [chatInput, sendMessage]);

  const renderMessageText = (text: string) => {
    return (
      <div className="prose prose-sm prose-invert max-w-none">
        <div className="text-slate-300 whitespace-pre-wrap">{text}</div>
      </div>
    );
  };

  return (
    <AuroraBackground className="min-h-screen">
      <motion.div
        initial={{ opacity: 0.0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.8,
          ease: "easeInOut",
        }}
        className="relative flex flex-col gap-4 items-center justify-start px-4 w-full min-h-screen pt-20"
      >
        <div className="container mx-auto p-3 md:p-6 lg:p-8 max-w-4xl w-full pb-32 md:pb-16">
          
          <header className="flex items-center justify-between mb-4 md:mb-6 pb-3 md:pb-4 border-b border-slate-700">
            {/* Back to Home Button */}
            <a
              href="/"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-slate-700/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Back to Home</span>
            </a>
            
            {/* Centered Title */}
            <div className="flex flex-col items-center">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">
                Dr. Marcus Johnson
              </h1>
              <p className="text-xs md:text-sm text-slate-400">Blockchain Philosophy Expert</p>
            </div>
            
            {/* Spacer for layout balance */}
            <div className="w-32"></div>
          </header>

          <div className="flex flex-col h-[70vh] md:min-h-[70vh] pb-20 md:pb-0">
            <div className="relative flex-grow bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden h-full">
              <GlowingEffect disabled={false} glow={true} />
              <div className="flex flex-col h-full">
                <div ref={chatContainerRef} className="flex-grow p-3 md:p-4 overflow-y-auto space-y-3 md:space-y-4 pb-20 md:pb-0">
                  {messages.length === 0 && (
                    <div className="text-center text-slate-400 h-full flex flex-col items-center justify-center gap-3 md:gap-4">
                      <div className="w-full max-w-md px-3 md:px-0">
                        <p className="mb-3 md:mb-4 text-sm md:text-base">Ask Dr. Marcus Johnson about blockchain philosophy...</p>
                        
                        {/* Question Templates */}
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 mb-2 md:mb-3">Philosophical Questions:</p>
                          {[
                            "What is the philosophical foundation of blockchain technology?",
                            "How does decentralization promote individual sovereignty?",
                            "What are the ethical implications of cryptocurrency?",
                            "How does blockchain technology challenge traditional financial systems?",
                            "What is the future of money and digital sovereignty?"
                          ].map((question, index) => {
                            const colorClasses = [
                              "bg-purple-900/20 hover:bg-purple-800/30 border-purple-700/30 hover:border-purple-600/40",
                              "bg-blue-900/20 hover:bg-blue-800/30 border-blue-700/30 hover:border-blue-600/40",
                              "bg-indigo-900/20 hover:bg-indigo-800/30 border-indigo-700/30 hover:border-indigo-600/40",
                              "bg-cyan-900/20 hover:bg-cyan-800/30 border-cyan-700/30 hover:border-cyan-600/40",
                              "bg-teal-900/20 hover:bg-teal-800/30 border-teal-700/30 hover:border-teal-600/40"
                            ];
                            
                            return (
                              <button
                                key={index}
                                onClick={() => sendMessage(question)}
                                className={`w-full text-left p-2 md:p-3 rounded-lg transition-all duration-200 text-xs md:text-sm text-slate-300 hover:text-white ${colorClasses[index]}`}
                              >
                                {question}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] md:max-w-md lg:max-w-2xl rounded-xl px-3 md:px-4 py-2 md:py-3 ${msg.sender === 'user' ? 'bg-purple-700 text-white' : 'bg-slate-700/80 backdrop-blur-sm text-slate-200 border border-slate-600/50'}`}>
                        {msg.sender === 'user' ? (
                          <div className="text-white text-sm md:text-base">
                            {msg.text}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {renderMessageText(msg.text)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoadingChat && messages[messages.length - 1]?.sender === 'user' && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] md:max-w-md lg:max-w-lg rounded-xl px-3 md:px-4 py-2 bg-slate-700 text-slate-200">
                        <LoadingSpinner className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                    </div>
                  )}
                </div>
                <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-slate-700/50 flex items-center gap-2 md:gap-3 bg-slate-800/30 backdrop-blur-sm flex-shrink-0">
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask about blockchain philosophy..." className="flex-grow bg-slate-700 border border-slate-600 rounded-lg px-3 md:px-4 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none transition text-sm md:text-base" disabled={isLoadingChat} />
                  <button type="submit" disabled={isLoadingChat || !chatInput.trim()} className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"><SendIcon className="w-4 h-4 md:w-5 md:h-5"/></button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AuroraBackground>
  );
};

export default App; 