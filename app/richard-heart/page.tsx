"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from "motion/react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { LoaderThree } from "@/components/ui/loader";
import { GlowingEffect } from "@/components/ui/glowing-effect";

import type { Message } from '../../types';
import LoadingSpinner from '@/components/icons/LoadingSpinner';
import SendIcon from '@/components/icons/SendIcon';
import ColourfulText from '@/components/ui/colourful-text';

// Splash Screen Modal Component
const SplashModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-slate-800/90 backdrop-blur-sm border border-slate-600/50 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Talk to Richard Heart!</h2>
                    <p className="text-slate-400 text-sm">AI-powered conversation with the crypto legend</p>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-yellow-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-xs font-bold">👑</span>
                        </div>
                        <p className="text-slate-300 text-sm">This AI mimics Richard Heart's tone, knowledge, wit, and persona.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">You may need a valid <span className="text-blue-400 font-medium">Gemini API Key</span> to generate responses.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">Your conversations are private and not stored on our servers.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">Experience Richard's unique perspective on crypto, life, and everything in between.</p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                >
                    Start Chatting with Richard! 👑
                </button>
            </motion.div>
        </div>
    );
};

export default function RichardHeartPage() {
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), text: inputMessage, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/richard-heart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          history: messages
        }),
      });

      if (!response.ok) {
        throw new Error(`Richard Heart API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let aiResponseText = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        aiResponseText += chunk;
      }

      if (aiResponseText.length === 0) {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: "Sorry, I couldn't generate a response right now. Please try again!", sender: 'ai' }]);
      } else {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: aiResponseText, sender: 'ai' }]);
      }

    } catch (e) {
      const errorMessage = (e as Error).message;
      setError(errorMessage);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: "Sorry, I encountered an error while processing your message. Please try again!", sender: 'ai' }]);
    } finally {
      setIsLoading(false);
      setInputMessage('');
    }
  }, [inputMessage, isLoading, messages]);

  // Enhanced markdown parser for Richard's responses
  const renderMarkdown = (content: string) => {
    // Split by code blocks
    const codeBlockParts = content.split(/(```[\s\S]*?```)/g);
    
    return codeBlockParts.map((block, blockIndex) => {
      if (block.startsWith('```') && block.endsWith('```')) {
        // Handle code blocks
        const code = block.slice(3, -3);
        const languageMatch = code.match(/^[a-zA-Z]+\n/);
        const language = languageMatch ? languageMatch[0].trim().toLowerCase() : 'text';
        const codeContent = languageMatch ? code.substring(language.length + 1) : code;
        
        return (
          <pre key={blockIndex} className="bg-slate-950 rounded-lg p-3 my-3 overflow-x-auto border border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-mono uppercase">{language}</span>
              <div className="flex space-x-1">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
            </div>
            <code className={`language-${language} text-sm leading-relaxed`}>{codeContent}</code>
          </pre>
        );
      }
      
      // Handle inline content with enhanced markdown
      const parts = block.split(/(`[^`]*`|#{1,6}\s+[^\n]*|>\s+[^\n]*|-\s+[^\n]*|\*\*[^*]*\*\*|\*[^*]*\*|\[[^\]]*\]\([^)]*\)|#[a-zA-Z]+)/g);
      
      return parts.map((part, partIndex) => {
        const key = `${blockIndex}-${partIndex}`;
        
        // Hashtags
        if (part.match(/^#[a-zA-Z]+$/)) {
          return (
            <span key={key} className="inline-block bg-yellow-600/20 text-yellow-300 px-2 py-1 rounded-full text-xs font-medium mr-1 mb-1">
              {part}
            </span>
          );
        }
        
        // Headers
        if (part.match(/^#{1,6}\s+/)) {
          const level = part.match(/^(#{1,6})/)?.[1].length || 1;
          const text = part.replace(/^#{1,6}\s+/, '');
          const headerClasses = {
            1: 'text-xl font-bold text-white border-b border-yellow-600/30 pb-2 mb-3',
            2: 'text-lg font-bold text-white mt-4 mb-2',
            3: 'text-base font-semibold text-white mt-3 mb-2',
            4: 'text-sm font-semibold text-slate-200 mt-2 mb-1',
            5: 'text-xs font-semibold text-slate-300 mt-2 mb-1',
            6: 'text-xs font-semibold text-slate-400 mt-2 mb-1'
          };
          return <div key={key} className={headerClasses[level as keyof typeof headerClasses]}>{text}</div>;
        }
        
        // Blockquotes
        if (part.startsWith('> ')) {
          const text = part.substring(2);
          return (
            <blockquote key={key} className="border-l-4 border-yellow-500 bg-yellow-900/20 pl-3 py-2 my-2 italic text-slate-300 text-sm">
              {text}
            </blockquote>
          );
        }
        
        // Lists
        if (part.startsWith('- ')) {
          const text = part.substring(2);
          return (
            <li key={key} className="flex items-start gap-2 my-0.5">
              <span className="text-yellow-400 mt-1.5 flex-shrink-0">•</span>
              <span className="text-slate-300 text-sm">{text}</span>
            </li>
          );
        }
        
        // Bold text
        if (part.startsWith('**') && part.endsWith('**')) {
          const text = part.slice(2, -2);
          return <strong key={key} className="font-bold text-white">{text}</strong>;
        }
        
        // Italic text
        if (part.startsWith('*') && part.endsWith('*')) {
          const text = part.slice(1, -1);
          return <em key={key} className="italic text-slate-200">{text}</em>;
        }
        
        // Inline code
        if (part.startsWith('`') && part.endsWith('`')) {
          const text = part.slice(1, -1);
          return (
            <code key={key} className="bg-slate-700 text-amber-300 rounded px-1.5 py-0.5 text-sm font-mono border border-slate-600">
              {text}
            </code>
          );
        }
        
        // Regular links
        if (part.match(/^\[([^\]]*)\]\(([^)]*)\)$/)) {
          const match = part.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
          if (match) {
            const [, text, url] = match;
            return (
              <a 
                key={key} 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                {text}
              </a>
            );
          }
        }
        
        // Regular text with line breaks
        if (part.includes('\n')) {
          return part.split('\n').map((line, lineIndex) => (
            <span key={`${key}-${lineIndex}`}>
              {line}
              {lineIndex < part.split('\n').length - 1 && <br />}
            </span>
          ));
        }
        
        return <span key={key} className="text-slate-300">{part}</span>;
      });
    });
  };

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    
    const messageText = inputMessage;
    setInputMessage('');
    await handleSubmit(e);
  }, [inputMessage, handleSubmit]);

  return (
    <AuroraBackground 
      className="min-h-screen" 
      colors={['#F59E0B', '#F97316', '#FB923C', '#FDBA74', '#FED7AA', '#FFEDD5', '#FEF3C7', '#92400E', '#B45309', '#C2410C']}
    >
      <SplashModal isOpen={showSplash} onClose={() => setShowSplash(false)} />
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
        <div className="container mx-auto p-3 md:p-6 lg:p-8 max-w-4xl w-full pb-24 md:pb-8">
          
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
                Talk to Richard Heart!
              </h1>
              <p className="text-xs md:text-sm text-slate-400">AI-powered conversation with the crypto legend</p>
            </div>
            
            {/* Right side placeholder for balance */}
            <div className="w-20"></div>
          </header>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* Main Chat Interface */}
          <main className="flex flex-col h-[70vh] md:min-h-[70vh] pb-20 md:pb-0">
            <div className="relative flex flex-col bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden h-full">
              <GlowingEffect disabled={false} glow={true} />
              
              <div className="flex-grow p-3 md:p-4 overflow-y-auto space-y-3 md:space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-slate-400 h-full flex flex-col items-center justify-center gap-3 md:gap-4">
                    <div className="w-full max-w-md px-3 md:px-0">
                      <div className="mb-6 text-center">
                        <div className="w-16 h-16 rounded-full mx-auto mb-4 overflow-hidden border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                          <span className="text-white text-2xl">👑</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Richard Heart</h3>
                        <p className="text-sm text-slate-400">Crypto founder, entrepreneur, and thought leader</p>
                      </div>
                      
                      <p className="mb-4 text-sm md:text-base">Hey there! I'm Richard Heart, and I'm here to share my thoughts on crypto, life, and everything in between. What's on your mind?</p>
                      
                      {/* Conversation Starters */}
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 mb-2 md:mb-3">Try asking me about:</p>
                        {[
                          "What's your take on the current crypto market?",
                          "Tell me about PulseChain and its vision",
                          "What's your philosophy on life and success?",
                          "How do you stay motivated in tough times?",
                          "What's your advice for crypto newcomers?"
                        ].map((starter, index) => {
                          const colorClasses = [
                            "bg-yellow-900/20 hover:bg-yellow-800/30 border-yellow-700/30 hover:border-yellow-600/40",
                            "bg-orange-900/20 hover:bg-orange-800/30 border-orange-700/30 hover:border-orange-600/40",
                            "bg-red-900/20 hover:bg-red-800/30 border-red-700/30 hover:border-red-600/40",
                            "bg-pink-900/20 hover:bg-pink-800/30 border-pink-700/30 hover:border-pink-600/40",
                            "bg-purple-900/20 hover:bg-purple-800/30 border-purple-700/30 hover:border-purple-600/40"
                          ];
                          
                          return (
                            <button
                              key={index}
                              onClick={() => setInputMessage(starter)}
                              className={`w-full text-left p-2 md:p-3 rounded-lg transition-all duration-200 text-xs md:text-sm text-slate-300 hover:text-white ${colorClasses[index]}`}
                            >
                              {starter}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
                
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] md:max-w-md lg:max-w-2xl rounded-xl px-3 md:px-4 py-2 md:py-3 backdrop-blur-sm text-slate-200 border ${
                      message.sender === 'user' 
                        ? 'bg-slate-700/80 border-slate-600/50' 
                        : 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30'
                    }`}>
                      <div className="space-y-2">
                        {message.sender === 'ai' && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-yellow-400">👑</span>
                            <span className="text-sm font-medium text-yellow-300">Richard Heart:</span>
                          </div>
                        )}
                        <div className="text-white text-sm md:text-base leading-relaxed">
                          {message.sender === 'ai' ? renderMarkdown(message.text) : message.text}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] md:max-w-md lg:max-w-lg rounded-xl px-3 md:px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-400">👑</span>
                        <span className="text-sm font-medium text-yellow-300">Richard is typing...</span>
                        <LoadingSpinner className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-slate-700/50 flex items-center gap-2 md:gap-3 bg-slate-800/30 backdrop-blur-sm flex-shrink-0">
                <input 
                  type="text" 
                  value={inputMessage} 
                  onChange={(e) => setInputMessage(e.target.value)} 
                  placeholder="Ask Richard anything..." 
                  className="flex-grow bg-slate-700 border border-slate-600 rounded-lg px-3 md:px-4 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-yellow-500 focus:outline-none transition text-sm md:text-base" 
                  disabled={isLoading} 
                />
                <button 
                  type="submit" 
                  disabled={isLoading || !inputMessage.trim()} 
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-2 rounded-full hover:from-yellow-600 hover:to-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                >
                  <SendIcon className="w-4 h-4 md:w-5 md:h-5"/>
                </button>
              </form>
            </div>
          </main>
        </div>
      </motion.div>
    </AuroraBackground>
  );
} 