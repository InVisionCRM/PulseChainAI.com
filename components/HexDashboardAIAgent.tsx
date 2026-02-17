'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { HexDataPoint } from '@/lib/hooks/useHexGemini';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LiveData {
  // Ethereum
  price?: number;
  tsharePrice?: number;
  tshareRateHEX?: number;
  stakedHEX?: number;
  circulatingHEX?: number;
  payoutPerTshare?: number;
  liquidityHEX?: number;
  liquidityUSDC?: number;
  liquidityETH?: number;
  penaltiesHEX?: number;
  // PulseChain
  price_Pulsechain?: number;
  pricePulseX?: number;
  tsharePrice_Pulsechain?: number;
  tshareRateHEX_Pulsechain?: number;
  stakedHEX_Pulsechain?: number;
  circulatingHEX_Pulsechain?: number;
  payoutPerTshare_Pulsechain?: number;
  liquidityHEX_Pulsechain?: number;
  liquidityPLS_Pulsechain?: number;
  liquidityEHEX_Pulsechain?: number;
  penaltiesHEX_Pulsechain?: number;
  pricePLS_Pulsechain?: number;
  pricePLSX_Pulsechain?: number;
  priceINC_Pulsechain?: number;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface HexDashboardAIAgentProps {
  // Data access from dashboard
  ethereumData?: HexDataPoint[];
  pulsechainData?: HexDataPoint[];
  ethereumStakingMetrics?: any;
  pulsechainStakingMetrics?: any;
  liveData?: LiveData;
  defaultNetwork?: 'ethereum' | 'pulsechain' | 'both';
  // Historical data for enhanced analysis
  includeHistoricalData?: boolean;

  // Modal props
  isOpen?: boolean;
  onClose?: () => void;

  // UI customization
  compact?: boolean;
  className?: string;
}

const HexDashboardAIAgent: React.FC<HexDashboardAIAgentProps> = React.memo(({
  ethereumData = [],
  pulsechainData = [],
  ethereumStakingMetrics,
  pulsechainStakingMetrics,
  liveData,
  defaultNetwork = 'pulsechain',
  compact = false,
  className = '',
  includeHistoricalData = true,
  isOpen = false,
  onClose
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [network, setNetwork] = useState<'ethereum' | 'pulsechain' | 'both'>(defaultNetwork);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const maxRetries = 2;

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentStreamingMessage]);

  // Cleanup effect for abort controller
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const sendMessage = useCallback(async (messageText: string, isRetry = false) => {
    if (!messageText.trim() || isLoadingChat) return;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    if (!isRetry) {
      const userMessage: Message = {
        id: Date.now().toString(),
        text: messageText,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setRetryCount(0);
      setError(null);
    }

    setIsLoadingChat(true);
    setIsStreaming(true);
    setCurrentStreamingMessage('');

    try {
      // Prepare conversation history (last 10 messages)
      const conversationHistory = messages.slice(-10).map(msg => ({
        id: msg.id,
        text: msg.text,
        sender: msg.sender,
        timestamp: msg.timestamp
      }));

      const response = await fetch('/api/hex-dashboard-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          conversationHistory,
          network,
          includeStakingData: true,
          includeLiveData: true,
          includeHistoricalData,
          liveData,
          historicalData: includeHistoricalData ? {
            ethereum: network === 'ethereum' || network === 'both' ? ethereumData.slice(-30) : [], // Last 30 data points
            pulsechain: network === 'pulsechain' || network === 'both' ? pulsechainData.slice(-30) : []
          } : undefined
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let accumulatedMessage = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === 'response' && data.text) {
                    accumulatedMessage += data.text;
                    setCurrentStreamingMessage(accumulatedMessage);
                  } else if (data.type === 'done') {
                    // Streaming complete
                    const aiMessage: Message = {
                      id: (Date.now() + 1).toString(),
                      text: accumulatedMessage,
                      sender: 'assistant',
                      timestamp: new Date()
                    };
                    setMessages(prev => [...prev, aiMessage]);
                    setCurrentStreamingMessage('');
                    setIsStreaming(false);
                    break;
                  } else if (data.type === 'error') {
                    throw new Error(data.error || 'Streaming error occurred');
                  }
                } catch (parseError) {
                  console.warn('Failed to parse SSE data:', parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
    } catch (error) {
      // Don't show error for aborted requests
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('HEX AI request was cancelled');
        return;
      }

      console.error('HEX AI chat error:', error);

      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      const isRetryableError = errorObj.message.includes('network') ||
                              errorObj.message.includes('timeout') ||
                              errorObj.message.includes('rate limit') ||
                              errorObj.message.includes('temporarily unavailable');

      if (isRetryableError && retryCount < maxRetries) {
        console.log(`Retrying HEX AI request (attempt ${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);

        // Wait before retrying (exponential backoff)
        setTimeout(() => {
          sendMessage(messageText, true);
        }, Math.pow(2, retryCount) * 1000);

        return;
      }

      // Final error after retries or non-retryable error
      let errorText = 'Sorry, I encountered an error. ';
      if (errorObj.message.includes('rate limit') || errorObj.message.includes('temporarily unavailable')) {
        errorText += 'The AI service is busy. Please try again in a few minutes.';
      } else if (errorObj.message.includes('network')) {
        errorText += 'Please check your internet connection and try again.';
      } else {
        errorText += 'Please try again.';
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setError(errorObj.message);
      setCurrentStreamingMessage('');
      setIsStreaming(false);
    } finally {
      setIsLoadingChat(false);
      abortControllerRef.current = null;
    }
  }, [messages, isLoadingChat, network, liveData]);

  const handleSendMessage = useCallback(() => {
    if (chatInput.trim() && !isLoadingChat) {
      const messageText = chatInput;
      setChatInput('');
      sendMessage(messageText);
    }
  }, [chatInput, isLoadingChat, sendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>HEX AI Assistant</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-full max-h-[60vh] overflow-hidden">
          {/* Network Selector */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700">Network:</span>
            <div className="flex gap-1">
              {(['ethereum', 'pulsechain', 'both'] as const).map((net) => (
                <button
                  key={net}
                  onClick={() => setNetwork(net)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    network === net
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-gray-300 hover:border-gray-400'
                  }`}
                  disabled={isLoadingChat}
                >
                  {net.charAt(0).toUpperCase() + net.slice(1)}
                </button>
              ))}
            </div>
          </div>


          {/* Chat Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 border border-gray-200 rounded p-2 mb-3 overflow-y-auto bg-gray-50 min-h-[300px] max-h-[400px]"
          >
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-sm">Ask me anything about HEX!</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-2 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] px-2 py-1 rounded text-xs ${
                message.sender === 'user'
                  ? 'bg-black text-white'
                  : 'bg-white text-black border border-gray-300'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.text}</p>
            </div>
          </div>
        ))}

        {/* Streaming message */}
        {isStreaming && currentStreamingMessage && (
          <div className="mb-2 flex justify-start">
            <div className="max-w-[90%] px-2 py-1 rounded text-xs bg-white text-black border border-gray-300">
              <p className="whitespace-pre-wrap">{currentStreamingMessage}</p>
              <span className="inline-block w-1 h-3 bg-gray-400 animate-pulse ml-1"></span>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoadingChat && !isStreaming && (
          <div className="mb-2 flex justify-start">
            <div className="bg-white text-black max-w-[90%] px-2 py-1 rounded text-xs border border-gray-300 flex items-center">
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="ml-2">
                {retryCount > 0 ? `Retrying... (${retryCount}/${maxRetries})` : 'Thinking...'}
              </span>
            </div>
          </div>
        )}

        {/* Error display with retry */}
        {error && !isLoadingChat && (
          <div className="mb-2 flex justify-start">
            <div className="bg-red-50 text-red-800 max-w-[90%] px-2 py-1 rounded text-xs border border-red-200">
              <div className="flex items-center justify-between gap-2">
                <span>Connection error occurred</span>
                <button
                  onClick={() => {
                    setError(null);
                    const lastUserMessage = [...messages].reverse().find(m => m.sender === 'user');
                    if (lastUserMessage) {
                      sendMessage(lastUserMessage.text);
                    }
                  }}
                  className="px-2 py-0.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

          {/* Input Area */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                value={chatInput}
                onChange={(e) => {
                  const value = e.target.value;
                  // Limit input to reasonable length
                  if (value.length <= 2000) {
                    setChatInput(value);
                  }
                }}
                onKeyPress={handleKeyPress}
                placeholder="Ask about HEX staking, market analysis..."
                className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-gray-400 text-black placeholder-gray-500 disabled:bg-gray-100 disabled:text-gray-500"
                rows={2}
                disabled={isLoadingChat}
                maxLength={2000}
              />
              {chatInput.length > 1800 && (
                <div className="absolute bottom-1 right-2 text-xs text-gray-400">
                  {chatInput.length}/2000
                </div>
              )}
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || isLoadingChat || chatInput.length > 2000}
              className="px-3 py-1 bg-black text-white text-xs rounded border border-black hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              title={chatInput.length > 2000 ? 'Message too long' : 'Send message'}
            >
              Send
            </button>
          </div>

          {/* Data status indicator */}
          <div className="mt-2 text-xs text-gray-500">
            {ethereumStakingMetrics && pulsechainStakingMetrics ? (
              <span>✓ Connected to Ethereum & PulseChain data</span>
            ) : ethereumStakingMetrics ? (
              <span>✓ Connected to Ethereum data</span>
            ) : pulsechainStakingMetrics ? (
              <span>✓ Connected to PulseChain data</span>
            ) : (
              <span>⚠ Limited data available</span>
            )}
            {(ethereumData.length > 0 || pulsechainData.length > 0) && (
              <span className="ml-2">• Historical data available ({ethereumData.length + pulsechainData.length} points)</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

HexDashboardAIAgent.displayName = 'HexDashboardAIAgent';

export default HexDashboardAIAgent;
