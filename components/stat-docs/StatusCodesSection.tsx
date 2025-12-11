'use client';

import { generateStatusCodes } from '@/lib/stat-docs/code-generator';

export default function StatusCodesSection() {
  const statusCodes = generateStatusCodes();
  
  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    if (code >= 400 && code < 500) return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
    return 'text-red-400 bg-red-500/20 border-red-500/30';
  };
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">HTTP Status Codes</h2>
      
      <div className="space-y-3">
        {statusCodes.map(status => (
          <div
            key={status.code}
            className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 flex items-start gap-4"
          >
            <span className={`px-3 py-1 text-sm font-bold rounded border ${getStatusColor(status.code)}`}>
              {status.code}
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white mb-1">{status.status}</h3>
              <p className="text-sm text-gray-400">{status.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

