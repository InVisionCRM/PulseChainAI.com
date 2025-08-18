'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from "framer-motion";

import { GlowingEffect } from "@/components/ui/glowing-effect";
import type { Message } from '../types';
import LoadingSpinner from '@/components/icons/LoadingSpinner';
import SendIcon from '@/components/icons/SendIcon';
import { useApiKey } from '../lib/hooks/useApiKey';

interface AIAgentChatProps {
  agentEndpoint: string;
  title: string;
  description: string;
  quickQuestions: string[];
}

const AIAgentChat: React.FC<AIAgentChatProps> = ({ 
  agentEndpoint, 
  title, 
  description, 
  quickQuestions 
}) => {
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

      const response = await fetch(`/api/${agentEndpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: messageText,
          history: messages
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const aiMessage: Message = { 
          id: (Date.now() + 1).toString(), 
          text: data.response, 
          sender: 'ai' 
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.error || 'Sorry, something went wrong. Please try again.',
          sender: 'ai'
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'ai'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoadingChat(false);
    }
  }, [messages, isLoadingChat, getApiKey, agentEndpoint]);

  const handleSendMessage = useCallback(() => {
    if (chatInput.trim()) {
      sendMessage(chatInput);
      setChatInput('');
    }
  }, [chatInput, sendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleQuickQuestion = useCallback((question: string) => {
    sendMessage(question);
  }, [sendMessage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-4">{title}</h1>
          <p className="text-xl text-purple-200">{description}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/20"
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Questions:</h3>
            <div className="grid gap-3">
              {quickQuestions.map((question, index) => (
                <motion.button
                  key={index}
                  onClick={() => handleQuickQuestion(question)}
                  className="text-left p-3 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-100 hover:text-white transition-colors duration-200 border border-purple-400/20 hover:border-purple-400/40"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isLoadingChat}
                >
                  {question}
                </motion.button>
              ))}
            </div>
          </div>

          <div
            ref={chatContainerRef}
            className="h-96 overflow-y-auto mb-4 p-4 bg-black/20 rounded-lg border border-white/10"
          >
            {messages.length === 0 && (
              <div className="text-center text-purple-300 mt-16">
                <p>Start a conversation by typing below or clicking a quick question!</p>
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-4 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.sender === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              </div>
            ))}
            {isLoadingChat && (
              <div className="mb-4 flex justify-start">
                <div className="bg-gray-700 text-white max-w-xs lg:max-w-md px-4 py-2 rounded-lg flex items-center">
                  <LoadingSpinner />
                  <span className="ml-2">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <GlowingEffect>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message here..."
                  className="w-full p-3 pr-12 bg-black/30 border border-white/30 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={2}
                  disabled={isLoadingChat}
                />
              </GlowingEffect>
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isLoadingChat}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-purple-400 hover:text-purple-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AIAgentChat;