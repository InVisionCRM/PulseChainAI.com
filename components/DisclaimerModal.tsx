"use client";

import React from 'react';
import { motion } from "framer-motion";

interface DisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DisclaimerModal({ isOpen, onClose }: DisclaimerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-slate-800/95 backdrop-blur-sm border border-slate-600/50 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">⚠️ Important Disclaimer</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6 text-slate-300">
            {/* General AI Disclaimer */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">🤖 AI Accuracy & Entertainment Purpose</h3>
              <div className="space-y-3 text-sm leading-relaxed">
                <p>
                  <strong>This website is for entertainment purposes only.</strong> The AI agents on this site are designed to provide engaging conversations and insights, but they may provide inaccurate, incomplete, or incorrect information.
                </p>
                <p>
                  <strong>Do not rely on AI responses for:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Financial advice or investment decisions</li>
                  <li>Medical diagnosis or treatment</li>
                  <li>Legal advice or legal decisions</li>
                  <li>Critical life decisions</li>
                  <li>Professional or academic work</li>
                </ul>
                <p>
                  Always verify information from authoritative sources and consult with qualified professionals for important matters.
                </p>
              </div>
            </div>

            {/* Therapist Specific Disclaimer */}
            <div className="border-t border-slate-600/50 pt-6">
              <h3 className="text-lg font-semibold text-white mb-3">🧠 AI Therapist Disclaimer</h3>
              <div className="space-y-3 text-sm leading-relaxed">
                <p>
                  <strong>The AI Therapist is NOT a replacement for professional mental health care.</strong>
                </p>
                <p>
                  <strong>Important limitations:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>This is an AI simulation, not a licensed therapist</li>
                  <li>Cannot provide medical diagnosis or treatment</li>
                  <li>Cannot handle crisis situations or emergencies</li>
                  <li>May provide inappropriate or harmful advice</li>
                  <li>Not suitable for serious mental health conditions</li>
                </ul>
                <p>
                  <strong>If you're experiencing a mental health crisis:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Call 988 (Suicide & Crisis Lifeline) in the US</li>
                  <li>Contact your local emergency services</li>
                  <li>Seek help from a licensed mental health professional</li>
                  <li>Visit your nearest emergency room if needed</li>
                </ul>
                <p>
                  The AI Therapist is designed for casual conversation and general support only. For serious mental health concerns, please consult with a qualified mental health professional.
                </p>
              </div>
            </div>

            {/* Crypto/Financial Disclaimer */}
            <div className="border-t border-slate-600/50 pt-6">
              <h3 className="text-lg font-semibold text-white mb-3">💰 Crypto & Financial Disclaimer</h3>
              <div className="space-y-3 text-sm leading-relaxed">
                <p>
                  <strong>This is not financial advice.</strong> Any information about cryptocurrencies, investments, or financial matters is for entertainment purposes only.
                </p>
                <p>
                  <strong>Cryptocurrency investments involve significant risk:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Prices can be extremely volatile</li>
                  <li>You can lose your entire investment</li>
                  <li>Past performance doesn't guarantee future results</li>
                  <li>Regulatory changes can affect value</li>
                </ul>
                <p>
                  Always do your own research (DYOR) and consult with a qualified financial advisor before making any investment decisions.
                </p>
              </div>
            </div>

            {/* General Terms */}
            <div className="border-t border-slate-600/50 pt-6">
              <h3 className="text-lg font-semibold text-white mb-3">📋 General Terms</h3>
              <div className="space-y-3 text-sm leading-relaxed">
                <p>
                  By using this website, you acknowledge that:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>All AI responses are for entertainment only</li>
                  <li>You won't rely on AI advice for important decisions</li>
                  <li>The website owners are not liable for any consequences</li>
                  <li>You use this site at your own risk</li>
                </ul>
                <p>
                  <strong>Last updated:</strong> {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-600/50 flex justify-end">
            <button
              onClick={onClose}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              I Understand
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
} 