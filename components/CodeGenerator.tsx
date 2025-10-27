'use client';

import { useState } from 'react';
import { StatCounterConfig, StatConfig } from './StatCounterBuilder';

interface CodeGeneratorProps {
  config: StatCounterConfig;
  onError: (error: string | null) => void;
}

export default function CodeGenerator({ config, onError }: CodeGeneratorProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'html' | 'iframe' | 'widget'>('html');

  const generateCode = () => {
    if (!config.tokens?.[0] || !config.stats.some(stat => stat.enabled)) {
      return '';
    }

    const enabledStats = config.stats.filter(stat => stat.enabled);
    const widgetId = `stat-counter-${config.tokens[0].address.slice(2, 8)}`;
    
    const cssStyles = generateCSS();
    const jsCode = generateJS(widgetId, enabledStats);
    const htmlCode = generateHTML(widgetId, enabledStats);

    switch (activeTab) {
      case 'html':
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.tokens?.[0]?.name || 'Token'} Stat Counter</title>
    <style>
${cssStyles}
    </style>
</head>
<body>
${htmlCode}
${jsCode}
</body>
</html>`;
      
      case 'iframe':
        return `<iframe 
    src="${window.location.origin}/api/stat-counter-widget?token=${config.tokens?.[0]?.address}&stats=${enabledStats.map(s => s.id).join(',')}"
    width="100%" 
    height="300" 
    frameborder="0" 
    scrolling="no"
    style="border: none; border-radius: 8px;">
</iframe>`;
      
      case 'widget':
        return `<div id="${widgetId}"></div>
<script>
(function() {
    var script = document.createElement('script');
    script.src = '${window.location.origin}/api/stat-counter-widget.js';
    script.onload = function() {
        initStatCounter('${widgetId}', {
            token: '${config.tokens?.[0]?.address}',
            stats: ${JSON.stringify(enabledStats.map(s => s.id))}
        });
    };
    document.head.appendChild(script);
})();
</script>`;
      
      default:
        return '';
    }
  };

  const generateCSS = () => {
    return `
      .stat-counter-widget {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #1f2937;
        color: #ffffff;
        border: 1px solid #374151;
        border-radius: 0.5rem;
        padding: 1rem;
        max-width: 100%;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        font-size: 1rem;
        font-weight: 400;
      }

      .stat-counter-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #374151;
      }

      .stat-counter-token-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .stat-counter-token-icon {
        width: 2rem;
        height: 2rem;
        background: linear-gradient(135deg, #6366f1, #3b82f6);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 0.875rem;
      }

      .stat-counter-token-name {
        font-weight: 600;
        font-size: 1rem;
        color: #3b82f6;
      }

      .stat-counter-token-address {
        font-size: 0.875rem;
        color: #9ca3af;
      }

      .stat-counter-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .stat-counter-stat {
        background: #111827;
        border-radius: 0.5rem;
        border: 1px solid #374151;
        padding: 1rem;
        text-align: center;
        transition: transform 0.2s ease;
      }

      .stat-counter-stat:hover {
        transform: translateY(-2px);
      }

      .stat-counter-stat-label {
        font-size: 0.875rem;
        color: #9ca3af;
        margin-bottom: 0.5rem;
      }

      .stat-counter-stat-value {
        font-size: 1.25rem;
        font-weight: bold;
        color: #3b82f6;
        margin: 0;
      }

      .stat-counter-footer {
        text-align: center;
        padding-top: 1rem;
        border-top: 1px solid #374151;
        font-size: 0.75rem;
        color: #9ca3af;
      }

      .stat-counter-timestamp {
        color: #3b82f6;
        font-weight: 500;
      }

      @media (max-width: 768px) {
        .stat-counter-stats {
          grid-template-columns: 1fr;
        }
        
        .stat-counter-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }
        
        .stat-counter-price {
          text-align: left;
        }
      }
    `;
  };

  const generateJS = (widgetId: string, enabledStats: StatConfig[]) => {
    const tokenName = config.tokens?.[0]?.name || 'Token';
    const tokenSymbol = config.tokens?.[0]?.symbol || 'TKN';
    const tokenAddress = config.tokens?.[0]?.address || '';
    
    return `
<script>
(function() {
    const widgetId = '${widgetId}';
    const tokenAddress = '${tokenAddress}';
    const enabledStats = ${JSON.stringify(enabledStats.map(s => ({ id: s.id, format: s.format, decimals: s.decimals })))};
    const tokenName = '${tokenName}';
    const tokenSymbol = '${tokenSymbol}';

    async function fetchTokenData() {
        try {
            const countersResponse = await fetch('https://api.scan.pulsechain.com/api/v2/tokens/' + tokenAddress + '/counters');
            
            if (!countersResponse.ok) {
                console.warn('PulseChain API not available, using static data');
                updateWidget({
                    address: tokenAddress,
                    name: tokenName,
                    symbol: tokenSymbol,
                    decimals: 18,
                    totalSupply: '0',
                    price: undefined,
                    marketCap: undefined,
                    holders: 0
                });
                return;
            }
            
            const countersData = await countersResponse.json();
            
            let tokenMetadata = null;
            try {
                const metadataResponse = await fetch('https://api.scan.pulsechain.com/api/v2/tokens/' + tokenAddress);
                if (metadataResponse.ok) {
                    tokenMetadata = await metadataResponse.json();
                }
            } catch (metadataError) {
                console.warn('Failed to fetch token metadata:', metadataError);
            }
            
            const tokenInfo = {
                address: tokenAddress,
                name: tokenMetadata?.name || tokenName,
                symbol: tokenMetadata?.symbol || tokenSymbol,
                decimals: tokenMetadata?.decimals || 18,
                total_supply: tokenMetadata?.total_supply || '0',
                exchange_rate: countersData?.exchange_rate,
                circulating_market_cap: countersData?.circulating_market_cap,
                holders: countersData?.token_holders_count || 0
            };
            
            updateWidget({
                address: tokenInfo.address,
                name: tokenInfo.name,
                symbol: tokenInfo.symbol,
                decimals: tokenInfo.decimals,
                totalSupply: tokenInfo.total_supply,
                price: tokenInfo.exchange_rate ? parseFloat(tokenInfo.exchange_rate) : undefined,
                marketCap: tokenInfo.circulating_market_cap ? parseFloat(tokenInfo.circulating_market_cap) : undefined,
                holders: parseInt(tokenInfo.holders) || 0
            });
        } catch (error) {
            console.error('Failed to fetch token data:', error);
            updateWidget({
                address: tokenAddress,
                name: tokenName,
                symbol: tokenSymbol,
                decimals: 18,
                totalSupply: '0',
                price: undefined,
                marketCap: undefined,
                holders: 0
            });
        }
    }
    
    function updateWidget(tokenData) {
        const widget = document.getElementById(widgetId);
        if (!widget) return;
        
        enabledStats.forEach(statId => {
            const statElement = widget.querySelector('[data-stat="' + statId + '"]');
            if (statElement) {
                const value = getStatValue(statId, tokenData);
                const formattedValue = formatStatValue(statId, value);
                statElement.textContent = formattedValue;
            }
        });
        
        const timestampElement = widget.querySelector('.stat-counter-timestamp');
        if (timestampElement) {
            timestampElement.textContent = new Date().toLocaleTimeString();
        }
    }
    
    function getStatValue(statId, tokenData) {
        switch (statId) {
            case 'price': return tokenData.price;
            case 'marketCap': return tokenData.marketCap;
            case 'volume24h': return tokenData.volume24h;
            case 'holders': return tokenData.holders;
            case 'totalSupply': return tokenData.totalSupply;
            case 'address': return tokenData.address;
            default: return null;
        }
    }
    
    function formatStatValue(statId, value) {
        if (value === null || value === undefined) return 'N/A';
        
        const stat = enabledStats.find(s => s.id === statId);
        if (!stat) return value.toString();
        
        switch (stat.format) {
            case 'currency':
                const decimals = stat.decimals || 2;
                return '$' + parseFloat(value.toString()).toFixed(decimals);
            case 'number':
                return value.toLocaleString();
            case 'percentage':
                return value.toFixed(2) + '%';
            case 'address':
                return typeof value === 'string' ? value.slice(0, 6) + '...' + value.slice(-4) : 'N/A';
            default:
                return value.toString();
        }
    }
    
    fetchTokenData();
    setInterval(fetchTokenData, 30000);
})();
</script>`;
  };

  const generateHTML = (widgetId: string, enabledStats: StatConfig[]) => {
    const token = config.tokens?.[0];
    
    return `<div id="${widgetId}" class="stat-counter-widget">
    <div class="stat-counter-header">
        <div class="stat-counter-token-info">
            <div class="stat-counter-token-icon">${token?.symbol?.charAt(0) || 'T'}</div>
            <div>
                <div class="stat-counter-token-name">${token?.name || 'Token'}</div>
                <div class="stat-counter-token-address">${token?.address ? token.address.slice(0, 6) + '...' + token.address.slice(-4) : 'N/A'}</div>
            </div>
        </div>
    </div>
    
    <div class="stat-counter-stats">
        ${enabledStats.map(stat => `
        <div class="stat-counter-stat">
            <div class="stat-counter-stat-label">${stat.label || stat.name}</div>
            <div class="stat-counter-stat-value" data-stat="${stat.id}">
                Loading...
            </div>
        </div>
        `).join('')}
    </div>
    
    <div class="stat-counter-footer">
        <span>Live data • Updated <span class="stat-counter-timestamp">${new Date().toLocaleTimeString()}</span></span>
    </div>
</div>`;
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      onError('Failed to copy code to clipboard');
    }
  };

  const generatedCode = generateCode();

  return (
    <div className="space-y-4">
      {/* Code Type Tabs */}
      <div className="flex space-x-1 bg-white/5 rounded-lg p-1">
        {([
          { id: 'html' as const, label: 'HTML', icon: '🌐' },
          { id: 'iframe' as const, label: 'iFrame', icon: '📦' },
          { id: 'widget' as const, label: 'Widget', icon: '⚡' }
        ] as const).map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Code Display */}
      <div className="relative">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              {activeTab === 'html' && 'Complete HTML page with embedded widget'}
              {activeTab === 'iframe' && 'Embed as iframe on any website'}
              {activeTab === 'widget' && 'JavaScript widget for dynamic loading'}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(generatedCode, activeTab)}
              className={`flex items-center space-x-2 px-3 py-1 rounded text-xs font-medium transition-colors ${
                copied === activeTab
                  ? 'bg-green-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {copied === activeTab ? (
                <>
                  <span>✓</span>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          
          <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
            <code>{generatedCode}</code>
          </pre>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-300 mb-2">How to use:</h4>
        <div className="text-xs text-blue-200 space-y-1">
          {activeTab === 'html' && (
            <>
              <p>• Save as .html file and open in browser</p>
              <p>• Upload to your web server</p>
              <p>• Embed in existing HTML page</p>
              <p className="text-green-300 mt-2">✅ Note: Works completely standalone - no server required!</p>
            </>
          )}
          {activeTab === 'iframe' && (
            <>
              <p>• Paste the iframe code anywhere on your website</p>
              <p>• Adjust width and height as needed</p>
              <p>• Works on any platform that supports iframes</p>
            </>
          )}
          {activeTab === 'widget' && (
            <>
              <p>• Add the widget div to your HTML</p>
              <p>• Include the JavaScript code</p>
              <p>• Automatically loads and updates data</p>
            </>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <h5 className="font-medium text-white mb-2">✅ Features</h5>
          <ul className="text-gray-300 space-y-1">
            <li>• Real-time data updates</li>
            <li>• Responsive design</li>
            <li>• Customizable styling</li>
            <li>• Mobile-friendly</li>
            <li className="text-green-300">• Direct API calls to PulseChain - no server required</li>
          </ul>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <h5 className="font-medium text-white mb-2">📊 Stats Included</h5>
          <ul className="text-gray-300 space-y-1">
            {config.stats.filter(s => s.enabled).map(stat => (
              <li key={stat.id}>• {stat.label}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
} 