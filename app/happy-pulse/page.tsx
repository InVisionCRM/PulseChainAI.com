"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { IconHeart, IconSparkles, IconArrowRight } from "@tabler/icons-react";
import { useGemini } from "@/lib/hooks/useGemini";

export default function HappyPulsePage() {
  const [isStarted, setIsStarted] = useState(false);
  const [inputTweet, setInputTweet] = useState("");
  const [positiveTweet, setPositiveTweet] = useState("");
  
  const { generate, isLoading, error } = useGemini({
    thinkingBudget: 1000,
    isChat: false
  });

  const handleStart = () => {
    setIsStarted(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTweet.trim()) return;

    try {
      const prompt = `Transform this negative tweet into a positive, uplifting message while maintaining the core meaning. Add appropriate emojis and make it sound authentic and relatable. Keep it under 280 characters. Original tweet: "${inputTweet}"`;
      
      const response = await generate(prompt);
      setPositiveTweet(response);
    } catch (error) {
      console.error("Error processing tweet:", error);
    }
  };

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center p-4">
        <motion.div 
          className="text-center max-w-4xl mx-auto"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          {/* Wacky Title */}
          <motion.h1 
            className="text-6xl md:text-8xl font-bold text-white mb-8"
            initial={{ y: -50 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
            style={{
              fontFamily: "Comic Sans MS, cursive",
              textShadow: "4px 4px 0px rgba(0,0,0,0.3), 8px 8px 0px rgba(255,255,255,0.2)"
            }}
          >
            Positive Vibes Only! ✨
          </motion.h1>

          {/* Sparkles Animation */}
          <motion.div 
            className="flex justify-center mb-8"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <IconSparkles className="w-16 h-16 text-yellow-300" />
          </motion.div>

          {/* Description */}
          <motion.div 
            className="bg-white/20 backdrop-blur-sm rounded-3xl p-8 mb-8"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              🌈 HappyPulse AI Agent
            </h2>
            <p className="text-xl md:text-2xl text-white/90 leading-relaxed mb-6">
              Transform your negative tweets into positive, uplifting messages! 
              No matter how sad, angry, or honest your tweet might be, 
              we'll turn it into pure sunshine! ☀️
            </p>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              <div className="bg-white/10 rounded-2xl p-6">
                <h3 className="text-2xl font-bold text-white mb-3">🎯 What it does:</h3>
                <ul className="text-white/90 space-y-2">
                  <li>• Converts negative emotions to positive ones</li>
                  <li>• Maintains your message's core meaning</li>
                  <li>• Adds uplifting language and emojis</li>
                  <li>• Keeps it authentic and relatable</li>
                </ul>
              </div>
              <div className="bg-white/10 rounded-2xl p-6">
                <h3 className="text-2xl font-bold text-white mb-3">✨ Powered by:</h3>
                <ul className="text-white/90 space-y-2">
                  <li>• Gemini 2.5 Flash AI</li>
                  <li>• Advanced sentiment analysis</li>
                  <li>• Positive psychology principles</li>
                  <li>• Real-time processing</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Start Button */}
          <motion.button
            onClick={handleStart}
            className="group bg-white text-purple-600 px-8 py-4 rounded-full text-2xl font-bold shadow-2xl hover:shadow-white/25 transition-all duration-300 hover:scale-105"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <span className="flex items-center gap-3">
              Start Spreading Joy! 
              <IconHeart className="w-6 h-6 group-hover:animate-pulse" />
            </span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            HappyPulse ✨
          </h1>
          <p className="text-xl text-white/90">
            Transform your tweets into positive vibes!
          </p>
        </motion.div>

        {/* Input Form */}
        <motion.div 
          className="bg-white/20 backdrop-blur-sm rounded-3xl p-8 mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white text-xl font-bold mb-4">
                Enter your tweet (the more negative, the better! 😄):
              </label>
              <textarea
                value={inputTweet}
                onChange={(e) => setInputTweet(e.target.value)}
                placeholder="Type your negative tweet here... We'll make it positive! 🌈"
                className="w-full h-32 p-4 rounded-2xl border-2 border-white/30 bg-white/10 text-white placeholder-white/60 resize-none focus:outline-none focus:border-white/60 focus:bg-white/20 transition-all"
                disabled={isProcessing}
              />
            </div>
            
            <motion.button
              type="submit"
              disabled={isLoading || !inputTweet.trim()}
              className="w-full bg-white text-purple-600 py-4 rounded-2xl text-xl font-bold shadow-2xl hover:shadow-white/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  Spreading Positive Vibes...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-3">
                  Make it Positive! 
                  <IconArrowRight className="w-6 h-6" />
                </span>
              )}
            </motion.button>
          </form>
        </motion.div>

        {/* Error Display */}
        {error && (
          <motion.div 
            className="bg-red-500/20 backdrop-blur-sm rounded-3xl p-6 mb-6 border-2 border-red-500/30"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="text-xl font-bold text-red-200 mb-2">Error</h3>
            <p className="text-red-100">{error}</p>
          </motion.div>
        )}

        {/* Result */}
        {positiveTweet && (
          <motion.div 
            className="bg-white/20 backdrop-blur-sm rounded-3xl p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <IconSparkles className="w-6 h-6 text-yellow-300" />
              Your Positive Tweet:
            </h3>
            <div className="bg-white/10 rounded-2xl p-6 border-2 border-white/20">
              <p className="text-white text-lg leading-relaxed">{positiveTweet}</p>
            </div>
            <div className="mt-4 flex gap-4">
              <button className="bg-white text-purple-600 px-6 py-3 rounded-xl font-bold hover:bg-white/90 transition-colors">
                Copy Tweet
              </button>
              <button 
                onClick={() => {
                  setPositiveTweet("");
                  setInputTweet("");
                }}
                className="bg-white/20 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/30 transition-colors"
              >
                Try Another
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
} 