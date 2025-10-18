'use client';

import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react';
// import { motion } from "framer-motion"; // Temporarily disabled due to TypeScript issues
import { useSearchParams } from 'next/navigation';

import { LoaderThree } from "@/components/ui/loader";
import { HexLoader } from "@/components/ui/hex-loader";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu";

import type { Message, ContractData, TokenInfo, AbiItem, ExplainedFunction, SearchResultItem, Transaction, TokenBalance, DexScreenerData } from '../../types';
import { fetchContract, fetchTokenInfo, search, fetchReadMethods, fetchDexScreenerData } from '../../services/pulsechainService';
import { dexscreenerApi } from '../../services/blockchain/dexscreenerApi';
import { pulsechainApiService } from '../../services/pulsechainApiService';
import { useApiKey } from '../../lib/hooks/useApiKey';
import { useGemini } from '../../lib/hooks/useGemini';
import UnverifiedContractRisksModal from '@/components/UnverifiedContractRisksModal';
import { WobbleCard } from '@/components/ui/wobble-card';
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';
import SourceCodeTab from '@/components/SourceCodeTab';
import ApiResponseTab from '@/components/ApiResponseTab';
import LiquidityTab from '@/components/LiquidityTab';
import SendIcon from '@/components/icons/SendIcon';
import AddressDetailsModal from '@/components/AddressDetailsModal';
import { Button as StatefulButton } from '@/components/ui/stateful-button';
import DexScreenerChart from '@/components/DexScreenerChart';
import { BackgroundGradient } from '@/components/ui/background-gradient';

// Note: API key is handled server-side in API routes

type TabId = 'code' | 'chat' | 'info' | 'holders' | 'liquidity';







// Component that uses useSearchParams
const AppWithSearchParams: React.FC = () => {
  const searchParams = useSearchParams();
  return <App searchParams={searchParams} />;
};

// Main App Component
const App: React.FC<{ searchParams: URLSearchParams }> = ({ searchParams }) => {
  // State management
  const [contractAddress, setContractAddress] = useState<string>('0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'); // Default for demo
  const [contractData, setContractData] = useState<ContractData | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [dexScreenerData, setDexScreenerData] = useState<DexScreenerData | null>(null);
  const [explainedFunctions, setExplainedFunctions] = useState<ExplainedFunction[] | null>(null);

  // Holders tab state
  const [holders, setHolders] = useState<SearchResultItem[] | null>(null);
  const [isLoadingHolders, setIsLoadingHolders] = useState<boolean>(false);
  const [holdersError, setHoldersError] = useState<string | null>(null);

  // Search state
  const [searchResults, setSearchResults] = useState<SearchResultItem[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // UI state
  const [isLoadingContract, setIsLoadingContract] = useState<boolean>(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState<boolean>(false);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState<boolean>(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [addressSet, setAddressSet] = useState<boolean>(false);
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('info');
  const [apiResponses, setApiResponses] = useState<Record<string, unknown>>({});
  
  // Missing state variables
  const [chatInput, setChatInput] = useState<string>('');
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [activeTabbedContent, setActiveTabbedContent] = useState<number>(0);

  // Token calculator state
  const [tokenAmount, setTokenAmount] = useState<string>('1');
  const [calculatorCurrency, setCalculatorCurrency] = useState<'usd' | 'wpls'>('usd');

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const headerSearchInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { getApiKey } = useApiKey();

  // Search Modal State
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [showHeaderSearch, setShowHeaderSearch] = useState<boolean>(false);

  // Listen for search modal trigger from sidebar
  useEffect(() => {
    const handleOpenSearch = () => {
      setShowSearchModal(true);
    };
    window.addEventListener('openAICodeSearch', handleOpenSearch);
    return () => window.removeEventListener('openAICodeSearch', handleOpenSearch);
  }, []);

  // Handle URL parameters - load token when address is in URL
  useEffect(() => {
    const addressParam = searchParams.get('address');
    if (addressParam) {
      // Close splash modal when loading from URL
      setContractAddress(addressParam);
      setAddressSet(true);
      // Use a small timeout to ensure state is updated before loading
      setTimeout(() => {
        handleLoadContract(addressParam);
      }, 100);
    }
  }, [searchParams]);

  // Derived state
  const abiReadFunctions = contractData?.abi?.filter(item => item.type === 'function' && item.stateMutability === 'view') || [];
  const abiWriteFunctions = contractData?.abi?.filter(item => item.type === 'function' && item.stateMutability !== 'view') || [];
  
  // Unverified contract risks modal state
  const [showUnverifiedRisksModal, setShowUnverifiedRisksModal] = useState<boolean>(false);
  

  
  // Placeholders for the vanish input
  const searchPlaceholders = [
    "Search Any PulseChain Ticker",
    "Search By Name, Ticker, or Address",
    "Search for HEX...or HEX!",
    "Search for PulseChain or PLS!",
    "Try SuperStake or PSSH",
    "Bringing AI To PulseChain",
    "Bookmark PulseChainAI.com",
  ];
  
  // AI Analysis
  const analyzeWithAI = useCallback(async () => {
    // TODO: Implement AI contract analysis
    // if (!contractData || !getApiKey) return;
    // setIsAnalyzingAI(true);
    setIsAnalyzingAI(false);
  }, [contractData, getApiKey]);
  
  // Handle contract loading
  const handleLoadContract = useCallback(async (addressToLoad?: string) => {
    const address = addressToLoad || contractAddress;
    if (!address) {
      setError('Please enter a contract address.');
      return;
    }
    setShowTutorial(false); // Hide tutorial when loading contract
    setIsLoadingContract(true);
    setError(null);
    setAddressSet(false); // Reset glow effect when loading starts
    setContractData(null);
    setTokenInfo(null);
    setDexScreenerData(null);
    setExplainedFunctions(null);
    // setOwnerAddress(null); // This line was removed
    setMessages([]);
    setHolders(null);
    setApiResponses({});

    try {
      const [contractResult, tokenResult, dexResult, profileResult] = await Promise.all([
        fetchContract(address),
        fetchTokenInfo(address),
        fetchDexScreenerData(address),
        dexscreenerApi.getTokenProfile(address)
      ]);

      setContractData(contractResult?.data ?? null);
      setTokenInfo(tokenResult?.data ?? null);
      
      // Use comprehensive profile data if available, fallback to regular DexScreener data
      const finalDexData = profileResult.success ? profileResult.data : dexResult.data;
      setDexScreenerData(finalDexData);
      
      setApiResponses({
        contract: contractResult?.data,
        token: tokenResult?.data,
        dex: finalDexData
      });

      // Auto-analyze with AI
      if (getApiKey()) {
        analyzeWithAI();
      }

      setAddressSet(true);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      setError(`Failed to load contract: ${errorMessage}`);
      setAddressSet(false);
    } finally {
      setIsLoadingContract(false);
    }
  }, [contractAddress, getApiKey, analyzeWithAI, setShowTutorial]);

  // Handle URL parameters for embedded mode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const embedded = urlParams.get('embedded');
    const contract = urlParams.get('contract');
    
    if (embedded === 'true') {
      setAddressSet(true);
      setShowTutorial(false);
    }
    
    if (contract) {
      setContractAddress(contract);
      // Don't call handleLoadContract here - it will be called when contractAddress changes
    }
  }, []);

  // Handle embedded contract loading
  useEffect(() => {
    if (addressSet && contractAddress && !contractData) {
      handleLoadContract();
    }
  }, [addressSet, contractAddress, contractData]);

  useEffect(() => {
    if (!contractData || !contractAddress) {
      // setReadMethods(null); // This line was removed
      return;
    }

    const findOwner = async () => {
      try {
        const result = await fetchReadMethods(contractAddress);
        
        // setReadMethods(result.data); // This line was removed
        
        const ownerMethod = result.data.find(
          (method: AbiItem) => method.name.toLowerCase() === 'owner' && method.inputs.length === 0
        );

        if (ownerMethod && ownerMethod.outputs?.[0]?.value) {
          // setOwnerAddress(ownerMethod.outputs[0].value); // This line was removed
        } else {
          // setOwnerAddress(null); // This line was removed
        }
      } catch (e) {
        console.error("Could not fetch read methods or find owner:", e);
        // setOwnerAddress(null); // This line was removed
        // setReadMethods(null); // This line was removed
      } finally {
        // setIsFetchingOwner(false); // This line was removed
      }
    };

    findOwner();
  }, [contractData, contractAddress]);

  // Token search with debouncing (similar to stat-counter-builder)
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(searchQuery);
    if (isAddress) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await search(searchQuery);
        setSearchResults(results.slice(0, 10)); // Limit to 10 results
        setSearchError(null);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : 'Search failed');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);






  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), text, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setIsLoadingChat(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          contractData,
          tokenInfo,
          dexScreenerData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const aiMessage: Message = { id: (Date.now() + 1).toString(), text: data.response, sender: 'ai' };
      setMessages(prev => [...prev, aiMessage]);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: `Error: ${errorMessage}`, sender: 'ai' }]);
    } finally {
      setIsLoadingChat(false);
    }
  }, [contractData, tokenInfo, dexScreenerData, getApiKey]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const messageText = chatInput;
    setChatInput('');
    await sendMessage(messageText);
  }, [chatInput, sendMessage]);
  
  const renderMessageText = (text: string) => {
    // Enhanced markdown parser with tabbed content and hashtags
    const renderMarkdown = (content: string) => {
      // Handle tabbed content first
      const tabRegex = /\[TAB:([^\]]+)\]([\s\S]*?)\[\/TAB\]/g;
      const tabMatches = [...content.matchAll(tabRegex)];
      
      if (tabMatches.length > 0) {
        const tabs = tabMatches.map(match => ({
          title: match[1],
          content: match[2]
        }));
        
        return (
          <div key="tabbed-content" className="my-4">
            <div className="flex border-b border-slate-600 mb-3">
              {tabs.map((tab, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTabbedContent(index)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    activeTabbedContent === index 
                      ? 'text-white border-b-2 border-purple-500' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.title}
                </button>
              ))}
            </div>
            <div className="p-3 bg-slate-800 rounded-lg border border-slate-600/30">
              {renderMarkdown(tabs[activeTabbedContent].content)}
            </div>
          </div>
        );
      }
      
      // Split by code blocks
      const codeBlockParts = content.split(/(```[\s\S]*?```)/g);
      
      return codeBlockParts.map((block, blockIndex) => {
        if (block.startsWith('```') && block.endsWith('```')) {
          // Handle code blocks
          const code = block.slice(3, -3);
          const languageMatch = code.match(/^[a-zA-Z]+\n/);
          const language = languageMatch ? languageMatch[0].trim().toLowerCase() : 'solidity';
          const codeContent = languageMatch ? code.substring(language.length + 1) : code;
          
          return (
            <pre key={blockIndex} className="bg-slate-950 rounded-lg p-3 my-3 overflow-x-auto border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-mono uppercase">{language}</span>
                <div className="flex space-x-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
              </div>
              <code className={`language-${language} text-sm leading-relaxed`}>{codeContent}</code>
            </pre>
          );
        }
        
        // Handle inline content with enhanced markdown
        const parts = block.split(/(`[^`]*`|#{1,6}\s+[^\n]*|>\s+[^\n]*|-\s+[^\n]*|\*\*[^*]*\*\*|\*[^*]*\*|\[[^\]]*\]\([^)]*\)|#[a-zA-Z]+)/g);
        
        return parts.map((part, partIndex) => {
          const key = `${blockIndex}-${partIndex}`;
          
          // Hashtags
          if (part.match(/^#[a-zA-Z]+$/)) {
            return (
              <span key={key} className="inline-block bg-purple-600/20 text-purple-300 px-2 py-1 rounded-full text-xs font-medium mr-1 mb-1">
                {part}
              </span>
            );
          }
          
          // Headers
          if (part.match(/^#{1,6}\s+/)) {
            const level = part.match(/^(#{1,6})/)?.[1].length || 1;
            const text = part.replace(/^#{1,6}\s+/, '');
            const headerClasses = {
              1: 'text-xl font-bold text-white border-b border-slate-600 pb-2 mb-3',
              2: 'text-lg font-bold text-white mt-4 mb-2',
              3: 'text-base font-semibold text-white mt-3 mb-2',
              4: 'text-sm font-semibold text-slate-200 mt-2 mb-1',
              5: 'text-xs font-semibold text-slate-300 mt-2 mb-1',
              6: 'text-xs font-semibold text-slate-400 mt-2 mb-1'
            };
            return <div key={key} className={headerClasses[level as keyof typeof headerClasses]}>{text}</div>;
          }
          
          // Blockquotes
          if (part.startsWith('> ')) {
            const text = part.substring(2);
            return (
              <blockquote key={key} className="border-l-4 border-purple-500 bg-purple-900/20 pl-3 py-2 my-2 italic text-slate-300 text-sm">
                {text}
              </blockquote>
            );
          }
          
          // Lists
          if (part.startsWith('- ')) {
            const text = part.substring(2);
            return (
              <li key={key} className="flex items-start gap-2 my-0.5">
                <span className="text-purple-400 mt-1.5 flex-shrink-0">•</span>
                <span className="text-slate-300 text-sm">{text}</span>
              </li>
            );
          }
          
          // Bold text
          if (part.startsWith('**') && part.endsWith('**')) {
            const text = part.slice(2, -2);
            return <strong key={key} className="font-bold text-white">{text}</strong>;
          }
          
          // Italic text
          if (part.startsWith('*') && part.endsWith('*')) {
            const text = part.slice(1, -1);
            return <em key={key} className="italic text-slate-200">{text}</em>;
          }
          
          // Inline code
          if (part.startsWith('`') && part.endsWith('`')) {
            const text = part.slice(1, -1);
            return (
              <code key={key} className="bg-slate-700 text-amber-300 rounded px-1.5 py-0.5 text-sm font-mono border border-slate-600">
                {text}
              </code>
            );
          }
          
          // Contract name links (special format: [ContractName](search))
          if (part.match(/^\[([^\]]*)\]\(search\)$/)) {
            const match = part.match(/^\[([^\]]*)\]\(search\)$/);
            if (match) {
              const [, contractName] = match;
              return (
                <button
                  key={key}
                  onClick={() => setContractAddress(contractName)}
                  className="text-lg font-bold text-purple-400 hover:text-purple-300 underline transition-colors cursor-pointer"
                >
                  {contractName}
                </button>
              );
            }
          }
          
          // Regular links
          if (part.match(/^\[([^\]]*)\]\(([^)]*)\)$/)) {
            const match = part.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
            if (match) {
              const [, text, url] = match;
              return (
                <a 
                  key={key} 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline transition-colors"
                >
                  {text}
                </a>
              );
            }
          }
          
          // Regular text with line breaks
          if (part.includes('\n')) {
            return part.split('\n').map((line, lineIndex) => (
              <span key={`${key}-${lineIndex}`}>
                {line}
                {lineIndex < part.split('\n').length - 1 && <br />}
              </span>
            ));
          }
          
          return <span key={key} className="text-slate-300">{part}</span>;
        });
      });
    };

    return (
      <div className="prose prose-sm prose-invert max-w-none">
        {renderMarkdown(text)}
      </div>
    );
  };

  const handleSelectSearchResult = (item: SearchResultItem) => {
    setContractAddress(item.address);
    setSearchQuery(item.address);
    setSearchResults([]);
    setShowSearchResults(false);
    setIsSearchFocused(false);
    setShowTutorial(false);

    // Clear both search inputs
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    if (headerSearchInputRef.current) {
      headerSearchInputRef.current.value = '';
    }

    // Directly trigger contract loading with the address
    handleLoadContract(item.address);
  };

  const explainedReadFunctions = explainedFunctions?.filter(f => f.type === 'read') || [];
  const explainedWriteFunctions = explainedFunctions?.filter(f => f.type === 'write') || [];

  return (
    <>
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px) scale(1);
          }
          25% {
            transform: translateY(-20px) translateX(10px) scale(1.05);
          }
          50% {
            transform: translateY(-10px) translateX(-15px) scale(0.95);
          }
          75% {
            transform: translateY(15px) translateX(5px) scale(1.02);
          }
        }
      `}</style>
      <div className="min-h-screen w-full relative bg-gradient-to-br from-black via-slate-900 to-black">
        {/* Dark Animated Background with Moving Blob */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(30,30,60,0.3),transparent_40%)] pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(20,20,40,0.2),transparent_40%)] pointer-events-none"></div>
      
      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(30,30,60,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(30,30,60,0.1)_1px,transparent_1px)] bg-[size:50px_50px] opacity-20"></div>
      
      <UnverifiedContractRisksModal 
        isOpen={showUnverifiedRisksModal} 
        onClose={() => setShowUnverifiedRisksModal(false)} 
      />
      
      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 backdrop-blur-sm border border-slate-600/50 rounded-xl shadow-2xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Search Token or Contract</h2>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="relative" ref={headerSearchInputRef}>
              <PlaceholdersAndVanishInput
                placeholders={searchPlaceholders}
                onChange={(e) => {
                  const value = e.target.value;
                  setContractAddress(value);
                  setSearchQuery(value);
                  if (value.trim()) {
                    setShowSearchResults(true);
                  } else {
                    setShowSearchResults(false);
                  }
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (contractAddress.trim()) {
                    handleLoadContract();
                    setShowSearchModal(false);
                  }
                }}
              />
              {showSearchResults && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl z-[9999] max-h-80 overflow-y-auto relative">
                    <div 
                      className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-lg opacity-20"
                      style={{ backgroundImage: 'url(/Mirage.jpg)' }}
                    />
                    <div className="relative z-10">
                  {isSearching && (
                    <div className="flex items-center justify-center p-4">
                      <div className="text-slate-400 text-sm">Searching...</div>
                    </div>
                  )}
                  {!isSearching && searchError && (
                    <div className="p-4 text-red-400 text-sm">{searchError}</div>
                  )}
                  {!isSearching && searchQuery.length >= 2 && searchResults?.length === 0 && !searchError && (
                    <div className="p-4 text-slate-400 text-sm">No tokens found for &quot;{searchQuery}&quot;</div>
                  )}
                  {!isSearching && searchResults?.map(item => (
                    <div
                      key={item.address}
                      onClick={() => {
                        handleSelectSearchResult(item);
                        setShowSearchModal(false);
                      }}
                          className="flex items-center gap-3 p-3 hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      {item.icon_url ?
                        <img src={item.icon_url} alt={`${item.name} logo`} className="w-8 h-8 rounded-full bg-slate-700" /> :
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-purple-400 font-bold text-sm flex-shrink-0">{item.name?.[0] || '?'}</div>
                      }
                      <div className="overflow-hidden flex-1">
                        <div className="font-semibold text-white truncate">{item.name} {item.symbol && `(${item.symbol})`}</div>
                        <div className="text-xs text-slate-400 capitalize">{item.type}</div>
                        <div className="text-xs text-slate-500 font-mono truncate">{item.address}</div>
                      </div>
                    </div>
                  ))}
                    </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div
        className="relative flex flex-col gap-4 justify-start w-full max-w-none overflow-y-auto"
      >
        {/* Search Bar - Only visible when no token is loaded */}
        {!contractData && !addressSet && (
          <div className="flex items-center justify-center min-h-[80vh] w-full">
            <div className="relative w-[90vw] max-w-4xl h-[60vh]">
              <div className="relative w-80 lg:w-[40rem] xl:w-[50rem] z-10 mx-auto mt-[25vh]" ref={searchInputRef}>
              <PlaceholdersAndVanishInput
                placeholders={searchPlaceholders}
                onChange={(e) => {
                  const value = e.target.value;
                  setContractAddress(value);
                  setSearchQuery(value);
                  if (value.trim()) {
                    setShowSearchResults(true);
                  } else {
                    setShowSearchResults(false);
                  }
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (contractAddress.trim()) {
                    handleLoadContract();
                  }
                }}
              />
              {showSearchResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl z-[9999] max-h-80 overflow-y-auto relative">
                  <div 
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-lg opacity-20"
                    style={{ backgroundImage: 'url(/Mirage.jpg)' }}
                  />
                  <div className="relative z-10">
                  {isSearching && (
                    <div className="flex items-center justify-center p-4">
                      <div className="text-slate-400 text-sm">Searching...</div>
                    </div>
                  )}
                  {!isSearching && searchError && (
                    <div className="p-4 text-red-400 text-sm">{searchError}</div>
                  )}
                  {!isSearching && searchQuery.length >= 2 && searchResults?.length === 0 && !searchError && (
                    <div className="p-4 text-slate-400 text-sm">No tokens found for &quot;{searchQuery}&quot;</div>
                  )}
                  {!isSearching && searchResults?.map(item => (
                    <div
                      key={item.address}
                      onClick={() => handleSelectSearchResult(item)}
                        className="flex items-center gap-3 p-3 hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      {item.icon_url ?
                        <img src={item.icon_url} alt={`${item.name} logo`} className="w-8 h-8 rounded-full bg-slate-700" /> :
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-purple-400 font-bold text-sm flex-shrink-0">{item.name?.[0] || '?'}</div>
                      }
                      <div className="overflow-hidden flex-1">
                        <div className="font-semibold text-white truncate">{item.name} {item.symbol && `(${item.symbol})`}</div>
                        <div className="text-xs text-slate-400 capitalize">{item.type}</div>
                        <div className="text-xs text-slate-500 font-mono truncate">{item.address}</div>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {/* WobbleCard Demo Component - Temporarily disabled due to API mismatch */}
        {/* {!addressSet && (
          <WobbleCard>
            <div>Tutorial content would go here</div>
          </WobbleCard>
        )} */}

        {error && (
            <div className="bg-red-900/20 backdrop-blur-xl border border-red-500/30 text-red-200 px-4 py-3 rounded-xl relative mb-6 mx-4 shadow-[0_8px_32px_rgba(239,68,68,0.2)]">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}

        {isLoadingContract && (
          <div className="flex items-center justify-center min-h-[80vh] w-full">
            <div className="relative w-[90vw] max-w-4xl h-[60vh] flex flex-col items-center justify-center">
              <div className="w-64 h-64 mb-8">
                <HexLoader />
              </div>
              <p className="text-base md:text-lg font-semibold text-white">Loading contract data...</p>
              <p className="text-slate-300 text-sm md:text-base">Fetching from PulseChain Scan API.</p>
            </div>
          </div>
        )}

        {contractData && (
          <main className={`flex flex-col ${addressSet ? 'h-full' : 'h-[calc(100vh-6rem)] pb-20 md:pb-0'} w-full`}>
            <div className="flex flex-col h-full w-full">
              <div className="relative flex-grow bg-black/20 backdrop-blur-xl border border-white/10 overflow-hidden h-full shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                   <GlowingEffect disabled={false} glow={true} />

                   {/* Header with Token Info and Search */}
                   <div className="relative flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-xl border-b border-white/10 z-50">
                     <div className="flex items-center gap-2">
                       {dexScreenerData?.tokenInfo?.name && (
                         <>
                           <span className="text-sm font-medium text-white">{dexScreenerData.tokenInfo.name}</span>
                           <span className="text-xs text-slate-400">({dexScreenerData.tokenInfo.symbol || dexScreenerData.pairs?.[0]?.baseToken?.symbol})</span>
                         </>
                       )}
                     </div>
                     
                     {/* Collapsible Search Bar for Medium+ Screens */}
                     <div className="hidden md:block absolute right-4">
                       {showHeaderSearch ? (
                         <div className="relative flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm border border-slate-600/50 rounded-lg px-3 py-2 shadow-lg min-w-fit">
                           <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                           </svg>
                           <input
                             type="text"
                             value={contractAddress}
                             onChange={(e) => {
                               const value = e.target.value;
                               setContractAddress(value);
                               setSearchQuery(value);
                               if (value.trim()) {
                                 setShowSearchResults(true);
                               } else {
                                 setShowSearchResults(false);
                               }
                             }}
                             onKeyDown={(e) => {
                               if (e.key === 'Enter' && contractAddress.trim()) {
                                 handleLoadContract();
                                 setShowHeaderSearch(false);
                                 setShowSearchResults(false);
                               }
                             }}
                             placeholder="Search token or contract..."
                             className="bg-transparent border-none outline-none text-white text-sm w-64 placeholder-slate-400"
                             autoFocus
                           />
                            {showSearchResults && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl z-[9999] max-h-80 overflow-y-auto relative">
                                <div 
                                  className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-lg opacity-20"
                                  style={{ backgroundImage: 'url(/Mirage.jpg)' }}
                                />
                                <div className="relative z-10">
                                  {isSearching && (
                                    <div className="flex items-center justify-center p-4">
                                      <div className="text-slate-400 text-sm">Searching...</div>
                                    </div>
                                  )}
                                  {!isSearching && searchError && (
                                    <div className="p-4 text-red-400 text-sm">{searchError}</div>
                                  )}
                                  {!isSearching && searchQuery.length >= 2 && searchResults?.length === 0 && !searchError && (
                                    <div className="p-4 text-slate-400 text-sm">No tokens found for &quot;{searchQuery}&quot;</div>
                                  )}
                                  {!isSearching && searchResults?.map(item => (
                                    <div
                                      key={item.address}
                                      onClick={() => {
                                        handleSelectSearchResult(item);
                                        setShowHeaderSearch(false);
                                        setShowSearchResults(false);
                                      }}
                                      className="flex items-center gap-3 p-3 hover:bg-slate-700/50 cursor-pointer transition-colors"
                                    >
                                      {item.icon_url ?
                                        <img src={item.icon_url} alt={`${item.name} logo`} className="w-8 h-8 rounded-full bg-slate-700" /> :
                                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-purple-400 font-bold text-sm flex-shrink-0">{item.name?.[0] || '?'}</div>
                                      }
                                      <div className="overflow-hidden flex-1">
                                        <div className="font-semibold text-white truncate">{item.name} {item.symbol && `(${item.symbol})`}</div>
                                        <div className="text-xs text-slate-400 capitalize">{item.type}</div>
                                        <div className="text-xs text-slate-500 font-mono truncate">{item.address}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                     <button
                             onClick={() => {
                               setShowHeaderSearch(false);
                               setShowSearchResults(false);
                               setContractAddress('');
                               setSearchQuery('');
                             }}
                             className="text-slate-400 hover:text-white transition-colors"
                             title="Close search"
                           >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                             </svg>
                           </button>
                         </div>
                       ) : (
                         <button
                           onClick={() => setShowHeaderSearch(true)}
                       className="p-2 bg-slate-500 hover:bg-slate-600 rounded-lg transition-colors"
                           title="Search new token"
                         >
                           <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                           </svg>
                         </button>
                       )}
                     </div>
                     
                     {/* Mobile Search Button */}
                     <button
                       onClick={() => setShowSearchModal(true)}
                       className="md:hidden p-2 bg-slate-500 hover:bg-slate-600 rounded-lg transition-colors"
                       title="Search new token"
                     >
                       <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                       </svg>
                     </button>
                   </div>

                   {/* Simple shadcn/ui Tabs Component */}
                   <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col w-full">
                     {contractData && (
                     <TabsList className="grid w-full grid-cols-5 bg-black/20 backdrop-blur-xl border-b border-white/10">
                        <TabsTrigger value="code" className="text-xs text-white data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500">Code</TabsTrigger>
                        <TabsTrigger value="chat" className="text-xs text-white data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500">Chat</TabsTrigger>
                        <TabsTrigger value="info" className="text-xs text-white data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500">Info</TabsTrigger>
                      <TabsTrigger value="holders" className="text-xs text-white data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500">Holders</TabsTrigger>
                        <TabsTrigger value="liquidity" className="text-xs text-white data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500">Liquidity</TabsTrigger>
                      </TabsList>
                     )}
                     
                     
                     <TabsContent value="code" className="flex-1 overflow-y-auto px-4 py-4">
                       <SourceCodeTab
                         sourceCode={contractData.source_code}
                         readFunctions={abiReadFunctions}
                         writeFunctions={abiWriteFunctions}
                         isAnalyzingAI={isAnalyzingAI}
                       />
                     </TabsContent>

                     <TabsContent value="chat" className="flex-1 flex flex-col">
                       <div ref={chatContainerRef} className="flex-grow overflow-y-auto space-y-1 md:space-y-4 pb-20 md:pb-0 min-h-[400px] py-4">
                         {messages.length === 0 && (
                           <div className="text-center text-slate-400 h-full flex flex-col items-center justify-center gap-3 md:gap-4">
                             {isAnalyzingAI ? (
                               <>
                                 <LoaderThree />
                                 <p className="text-sm md:text-base">Analyzing contract functions with AI...</p>
                               </>
                             ) : (
                               <div className="w-full max-w-md px-3 md:px-0">
                                 <p className="mb-3 md:mb-4 text-sm md:text-base">Ask a question about the contract...</p>
                                 
                                 {/* Question Templates */}
                                 <div className="space-y-2">
                                   <p className="text-xs text-slate-500 mb-2 md:mb-3">Quick Questions:</p>
                                   {[
                                     "What does this contract do? What is its purpose in the context of the overall smart contract?",
                                     "Does this token have taxes, fees or similar?",
                                     "Does this contract interact with any proxy contracts?",
                                     "Is this contract unique?",
                                     "Rate the quality of this contract"
                                   ].map((question, index) => {
                                     const colorClasses = [
                                       "bg-pink-900/20 hover:bg-pink-800/30 border-pink-700/30 hover:border-pink-600/40",
                                       "bg-purple-900/20 hover:bg-purple-800/30 border-purple-700/30 hover:border-purple-600/40",
                                       "bg-blue-900/20 hover:bg-blue-800/30 border-blue-700/30 hover:border-blue-600/40",
                                       "bg-cyan-900/20 hover:bg-cyan-800/30 border-cyan-700/30 hover:border-cyan-600/40",
                                       "bg-red-900/20 hover:bg-red-800/30 border-red-700/30 hover:border-red-600/40"
                                     ];
                                     
                                     return (
                                       <button
                                         key={index}
                                         onClick={() => sendMessage(question)}
                                         className={`w-full text-left p-2 md:p-3 rounded-lg transition-all duration-200 text-xs md:text-sm text-slate-300 hover:text-white ${colorClasses[index]}`}
                                       >
                                         {question}
                                       </button>
                                     );
                                   })}
                                 </div>
                               </div>
                             )}
                           </div>
                         )}
                         {messages.map((msg) => (
                           <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} px-4`}>
                             <div className={`max-w-[95%] rounded-xl px-3 md:px-4 py-2 md:py-3 ${msg.sender === 'user' ? 'bg-purple-700 text-white' : 'bg-slate-700 backdrop-blur-sm text-slate-200 border border-slate-600/50'}`}>
                               {msg.sender === 'user' ? (
                                 <div className="text-white text-sm md:text-base">
                                   {msg.text}
                                 </div>
                               ) : (
                                 <div className="space-y-2">
                                  {msg.text === '...' ? (
                                    <LoaderThree />
                                  ) : (
                                    renderMessageText(msg.text)
                                   )}
                                 </div>
                               )}
                             </div>
                           </div>
                         ))}
                        {isLoadingChat && messages[messages.length - 1]?.sender === 'user' && (
                          <div className="flex justify-start px-4">
                            <div className="max-w-[95%] rounded-xl px-3 md:px-4 py-2 bg-slate-700 text-slate-200">
                              <LoaderThree />
                            </div>
                          </div>
                        )}
                       </div>
                       <form onSubmit={handleSendMessage} className="border-t border-white/10 flex items-center gap-2 md:gap-3 bg-black/20 backdrop-blur-xl flex-shrink-0 p-4">
                         <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask about the contract..." className="flex-grow bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg px-3 md:px-4 py-2 text-white placeholder-slate-300 focus:ring-2 focus:ring-purple-500 focus:outline-none transition text-sm md:text-base" disabled={isLoadingChat} />
                         <button type="submit" disabled={isLoadingChat || !chatInput.trim()} className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors" title="Send message"><SendIcon className="w-4 h-4 md:w-5 md:h-5"/></button>
                       </form>
                     </TabsContent>
                     
                     
                     <TabsContent value="info" className="flex-1 overflow-y-auto">
                       <div className="h-full bg-slate-900 w-full">
                         {/* Header Banner Image with Overlay Buttons */}
                         <div className="relative w-full -mt-px">
                           {dexScreenerData?.profile?.headerImageUrl && (
                             <div className="relative w-full overflow-hidden border-b-2 border-orange-500">
                               <img
                                 src={dexScreenerData.profile.headerImageUrl}
                                 alt="Token header"
                                 className="w-full h-auto object-cover"
                                 style={{ maxHeight: '500px', aspectRatio: '3/1' }}
                                 onError={(e) => {
                                   e.currentTarget.style.display = 'none';
                                 }}
                               />
                             </div>
                           )}
                           
                           {/* Social Links Row - Overlaying bottom of header */}
                           {dexScreenerData?.profile?.cmsLinks && dexScreenerData.profile.cmsLinks.length > 0 && (() => {
                             // Filter for Website, Twitter, and Telegram only
                             const websiteLink = dexScreenerData.profile.cmsLinks.find((link: any) => {
                               const urlLower = (link.url || '').toLowerCase();
                               const labelLower = (link.label || '').toLowerCase();
                               return !urlLower.includes('twitter.com') && !urlLower.includes('x.com') && 
                                      !urlLower.includes('t.me') && !labelLower.includes('telegram') &&
                                      !urlLower.includes('instagram.com') && !urlLower.includes('discord');
                             });
                             
                             const twitterLink = dexScreenerData.profile.cmsLinks.find((link: any) => {
                               const urlLower = (link.url || '').toLowerCase();
                               const labelLower = (link.label || '').toLowerCase();
                               return urlLower.includes('twitter.com') || urlLower.includes('x.com') || 
                                      labelLower.includes('twitter') || labelLower === 'x';
                             });
                             
                             const telegramLink = dexScreenerData.profile.cmsLinks.find((link: any) => {
                               const urlLower = (link.url || '').toLowerCase();
                               const labelLower = (link.label || '').toLowerCase();
                               return urlLower.includes('t.me') || labelLower.includes('telegram');
                             });
                             
                             const filteredLinks = [websiteLink, twitterLink, telegramLink].filter(Boolean);
                             
                             if (filteredLinks.length === 0) return null;
                             
                             return (
                               <div className="absolute bottom-0 left-0 right-0 transform translate-y-1/2 px-4 z-10">
                                 <div className="flex items-center justify-center gap-2">
                                   {/* Website Button */}
                                   {websiteLink && (
                                     <a
                                       href={websiteLink.url}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-md font-semibold leading-6 text-white inline-block"
                                       style={{ filter: 'drop-shadow(0 10px 4px rgba(0, 0, 0, 0.8))' }}
                                     >
                                       <span className="absolute inset-0 overflow-hidden rounded-full">
                                         <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                                       </span>
                                       <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10">
                                         <span>Website</span>
                                         <svg fill="none" height="16" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg">
                                           <path d="M10.75 8.75L14.25 12L10.75 15.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                                         </svg>
                                       </div>
                                       <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                                     </a>
                                   )}
                                   
                                   {/* Twitter Button */}
                                   {twitterLink && (
                                     <a
                                       href={twitterLink.url}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-md font-semibold leading-6 text-white inline-block"
                                       style={{ filter: 'drop-shadow(0 10px 4px rgba(0, 0, 0, 0.8))' }}
                                     >
                                       <span className="absolute inset-0 overflow-hidden rounded-full">
                                         <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                                       </span>
                                       <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10">
                                         <span>Twitter</span>
                                         <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                           <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                         </svg>
                                       </div>
                                       <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                                     </a>
                                   )}
                                   
                                   {/* Telegram Button */}
                                   {telegramLink && (
                                     <a
                                       href={telegramLink.url}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-md font-semibold leading-6 text-white inline-block"
                                       style={{ filter: 'drop-shadow(0 10px 4px rgba(0, 0, 0, 0.8))' }}
                                     >
                                       <span className="absolute inset-0 overflow-hidden rounded-full">
                                         <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                                       </span>
                                       <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10">
                                         <span>Telegram</span>
                                         <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                           <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                                         </svg>
                                       </div>
                                       <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                                     </a>
                                   )}
                                   
                                   {/* Smaller dropdown button */}
                                   {dexScreenerData.profile.cmsLinks.length > filteredLinks.length && (
                                     <button 
                                       onClick={() => {
                                         document.getElementById('description-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                       }}
                                       className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-md font-semibold leading-6 text-white inline-block"
                                       style={{ filter: 'drop-shadow(0 10px 4px rgba(0, 0, 0, 0.5))' }}
                                       title="View all links"
                                     >
                                       <span className="absolute inset-0 overflow-hidden rounded-full">
                                         <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                                       </span>
                                       <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-3 ring-1 ring-white/10">
                                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                         </svg>
                                       </div>
                                       <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                                     </button>
                                   )}
                                 </div>
                               </div>
                             );
                           })()}
                         </div>
                         
                        {/* Main Content */}
                        <div className="pt-8 px-4 pb-4">
                          {/* Action Buttons */}
                          <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 mb-4">
                            <div className="flex items-center justify-center gap-1 md:gap-2">
                              <button
                                onClick={() => {
                                  const tokenSymbol = dexScreenerData?.tokenInfo?.symbol || dexScreenerData?.pairs?.[0]?.baseToken?.symbol || '';
                                  window.open(`https://x.com/search?q=%23${encodeURIComponent(tokenSymbol)}`, '_blank');
                                }}
                                className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-md font-semibold leading-6 text-white inline-block"
                                style={{ filter: 'drop-shadow(0 10px 15px rgb(0, 0, 0))' }}
                              >
                                <span className="absolute inset-0 overflow-hidden rounded-full">
                                  <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                                </span>
                                <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10">
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                  </svg>
                                  <span>Search</span>
                                </div>
                                <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                              </button>
                              
                              <button
                                onClick={() => setActiveTab('liquidity')}
                                className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-md font-semibold leading-6 text-white inline-block"
                                style={{ filter: 'drop-shadow(0 10px 15px rgb(0, 0, 0))' }}
                              >
                                <span className="absolute inset-0 overflow-hidden rounded-full">
                                  <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                                </span>
                                <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10">
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                  <span className="hidden sm:inline">Other pairs</span>
                                  <span className="sm:hidden">Pairs</span>
                                </div>
                                <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                              </button>
                              
                              <button
                                onClick={() => setActiveTab('code')}
                                className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-md font-semibold leading-6 text-white inline-block"
                                style={{ filter: 'drop-shadow(0 10px 4px rgba(0, 0, 0, 0.8))' }}
                              >
                                <span className="absolute inset-0 overflow-hidden rounded-full">
                                  <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                                </span>
                                <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10">
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                  </svg>
                                  <span className="hidden sm:inline">View Code</span>
                                  <span className="sm:hidden">Code</span>
                                </div>
                                <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                              </button>
                            </div>
                            
                            <div className="flex items-center justify-center gap-1 mt-[5px] md:mt-0 mb-3 md:mb-0">
                              <StatefulButton
                                onClick={() => setActiveTab('chat')}
                                className="min-w-0 w-auto px-2 py-0.5 text-lg bg-orange-500 hover:ring-orange-500 opacity-100 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                                skipLoader={true}
                              >
                                Ask AI
                              </StatefulButton>
                              
                              <StatefulButton
                                onClick={() => {
                                  const tokenAddress = contractAddress || dexScreenerData?.pairs?.[0]?.baseToken?.address || '';
                                  window.open(`/admin-stats?address=${tokenAddress}`, '_blank');
                                }}
                                className="min-w-0 w-auto px-2 py-0.5 text-lg bg-orange-500 hover:ring-orange-500 opacity-100 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                                skipLoader={true}
                              >
                                API
                              </StatefulButton>
                            </div>
                          </div>
                          
                          {/* Divider - Mobile Only */}
                          <div className="md:hidden w-full h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent mb-4"></div>
                          
                          {/* Price Section */}
                          {dexScreenerData?.pairs?.[0] && (
                            <div className="grid grid-cols-3 gap-4 mb-4">
                             <BackgroundGradient
                               containerClassName="rounded-xl"
                               className="rounded-xl"
                               gradientClassName="bg-[radial-gradient(circle_farthest-side_at_0_100%,#1d4ed8,transparent),radial-gradient(circle_farthest-side_at_100%_0,#FA4616,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#ffffff33,transparent),radial-gradient(circle_farthest-side_at_0_0,#ffffff22,#0C2340)]"
                             >
                               <div className="p-2 rounded-xl bg-slate-800 border border-white/10 backdrop-blur-sm text-center">
                                 <div className="text-sm text-slate-200 uppercase mb-0.5">Price USD</div>
                                 <div className="text-md font-bold text-white">
                                   ${Number(dexScreenerData.pairs[0].priceUsd || 0).toFixed(6)}
                                 </div>
                               </div>
                             </BackgroundGradient>
                             <BackgroundGradient
                               containerClassName="rounded-xl"
                               className="rounded-xl"
                               gradientClassName="bg-[radial-gradient(circle_farthest-side_at_0_100%,#1d4ed8,transparent),radial-gradient(circle_farthest-side_at_100%_0,#FA4616,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#ffffff33,transparent),radial-gradient(circle_farthest-side_at_0_0,#ffffff22,#0C2340)]"
                             >
                               <div className="p-2 rounded-xl bg-slate-800 border border-white/10 backdrop-blur-sm text-center">
                                 <div className="text-sm text-slate-200 uppercase mb-0.5">Price WPLS</div>
                                 <div className="text-md font-bold text-white">
                                   {Math.round(Number(dexScreenerData.pairs[0].priceNative || 0))}
                                 </div>
                               </div>
                             </BackgroundGradient>
                             <BackgroundGradient
                               containerClassName="rounded-xl"
                               className="rounded-xl"
                               gradientClassName="bg-[radial-gradient(circle_farthest-side_at_0_100%,#1d4ed8,transparent),radial-gradient(circle_farthest-side_at_100%_0,#FA4616,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#ffffff33,transparent),radial-gradient(circle_farthest-side_at_0_0,#ffffff22,#0C2340)]"
                             >
                                <div className="p-2 rounded-xl bg-slate-800 border border-white/10 backdrop-blur-sm text-center">
                                  <div className="text-sm text-slate-200 uppercase mb-0.5">24h Volume</div>
                                  <div className="text-md font-bold text-white">
                                  ${Number(dexScreenerData.pairs[0].volume?.h24 || 0) >= 1000000 
                                      ? `${Math.round(Number(dexScreenerData.pairs[0].volume?.h24 || 0) / 1000000)}M`
                                      : Math.round(Number(dexScreenerData.pairs[0].volume?.h24 || 0)).toLocaleString()}
                                  </div>
                                </div>
                             </BackgroundGradient>
                           </div>
                          )}
                          
                          {/* Key Metrics */}
                           {dexScreenerData?.pairs?.[0] && (
                             <div className="grid grid-cols-3 gap-4 mb-4">
                              <BackgroundGradient
                                containerClassName="rounded-xl"
                                className="rounded-xl"
                                gradientClassName="bg-[radial-gradient(circle_farthest-side_at_0_100%,#1d4ed8,transparent),radial-gradient(circle_farthest-side_at_100%_0,#FA4616,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#ffffff33,transparent),radial-gradient(circle_farthest-side_at_0_0,#ffffff22,#0C2340)]"
                              >
                                 <div className="p-2 rounded-xl bg-slate-800 border border-white/10 backdrop-blur-sm text-center">
                                   <div className="text-sm text-slate-200 uppercase mb-0.5">Liquidity</div>
                                   <div className="text-md font-bold text-white">
                                   ${Number(dexScreenerData.pairs[0].liquidity?.usd || 0) >= 1000000 
                                       ? `${Math.round(Number(dexScreenerData.pairs[0].liquidity?.usd || 0) / 1000000)}M`
                                       : `${Math.round(Number(dexScreenerData.pairs[0].liquidity?.usd || 0) / 1000)}K`}
                                 </div>
                               </div>
                              </BackgroundGradient>
                              <BackgroundGradient
                                containerClassName="rounded-xl"
                                className="rounded-xl"
                                gradientClassName="bg-[radial-gradient(circle_farthest-side_at_0_100%,#1d4ed8,transparent),radial-gradient(circle_farthest-side_at_100%_0,#FA4616,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#ffffff33,transparent),radial-gradient(circle_farthest-side_at_0_0,#ffffff22,#0C2340)]"
                              >
                                <div className="p-2 rounded-xl bg-slate-800 border border-white/10 backdrop-blur-sm text-center">
                                  <div className="text-sm text-slate-200 uppercase mb-0.5">FDV</div>
                                  <div className="text-md font-bold text-white">
                                   ${Number(dexScreenerData.pairs[0].fdv || 0) >= 1000000 
                                      ? `${Math.round(Number(dexScreenerData.pairs[0].fdv || 0) / 1000000)}M`
                                      : `${Math.round(Number(dexScreenerData.pairs[0].fdv || 0) / 1000)}K`}
                                 </div>
                               </div>
                              </BackgroundGradient>
                              <BackgroundGradient
                                containerClassName="rounded-xl"
                                className="rounded-xl"
                                gradientClassName="bg-[radial-gradient(circle_farthest-side_at_0_100%,#1d4ed8,transparent),radial-gradient(circle_farthest-side_at_100%_0,#FA4616,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#ffffff33,transparent),radial-gradient(circle_farthest-side_at_0_0,#ffffff22,#0C2340)]"
                              >
                                <div className="p-2 rounded-xl bg-slate-800 border border-white/10 backdrop-blur-sm text-center">
                                  <div className="text-sm text-slate-200 uppercase mb-0.5">Mkt Cap</div>
                                  <div className="text-md font-bold text-white">
                                   ${Number((dexScreenerData.pairs[0] as any).marketCap || dexScreenerData.pairs[0].fdv || 0) >= 1000000 
                                      ? `${Math.round(Number((dexScreenerData.pairs[0] as any).marketCap || dexScreenerData.pairs[0].fdv || 0) / 1000000)}M`
                                      : `${Math.round(Number((dexScreenerData.pairs[0] as any).marketCap || dexScreenerData.pairs[0].fdv || 0) / 1000)}K`}
                                 </div>
                               </div>
                              </BackgroundGradient>
                             </div>
                           )}
                           
                           {/* Description Section */}
                           {dexScreenerData?.profile?.description && (
                             <div id="description-section" className="bg-slate-800/50 border border-slate-700 rounded pt-4 px-4 pb-6 mb-6 scroll-mt-4 bg-cover bg-center relative mt-[15px]" style={{ backgroundImage: 'url(/Mirage.jpg)' }}>
                               {/* Token Logo - Centered with Overflow */}
                               <div className="flex justify-center mb-4 pt-1 mt-1">
                                 {(dexScreenerData?.tokenInfo?.logoURI || dexScreenerData?.pairs?.[0]?.baseToken?.logoURI || dexScreenerData?.pairs?.[0]?.info?.imageUrl) ? (
                                   <img
                                     src={dexScreenerData?.tokenInfo?.logoURI || dexScreenerData?.pairs?.[0]?.baseToken?.logoURI || dexScreenerData?.pairs?.[0]?.info?.imageUrl}
                                     alt={`${dexScreenerData?.tokenInfo?.symbol} logo`}
                                     className="w-16 h-16 sm:w-20 sm:h-20"
                                     style={{ filter: 'drop-shadow(0 10px 4px rgba(0, 0, 0, 0.8))' }}
                                   />
                                 ) : (
                                   <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-purple-600 to-orange-600 flex items-center justify-center shadow-lg">
                                     <span className="text-2xl sm:text-3xl font-bold text-white">
                                       {dexScreenerData?.tokenInfo?.symbol?.[0] || '?'}
                                     </span>
                                   </div>
                                 )}
                               </div>
                               
                               {/* Token Title - Centered */}
                               <h2 className="text-2xl font-bold text-white text-center mb-6" style={{ textShadow: '0 10px 4px rgba(0, 0, 0, 0.8)' }}>
                                 {dexScreenerData?.tokenInfo?.name || 'Token Description'}
                               </h2>
                               
                               {/* All Social Links & Websites - Before Description */}
                               {dexScreenerData?.profile?.cmsLinks && dexScreenerData.profile.cmsLinks.length > 0 && (
                                 <div className="flex flex-wrap justify-center gap-2 mb-6">
                                   {dexScreenerData.profile.cmsLinks.map((link: any, index: number) => {
                                     const getSocialIcon = (url: string, label: string) => {
                                       const urlLower = url.toLowerCase();
                                       const labelLower = label.toLowerCase();
                                       
                                       if (urlLower.includes('twitter.com') || urlLower.includes('x.com') || labelLower.includes('twitter') || labelLower === 'x') {
                                         return (
                                           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                             <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                           </svg>
                                         );
                                       } else if (urlLower.includes('t.me') || labelLower.includes('telegram')) {
                                         return (
                                           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                             <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                                           </svg>
                                         );
                                       } else if (urlLower.includes('instagram.com') || labelLower.includes('instagram')) {
                                         return (
                                           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                             <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                           </svg>
                                         );
                                       } else {
                                         return (
                                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                                           </svg>
                                         );
                                       }
                                     };
                                     
                                     const getLinkLabel = (url: string, label: string) => {
                                       if (!label || label === 'Link') {
                                         const urlLower = url.toLowerCase();
                                         if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'Twitter';
                                         if (urlLower.includes('t.me')) return 'Telegram';
                                         if (urlLower.includes('instagram.com')) return 'Instagram';
                                         if (urlLower.includes('discord')) return 'Discord';
                                         return 'Website';
                                       }
                                       return label;
                                     };
                                     
                                     return (
                                       <a
                                         key={index}
                                         href={link.url}
                                         target="_blank"
                                         rel="noopener noreferrer"
                                         className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
                                         style={{ filter: 'drop-shadow(0 10px 4px rgba(0, 0, 0, 0.8))' }}
                                       >
                                         <span className="absolute inset-0 overflow-hidden rounded-full">
                                           <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                                         </span>
                                         <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10">
                                           {getSocialIcon(link.url || '', link.label || '')}
                                           <span>{getLinkLabel(link.url || '', link.label || '')}</span>
                                         </div>
                                         <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                                       </a>
                                     );
                                   })}
                                 </div>
                               )}
                               
                               {/* Description Text - Centered */}
                               <div className="text-sm text-slate-300 leading-relaxed text-center whitespace-pre-line">
                                 {dexScreenerData.profile.description}
                               </div>
                             </div>
                           )}
                           
                           {/* Price Chart */}
                           {dexScreenerData?.pairs?.[0] && (
                             <div className="mb-4">
                              <DexScreenerChart 
                                 pairAddress={dexScreenerData.pairs[0].pairAddress}
                               />
                             </div>
                           )}
                           
                           {/* Time Period Performance */}
                           {dexScreenerData?.pairs?.[0]?.priceChange && (
                             <div className="grid grid-cols-4 bg-slate-800/50 border border-slate-700 rounded overflow-hidden mb-0 bg-cover bg-center" style={{ backgroundImage: 'url(/Mirage.jpg)' }}>
                               <div className="p-3 text-center border-r border-slate-700">
                                 <div className="text-xs text-slate-400 uppercase mb-1">5M</div>
                                 <div className={`text-sm font-bold ${(dexScreenerData.pairs[0].priceChange.m5 || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                   {(dexScreenerData.pairs[0].priceChange.m5 || 0).toFixed(2)}%
                                 </div>
                               </div>
                               <div className="p-3 text-center border-r border-slate-700">
                                 <div className="text-xs text-slate-400 uppercase mb-1">1H</div>
                                 <div className={`text-sm font-bold ${(dexScreenerData.pairs[0].priceChange.h1 || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                   {(dexScreenerData.pairs[0].priceChange.h1 || 0).toFixed(2)}%
                                 </div>
                               </div>
                               <div className="p-3 text-center border-r border-slate-700">
                                 <div className="text-xs text-slate-400 uppercase mb-1">6H</div>
                                 <div className={`text-sm font-bold ${(dexScreenerData.pairs[0].priceChange.h6 || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                   {(dexScreenerData.pairs[0].priceChange.h6 || 0).toFixed(2)}%
                                 </div>
                               </div>
                               <div className="p-3 text-center">
                                 <div className="text-xs text-slate-400 uppercase mb-1">24H</div>
                                 <div className={`text-sm font-bold ${(dexScreenerData.pairs[0].priceChange.h24 || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                   {(dexScreenerData.pairs[0].priceChange.h24 || 0).toFixed(2)}%
                                 </div>
                               </div>
                             </div>
                           )}
                           
                           {/* Transaction, Volume, and Maker Stats - Two Column Layout */}
                           {dexScreenerData?.pairs?.[0]?.txns && dexScreenerData?.pairs?.[0]?.volume && (
                             <div className="bg-slate-800/50 border border-slate-700 rounded p-4 mb-4 bg-cover bg-center" style={{ backgroundImage: 'url(/Mirage.jpg)' }}>
                               <div className="grid gap-0" style={{ gridTemplateColumns: '1fr 3fr' }}>
                                 {/* Left Column - Labels and Totals */}
                                 <div className="space-y-5 pr-4">
                                   {/* TXNS */}
                                   <div>
                                     <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">TXNS</div>
                                     <div className="text-lg font-bold text-white">
                                       {(Number(dexScreenerData.pairs[0].txns.h24?.buys || 0) + Number(dexScreenerData.pairs[0].txns.h24?.sells || 0))}
                                     </div>
                                   </div>
                                   
                                   {/* VOLUME */}
                                   <div>
                                     <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">VOLUME</div>
                                     <div className="text-lg font-bold text-white">
                                       ${Number(dexScreenerData.pairs[0].volume.h24 || 0) >= 1000000 
                                         ? `${(Number(dexScreenerData.pairs[0].volume.h24 || 0) / 1000000).toFixed(2)}M`
                                         : Math.round(Number(dexScreenerData.pairs[0].volume.h24 || 0))}
                                     </div>
                                   </div>
                                   
                                   {/* MAKERS */}
                                   <div>
                                     <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">MAKERS</div>
                                     <div className="text-lg font-bold text-white">
                                       {(Number(dexScreenerData.pairs[0].txns.h24?.buys || 0) + Number(dexScreenerData.pairs[0].txns.h24?.sells || 0))}
                                     </div>
                                   </div>
                                 </div>
                                 
                                 {/* Vertical Divider */}
                                 <div className="relative">
                                   <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-700" />
                                   
                                   {/* Right Column - Buys/Sells with Progress Bars */}
                                   <div className="space-y-5 pl-4">
                                     {/* TXNS Buys/Sells */}
                                     <div>
                                       <div className="flex justify-between mb-2">
                                         <div className="text-center flex-1">
                                           <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">BUYS</div>
                                           <div className="text-lg font-bold text-white">
                                             {Number(dexScreenerData.pairs[0].txns.h24?.buys || 0)}
                                           </div>
                                         </div>
                                         <div className="text-center flex-1">
                                           <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">SELLS</div>
                                           <div className="text-lg font-bold text-white">
                                             {Number(dexScreenerData.pairs[0].txns.h24?.sells || 0)}
                                           </div>
                                         </div>
                                       </div>
                                       <div className="w-full h-2 bg-slate-700 rounded-sm overflow-hidden flex">
                                         <div 
                                           className="h-full bg-green-500"
                                           style={{ 
                                             width: `${(Number(dexScreenerData.pairs[0].txns.h24?.buys || 0) / (Number(dexScreenerData.pairs[0].txns.h24?.buys || 0) + Number(dexScreenerData.pairs[0].txns.h24?.sells || 1)) * 100)}%` 
                                           }}
                                         />
                                         <div className="h-full bg-red-500 flex-1" />
                                       </div>
                                     </div>
                                     
                                     {/* VOLUME Buys/Sells */}
                                     <div>
                                       <div className="flex justify-between mb-2">
                                         <div className="text-center flex-1">
                                           <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">BUY VOL</div>
                                           <div className="text-lg font-bold text-white">
                                             ${Number(dexScreenerData.pairs[0].volume.h24 || 0) * 0.55 >= 1000000 
                                               ? `${(Number(dexScreenerData.pairs[0].volume.h24 || 0) * 0.55 / 1000000).toFixed(0)}K`
                                               : Math.round(Number(dexScreenerData.pairs[0].volume.h24 || 0) * 0.55)}
                                           </div>
                                         </div>
                                         <div className="text-center flex-1">
                                           <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">SELL VOL</div>
                                           <div className="text-lg font-bold text-white">
                                             ${Number(dexScreenerData.pairs[0].volume.h24 || 0) * 0.45 >= 1000000 
                                               ? `${(Number(dexScreenerData.pairs[0].volume.h24 || 0) * 0.45 / 1000000).toFixed(0)}K`
                                               : Math.round(Number(dexScreenerData.pairs[0].volume.h24 || 0) * 0.45)}
                                           </div>
                                         </div>
                                       </div>
                                       <div className="w-full h-2 bg-slate-700 rounded-sm overflow-hidden flex">
                                         <div className="h-full bg-green-500" style={{ width: '55%' }} />
                                         <div className="h-full bg-red-500 flex-1" />
                                       </div>
                                     </div>
                                     
                                     {/* MAKERS Buys/Sells */}
                                     <div>
                                       <div className="flex justify-between mb-2">
                                         <div className="text-center flex-1">
                                           <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">BUYERS</div>
                                           <div className="text-lg font-bold text-white">
                                             {Number(dexScreenerData.pairs[0].txns.h24?.buys || 0)}
                                           </div>
                                         </div>
                                         <div className="text-center flex-1">
                                           <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">SELLERS</div>
                                           <div className="text-lg font-bold text-white">
                                             {Number(dexScreenerData.pairs[0].txns.h24?.sells || 0)}
                                           </div>
                                         </div>
                                       </div>
                                       <div className="w-full h-2 bg-slate-700 rounded-sm overflow-hidden flex">
                                         <div 
                                           className="h-full bg-green-500"
                                           style={{ 
                                             width: `${(Number(dexScreenerData.pairs[0].txns.h24?.buys || 0) / (Number(dexScreenerData.pairs[0].txns.h24?.buys || 0) + Number(dexScreenerData.pairs[0].txns.h24?.sells || 1)) * 100)}%` 
                                           }}
                                         />
                                         <div className="h-full bg-red-500 flex-1" />
                                       </div>
                                     </div>
                                   </div>
                                 </div>
                               </div>
                             </div>
                           )}
                           
                           {/* Action Buttons */}
                           <div className="flex items-center justify-center gap-2 mb-4">
                             <button
                               onClick={() => {
                                 const tokenSymbol = dexScreenerData?.tokenInfo?.symbol || dexScreenerData?.pairs?.[0]?.baseToken?.symbol || '';
                                 window.open(`https://x.com/search?q=%23${encodeURIComponent(tokenSymbol)}`, '_blank');
                               }}
                               className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
                               style={{ filter: 'drop-shadow(0 10px 15px rgb(0, 0, 0))' }}
                             >
                               <span className="absolute inset-0 overflow-hidden rounded-full">
                                 <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                               </span>
                               <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10">
                                 <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                   <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                 </svg>
                                 <span>Search</span>
                               </div>
                               <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                             </button>
                             
                             <button
                               onClick={() => setActiveTab('liquidity')}
                               className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
                               style={{ filter: 'drop-shadow(0 10px 15px rgb(0, 0, 0))' }}
                             >
                               <span className="absolute inset-0 overflow-hidden rounded-full">
                                 <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                               </span>
                               <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10">
                                 <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                 </svg>
                                 <span className="hidden sm:inline">Other pairs</span>
                                 <span className="sm:hidden">Pairs</span>
                               </div>
                               <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                             </button>
                             
                             <button
                               onClick={() => setActiveTab('code')}
                               className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
                               style={{ filter: 'drop-shadow(0 10px 4px rgba(0, 0, 0, 0.8))' }}
                             >
                               <span className="absolute inset-0 overflow-hidden rounded-full">
                                 <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                               </span>
                               <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10">
                                 <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                 </svg>
                                 <span className="hidden sm:inline">View Code</span>
                                 <span className="sm:hidden">Code</span>
                               </div>
                               <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                             </button>
                             
                             <button
                               onClick={() => setActiveTab('chat')}
                               className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
                               style={{ filter: 'drop-shadow(0 10px 4px rgba(0, 0, 0, 0.8))' }}
                             >
                               <span className="absolute inset-0 overflow-hidden rounded-full">
                                 <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                               </span>
                               <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10">
                                 <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                 </svg>
                                 <span>Ask AI</span>
                               </div>
                               <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                             </button>
                           </div>
                           
                           {/* Pair Details */}
                           {dexScreenerData?.pairs?.[0] && (
                             <div className="bg-slate-800/50 border border-slate-700 rounded p-4 relative bg-cover bg-center" style={{ backgroundImage: 'url(/Mirage.jpg)', marginBottom: '50px' }}>
                               <button
                                 onClick={() => setActiveTab('liquidity')}
                                 className="absolute top-4 right-4 px-3 py-1.5 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded transition-colors"
                               >
                                 Other Pairs
                               </button>
                              <h3 className="text-base font-semibold text-white mb-3 uppercase tracking-wider">Pair Information</h3>
                              <div className="space-y-2 text-base">
                                 <div className="flex justify-between py-2 border-b border-slate-700">
                                    <span className="text-slate-300">Pair created</span>
                                   <span className="text-white">
                                     {dexScreenerData.pairs[0].pairCreatedAt 
                                       ? (() => {
                                           const now = new Date();
                                           const created = new Date(dexScreenerData.pairs[0].pairCreatedAt);
                                           const diffTime = Math.abs(now.getTime() - created.getTime());
                                           const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));
                                           return `${diffMonths}mo ago`;
                                         })()
                                       : 'N/A'}
                                   </span>
                                 </div>
                                 
                                 {dexScreenerData.pairs[0].liquidity && (
                                   <>
                                     <div className="flex justify-between py-2 border-b border-slate-700">
                                      <span className="text-slate-300">Pooled {dexScreenerData.pairs[0].baseToken?.symbol}</span>
                                       <span className="text-white">
                                         {Number(dexScreenerData.pairs[0].liquidity.base || 0).toLocaleString()} 
                                        <span className="text-slate-400 ml-2">
                                           ${(Number(dexScreenerData.pairs[0].liquidity.base || 0) * Number(dexScreenerData.pairs[0].priceUsd || 0)).toLocaleString()}
                                         </span>
                                       </span>
                                     </div>
                                     
                                     <div className="flex justify-between py-2 border-b border-slate-700">
                                      <span className="text-slate-300">Pooled {dexScreenerData.pairs[0].quoteToken?.symbol}</span>
                                       <span className="text-white">
                                         {Number(dexScreenerData.pairs[0].liquidity.quote || 0).toLocaleString()}
                                        <span className="text-slate-400 ml-2">
                                           ${(Number(dexScreenerData.pairs[0].liquidity.usd || 0) / 2).toLocaleString()}
                                         </span>
                                       </span>
                                     </div>
                                   </>
                                 )}
                                 
                                 <div className="flex justify-between py-2 border-b border-slate-700">
                                    <span className="text-slate-300">Pair</span>
                                   <div className="flex items-center gap-2">
                                     <a
                                       href={`https://scan.pulsechain.box/token/${dexScreenerData.pairs[0].pairAddress}`}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300 font-mono text-sm transition-colors"
                                     >
                                       {dexScreenerData.pairs[0].pairAddress?.slice(0, 4)}...{dexScreenerData.pairs[0].pairAddress?.slice(-4)}
                                     </a>
                                     <StatefulButton
                                       onClick={() => navigator.clipboard.writeText(dexScreenerData.pairs[0].pairAddress || '')}
                                      className="min-w-[70px] px-2 py-1 text-sm bg-orange-500 hover:ring-orange-500 opacity-100"
                                       skipLoader={true}
                                     >
                                       Copy
                                     </StatefulButton>
                                   </div>
                                 </div>
                                 
                                 <div className="flex justify-between py-2 border-b border-slate-700">
                                    <span className="text-slate-300">{dexScreenerData.pairs[0].baseToken?.symbol}</span>
                                   <div className="flex items-center gap-2">
                                     <a
                                       href={`https://scan.pulsechain.box/token/${dexScreenerData.pairs[0].baseToken?.address}`}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300 font-mono text-sm transition-colors"
                                     >
                                       {dexScreenerData.pairs[0].baseToken?.address?.slice(0, 4)}...{dexScreenerData.pairs[0].baseToken?.address?.slice(-4)}
                                     </a>
                                     <StatefulButton
                                       onClick={() => navigator.clipboard.writeText(dexScreenerData.pairs[0].baseToken?.address || '')}
                                      className="min-w-[70px] px-2 py-1 text-sm bg-orange-500 hover:ring-orange-500 opacity-100"
                                       skipLoader={true}
                                     >
                                       Copy
                                     </StatefulButton>
                                   </div>
                                 </div>
                                 
                                 <div className="flex justify-between py-2">
                                    <span className="text-slate-300">{dexScreenerData.pairs[0].quoteToken?.symbol}</span>
                                   <div className="flex items-center gap-2">
                                     <a
                                       href={`https://scan.pulsechain.box/token/${dexScreenerData.pairs[0].quoteToken?.address}`}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300 font-mono text-sm transition-colors"
                                     >
                                       {dexScreenerData.pairs[0].quoteToken?.address?.slice(0, 4)}...{dexScreenerData.pairs[0].quoteToken?.address?.slice(-4)}
                                     </a>
                                     <StatefulButton
                                       onClick={() => navigator.clipboard.writeText(dexScreenerData.pairs[0].quoteToken?.address || '')}
                                      className="min-w-[70px] px-2 py-1 text-sm bg-orange-500 hover:ring-orange-500 opacity-100"
                                       skipLoader={true}
                                     >
                                       Copy
                                     </StatefulButton>
                                   </div>
                                 </div>
                               </div>
                             </div>
                           )}
                           
                           {/* Token Amount Calculator */}
                           {dexScreenerData?.pairs?.[0] && (
                            <div className="mb-4">
                              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 bg-cover bg-center" style={{ backgroundImage: 'url(/Mirage.jpg)' }}>
                                {/* Token Amount Input */}
                                <div className="mb-3">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={tokenAmount}
                                      onChange={(e) => {
                                        const value = e.target.value.replace(/[^0-9.]/g, '');
                                        setTokenAmount(value);
                                      }}
                                      placeholder="1"
                                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 pr-20 text-white text-lg font-semibold focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">
                                      {dexScreenerData.pairs[0].baseToken?.symbol || 'TOKEN'}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-center mt-2">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                    </svg>
                                  </div>
                                </div>

                                {/* Calculated Value Display */}
                                <div className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 mb-3">
                                  <div className="text-2xl font-bold text-white flex items-center justify-between">
                                    {(() => {
                                      const amount = Number(tokenAmount) || 0;
                                      const priceUsd = Number(dexScreenerData.pairs[0].priceUsd || 0);
                                      const priceNative = Number(dexScreenerData.pairs[0].priceNative || 0);
                                      const totalUsd = amount * priceUsd;
                                      const totalWpls = amount * priceNative;
                                      
                                      if (calculatorCurrency === 'usd') {
                                        return (
                                          <>
                                            <span>$</span>
                                            <span className="flex-1 text-right">{totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                                          </>
                                        );
                                      } else {
                                        return (
                                          <>
                                            <span className="flex-1">{totalWpls.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                                            <span className="text-slate-400 text-lg ml-2">WPLS</span>
                                          </>
                                        );
                                      }
                                    })()}
                                  </div>
                                </div>

                                {/* Currency Toggle */}
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setCalculatorCurrency('usd')}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                                      calculatorCurrency === 'usd' 
                                        ? 'text-green-400' 
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {calculatorCurrency === 'usd' && (
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                    USD
                                  </button>
                                  <button
                                    onClick={() => setCalculatorCurrency('wpls')}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                                      calculatorCurrency === 'wpls' 
                                        ? 'text-green-400' 
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {calculatorCurrency === 'wpls' && (
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                    WPLS
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                         </div>
                       </div>
                     </TabsContent>
                      
                      {/* Holders Tab */}
                      <TabsContent value="holders" className="flex-1 overflow-y-auto px-4 py-4">
                        <HoldersTabContent 
                          contractAddress={contractAddress}
                          tokenInfo={tokenInfo}
                        />
                      </TabsContent>
                     
                     <TabsContent value="liquidity" className="flex-1 overflow-y-auto px-4 py-4">
                       <LiquidityTab 
                         dexScreenerData={dexScreenerData}
                         isLoading={isLoadingContract}
                       />
                     </TabsContent>
                   </Tabs>
                 </div>
            </div>
          </main>
        )}
      </div>
    </div>
    </>
  );
};

export default function AICodeReaderPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AppWithSearchParams />
    </Suspense>
  );
}
 
// Holders Tab Content (local to this page)
const HoldersTabContent: React.FC<{ contractAddress: string; tokenInfo: TokenInfo | null }>
  = ({ contractAddress, tokenInfo }) => {
  const [list, setList] = useState<Array<{ address: string; value: string; isContract?: boolean; isVerified?: boolean }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchTopHolders = async () => {
      if (!contractAddress) return;
      setLoading(true);
      try {
        const res = await pulsechainApiService.getTokenHolders(contractAddress, 1, 50);
        const resData: any = res;
        
        // Parse response structure
        let items: Array<{ address: string; value: string }> = [];
        const rawData = Array.isArray(resData) ? resData 
                      : resData.data && Array.isArray(resData.data) ? resData.data
                      : resData.items && Array.isArray(resData.items) ? resData.items
                      : [];
        
        items = rawData
          .map((h: any) => ({ 
            address: h.address?.hash || '', 
            value: h.value || '0' 
          }))
          .filter((item: any) => item.address && item.value);
        
        // Fetch contract info for top 10 holders (to avoid too many API calls)
        const top10Addresses = items.slice(0, 10).map(h => h.address);
        const contractChecks = await Promise.allSettled(
          top10Addresses.map(addr => pulsechainApiService.getAddressInfo(addr))
        );
        
        // Map contract info to holders
        const itemsWithContractInfo = items.map((item, idx) => {
          if (idx < 10) {
            const checkResult = contractChecks[idx];
            if (checkResult.status === 'fulfilled' && checkResult.value) {
              return {
                ...item,
                isContract: checkResult.value.is_contract,
                isVerified: checkResult.value.is_verified
              };
            }
          }
          return item;
        });
        
        if (!cancelled) setList(itemsWithContractInfo);
      } catch (error) {
        console.error('Error fetching holders:', error);
        if (!cancelled) setList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTopHolders();
    return () => { cancelled = true; };
  }, [contractAddress]);

  // Memoize constants
  const decimals = React.useMemo(() => 
    tokenInfo?.decimals ? Number(tokenInfo.decimals) : 18, 
    [tokenInfo?.decimals]
  );
  
  const totalSupply = React.useMemo(() => 
    tokenInfo?.total_supply ? Number(tokenInfo.total_supply) : 0, 
    [tokenInfo?.total_supply]
  );

  // Memoize formatting functions
  const percentOfSupply = useCallback((raw: string): number => {
    if (!totalSupply) return 0;
    const bal = Number(raw);
    if (!Number.isFinite(bal)) return 0;
    return (bal / totalSupply) * 100;
  }, [totalSupply]);

  const formatAmount = useCallback((raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return '0';
    const v = n / Math.pow(10, decimals);
    return v.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }, [decimals]);

  // Pre-calculate all row data to avoid recalculation on every render
  const processedList = React.useMemo(() => 
    list.map((h, idx) => ({
      ...h,
      index: idx + 1,
      formattedAddress: h.address ? `${h.address.slice(0, 10)}...${h.address.slice(-6)}` : 'Unknown Address',
      formattedBalance: formatAmount(h.value),
      percentage: percentOfSupply(h.value),
      isContract: h.isContract,
      isVerified: h.isVerified
    })),
    [list, formatAmount, percentOfSupply]
  );

  // Calculate contract vs wallet stats
  const contractCount = React.useMemo(() =>
    processedList.filter(h => h.isContract === true).length,
    [processedList]
  );

  const handleAddressClick = (address: string) => {
    setSelectedAddress(address);
    setShowAddressModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Top 50 Holders</h3>
          {contractCount > 0 && (
            <p className="text-xs text-slate-400 mt-1">
              {contractCount} contract{contractCount !== 1 ? 's' : ''} detected in top 10 (LP pools, contracts, etc.)
            </p>
          )}
        </div>
        {tokenInfo?.symbol && (
          <div className="text-slate-400 text-sm">Token: {tokenInfo.symbol}</div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoaderThree />
        </div>
      ) : processedList.length === 0 ? (
        <div className="text-center text-slate-400 py-12">No holders found</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/30">
              <tr className="text-left text-slate-300">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Address</th>
                <th className="px-4 py-2">Balance</th>
                <th className="px-4 py-2">% of Supply</th>
              </tr>
            </thead>
            <tbody>
              {processedList.map((holder) => (
                <tr key={holder.address || holder.index} className="border-t border-white/10 hover:bg-white/5">
                  <td className="px-4 py-2 text-slate-400">{holder.index}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddressClick(holder.address)}
                        className="font-mono text-purple-300 hover:text-purple-100 transition-colors cursor-pointer hover:underline"
                        title="Click to view address details"
                      >
                        {holder.formattedAddress}
                      </button>
                      {holder.isContract && (
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-300 font-medium" title="This address is a smart contract (likely LP or other contract)">
                            📄 Contract
                          </span>
                          {holder.isVerified && (
                            <span className="px-2 py-0.5 bg-green-600/20 border border-green-500/30 rounded text-xs text-green-300 font-medium" title="Verified contract">
                              ✓
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-white">{holder.formattedBalance} {tokenInfo?.symbol}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{holder.percentage.toFixed(4)}%</span>
                      <div className="flex-1 h-2 bg-white/10 rounded-full">
                        <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${Math.min(100, holder.percentage)}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Address Details Modal */}
      {selectedAddress && (
        <AddressDetailsModal
          isOpen={showAddressModal}
          onClose={() => {
            setShowAddressModal(false);
            setSelectedAddress(null);
          }}
          address={selectedAddress}
          tokenAddress={contractAddress}
          tokenSymbol={tokenInfo?.symbol || 'TOKEN'}
          tokenDecimals={tokenInfo?.decimals ? Number(tokenInfo.decimals) : 18}
        />
      )}
    </div>
  );
};
