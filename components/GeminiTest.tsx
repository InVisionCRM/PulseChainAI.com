"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useGemini } from "@/lib/hooks/useGemini";
import { IconBrain, IconTestPipe, IconCheck, IconX } from "@tabler/icons-react";

export default function GeminiTest() {
  const [testResult, setTestResult] = useState<string>("");
  const [isTesting, setIsTesting] = useState(false);
  
  const { generate, isLoading, error } = useGemini({
    thinkingBudget: 1000,
    isChat: false
  });

  const runTest = async () => {
    setIsTesting(true);
    setTestResult("");
    
    try {
      const prompt = "Please provide a brief test response to confirm the Gemini 2.5 Flash API is working correctly. Keep it under 100 words.";
      const response = await generate(prompt);
      setTestResult(response);
    } catch (error) {
      setTestResult("Test failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <motion.div 
        className="bg-[var(--panel)] backdrop-blur-sm rounded-2xl p-6 border border-[var(--line)]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-500">
            <IconBrain className="w-6 h-6 text-[var(--text)]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--text)]">Gemini 2.5 Flash API Test</h2>
            <p className="text-[var(--text-muted)]">Test the API integration with thinking budget and grounding</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-[var(--panel)] rounded-lg p-3">
              <span className="text-[var(--text-muted)]">Thinking Budget:</span>
              <div className="text-[var(--text)] font-semibold">1000 steps</div>
            </div>
            <div className="bg-[var(--panel)] rounded-lg p-3">
              <span className="text-[var(--text-muted)]">Grounding:</span>
              <div className="text-[var(--text)] font-semibold">Google Search</div>
            </div>
          </div>

          {error && (
            <motion.div 
              className="bg-red-500/20 border border-red-500/30 rounded-lg p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <IconX className="w-5 h-5 text-red-400" />
                <span className="text-red-200 font-semibold">Error</span>
              </div>
              <p className="text-red-100 text-sm">{error}</p>
            </motion.div>
          )}

          <motion.button
            onClick={runTest}
            disabled={isLoading || isTesting}
            className="w-full bg-gradient-to-br from-blue-500 to-blue-500 text-[var(--text)] py-3 rounded-lg font-semibold hover:from-[var(--app-bg)] hover:to-[var(--app-bg)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading || isTesting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Testing API...
              </>
            ) : (
              <>
                <IconTestPipe className="w-5 h-5" />
                Run API Test
              </>
            )}
          </motion.button>

          {testResult && (
            <motion.div 
              className="bg-[var(--panel)] border border-[var(--line)] rounded-lg p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <IconCheck className="w-5 h-5 text-[var(--up)]" />
                <span className="text-green-200 font-semibold">Test Result</span>
              </div>
              <p className="text-[var(--text)] text-sm leading-relaxed">{testResult}</p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
} 