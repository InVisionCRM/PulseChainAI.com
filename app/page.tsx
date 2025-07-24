'use client';

import React, { useState, useCallback, useRef, useEffect, Suspense, lazy } from 'react';
import Image from 'next/image';
import type { Message, ContractData, TokenInfo, AbiItem, ExplainedFunction, SearchResultItem, Transaction, TokenBalance } from '../types';
import { fetchContract, fetchTokenInfo, search, fetchReadMethods, fetchCreatorTransactions, fetchAddressTokenBalances, fetchAddressInfo } from '../services/pulsechainService';
import LoadingSpinner from '../components/icons/LoadingSpinner';
import SendIcon from '../components/icons/SendIcon';
import PulseChainLogo from '../components/icons/PulseChainLogo';
import PerformanceMonitor from '../components/PerformanceMonitor';
import MobilePerformanceMonitor from '../components/MobilePerformanceMonitor';

// Lazy load components for better mobile performance
const QuickCheck = lazy(() => import('../components/QuickCheck'));
const TokenInfoCard = lazy(() => import('../components/TokenInfoCard'));
const AbiFunctionsList = lazy(() => import('../components/AbiFunctionsList'));
const CreatorTab = lazy(() => import('../components/CreatorTab'));
const ApiResponseTab = lazy(() => import('../components/ApiResponseTab'));


type TabId = 'quickcheck' | 'creator' | 'functions' | 'code' | 'api' | 'chat';

const TabButton: React.FC<{ name: string; tabId: TabId; activeTab: string; onClick: (tabId: TabId) => void; }> = ({ name, tabId, activeTab, onClick }) => {
    const isActive = activeTab === tabId;
    return (
        <button
            onClick={() => onClick(tabId)}
            className={`px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${isActive ? 'text-white bg-slate-700/50 border-b-2 border-purple-500' : 'text-slate-400 hover:text-white'}`}
            aria-selected={isActive}
            role="tab"
        >
            {name}
        </button>
    );
};


// Main App Component
const HomePage: React.FC = () => {
  // State management
  const [contractAddress, setContractAddress] = useState<string>('0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'); // Default for demo
  const [contractData, setContractData] = useState<ContractData | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [explainedFunctions, setExplainedFunctions] = useState<ExplainedFunction[] | null>(null);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  
  // Creator Tab State
  const [creatorTransactions, setCreatorTransactions] = useState<Transaction[] | null>(null);
  const [creatorTokenBalance, setCreatorTokenBalance] = useState<TokenBalance | null>(null);

  // API Response State
  const [apiResponses, setApiResponses] = useState<Record<string, any>>({});

  const [messages, setMessages] = useState<Message[]>([]);
  
  const [isLoadingContract, setIsLoadingContract] = useState<boolean>(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState<boolean>(false);
  const [isFetchingOwner, setIsFetchingOwner] = useState<boolean>(false);
  const [isLoadingCreatorInfo, setIsLoadingCreatorInfo] = useState<boolean>(false);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearchDropdownVisible, setIsSearchDropdownVisible] = useState<boolean>(false);

  
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<TabId>('quickcheck');
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Debounced search effect with mobile optimization
  useEffect(() => {
    const query = contractAddress.trim();
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(query);

    if (query.length < 2 || isAddress) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    // Increased debounce time for mobile optimization
    const handler = setTimeout(async () => {
      try {
        const results = await search(query);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 800); // Increased debounce for mobile optimization

    return () => {
      clearTimeout(handler);
    };
  }, [contractAddress]);

  // Handle clicks outside of search to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
            setIsSearchDropdownVisible(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch owner address when contract data is loaded
  useEffect(() => {
    if (!contractData || !contractAddress) {
      setOwnerAddress(null);
      return;
    }

    const findOwner = async () => {
      setIsFetchingOwner(true);
      try {
        const result = await fetchReadMethods(contractAddress);
        setApiResponses(prev => ({...prev, readMethods: result.raw}));
        
        const ownerMethod = result.data.find(
          method => method.name.toLowerCase() === 'owner' && method.inputs.length === 0
        );

        if (ownerMethod && ownerMethod.outputs?.[0]?.value) {
          setOwnerAddress(ownerMethod.outputs[0].value);
        } else {
          setOwnerAddress(null);
        }
      } catch (e) {
        console.error("Could not fetch read methods or find owner:", e);
        setOwnerAddress(null);
      } finally {
        setIsFetchingOwner(false);
      }
    };

    findOwner();
  }, [contractData, contractAddress]);

  // Fetch creator info when contract data is loaded
  useEffect(() => {
    const creatorAddress = contractData?.creator_address_hash;
    if (!creatorAddress) {
        setCreatorTransactions(null);
        setCreatorTokenBalance(null);
        return;
    }

    const fetchCreatorData = async () => {
        setIsLoadingCreatorInfo(true);
        try {
            const [transactionsResult, balancesResult] = await Promise.all([
                fetchCreatorTransactions(creatorAddress),
                fetchAddressTokenBalances(creatorAddress)
            ]);

            setApiResponses(prev => ({
                ...prev,
                creatorTxs: transactionsResult.raw,
                creatorBalances: balancesResult.raw
            }));

            const contractCreations = transactionsResult.data.filter(tx => tx.is_contract_creation);
            setCreatorTransactions(contractCreations);

            const relevantBalance = balancesResult.data.find(b => b.token.address.toLowerCase() === contractAddress.toLowerCase());
            setCreatorTokenBalance(relevantBalance || null);

        } catch (e) {
            console.error("Failed to fetch creator data:", e);
            setCreatorTransactions([]);
            setCreatorTokenBalance(null);
        } finally {
            setIsLoadingCreatorInfo(false);
        }
    };

    fetchCreatorData();
}, [contractData, contractAddress]);

  
  const analyzeAndExplainAbi = useCallback(async (abi: AbiItem[], sourceCode: string) => {
      setIsAnalyzingAI(true);
      setExplainedFunctions(null);

      const functionsToExplain = abi.filter(item => item.type === 'function' && item.name);
      if (functionsToExplain.length === 0) {
          setIsAnalyzingAI(false);
          return;
      }
      
      try {
          const response = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ abi, sourceCode }),
          });

          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `API responded with ${response.status}`);
          }
          const data = await response.json();

          interface ExplainedFunctionFromAI {
            name: string;
            explanation: string;
          }

          const explained = data.functions as ExplainedFunctionFromAI[];
          
          const mergedFunctions: ExplainedFunction[] = functionsToExplain.map(originalFunc => {
              const explanationData = explained.find((exp: ExplainedFunctionFromAI) => exp.name === originalFunc.name);
              return {
                  name: originalFunc.name,
                  type: originalFunc.stateMutability === 'view' || originalFunc.stateMutability === 'pure' ? 'read' : 'write',
                  inputs: originalFunc.inputs,
                  outputs: originalFunc.outputs,
                  explanation: explanationData?.explanation || 'AI explanation not available.',
              };
          });

          setExplainedFunctions(mergedFunctions);
      } catch (e) {
          setError(`AI analysis failed: ${(e as Error).message}`);
          console.error(e);
      } finally {
          setIsAnalyzingAI(false);
      }
  }, []);


  const handleLoadContract = useCallback(async () => {
    if (!contractAddress) {
      setError('Please enter a contract address.');
      return;
    }
    setIsLoadingContract(true);
    setError(null);
    setContractData(null);
    setTokenInfo(null);
    setExplainedFunctions(null);
    setOwnerAddress(null);
    setMessages([]);
    setCreatorTransactions(null);
    setCreatorTokenBalance(null);
    setApiResponses({});
    setActiveTab('functions');

    try {
      const [contractResult, tokenResult, addressInfoResult] = await Promise.all([
        fetchContract(contractAddress),
        fetchTokenInfo(contractAddress),
        fetchAddressInfo(contractAddress)
      ]);

      setApiResponses({
          contract: contractResult.raw,
          tokenInfo: tokenResult?.raw,
          addressInfo: addressInfoResult?.raw
      });

      const finalContractData = contractResult.data;
      if (finalContractData && addressInfoResult?.data) {
          finalContractData.creator_address_hash = addressInfoResult.data.creator_address_hash;
          finalContractData.creation_tx_hash = addressInfoResult.data.creation_tx_hash;
      }
      
      setContractData(finalContractData);
      setTokenInfo(tokenResult?.data || null);

      if (finalContractData?.abi && finalContractData?.source_code) {
        analyzeAndExplainAbi(finalContractData.abi, finalContractData.source_code);
      }

    } catch (e) {
      setError((e as Error).message);
      setContractData(null);
      setTokenInfo(null);
    } finally {
      setIsLoadingContract(false);
    }
  }, [contractAddress, analyzeAndExplainAbi]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isLoadingChat || !contractData) return;

    const userMessage: Message = { id: Date.now().toString(), text: chatInput, sender: 'user' };
    const historyForApi = [...messages];
    
    setMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsLoadingChat(true);

    const aiMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: aiMessageId, text: '...', sender: 'ai' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          history: historyForApi, 
          message: userMessage.text, 
          contract: { name: contractData.name, source_code: contractData.source_code }
        }),
      });

      if (!response.ok || !response.body) {
          const errorText = await response.text();
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Chat API request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponseText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        aiResponseText += decoder.decode(value, { stream: true });
        setMessages(prev =>
            prev.map(msg =>
                msg.id === aiMessageId ? { ...msg, text: aiResponseText } : msg
            )
        );
      }

      if (aiResponseText.length === 0) {
           setMessages(prev => prev.map(msg => 
               msg.id === aiMessageId ? { ...msg, text: "I'm sorry, I could not generate a response. Please try again." } : msg
           ));
       }

    } catch (e) {
      const errorMessage = (e as Error).message;
       setMessages(prev => prev.map(msg => 
           msg.id === aiMessageId ? { ...msg, text: `Error: ${errorMessage}` } : msg
       ));
    } finally {
      setIsLoadingChat(false);
    }
  }, [messages, chatInput, isLoadingChat, contractData]);
  
  const renderMessageText = useCallback((text: string) => {
    try {
      // Safety check for text input
      if (!text || typeof text !== 'string') {
        return <span>Invalid message content</span>;
      }

    // Enhanced regex patterns for better formatting
    const patterns = [
      // Code blocks with language specification
      { 
        regex: /```([a-zA-Z]*)\n([\s\S]*?)```/g, 
        render: (match: string, language: string, code: string) => {
          const lang = (language || 'solidity').toLowerCase();
          const safeCode = (code || '').trim();
          return (
            <pre key={`code-${Date.now()}-${Math.random()}`} className="chat-code-block">
              <div className="code-block-header">
                <span className="code-block-language">{lang}</span>
                <div className="code-block-dots">
                  <div className="code-block-dot code-block-dot-red"></div>
                  <div className="code-block-dot code-block-dot-yellow"></div>
                  <div className="code-block-dot code-block-dot-green"></div>
                </div>
              </div>
              <code className={`language-${lang} text-sm text-slate-200 leading-relaxed`}>
                {safeCode}
              </code>
            </pre>
          );
        }
      },
      // Inline code
      { 
        regex: /`([^`]+)`/g, 
        render: (match: string, code: string) => (
          <code key={`inline-${Date.now()}-${Math.random()}`} className="chat-inline-code">
            {code || ''}
          </code>
        )
      },
      // Bold text
      { 
        regex: /\*\*(.*?)\*\*/g, 
        render: (match: string, text: string) => (
          <strong key={`bold-${Date.now()}-${Math.random()}`} className="font-bold text-white">
            {text || ''}
          </strong>
        )
      },
      // Italic text
      { 
        regex: /\*(.*?)\*/g, 
        render: (match: string, text: string) => (
          <em key={`italic-${Date.now()}-${Math.random()}`} className="italic text-slate-300">
            {text || ''}
          </em>
        )
      },
      // Headers (H1-H6)
      { 
        regex: /^(#{1,6})\s+(.+)$/gm, 
        render: (match: string, hashes: string, text: string) => {
          const level = hashes ? hashes.length : 1;
          const Tag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
          const classes = {
            1: 'chat-header-1',
            2: 'chat-header-2',
            3: 'chat-header-3',
            4: 'chat-header-4',
            5: 'chat-header-5',
            6: 'chat-header-6'
          };
          return (
            <Tag key={`header-${Date.now()}-${Math.random()}`} className={classes[Math.min(level, 6) as keyof typeof classes]}>
              {text || ''}
            </Tag>
          );
        }
      },
      // Numbered lists
      { 
        regex: /^\d+\.\s+(.+)$/gm, 
        render: (match: string, text: string) => (
          <li key={`ol-${Date.now()}-${Math.random()}`} className="ml-4 text-slate-200 mb-1">
            {text || ''}
          </li>
        )
      },
      // Bullet lists
      { 
        regex: /^[-*]\s+(.+)$/gm, 
        render: (match: string, text: string) => (
          <li key={`ul-${Date.now()}-${Math.random()}`} className="chat-list-item">
            <span className="chat-list-bullet">•</span>
            <span>{text || ''}</span>
          </li>
        )
      },
      // Links
      { 
        regex: /\[([^\]]+)\]\(([^)]+)\)/g, 
        render: (match: string, text: string, url: string) => (
          <a 
            key={`link-${Date.now()}-${Math.random()}`} 
            href={url || '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            className="chat-link"
          >
            {text || 'link'}
          </a>
        )
      },
      // Address highlighting (0x...)
      { 
        regex: /(0x[a-fA-F0-9]{40})/g, 
        render: (match: string, address: string) => (
          <code key={`address-${Date.now()}-${Math.random()}`} className="chat-address">
            {address || ''}
          </code>
        )
      },
      // Function names (common Solidity patterns)
      { 
        regex: /(\b[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\))/g, 
        render: (match: string, func: string) => (
          <code key={`func-${Date.now()}-${Math.random()}`} className="chat-function">
            {func || ''}
          </code>
        )
      }
    ];

    // Process the text through all patterns
    let processedText = text;
    let elements: (string | JSX.Element)[] = [processedText];

    patterns.forEach(pattern => {
      const newElements: (string | JSX.Element)[] = [];
      
      elements.forEach(element => {
        if (typeof element === 'string') {
          try {
            const parts = element.split(pattern.regex);
            const processedParts: (string | JSX.Element)[] = [];
            
            for (let i = 0; i < parts.length; i++) {
              if (i % (pattern.regex.source.match(/\(/g)?.length || 0 + 1) === 0) {
                // This is a regular text part
                if (parts[i]) {
                  processedParts.push(parts[i]);
                }
              } else {
                // This is a match part
                const match = parts[i];
                const groups = [];
                const groupCount = pattern.regex.source.match(/\(/g)?.length || 0;
                for (let j = 1; j < groupCount; j++) {
                  if (parts[i + j] !== undefined) {
                    groups.push(parts[i + j]);
                  } else {
                    groups.push(''); // Provide default value for missing groups
                  }
                }
                try {
                  const rendered = pattern.render(match, ...groups);
                  processedParts.push(rendered);
                } catch (renderError) {
                  console.error('Error rendering pattern:', renderError);
                  processedParts.push(match); // Fallback to original text
                }
                i += groups.length; // Skip the group parts we just processed
              }
            }
            
            newElements.push(...processedParts);
          } catch (splitError) {
            console.error('Error splitting text with pattern:', splitError);
            newElements.push(element); // Fallback to original element
          }
        } else {
          newElements.push(element);
        }
      });
      
      elements = newElements;
    });

    // Handle line breaks and paragraphs
    const finalElements: (string | JSX.Element)[] = [];
    
    elements.forEach((element, index) => {
      if (typeof element === 'string') {
        const lines = element.split('\n');
        lines.forEach((line, lineIndex) => {
          if (line.trim() === '') {
            if (lineIndex > 0 && lineIndex < lines.length - 1) {
              finalElements.push(<br key={`br-${index}-${lineIndex}`} />);
            }
          } else {
            finalElements.push(line);
            if (lineIndex < lines.length - 1) {
              finalElements.push(<br key={`br-${index}-${lineIndex}-end`} />);
            }
          }
        });
      } else {
        finalElements.push(element);
      }
    });

    // Group consecutive list items
    const groupedElements: (string | JSX.Element | JSX.Element[])[] = [];
    let currentList: JSX.Element[] = [];
    let inList = false;

    finalElements.forEach((element) => {
      if (React.isValidElement(element) && element.type === 'li') {
        if (!inList) {
          inList = true;
          currentList = [];
        }
        currentList.push(element);
      } else {
        if (inList && currentList.length > 0) {
          groupedElements.push(
            <ul key={`list-${Date.now()}-${Math.random()}`} className="chat-list">
              {currentList}
            </ul>
          );
          currentList = [];
          inList = false;
        }
        groupedElements.push(element);
      }
    });

    // Handle any remaining list items
    if (inList && currentList.length > 0) {
      groupedElements.push(
        <ul key={`list-final-${Date.now()}-${Math.random()}`} className="chat-list">
          {currentList}
        </ul>
      );
    }

    return <>{groupedElements}</>;
  } catch (error) {
    console.error('Error in renderMessageText:', error);
    return <span className="text-red-400">Error rendering message. Please try again.</span>;
  }
  }, []);

  const handleSelectSearchResult = (item: SearchResultItem) => {
    setContractAddress(item.address);
    setSearchResults([]);
    setIsSearchDropdownVisible(false);
  };

  const readFunctions = explainedFunctions?.filter(f => f.type === 'read') || [];
  const writeFunctions = explainedFunctions?.filter(f => f.type === 'write') || [];

  return (
    <div className="min-h-screen text-slate-200">
      <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
        
        <header className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <PulseChainLogo className="h-10 w-10" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">PulseChain Contract Analyzer</h1>
              <p className="text-sm text-slate-400">Analyze Solidity contracts with AI on Next.js</p>
            </div>
          </div>
        </header>

        {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}

        <div className="bg-slate-800/50 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-700 mb-8">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="w-full relative" ref={searchContainerRef}>
                    <label htmlFor="contractAddress" className="block text-sm font-medium text-slate-300 mb-2">
                        Contract Address or Name/Ticker
                    </label>
                    <input
                        type="text"
                        id="contractAddress"
                        value={contractAddress}
                        onChange={(e) => setContractAddress(e.target.value)}
                        onFocus={() => setIsSearchDropdownVisible(true)}
                        placeholder="0x... or search for 'Pulse'"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                        disabled={isLoadingContract}
                        autoComplete="off"
                    />
                    {isSearchDropdownVisible && (isSearching || searchResults.length > 0) && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10 max-h-80 overflow-y-auto">
                            {isSearching && <div className="p-3 text-slate-400 flex items-center gap-2"><LoadingSpinner className="w-4 h-4" /><span>Searching...</span></div>}
                            {!isSearching && searchResults.map(item => (
                                <div
                                    key={item.address}
                                    onClick={() => handleSelectSearchResult(item)}
                                    className="flex items-center gap-3 p-3 hover:bg-slate-700 cursor-pointer transition-colors"
                                >
                                    {item.icon_url ?
                                      <Image src={item.icon_url} alt={`${item.name} logo`} className="w-8 h-8 rounded-full bg-slate-700" width={32} height={32} /> :
                                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-purple-400 font-bold text-sm flex-shrink-0">{item.name?.[0] || '?'}</div>
                                    }
                                    <div className="overflow-hidden">
                                        <div className="font-semibold text-white truncate">{item.name} {item.symbol && `(${item.symbol})`}</div>
                                        <div className="text-xs text-slate-400 capitalize">{item.type}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    onClick={handleLoadContract}
                    disabled={isLoadingContract || !contractAddress}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-purple-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
                >
                    {isLoadingContract ? <LoadingSpinner /> : 'Load Contract'}
                </button>
            </div>
        </div>
        
        {isLoadingContract && (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-800 rounded-xl">
              <LoadingSpinner className="w-10 h-10 text-purple-400" />
              <p className="mt-4 text-lg font-semibold">Loading contract data...</p>
              <p className="text-slate-400">Fetching from PulseChain Scan API.</p>
            </div>
        )}

        {contractData && (
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-8">
               <div className="bg-slate-800/50 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-700">
                   <h3 className="text-xl font-bold text-white mb-4">{contractData.name}</h3>
                   <div className="space-y-2 text-sm">
                       <div className="flex justify-between items-center"><span className="text-slate-400">Verified</span><span className={`px-2 py-0.5 rounded-full text-xs ${contractData.is_verified ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'}`}>{contractData.is_verified ? 'Yes' : 'No'}</span></div>
                       <div className="flex justify-between items-center"><span className="text-slate-400">Compiler</span><span className="font-mono">{contractData.compiler_version}</span></div>
                       <div className="flex justify-between items-center"><span className="text-slate-400">Optimization</span><span className={`px-2 py-0.5 rounded-full text-xs ${contractData.optimization_enabled ? 'bg-green-800 text-green-200' : 'bg-yellow-800 text-yellow-200'}`}>{contractData.optimization_enabled ? 'Enabled' : 'Disabled'}</span></div>
                       <div className="flex justify-between items-center pt-1">
                           <span className="text-slate-400">Owner</span>
                           <div className="flex items-center gap-2">
                               {isFetchingOwner && <LoadingSpinner className="w-4 h-4" />}
                               {!isFetchingOwner && (
                                   ownerAddress ?
                                   <a href={`https://scan.pulsechain.com/address/${ownerAddress}`} target="_blank" rel="noopener noreferrer" title={ownerAddress} className="font-mono text-purple-400 hover:text-purple-300 transition-colors break-all text-right">
                                       {`${ownerAddress.substring(0, 6)}...${ownerAddress.substring(ownerAddress.length - 4)}`}
                                   </a>
                                   : <span className="text-slate-500">Not Found</span>
                               )}
                           </div>
                       </div>
                   </div>
               </div>
               <Suspense fallback={<div className="bg-slate-800/50 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-700 h-full flex items-center justify-center"><LoadingSpinner /></div>}>
                   <TokenInfoCard tokenInfo={tokenInfo} />
               </Suspense>
            </div>

            <div className="lg:col-span-2 flex flex-col h-[75vh]">
                <div className="flex border-b border-slate-700" role="tablist" aria-label="Contract Details">
                                  <TabButton name="Quick Check" tabId="quickcheck" activeTab={activeTab} onClick={setActiveTab} />
              <TabButton name="Creator" tabId="creator" activeTab={activeTab} onClick={setActiveTab} />
              <TabButton name="Functions" tabId="functions" activeTab={activeTab} onClick={setActiveTab} />
              <TabButton name="Source Code" tabId="code" activeTab={activeTab} onClick={setActiveTab} />
              <TabButton name="API Response" tabId="api" activeTab={activeTab} onClick={setActiveTab} />
              <TabButton name="Chat with AI" tabId="chat" activeTab={activeTab} onClick={setActiveTab} />
                </div>
                
                <div className="flex-grow bg-slate-800/50 rounded-b-xl border border-t-0 border-slate-700 overflow-hidden">
                    <div role="tabpanel" hidden={activeTab !== 'quickcheck'} className="h-full overflow-y-auto">
                        <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                            <QuickCheck
                                contractData={contractData}
                                tokenInfo={tokenInfo}
                                isLoading={isLoadingContract}
                            />
                        </Suspense>
                    </div>
                    <div role="tabpanel" hidden={activeTab !== 'creator'} className="h-full overflow-y-auto">
                        <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                            <CreatorTab
                                creatorAddress={contractData.creator_address_hash}
                                creationTxHash={contractData.creation_tx_hash}
                                tokenBalance={creatorTokenBalance}
                                transactions={creatorTransactions}
                                tokenInfo={tokenInfo}
                                isLoading={isLoadingCreatorInfo}
                            />
                        </Suspense>
                    </div>
                    <div role="tabpanel" hidden={activeTab !== 'functions'} className="p-4 space-y-6 overflow-y-auto h-full">
                       <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                           <AbiFunctionsList title="Read Functions" functions={readFunctions} isLoading={isAnalyzingAI} />
                           <AbiFunctionsList title="Write Functions" functions={writeFunctions} isLoading={isAnalyzingAI} />
                       </Suspense>
                    </div>
                    <div role="tabpanel" hidden={activeTab !== 'code'} className="h-full">
                       <pre className="h-full overflow-auto p-4"><code className="text-sm font-mono text-slate-300 whitespace-pre-wrap break-words">{contractData.source_code}</code></pre>
                    </div>
                    <div role="tabpanel" hidden={activeTab !== 'api'} className="h-full">
                       <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
                           <ApiResponseTab responses={apiResponses} />
                       </Suspense>
                    </div>
                    <div role="tabpanel" hidden={activeTab !== 'chat'} className="flex flex-col h-full">
                        <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-4 chat-container">
                            {messages.length === 0 && (<div className="text-center text-slate-400 h-full flex items-center justify-center">Ask a question about the contract...</div>)}
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} chat-message-animate`}>
                                    <div className={`chat-message-bubble ${msg.sender === 'user' ? 'chat-message-user' : 'chat-message-ai'}`}>
                                        <div className="chat-text">
                                            {msg.text === '...' ? <LoadingSpinner className="w-5 h-5" /> : renderMessageText(msg.text)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isLoadingChat && messages[messages.length - 1]?.sender === 'user' && (
                                <div className="flex justify-start chat-message-animate">
                                    <div className="chat-message-bubble chat-message-ai">
                                        <LoadingSpinner className="w-5 h-5" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700 flex items-center gap-3 bg-slate-800">
                            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask about the contract..." className="flex-grow bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none transition" disabled={isLoadingChat} />
                            <button type="submit" disabled={isLoadingChat || !chatInput.trim()} className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"><SendIcon className="w-5 h-5"/></button>
                        </form>
                    </div>
                </div>
            </div>
          </main>
        )}
      </div>
      <PerformanceMonitor />
      <MobilePerformanceMonitor />
    </div>
  );
};

export default HomePage;
