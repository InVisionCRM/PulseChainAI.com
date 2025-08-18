"use client";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";

const CheckIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={cn("w-6 h-6 ", className)}
    >
      <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
};

const CheckFilled = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("w-6 h-6 ", className)}
    >
      <path
        fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
};

type LoadingState = {
  text: string;
  type?: 'thought' | 'answer' | 'step';
};

const LoaderCore = ({
  loadingStates,
  value = 0,
  currentThoughts = "",
  currentAnswer = "",
}: {
  loadingStates: LoadingState[];
  value?: number;
  currentThoughts?: string;
  currentAnswer?: string;
}) => {
  // Use the single thought passed from parent
  const currentThought = currentThoughts;

  return (
    <div className="flex relative justify-start max-w-xl mx-auto flex-col">
      {loadingStates.map((loadingState, index) => {
        const distance = Math.abs(index - value);
        const opacity = Math.max(1 - distance * 0.2, 0);

        return (
          <motion.div
            key={index}
            className={cn("text-left flex gap-2 mb-4")}
            initial={{ opacity: 0, y: -(value * 40) }}
            animate={{ opacity: opacity, y: -(value * 40) }}
            transition={{ duration: 0.5 }}
          >
            <div>
              {index > value && (
                <CheckIcon className="text-black dark:text-white" />
              )}
              {index <= value && (
                <CheckFilled
                  className={cn(
                    "text-black dark:text-white",
                    value === index &&
                      "text-black dark:text-lime-500 opacity-100"
                  )}
                />
              )}
            </div>
            <div className="flex flex-col">
              <span
                className={cn(
                  "text-black dark:text-white",
                  value === index && "text-black dark:text-lime-500 opacity-100"
                )}
              >
                {loadingState.text}
              </span>
              
              {/* Show only the current thought with fade transitions */}
              {loadingState.type === 'thought' && value === index && currentThought && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 p-3 bg-blue-900/30 rounded-lg border border-blue-500/30 max-w-md"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-400 text-xs font-semibold">🧠 AI Thinking</span>
                  </div>
                  <motion.p
                    key={currentThought}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="text-xs text-blue-200 leading-relaxed whitespace-pre-wrap"
                  >
                    {currentThought}
                    <span className="inline-block w-1 h-3 bg-blue-400 ml-1 animate-pulse"></span>
                  </motion.p>
                </motion.div>
              )}
              
              {/* Show current answer if this is the answer step */}
              {loadingState.type === 'answer' && value === index && currentAnswer && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700 max-w-md"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-400 text-xs font-semibold">💬 AI Response</span>
                  </div>
                  <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {currentAnswer}
                    <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse"></span>
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export const MultiStepLoader = ({
  loadingStates,
  loading,
  duration = 2000,
  loop = true,
  currentThoughts = "",
  currentAnswer = "",
  currentStep = 0,
}: {
  loadingStates: LoadingState[];
  loading?: boolean;
  duration?: number;
  loop?: boolean;
  currentThoughts?: string;
  currentAnswer?: string;
  currentStep?: number;
}) => {
  const [displayedThought, setDisplayedThought] = useState("");
  
  // Update displayed thought when currentThoughts changes
  useEffect(() => {
    if (currentThoughts) {
      const sentences = currentThoughts
        .split(/[.!?]+/)
        .filter(sentence => sentence.trim().length > 0)
        .map(sentence => sentence.trim() + '.');
      
      const latestThought = sentences[sentences.length - 1] || "";
      setDisplayedThought(latestThought);
    }
  }, [currentThoughts]);
  
  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          exit={{
            opacity: 0,
          }}
          className="w-full h-full fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-2xl"
        >
          <LoaderCore 
            value={currentStep} 
            loadingStates={loadingStates} 
            currentThoughts={displayedThought}
            currentAnswer={currentAnswer}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 