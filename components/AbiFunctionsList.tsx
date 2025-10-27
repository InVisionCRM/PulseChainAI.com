import React, { useState } from 'react';
import type { ExplainedFunction, AbiItemInput } from '@/types';
import LoadingSpinner from './icons/LoadingSpinner';

const FunctionItem: React.FC<{ func: ExplainedFunction }> = ({ func }) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatParams = (params: AbiItemInput[]) => {
    if (!params || params.length === 0) return '()';
    return `(${params.map(p => `${p.type}${p.name ? ` ${p.name}`: ''}`).join(', ')})`;
  };
  
  const formatOutputs = (params: AbiItemInput[]) => {
    if (!params || params.length === 0) return '';
    const outputString = params.map(p => `${p.type}${p.name ? ` ${p.name}` : ''}`).join(', ');
    return ` returns (${outputString})`;
  };

  return (
    <div className="border-b border-slate-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-left p-4 hover:bg-slate-700/50 transition-colors focus:outline-none focus:bg-slate-700/50"
      >
        <span className="font-mono break-all">
          <span className="text-blue-400">{func.name}{formatParams(func.inputs)}</span>
          <span className="text-cyan-400">{formatOutputs(func.outputs)}</span>
        </span>
        <svg
          className={`w-5 h-5 transition-transform transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>
      <div id={`func-details-${func.name}`} hidden={!isOpen} className="p-4 bg-slate-900/50">
          <p className="text-slate-300 mb-3 text-sm">{func.explanation}</p>
          <div className="text-xs space-y-1">
            {func.inputs.length > 0 && (
                <div>
                    <h4 className="font-semibold text-slate-400">Inputs:</h4>
                    <ul className="list-disc list-inside pl-2 font-mono text-slate-300">
                        {func.inputs.map((input, i) => <li key={i}>{input.name || `param_${i}`}: {input.type}</li>)}
                    </ul>
                </div>
            )}
             {func.outputs.length > 0 && (
                <div className="mt-2">
                    <h4 className="font-semibold text-slate-400">Outputs:</h4>
                     <ul className="list-disc list-inside pl-2 font-mono text-slate-300">
                        {func.outputs.map((output, i) => <li key={i}>{output.name || `return_${i}`}: {output.type}</li>)}
                    </ul>
                </div>
            )}
          </div>
        </div>
    </div>
  );
};


const AbiFunctionsList: React.FC<{ functions: ExplainedFunction[] | null, isLoading: boolean, title: string }> = ({ functions, isLoading, title }) => {
    const hasFunctions = functions && functions.length > 0;

    return (
        <section>
            <h3 className="text-lg font-bold text-white mb-2 px-4">{title}</h3>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                {isLoading && (
                     <div className="flex items-center justify-center p-8">
                        <LoadingSpinner />
                        <span className="ml-3 text-slate-300">AI is analyzing functions...</span>
                     </div>
                )}
                {!isLoading && !hasFunctions && (
                     <div className="p-8 text-center text-slate-400">
                        No {title.replace(' Functions', '').toLowerCase()} functions found in ABI.
                     </div>
                )}
                {!isLoading && hasFunctions && (
                    <div>
                        {functions.map((func, index) => (
                            <FunctionItem key={`${func.name}-${index}`} func={func} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

export default AbiFunctionsList;
