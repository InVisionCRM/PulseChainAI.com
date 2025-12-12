'use client';

import { useState } from 'react';
import { getStatApiMapping, type ApiEndpoint } from '@/lib/stat-docs/api-endpoint-mapping';

interface RealApiEndpointsSectionProps {
  statId: string;
  tokenAddress: string;
}

export default function RealApiEndpointsSection({ statId, tokenAddress }: RealApiEndpointsSectionProps) {
  const mapping = getStatApiMapping(statId);
  const [expandedEndpoint, setExpandedEndpoint] = useState<number | null>(null);
  
  if (!mapping) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">API Endpoints</h2>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-amber-300 text-sm">
          Detailed API endpoint documentation is being added for this stat.
        </div>
      </div>
    );
  }
  
  const copyEndpoint = async (url: string) => {
    await navigator.clipboard.writeText(url);
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Real API Endpoints</h2>
        <p className="text-sm text-gray-400">
          This stat makes <strong>{mapping.endpoints.length}</strong> external API call{mapping.endpoints.length !== 1 ? 's' : ''} to fetch data
        </p>
      </div>
      
      {/* Implementation Notes */}
      {mapping.implementationNotes && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex gap-2 mb-2">
            <span className="text-blue-400 text-lg">💡</span>
            <h3 className="text-sm font-semibold text-blue-300">Implementation</h3>
          </div>
          <p className="text-sm text-gray-300 ml-7">{mapping.implementationNotes}</p>
        </div>
      )}
      
      {/* Data Processing */}
      {mapping.dataProcessing && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <div className="flex gap-2 mb-2">
            <span className="text-purple-400 text-lg">⚙️</span>
            <h3 className="text-sm font-semibold text-purple-300">Data Processing</h3>
          </div>
          <p className="text-sm text-gray-300 ml-7">{mapping.dataProcessing}</p>
        </div>
      )}
      
      {/* Endpoints List */}
      <div className="space-y-4">
        {mapping.endpoints.map((endpoint, index) => {
          const isExpanded = expandedEndpoint === index;
          const fullUrl = endpoint.url
            .replace('{address}', tokenAddress)
            .replace('{tokenAddress}', tokenAddress);
          
          return (
            <div key={index} className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
              {/* Endpoint Header */}
              <div className="p-4 border-b border-slate-700">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-bold text-white">#{index + 1}</span>
                      <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded">
                        {endpoint.method}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{endpoint.description}</p>
                  </div>
                  <button
                    onClick={() => copyEndpoint(fullUrl)}
                    className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded transition-colors flex-shrink-0"
                  >
                    📋 Copy URL
                  </button>
                </div>
                
                {/* URL Display */}
                <div className="mt-3 bg-slate-950 border border-slate-800 rounded p-3">
                  <code className="text-xs text-purple-400 break-all font-mono">
                    {fullUrl}
                  </code>
                </div>
              </div>
              
              {/* Parameters */}
              {endpoint.parameters && Object.keys(endpoint.parameters).length > 0 && (
                <div className="p-4 border-b border-slate-700 bg-slate-950/50">
                  <h4 className="text-sm font-semibold text-white mb-3">Parameters</h4>
                  <div className="space-y-2">
                    {Object.entries(endpoint.parameters).map(([key, param]) => (
                      <div key={key} className="flex items-start gap-3 text-xs">
                        <code className="text-blue-400 font-mono">{key}</code>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-purple-400">
                              {param.type}
                            </span>
                            {param.required && (
                              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded font-semibold">
                                required
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400">{param.description}</p>
                          <p className="text-gray-500 mt-1">Example: <code className="text-purple-400">{param.example}</code></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Sample Response */}
              {endpoint.sampleResponse && (
                <div className="p-4">
                  <button
                    onClick={() => setExpandedEndpoint(isExpanded ? null : index)}
                    className="w-full flex items-center justify-between text-sm font-semibold text-white hover:text-purple-400 transition-colors mb-3"
                  >
                    <span>Sample Response</span>
                    <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  
                  {isExpanded && (
                    <div className="bg-slate-950 border border-slate-800 rounded overflow-hidden">
                      <pre className="p-4 overflow-x-auto text-xs text-gray-300 font-mono max-h-96 overflow-y-auto">
                        {JSON.stringify(endpoint.sampleResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Implementation Flow */}
      {mapping.endpoints.length > 1 && (
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">API Call Flow</h3>
          <div className="space-y-3">
            {mapping.endpoints.map((endpoint, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm text-gray-300">{endpoint.description}</p>
                  <code className="text-xs text-purple-400 mt-1 block">
                    {endpoint.method} {endpoint.url.split('/').slice(-2).join('/')}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


