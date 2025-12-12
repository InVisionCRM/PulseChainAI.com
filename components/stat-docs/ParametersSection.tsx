'use client';

import { StatParameter } from '@/lib/stat-docs/parameter-detector';

interface ParametersSectionProps {
  parameters: StatParameter[];
}

export default function ParametersSection({ parameters }: ParametersSectionProps) {
  const requiredParams = parameters.filter(p => p.required);
  const optionalParams = parameters.filter(p => !p.required);
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Parameters</h2>
      
      {requiredParams.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Required Parameters
          </h3>
          <div className="space-y-4">
            {requiredParams.map(param => (
              <ParameterCard key={param.key} parameter={param} />
            ))}
          </div>
        </div>
      )}
      
      {optionalParams.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Optional Parameters
          </h3>
          <div className="space-y-4">
            {optionalParams.map(param => (
              <ParameterCard key={param.key} parameter={param} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ParameterCard({ parameter }: { parameter: StatParameter }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono text-blue-400">{parameter.key}</code>
          <span className="text-xs px-2 py-0.5 bg-slate-800 border border-slate-600 rounded text-gray-400">
            {parameter.type}
          </span>
        </div>
        {parameter.required && (
          <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded font-semibold">
            REQUIRED
          </span>
        )}
      </div>
      
      <p className="text-sm text-gray-300 mb-3">{parameter.description}</p>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Example:</span>
          <code className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-purple-400">
            {parameter.example}
          </code>
        </div>
      </div>
    </div>
  );
}


