'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApiKeySet: (apiKey: string) => void;
  currentApiKey: string | null;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onApiKeySet, currentApiKey }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (isOpen && currentApiKey) {
      setApiKey(currentApiKey);
    } else if (isOpen) {
      setApiKey('');
    }
  }, [isOpen, currentApiKey]);

  const validateApiKey = (key: string): boolean => {
    // Basic validation for Gemini API key format
    return key.length > 0 && key.startsWith('AIza');
  };

  const testApiKey = async (key: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/test-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: key }),
      });

      if (response.ok) {
        return true;
      } else {
        const error = await response.json();
        setErrorMessage(error.error || 'Failed to test API key');
        return false;
      }
    } catch (error) {
      setErrorMessage('Network error while testing API key');
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateApiKey(apiKey)) {
      setErrorMessage('Please enter a valid Gemini API key');
      return;
    }

    setIsValidating(true);
    setTestResult('idle');
    setErrorMessage('');

    const isValid = await testApiKey(apiKey);
    
    if (isValid) {
      setTestResult('success');
      onApiKeySet(apiKey);
      setTimeout(() => {
        onClose();
        setTestResult('idle');
        setErrorMessage('');
      }, 1500);
    } else {
      setTestResult('error');
    }

    setIsValidating(false);
  };

  const handleClear = () => {
    setApiKey('');
    setShowKey(false);
    setTestResult('idle');
    setErrorMessage('');
    onApiKeySet('');
  };

  const handleClose = () => {
    setApiKey('');
    setShowKey(false);
    setTestResult('idle');
    setErrorMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-slate-800/90 backdrop-blur-sm border border-slate-600/50 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Gemini API Key Setup</h2>
                <p className="text-slate-400 text-sm">Configure your personal API key for enhanced reliability</p>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-white transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tutorial Section */}
            <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">📚 How to Get Your API Key</h3>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <p>Visit <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Google AI Studio</a> and sign in with your Google account</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <p>Click "Create API Key" and select "Create API Key in new project"</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <p>Copy your API key (starts with "AIza...") and paste it below</p>
                </div>
              </div>
            </div>

            {/* Important Notice */}
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-amber-400 font-semibold mb-1">Important Information</h4>
                  <p className="text-amber-200 text-sm">
                    You don't need to add an API key to use this platform. We provide a global API key that works for everyone. 
                    However, depending on site traffic, the global key may reach its daily limit. Adding your own API key ensures 
                    uninterrupted access and better performance.
                  </p>
                </div>
              </div>
            </div>

            {/* Storage Notice */}
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-blue-400 font-semibold mb-1">Privacy & Storage</h4>
                  <p className="text-blue-200 text-sm">
                    Your API key is stored locally in your browser's session storage and will be automatically cleared when you close your browser. 
                    We do not store your API key on our servers or in any persistent storage. This ensures your API key remains private and secure.
                  </p>
                </div>
              </div>
            </div>

            {/* API Key Input */}
            <div className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-2">
                  Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    id="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none transition pr-12"
                    disabled={isValidating}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showKey ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Status Messages */}
              {testResult === 'success' && (
                <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">API key validated successfully!</span>
                  </div>
                </div>
              )}

              {testResult === 'error' && (
                <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={!apiKey.trim() || isValidating}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  {isValidating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Testing...
                    </>
                  ) : (
                    'Save & Test API Key'
                  )}
                </button>
                
                {currentApiKey && (
                  <button
                    onClick={handleClear}
                    className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                  >
                    Clear Key
                  </button>
                )}
                
                <button
                  onClick={handleClose}
                  className="bg-transparent border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ApiKeyModal; 