'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { StatCounterConfig, TokenCard } from './StatCounterBuilder';

interface CodeGenerationModalProps {
  open: boolean;
  onClose: () => void;
  config: StatCounterConfig;
  statResults: Record<string, Record<string, unknown>>;
}

export default function CodeGenerationModal({ 
  open, 
  onClose, 
  config, 
  statResults 
}: CodeGenerationModalProps) {
  const [activeTab, setActiveTab] = useState<'html' | 'embed'>('html');

  const generateHTML = () => {
    if (config.tokens.length === 0) {
      return `<!-- No tokens configured yet -->
<div style="text-align: center; padding: 20px; color: #666;">
  <p>Please add tokens to your dashboard first</p>
</div>`;
    }

    const cardsHTML = config.tokens.map((tokenCard, index) => {
      if (!tokenCard.token) {
        return `<!-- Empty card ${index + 1} -->`;
      }

      const cardStats = tokenCard.stats.map(stat => {
        const result = statResults[tokenCard.id]?.[stat.id] as any;
        const value = result?.formattedValue || result?.value || 'Loading...';
        return `
        <div class="stat-item" style="
          background: ${tokenCard.customization.cardBackgroundColor}${Math.round((Number(tokenCard.customization.cardOpacity) || 100) / 100 * 255).toString(16).padStart(2, '0')};
          border: 1px solid ${tokenCard.customization.cardBorderColor};
          border-radius: 8px;
          padding: 12px;
          margin: 8px;
          text-align: center;
        ">
          <div style="color: ${tokenCard.customization.textColor}; font-size: 14px; margin-bottom: 4px;">
            ${(tokenCard.customization.customLabels && (tokenCard.customization.customLabels as any)[stat.id]) || stat.label}
          </div>
          <div style="color: ${tokenCard.customization.accentColor}; font-size: 18px; font-weight: bold;">
            ${value}
          </div>
        </div>`;
      }).join('');

      return `
      <div class="token-card" style="
        position: absolute;
        left: ${tokenCard.position.x}px;
        top: ${tokenCard.position.y}px;
        width: ${tokenCard.size.width}px;
        height: ${tokenCard.size.height}px;
        background: ${tokenCard.customization.backgroundColor}${Math.round((Number(tokenCard.customization.backgroundOpacity) || 100) / 100 * 255).toString(16).padStart(2, '0')};
        border: 1px solid ${tokenCard.customization.cardBorderColor};
        border-radius: 12px;
        padding: 16px;
        font-family: ${tokenCard.customization.fontFamily || 'Inter'};
      ">
        <div style="text-align: center; margin-bottom: 12px;">
          <h3 style="color: ${tokenCard.customization.accentColor}; margin: 0 0 4px 0; font-size: 16px;">
            ${tokenCard.token.name} (${tokenCard.token.symbol})
          </h3>
          <p style="color: ${tokenCard.customization.textColor}; margin: 0; font-size: 12px;">
            ${tokenCard.token.address.slice(0, 6)}...${tokenCard.token.address.slice(-4)}
          </p>
        </div>
        <div style="display: flex; flex-wrap: wrap; justify-content: center;">
          ${cardStats}
        </div>
      </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PulseChain Stats Dashboard</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #000;
            color: #fff;
        }
        .dashboard-container {
            position: relative;
            width: 100%;
            height: 100vh;
            overflow: hidden;
        }
        .stat-item {
            transition: transform 0.2s ease;
        }
        .stat-item:hover {
            transform: scale(1.05);
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        ${cardsHTML}
    </div>
    
    <script>
        // Auto-refresh stats every 30 seconds
        setInterval(() => {
            location.reload();
        }, 30000);
    </script>
</body>
</html>`;
  };

  const generateEmbedCode = () => {
    if (config.tokens.length === 0) {
      return `<iframe src="about:blank" style="width: 100%; height: 400px; border: none;"></iframe>`;
    }

    // For now, we'll create a simple embed that points to a hosted version
    // In a real implementation, you'd host the generated HTML and provide the URL
    return `<iframe 
  src="https://your-domain.com/pulsechain-stats-dashboard" 
  style="width: 100%; height: 600px; border: none; border-radius: 8px;"
  title="PulseChain Stats Dashboard"
></iframe>`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="bg-gray-900 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] shadow-2xl border border-white/20 relative overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Generate Code</h2>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 mb-6">
              <button
                onClick={() => setActiveTab('html')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'html' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-300 hover:text-white'
                }`}
              >
                HTML Code
              </button>
              <button
                onClick={() => setActiveTab('embed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'embed' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-300 hover:text-white'
                }`}
              >
                Embed Code
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <div className="bg-gray-800 rounded-lg p-4 h-full overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    {activeTab === 'html' ? 'HTML Code' : 'Embed Code'}
                  </h3>
                  <button
                    onClick={() => copyToClipboard(activeTab === 'html' ? generateHTML() : generateEmbedCode())}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Copy Code
                  </button>
                </div>
                
                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm text-green-400 font-mono">
                  <code>{activeTab === 'html' ? generateHTML() : generateEmbedCode()}</code>
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-white/20">
              <div className="text-sm text-gray-400">
                <p className="mb-2">
                  <strong>Instructions:</strong>
                </p>
                {activeTab === 'html' ? (
                  <ul className="list-disc list-inside space-y-1">
                    <li>Copy the HTML code above</li>
                    <li>Save it as a .html file</li>
                    <li>Open it in a web browser</li>
                    <li>The dashboard will auto-refresh every 30 seconds</li>
                  </ul>
                ) : (
                  <ul className="list-disc list-inside space-y-1">
                    <li>Copy the embed code above</li>
                    <li>Paste it into your website's HTML</li>
                    <li>The dashboard will appear as an iframe</li>
                    <li>Note: You'll need to host the HTML file first</li>
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 