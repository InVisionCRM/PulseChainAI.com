'use client';

import { useState, useEffect } from 'react';
import { StatParameter } from '@/lib/stat-docs/parameter-detector';

interface LiveStatTesterProps {
  statId: string;
  statName: string;
  parameters: StatParameter[];
}

export default function LiveStatTester({ statId, statName, parameters }: LiveStatTesterProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFullResponse, setShowFullResponse] = useState(false);
  
  // Pre-fill with URL params, saved values, or examples
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const savedAddress = localStorage.getItem('selectedTokenAddress');
    const exampleInputs: Record<string, string> = {};
    
    parameters.forEach(param => {
      // Priority: URL params > saved address > examples
      const urlValue = urlParams.get(param.key);
      if (urlValue) {
        exampleInputs[param.key] = urlValue;
      } else if (param.key === 'address' && savedAddress) {
        exampleInputs[param.key] = savedAddress;
      } else {
        exampleInputs[param.key] = param.example;
      }
    });
    
    setInputs(exampleInputs);
  }, [parameters]);
  
  // Update URL when inputs change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      let hasChanges = false;
      
      Object.entries(inputs).forEach(([key, value]) => {
        if (value && value.trim()) {
          if (params.get(key) !== value) {
            params.set(key, value);
            hasChanges = true;
          }
        } else {
          if (params.has(key)) {
            params.delete(key);
            hasChanges = true;
          }
        }
      });
      
      if (hasChanges) {
        const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
        window.history.replaceState({}, '', newUrl);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [inputs]);
  
  // Validate address format
  const validateAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };
  
  // Check if all required parameters are filled
  const canTest = (): boolean => {
    return parameters
      .filter(p => p.required)
      .every(p => inputs[p.key] && inputs[p.key].trim() !== '');
  };
  
  // Handle stat testing
  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      // Validate address if present
      if (inputs.address && !validateAddress(inputs.address)) {
        throw new Error('Invalid token address format. Must be 0x followed by 40 hex characters.');
      }
      
      // Build query string
      const queryParams = new URLSearchParams();
      Object.entries(inputs).forEach(([key, value]) => {
        if (value && value.trim()) {
          queryParams.append(key, value.trim());
        }
      });
      
      // Make API request (using the same endpoint pattern as AdminStatsPanel)
      const response = await fetch(`/api/stats/${statId}?${queryParams.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setResult(data);
      
      // Save address to localStorage if successful
      if (inputs.address) {
        localStorage.setItem('selectedTokenAddress', inputs.address);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stat');
      console.error('Stat test error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Copy result to clipboard
  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  };
  
  // Copy shareable link
  const copyLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };
  
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">🧪 Try It Live</h2>
          <p className="text-sm text-gray-400">
            Test {statName} with real PulseChain data
          </p>
        </div>
        <button
          onClick={copyLink}
          className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded transition-colors flex items-center gap-1"
        >
          🔗 Share
        </button>
      </div>
      
      {/* Parameter Inputs */}
      {parameters.length > 0 && (
        <div className="space-y-4">
          {parameters.map(param => {
            const hasValue = inputs[param.key] && inputs[param.key].trim() !== '';
            const isInvalid = param.key === 'address' && hasValue && !validateAddress(inputs[param.key]);
            
            return (
              <div key={param.key}>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {param.label}
                  {param.required && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded">
                      Required
                    </span>
                  )}
                  {!param.required && (
                    <span className="ml-2 text-xs text-gray-500">
                      (optional)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={inputs[param.key] || ''}
                  onChange={(e) => setInputs({ ...inputs, [param.key]: e.target.value })}
                  placeholder={param.placeholder}
                  className={`w-full px-4 py-3 bg-slate-950 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                    isInvalid
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-slate-700 focus:border-purple-500'
                  }`}
                />
                {isInvalid && (
                  <p className="mt-1 text-xs text-red-400">
                    Invalid address format
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">{param.description}</p>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Test Button */}
      <button
        onClick={handleTest}
        disabled={loading || !canTest()}
        className={`w-full px-6 py-3 font-semibold rounded-lg transition-all ${
          loading || !canTest()
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Testing...
          </span>
        ) : (
          'Test Stat'
        )}
      </button>
      
      {/* Results Display */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Result</h3>
            <button
              onClick={copyResult}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded transition-colors"
            >
              📋 Copy JSON
            </button>
          </div>
          
          {/* Formatted Value Display */}
          <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur px-6 py-8 rounded-xl border border-purple-500/20 shadow-lg">
            <div className="text-center space-y-2">
              <div className="text-xs text-gray-400 uppercase tracking-wider">
                {statName}
              </div>
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                {result.formattedValue}
              </div>
              <div className="text-xs text-gray-500">
                Last updated: {new Date(result.lastUpdated).toLocaleString()}
              </div>
            </div>
          </div>
          
          {/* Full JSON Response (Expandable) */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowFullResponse(!showFullResponse)}
              className="w-full px-4 py-3 flex items-center justify-between text-sm text-gray-400 hover:text-white transition-colors"
            >
              <span>Full JSON Response</span>
              <span className={`transition-transform ${showFullResponse ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            {showFullResponse && (
              <pre className="px-4 pb-4 overflow-x-auto text-xs text-gray-300 font-mono">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex gap-3">
            <span className="text-red-400 text-xl">⚠️</span>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-400 mb-1">Error</h4>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex gap-2">
          <span className="text-blue-400 text-xl">💡</span>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-300 mb-1">Testing Tips</h4>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>• Use a valid PulseChain token contract address</li>
              <li>• Results are fetched in real-time from the blockchain</li>
              <li>• Your last used token address is saved for convenience</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}


