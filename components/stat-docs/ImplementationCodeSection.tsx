'use client';

import { useState } from 'react';
import { getStatApiMapping } from '@/lib/stat-docs/api-endpoint-mapping';

interface ImplementationCodeSectionProps {
  statId: string;
}

export default function ImplementationCodeSection({ statId }: ImplementationCodeSectionProps) {
  const [showCode, setShowCode] = useState(false);
  const mapping = getStatApiMapping(statId);
  
  if (!mapping) {
    return null;
  }
  
  // Generate pseudo-code based on the mapping
  const generatePseudoCode = () => {
    let code = `// Real implementation from AdminStatsPanel.tsx\n\n`;
    code += `async function calculate${statId}(tokenAddress: string) {\n`;
    
    if (mapping.endpoints.length === 1) {
      const endpoint = mapping.endpoints[0];
      code += `  // Step 1: ${endpoint.description}\n`;
      code += `  const response = await fetch('${endpoint.url.replace('{address}', tokenAddress)}');\n`;
      code += `  const data = await response.json();\n\n`;
      
      if (mapping.dataProcessing) {
        code += `  // Data Processing: ${mapping.dataProcessing}\n`;
        code += `  const result = processData(data);\n\n`;
      }
      
      code += `  return result;\n`;
    } else {
      // Multiple endpoints
      mapping.endpoints.forEach((endpoint, index) => {
        code += `  // Step ${index + 1}: ${endpoint.description}\n`;
        code += `  const response${index + 1} = await fetch('${endpoint.url.replace('{address}', tokenAddress)}');\n`;
        code += `  const data${index + 1} = await response${index + 1}.json();\n\n`;
      });
      
      if (mapping.dataProcessing) {
        code += `  // Data Processing: ${mapping.dataProcessing}\n`;
        code += `  const result = combineAndProcess(${mapping.endpoints.map((_, i) => `data${i + 1}`).join(', ')});\n\n`;
      }
      
      code += `  return result;\n`;
    }
    
    code += `}`;
    return code;
  };
  
  const copyCode = async () => {
    await navigator.clipboard.writeText(generatePseudoCode());
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Implementation Code</h2>
        <button
          onClick={() => setShowCode(!showCode)}
          className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          {showCode ? 'Hide Code' : 'Show Implementation'}
        </button>
      </div>
      
      {showCode && (
        <div className="space-y-3">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-gray-300">
              This is a simplified version of the actual implementation from <code className="text-purple-400">AdminStatsPanel.tsx</code>. 
              The real code includes error handling, caching, pagination logic, and data transformations.
            </p>
          </div>
          
          <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
              <span className="text-sm font-semibold text-white">Pseudo-Code Implementation</span>
              <button
                onClick={copyCode}
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded transition-colors"
              >
                📋 Copy
              </button>
            </div>
            <pre className="p-6 overflow-x-auto text-sm text-gray-300 font-mono">
              {generatePseudoCode()}
            </pre>
          </div>
          
          {mapping.implementationNotes && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <div className="flex gap-2 mb-2">
                <span className="text-purple-400 text-lg">📝</span>
                <h3 className="text-sm font-semibold text-purple-300">Implementation Notes</h3>
              </div>
              <p className="text-sm text-gray-300 ml-7">{mapping.implementationNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


