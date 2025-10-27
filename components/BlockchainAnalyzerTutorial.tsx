'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TutorialStep {
  id: number;
  title: string;
  description: string;
  targetElement?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  showArrow?: boolean;
}

interface BlockchainAnalyzerTutorialProps {
  onClose: () => void;
  onComplete: () => void;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 0,
    title: "Welcome to Blockchain Analyzer",
    description: "This AI-powered tool helps you analyze tokens, addresses, and blockchain data. You can ask questions about token holders, whale movements, transaction patterns, and more. Note: This is a proof of concept and results should not be taken as 100% guaranteed.",
    position: 'center',
    showArrow: false
  },
  {
    id: 1,
    title: "Add Tokens to Context",
    description: "Click the '+ Token' button to add tokens, addresses, or contracts to your analysis context. This helps the AI provide more targeted insights.",
    targetElement: '[data-tutorial="add-token-button"]',
    position: 'center',
    showArrow: false
  },
  {
    id: 2,
    title: "Configure Data Sources",
    description: "Use the '+ Endpoint' button to select which API endpoints to call for data. You can choose specific data sources or let the AI decide automatically.",
    targetElement: '[data-tutorial="add-endpoint-button"]',
    position: 'center',
    showArrow: false
  },
  {
    id: 3,
    title: "Ask Your Question",
    description: "Type your question in the input field. Try asking about token analysis, holder patterns, whale movements, or address activity. You can use @ to mention specific tokens.",
    targetElement: '[data-tutorial="chat-input"]',
    position: 'center',
    showArrow: false
  },
  {
    id: 4,
    title: "View AI Analysis",
    description: "The AI will provide detailed analysis with data visualizations, holder distributions, and insights. You'll see responses appear in the chat area with interactive data cards.",
    targetElement: '[data-tutorial="chat-messages"]',
    position: 'center',
    showArrow: false
  },
  {
    id: 5,
    title: "Ready to Analyze!",
    description: "You're all set! The Blockchain Analyzer will help you explore PulseChain data with AI-powered insights. Remember, this is a proof of concept for demonstration purposes.",
    position: 'center',
    showArrow: false
  }
];

export const BlockchainAnalyzerTutorial: React.FC<BlockchainAnalyzerTutorialProps> = ({
  onClose,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const currentStepData = tutorialSteps[currentStep];

  useEffect(() => {
    if (currentStepData.targetElement) {
      const element = document.querySelector(currentStepData.targetElement) as HTMLElement;
      setTargetElement(element);
      
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setTargetElement(null);
    }
  }, [currentStepData.targetElement]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const getModalPosition = () => {
    // Center the modal within the AI chat window bounds
    const aiChatContainer = document.querySelector('[data-tutorial="ai-chat-container"]') as HTMLElement;
    
    if (aiChatContainer) {
      const rect = aiChatContainer.getBoundingClientRect();
      const modalWidth = 320;
      const modalHeight = 200;
      
      return {
        position: 'fixed' as const,
        top: `${rect.top + (rect.height / 2) - (modalHeight / 2)}px`,
        left: `${rect.left + (rect.width / 2) - (modalWidth / 2)}px`,
        transform: 'none',
        maxWidth: `${Math.min(320, rect.width - 40)}px`,
      };
    }
    
    // Fallback to viewport center if AI container not found
    return {
      position: 'fixed' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  };


  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] pointer-events-auto"
      >
        
        {/* Spotlight effect for target element */}
        {targetElement && (
          <div
            className="absolute pointer-events-none"
            style={{
              top: targetElement.getBoundingClientRect().top - 10,
              left: targetElement.getBoundingClientRect().left - 10,
              width: targetElement.getBoundingClientRect().width + 20,
              height: targetElement.getBoundingClientRect().height + 20,
              borderRadius: '8px',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
              zIndex: 10000,
            }}
          />
        )}
        

        {/* Tutorial Modal */}
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="bg-blue-500/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 max-w-sm w-full mx-4"
          style={getModalPosition()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Content */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-2">
              {currentStepData.title}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {currentStepData.description}
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index <= currentStep ? 'bg-blue-500' : 'bg-white/20'
                }`}
                style={{ width: `${100 / tutorialSteps.length}%` }}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
                >
                  Previous
                </button>
              )}
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                Skip Tutorial
              </button>
            </div>
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-slate-950 hover:bg-slate-950 text-white rounded-lg font-medium transition-colors"
            >
              {currentStep === tutorialSteps.length - 1 ? 'Start Analyzing' : 'Next'}
            </button>
          </div>
        </motion.div>

      </motion.div>
    </AnimatePresence>
  );
};

export default BlockchainAnalyzerTutorial;
