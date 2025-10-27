"use client";
import { useState } from "react";
import { MultiStepLoader } from "./multi-step-loader";
import { IconSquareRoundedX } from "@tabler/icons-react";

const loadingStates = [
  { text: "Initializing AI Auditor...", type: "step" as const },
  { text: "Analyzing contract structure...", type: "step" as const },
  { text: "AI is thinking...", type: "thought" as const },
  { text: "Generating response...", type: "answer" as const },
  { text: "Finalizing audit report...", type: "step" as const }
];

export function MultiStepLoaderDemo() {
  const [loading, setLoading] = useState(false);
  const [currentThoughts, setCurrentThoughts] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [currentStep, setCurrentStep] = useState(0);

  const simulateStreaming = () => {
    setLoading(true);
    setCurrentStep(0);
    setCurrentThoughts("");
    setCurrentAnswer("");

    // Simulate the loading process
    setTimeout(() => setCurrentStep(1), 1500);
    setTimeout(() => setCurrentStep(2), 3000);
    
    // Simulate thoughts streaming
    const thoughts = [
      "Analyzing the contract structure for potential vulnerabilities...",
      "Checking for common security patterns and anti-patterns...",
      "Identifying reentrancy attack vectors...",
      "Evaluating access control mechanisms...",
      "Assessing gas optimization opportunities..."
    ];

    let thoughtIndex = 0;
    const thoughtInterval = setInterval(() => {
      if (thoughtIndex < thoughts.length) {
        setCurrentThoughts(thoughts.slice(0, thoughtIndex + 1).join(" "));
        thoughtIndex++;
      } else {
        clearInterval(thoughtInterval);
        // Start answer after thoughts are complete
        setTimeout(() => {
          setCurrentStep(3);
          setCurrentAnswer("Based on my analysis, I've identified several critical security vulnerabilities...");
        }, 1000);
      }
    }, 2000);

    // Complete the process
    setTimeout(() => {
      setCurrentStep(4);
      setTimeout(() => {
        setLoading(false);
        setCurrentStep(0);
      }, 2000);
    }, 15000);
  };

  return (
    <div className="w-full h-[60vh] flex items-center justify-center">
      {/* Core Loader Modal */}
      <MultiStepLoader
        loadingStates={loadingStates}
        loading={loading}
        duration={2000}
        currentThoughts={currentThoughts}
        currentAnswer={currentAnswer}
        currentStep={currentStep}
      />

      {/* The buttons are for demo only, remove it in your actual code ⬇️ */}
      <button
        onClick={simulateStreaming}
        className="bg-[#39C3EF] hover:bg-[#39C3EF]/90 text-slate-950 mx-auto text-sm md:text-base transition font-medium duration-200 h-10 rounded-lg px-8 flex items-center justify-center"
        style={{
          boxShadow:
            "0px -1px 0px 0px #ffffff40 inset, 0px 1px 0px 0px #ffffff40 inset",
        }}
      >
        Click to load
      </button>

      {loading && (
        <button
          className="fixed top-4 right-4 text-slate-950 dark:text-white z-[120]"
          onClick={() => setLoading(false)}
        >
          <IconSquareRoundedX className="h-10 w-10" />
        </button>
      )}
    </div>
  );
} 