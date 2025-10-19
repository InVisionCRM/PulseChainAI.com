import React, { useState, useMemo } from 'react';

interface SourceCodeTabProps {
  sourceCode: string;
  readFunctions?: any[];
  writeFunctions?: any[];
  isAnalyzingAI?: boolean;
}

interface SourceFile {
  path: string;
  content: string;
}

interface HardcodedAddress {
  address: string;
  contractName?: string;
  context: string;
  lineNumber: number;
  filePath: string;
}

const SourceCodeTab: React.FC<SourceCodeTabProps> = ({ sourceCode, readFunctions = [], writeFunctions = [], isAnalyzingAI = false }) => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'files' | 'functions' | 'addresses'>('files');

  // Format function return values for display
  const formatValue = (value: any, outputType?: string, functionName?: string, decimals?: any): string => {
    if (value === undefined || value === null) return '';
    
    // Handle different types
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    
    // Convert value to string for processing
    const valueStr = String(value);
    
    // Check if it's an address (0x followed by 40 hex chars)
    if (/^0x[a-fA-F0-9]{40}$/.test(valueStr)) {
      return `${valueStr.slice(0, 6)}...${valueStr.slice(-4)}`;
    }
    
    // Check if it's a number (with or without decimals)
    if (/^\d+$/.test(valueStr)) {
      const num = BigInt(valueStr);
      
      // Check if this is a token amount function that needs decimal formatting
      const isTokenAmount = functionName && (
        functionName.toLowerCase().includes('supply') ||
        functionName.toLowerCase().includes('balance') ||
        functionName.toLowerCase() === 'totalsupply' ||
        functionName.toLowerCase() === 'balanceof' ||
        functionName.toLowerCase() === 'currentsupply'
      );
      
      console.log(`formatValue - functionName: ${functionName}, isTokenAmount: ${isTokenAmount}, decimals: ${decimals} (type: ${typeof decimals}), value: ${valueStr}`);
      
      if (isTokenAmount && decimals !== undefined && decimals !== null) {
        // Convert decimals to number - handle both string and number types
        let decimalCount = 0;
        if (typeof decimals === 'number') {
          decimalCount = decimals;
        } else if (typeof decimals === 'string') {
          decimalCount = parseInt(decimals, 10);
        } else {
          decimalCount = Number(decimals);
        }
        
        console.log(`Parsed decimalCount: ${decimalCount}`);
        
        if (decimalCount > 0 && !isNaN(decimalCount)) {
          // Apply decimals: divide by 10^decimals
          // Build divisor as BigInt to avoid precision issues
          const divisor = BigInt('1' + '0'.repeat(decimalCount));
          const wholePart = num / divisor;
          const remainder = num % divisor;
          
          console.log(`Applying decimals: ${decimalCount}, divisor: ${divisor}, wholePart: ${wholePart}, remainder: ${remainder}`);
          
          // Format with decimals
          if (remainder === BigInt(0)) {
            return wholePart.toLocaleString();
          } else {
            const remainderStr = remainder.toString().padStart(decimalCount, '0');
            // Trim trailing zeros
            const trimmed = remainderStr.replace(/0+$/, '');
            return `${wholePart.toLocaleString()}.${trimmed}`;
          }
        }
      }
      
      // Format with commas for readability (raw value)
      return num.toLocaleString();
    }
    
    // Return as-is for strings
    return valueStr;
  };

  // Parse source code to extract files
  const sourceFiles = useMemo(() => {
    if (!sourceCode) return [];

    const files: SourceFile[] = [];
    
    // Check if source code contains file path markers
    // Common patterns for multi-file contracts
    const filePatterns = [
      // Pattern: // File: path/to/file.sol
      /\/\/ File: ([^\n]+)/g,
      // Pattern: /* File: path/to/file.sol */
      /\/\* File: ([^*]+) \*\//g,
      // Pattern: pragma solidity... (single file)
      /pragma solidity/g
    ];

    let match;
    let currentFile: SourceFile | null = null;
    let lines = sourceCode.split('\n');
    let currentContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for file path markers
      const fileMatch = line.match(/\/\/ File: (.+)/);
      if (fileMatch) {
        // Save previous file if exists
        if (currentFile) {
          currentFile.content = currentContent.join('\n');
          files.push(currentFile);
        }
        
        // Start new file
        currentFile = {
          path: fileMatch[1].trim(),
          content: ''
        };
        currentContent = [];
        continue;
      }

      // Check for pragma solidity (single file case)
      if (line.includes('pragma solidity') && !currentFile) {
        currentFile = {
          path: 'Contract.sol',
          content: ''
        };
      }

      if (currentFile) {
        currentContent.push(line);
      }
    }

    // Add the last file
    if (currentFile) {
      currentFile.content = currentContent.join('\n');
      files.push(currentFile);
    }

    // If no files were found, treat the entire source code as one file
    if (files.length === 0) {
      files.push({
        path: 'Contract.sol',
        content: sourceCode
      });
    }

    return files;
  }, [sourceCode]);

  // Extract hardcoded addresses from source code
  const hardcodedAddresses = useMemo(() => {
    const addresses: HardcodedAddress[] = [];
    
    sourceFiles.forEach((file, fileIndex) => {
      const lines = file.content.split('\n');
      
      lines.forEach((line, lineIndex) => {
        // Match Ethereum addresses (0x followed by 40 hex characters)
        const addressRegex = /0x[a-fA-F0-9]{40}/g;
        let match;
        
        while ((match = addressRegex.exec(line)) !== null) {
          const address = match[0];
          
          // Skip if it's a comment or string literal
          const beforeMatch = line.substring(0, match.index);
          const isInComment = beforeMatch.includes('//') || beforeMatch.includes('/*');
          const isInString = (beforeMatch.match(/"/g) || []).length % 2 === 1;
          
          if (!isInComment && !isInString) {
            // Try to extract contract name from the line
            let contractName: string | undefined;
            
            // Look for contract name patterns
            const contractPatterns = [
              /contract\s+([A-Za-z_][A-Za-z0-9_]*)/g,
              /interface\s+([A-Za-z_][A-Za-z0-9_]*)/g,
              /library\s+([A-Za-z_][A-Za-z0-9_]*)/g,
              /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*I[A-Za-z_][A-Za-z0-9_]*/g, // Interface assignment
            ];
            
            for (const pattern of contractPatterns) {
              const contractMatch = line.match(pattern);
              if (contractMatch) {
                contractName = contractMatch[1];
                break;
              }
            }
            
            // If no contract name found in this line, look in previous lines
            if (!contractName) {
              for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 10); i--) {
                const prevLine = lines[i];
                for (const pattern of contractPatterns) {
                  const contractMatch = prevLine.match(pattern);
                  if (contractMatch) {
                    contractName = contractMatch[1];
                    break;
                  }
                }
                if (contractName) break;
              }
            }
            
            addresses.push({
              address,
              contractName,
              context: line.trim(),
              lineNumber: lineIndex + 1,
              filePath: file.path
            });
          }
        }
      });
    });
    
    return addresses;
  }, [sourceFiles]);

  if (sourceFiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-400">No source code available</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Main Tabs */}
      <div className="flex border-b border-slate-700 bg-slate-800/50">
        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${
            activeTab === 'files' 
              ? 'text-white bg-slate-700/50 border-b-2 border-purple-500' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Files
        </button>
        <button
          onClick={() => setActiveTab('functions')}
          className={`px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${
            activeTab === 'functions' 
              ? 'text-white bg-slate-700/50 border-b-2 border-purple-500' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Functions
        </button>
        <button
          onClick={() => setActiveTab('addresses')}
          className={`px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${
            activeTab === 'addresses' 
              ? 'text-white bg-slate-700/50 border-b-2 border-purple-500' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Addresses ({hardcodedAddresses.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'files' && (
        <>
          {/* File Tabs */}
          {sourceFiles.length > 1 && (
            <div className="flex border-b border-slate-700 bg-slate-800/30">
              {sourceFiles.map((file, index) => (
                <button
                  key={index}
                  onClick={() => setActiveFileIndex(index)}
                  className={`px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${
                    activeFileIndex === index 
                      ? 'text-white bg-slate-700/50 border-b-2 border-purple-500' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {file.path.split('/').pop() || file.path}
                </button>
              ))}
            </div>
          )}

          {/* Source Code Content */}
          <div className="flex-grow overflow-auto">
            <div className="p-4">
              {sourceFiles.length > 1 && (
                <div className="mb-4 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                  <div className="text-sm text-slate-300">
                    <span className="text-slate-400">File:</span> {sourceFiles[activeFileIndex].path}
                  </div>
                </div>
              )}
              
              <pre className="text-sm font-mono text-slate-300 whitespace-pre-wrap break-words bg-slate-900/50 rounded-lg p-4 border border-slate-700/30 overflow-auto">
                <code>{sourceFiles[activeFileIndex].content}</code>
              </pre>
            </div>
          </div>
        </>
      )}

      {activeTab === 'functions' && (
        <div className="flex-grow overflow-auto p-4 space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Read Functions</h3>
            {readFunctions.length > 0 ? (
              <div className="space-y-3">
                {readFunctions.map((func, index) => {
                  const outputType = func.outputs?.[0]?.type || func.outputs?.[0]?.internalType;
                  
                  // Find decimals from the read functions list
                  const decimalsFunc = readFunctions.find(f => f.name === 'decimals');
                  const decimals = decimalsFunc?.value;
                  
                  // Debug logging
                  if (func.name === 'totalSupply' || func.name === 'decimals') {
                    console.log(`Function: ${func.name}, Value: ${func.value}, Decimals: ${decimals}, Type: ${typeof decimals}`);
                  }
                  
                  const formattedValue = func.value !== undefined 
                    ? formatValue(func.value, outputType, func.name, decimals) 
                    : null;
                  
                  return (
                    <div key={index} className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-4 hover:border-slate-500/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="text-white font-mono text-sm font-semibold">
                            {func.name}()
                          </div>
                          {outputType && (
                            <div className="text-slate-500 text-xs mt-1">
                              returns {outputType}
                            </div>
                          )}
                          {formattedValue && (
                            <div className="mt-3 p-3 bg-slate-900/50 rounded border border-slate-700/50">
                              <div className="text-xs text-slate-400 mb-1">Current Value:</div>
                              <div className="text-green-400 text-sm font-mono break-all">
                                {formattedValue}
                              </div>
                            </div>
                          )}
                          {func.explanation && (
                            <div className="mt-2 text-slate-300 text-sm">
                              {func.explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-slate-400 text-sm">No read functions found</div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Write Functions</h3>
            {writeFunctions.length > 0 ? (
              <div className="space-y-3">
                {writeFunctions.map((func, index) => (
                  <div key={index} className="bg-transparent border border-slate-600/30 rounded-lg p-4">
                    <div className="text-white font-mono text-sm">
                      {func.name}
                    </div>
                    {func.explanation && (
                      <div className="mt-2 text-slate-300 text-sm">
                        {func.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 text-sm">No write functions found</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'addresses' && (
        <div className="flex-grow overflow-auto p-4">
          {hardcodedAddresses.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              <div className="text-lg mb-2">No hardcoded addresses found</div>
              <div className="text-sm">This contract doesn't contain any hardcoded Ethereum addresses.</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-slate-400 mb-4">
                Found {hardcodedAddresses.length} hardcoded address{hardcodedAddresses.length !== 1 ? 'es' : ''}
              </div>
              
              {hardcodedAddresses.map((addr, index) => (
                <div key={index} className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-400 font-mono text-sm">{addr.address}</span>
                      {addr.contractName && (
                        <span className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded border border-purple-600/30">
                          {addr.contractName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      Line {addr.lineNumber}
                    </div>
                  </div>
                  
                  <div className="text-xs text-slate-400 mb-2">
                    File: {addr.filePath}
                  </div>
                  
                  <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
                    <code className="text-xs text-slate-300 font-mono">
                      {addr.context}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SourceCodeTab; 