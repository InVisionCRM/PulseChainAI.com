'use client';

import { useState } from 'react';
import { getStatApiMapping } from '@/lib/stat-docs/api-endpoint-mapping';

interface FullApiResponsesSectionProps {
  statId: string;
}

export default function FullApiResponsesSection({ statId }: FullApiResponsesSectionProps) {
  const mapping = getStatApiMapping(statId);
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  
  if (!mapping || !mapping.endpoints.some(e => e.sampleResponse)) {
    return null;
  }
  
  const endpointsWithResponses = mapping.endpoints.filter(e => e.sampleResponse);
  const activeEndpoint = endpointsWithResponses[activeTab];
  
  const copyResponse = async () => {
    if (!activeEndpoint?.sampleResponse) return;
    await navigator.clipboard.writeText(JSON.stringify(activeEndpoint.sampleResponse, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Full API Responses</h2>
        <p className="text-sm text-gray-400">
          Complete real responses from external APIs - exactly what you'll receive when calling these endpoints
        </p>
      </div>
      
      {/* Info Banner */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
        <div className="flex gap-2">
          <span className="text-purple-400 text-xl">📡</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-purple-300 mb-1">Real API Data</h3>
            <p className="text-xs text-gray-300">
              These are actual responses from Blockscout and DexScreener APIs. All fields shown are real - 
              this is exactly what you'll get when calling the endpoints.
            </p>
          </div>
        </div>
      </div>
      
      {/* Endpoint Tabs */}
      {endpointsWithResponses.length > 1 && (
        <div className="flex gap-2 border-b border-slate-700 overflow-x-auto">
          {endpointsWithResponses.map((endpoint, index) => {
            const isActive = activeTab === index;
            return (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'text-purple-400 border-purple-500'
                    : 'text-gray-400 hover:text-gray-300 border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded font-semibold">
                    {endpoint.method}
                  </span>
                  <span>Endpoint #{index + 1}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      
      {/* Active Endpoint Info */}
      {activeEndpoint && (
        <div className="space-y-4">
          {/* Endpoint Description */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-0.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded font-semibold">
                    {activeEndpoint.method}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {activeEndpoint.description}
                  </span>
                </div>
                <code className="text-xs text-purple-400 break-all font-mono">
                  {activeEndpoint.url}
                </code>
              </div>
            </div>
          </div>
          
          {/* Response Display */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-white">Complete Response</span>
                <span className="text-xs px-2 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded">
                  200 OK
                </span>
              </div>
              <button
                onClick={copyResponse}
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded transition-colors"
              >
                {copied ? '✓ Copied!' : '📋 Copy JSON'}
              </button>
            </div>
            
            <div className="relative">
              <pre className="p-6 overflow-x-auto text-xs text-gray-300 font-mono max-h-[600px] overflow-y-auto">
                {JSON.stringify(activeEndpoint.sampleResponse, null, 2)}
              </pre>
              
              {/* Field Count */}
              <div className="absolute top-2 right-2 px-2 py-1 bg-slate-900/90 backdrop-blur border border-slate-700 rounded text-xs text-gray-400">
                {Object.keys(activeEndpoint.sampleResponse).length} fields
              </div>
            </div>
          </div>
          
          {/* Response Highlights */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex gap-2 mb-3">
              <span className="text-blue-400 text-lg">💡</span>
              <h3 className="text-sm font-semibold text-blue-300">Key Fields</h3>
            </div>
            <div className="ml-7 space-y-2">
              {Object.entries(activeEndpoint.sampleResponse).slice(0, 5).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-xs">
                  <code className="text-purple-400 font-mono">{key}</code>
                  <span className="text-gray-400">→</span>
                  <code className="text-gray-300 flex-1 break-all">
                    {typeof value === 'object' ? '{...}' : JSON.stringify(value)}
                  </code>
                </div>
              ))}
              {Object.keys(activeEndpoint.sampleResponse).length > 5 && (
                <p className="text-gray-500 italic">
                  ... and {Object.keys(activeEndpoint.sampleResponse).length - 5} more fields
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Data Processing Note */}
      {mapping.dataProcessing && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <div className="flex gap-2 mb-2">
            <span className="text-purple-400 text-lg">⚙️</span>
            <h3 className="text-sm font-semibold text-purple-300">How This Data Is Used</h3>
          </div>
          <p className="text-sm text-gray-300 ml-7">{mapping.dataProcessing}</p>
        </div>
      )}
    </div>
  );
}


