'use client';

import { useState } from 'react';
import { CodeExamples } from '@/lib/stat-docs/code-generator';

interface CodeExamplesSectionProps {
  examples: CodeExamples;
  statId: string;
  tokenAddress: string;
}

type Language = 'curl' | 'javascript' | 'typescript' | 'python';

const languageLabels: Record<Language, string> = {
  curl: 'cURL',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python'
};

export default function CodeExamplesSection({ examples, statId, tokenAddress }: CodeExamplesSectionProps) {
  const [activeTab, setActiveTab] = useState<Language>('javascript');
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  
  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(examples[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const runCode = async () => {
    if (activeTab !== 'javascript' && activeTab !== 'typescript') {
      alert('Code execution is only available for JavaScript/TypeScript examples');
      return;
    }
    
    setRunning(true);
    setShowConsole(true);
    setConsoleOutput(['▶️ Running code...', '']);
    
    try {
      // Capture console.log, console.error
      const logs: string[] = [];
      const originalLog = console.log;
      const originalError = console.error;
      
      console.log = (...args: any[]) => {
        logs.push('> ' + args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
        originalLog(...args);
      };
      
      console.error = (...args: any[]) => {
        logs.push('❌ ' + args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
        originalError(...args);
      };
      
      // Execute the code
      const code = examples[activeTab].replace(tokenAddress, tokenAddress);
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction(code);
      await fn();
      
      // Restore console
      console.log = originalLog;
      console.error = originalError;
      
      setConsoleOutput(['✅ Code executed successfully!', '', ...logs]);
    } catch (error) {
      setConsoleOutput(prev => [
        ...prev,
        '',
        '❌ Error:',
        error instanceof Error ? error.message : String(error)
      ]);
    } finally {
      setRunning(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Complete Working Code</h2>
        <div className="flex items-center gap-2">
          {(activeTab === 'javascript' || activeTab === 'typescript') && (
            <button
              onClick={runCode}
              disabled={running}
              className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 rounded transition-colors disabled:opacity-50"
            >
              {running ? '⏳ Running...' : '▶️ Run Code'}
            </button>
          )}
          <button
            onClick={copyToClipboard}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded transition-colors"
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
      </div>
      
      {/* Language Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {(Object.keys(languageLabels) as Language[]).map(lang => (
          <button
            key={lang}
            onClick={() => setActiveTab(lang)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === lang
                ? 'text-purple-400 border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {languageLabels[lang]}
          </button>
        ))}
      </div>
      
      {/* Code Display */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        <pre className="p-6 overflow-x-auto text-sm">
          <code className="text-gray-300 font-mono whitespace-pre">
            {examples[activeTab]}
          </code>
        </pre>
      </div>
      
      {/* Console Output */}
      {showConsole && consoleOutput.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Console Output</h3>
            <button
              onClick={() => setShowConsole(false)}
              className="text-xs text-gray-400 hover:text-white"
            >
              ✕ Close
            </button>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
              {consoleOutput.join('\n')}
            </pre>
          </div>
        </div>
      )}
      
      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex gap-2 mb-2">
          <span className="text-blue-400 text-xl">💡</span>
          <h3 className="text-sm font-semibold text-blue-300">Complete Implementation</h3>
        </div>
        <p className="text-xs text-gray-300 ml-7">
          This is ONE complete executable function you can copy-paste and run immediately. 
          It includes all API calls, pagination logic, error handling, and data processing.
          {(activeTab === 'javascript' || activeTab === 'typescript') && ' Click "▶️ Run Code" to test it live!'}
        </p>
      </div>
    </div>
  );
}


