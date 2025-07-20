"use client";

import React, { useState, useCallback } from 'react';
import { motion } from "motion/react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import ColourfulText from "@/components/ui/colourful-text";
import HappyFaceLoader from '@/components/icons/HappyFaceLoader';

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
                    <h2 className="text-2xl font-bold text-white mb-2">Welcome to HappyPulse</h2>
                    <p className="text-slate-400 text-sm">Turn your negative thoughts into positive vibes!</p>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-pink-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-xs font-bold">✨</span>
                        </div>
                        <p className="text-slate-300 text-sm">HappyPulse uses AI to transform negative thoughts into positive, uplifting messages.</p>
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
                        <p className="text-slate-300 text-sm">Your messages are processed securely and not stored on our servers.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-yellow-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">The AI maintains your message's core meaning while adding positive energy.</p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                >
                    Start Spreading Joy! ✨
                </button>
            </motion.div>
        </div>
    );
};

export default function HappyPulsePage() {
  const [inputTweet, setInputTweet] = useState("");
  const [positiveTweet, setPositiveTweet] = useState<string>("");
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTweet.trim() || isLoading) return;

    setIsLoading(true);
    setIsProcessing(true);
    setError(null);
    setPositiveTweet("");

    try {
      const response = await fetch('/api/happy-pulse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputTweet
        }),
      });

      if (!response.ok) {
        throw new Error(`HappyPulse API error: ${response.status}`);
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
        setPositiveTweet("I'm sorry, I couldn't generate a positive message right now. Please try again!");
      } else {
        setPositiveTweet(aiResponseText);
      }

    } catch (e) {
      const errorMessage = (e as Error).message;
      setError(errorMessage);
      setPositiveTweet("I'm sorry, I encountered an error while processing your message. Please try again!");
    } finally {
      setIsLoading(false);
      // Keep isProcessing true to maintain vibrant colors
    }
  }, [inputTweet, isLoading]);

  const handleTryAnother = () => {
    setInputTweet("");
    setPositiveTweet("");
    setError(null);
    // Keep the vibrant colors - don't reset to black and white
  };

  const handleCopyMessage = async () => {
    if (positiveTweet) {
      try {
        await navigator.clipboard.writeText(positiveTweet);
        // You could add a toast notification here
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    }
  };

  const handleShareMessage = async () => {
    if (positiveTweet) {
      try {
        if (navigator.share) {
          await navigator.share({
            title: 'HappyPulse Positive Message',
            text: positiveTweet,
            url: window.location.href
          });
        } else {
          // Fallback to copying to clipboard
          await navigator.clipboard.writeText(positiveTweet);
          // You could add a toast notification here
        }
      } catch (err) {
        console.error('Failed to share:', err);
      }
    }
  };

  const handleRetry = () => {
    if (inputTweet.trim()) {
      handleSubmit({ preventDefault: () => {} } as React.FormEvent);
    }
  };

  // Define different color sets for different states
  const defaultColors = ['#000000', '#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777', '#888888', '#999999'];
  const vibrantColors = ['#FF1493', '#FF69B4', '#FFB6C1', '#FFC0CB', '#FFE4E1', '#FF69B4', '#FF1493', '#FF69B4', '#FFB6C1', '#FFC0CB'];

  return (
    <AuroraBackground 
      className="min-h-screen flex items-center justify-center p-4" 
      colors={isProcessing ? vibrantColors : defaultColors}
    >
      <SplashModal isOpen={showSplash} onClose={() => setShowSplash(false)} />
      
      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        onClick={() => window.location.href = '/'}
        className="absolute top-20 left-6 z-10 bg-slate-900/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-slate-800/80 transition-colors border border-slate-700/50"
      >
        ← Back To Home
      </motion.button>

      {/* Title Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="absolute top-32 left-1/2 transform -translate-x-1/2 text-center z-10"
      >
        <h1 className="text-4xl md:text-6xl font-bold tracking-wider">
          <motion.span 
            className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [1, 0.8, 1]
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            HAPPY
          </motion.span>
          <span className="ml-2 md:ml-4">
            <ColourfulText text="VIBES" />
          </span>
          <span className="ml-2 md:ml-4 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.9)]">ONLY!!!</span>
        </h1>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-md mx-auto mt-44 md:mt-52"
      >
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.3)] p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <p className="text-slate-400 text-sm">Transform negative thoughts into positive vibes</p>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <HappyFaceLoader />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Spreading Positive Vibes! ✨</h3>
              <p className="text-sm text-slate-400">Transforming your words into pure sunshine...</p>
            </div>
          ) : !positiveTweet || positiveTweet.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center">
                <h4 className="text-lg font-semibold text-white mb-3">What's Wrong? 😔</h4>
                <p className="text-sm text-slate-400 mb-4">Tell me what's bothering you, and I'll help you see it in a positive light!</p>
              </div>
              
                              <div className="space-y-3">
                  <textarea
                    value={inputTweet}
                    onChange={(e) => setInputTweet(e.target.value)}
                    placeholder="Share what's on your mind..."
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-pink-500 focus:outline-none transition resize-none min-h-[80px] max-h-[200px]"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && inputTweet.trim()) {
                        e.preventDefault();
                        handleSubmit(e as any);
                      }
                    }}
                    rows={3}
                  />
                
                <button
                  onClick={(e) => handleSubmit(e)}
                  disabled={!inputTweet.trim() || isLoading}
                  className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-pink-700 hover:to-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Make it Positive! ✨
                </button>
              </div>
              
              <div className="pt-4 border-t border-slate-600/30">
                <p className="text-xs text-slate-500 mb-2 text-center">Or try this example:</p>
                <button
                  onClick={() => setInputTweet("This token is a freaking scam. it took all my money!")}
                  className="w-full text-left p-2 rounded-lg transition-all duration-200 text-xs text-slate-300 hover:text-white hover:bg-slate-700/30"
                >
                  This token is a freaking scam. it took all my money!
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-3">
                  <span className="text-2xl mr-2">✨</span>
                  <h3 className="text-lg font-semibold text-white">Your Positive Message:</h3>
                </div>
              </div>
              
              {/* Original Message */}
              <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-600/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-400">😔</span>
                  <span className="text-sm font-medium text-slate-300">Original:</span>
                </div>
                <p className="text-slate-300 text-center leading-relaxed">{inputTweet}</p>
              </div>
              
              {/* Positive Message */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-pink-400">✨</span>
                  <span className="text-sm font-medium text-pink-300">Positive:</span>
                </div>
                <p className="text-white text-center leading-relaxed">{positiveTweet}</p>
              </div>
              
              {error && (
                <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              
              <div className="flex justify-center space-x-6">
                <button
                  onClick={handleCopyMessage}
                  className="text-white hover:opacity-70 transition-opacity text-2xl"
                  title="Copy Message"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={handleShareMessage}
                  className="text-white hover:opacity-70 transition-opacity text-2xl"
                  title="Share Message"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                </button>
                <button
                  onClick={handleRetry}
                  className="text-white hover:opacity-70 transition-opacity text-2xl"
                  title="Retry"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={handleTryAnother}
                  className="text-white hover:opacity-70 transition-opacity text-2xl"
                  title="New Message"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AuroraBackground>
  );
} 