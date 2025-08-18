'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
// import { motion } from "framer-motion"; // Temporarily disabled due to TypeScript issues

import { LoaderThree } from "@/components/ui/loader";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu";

import type { Message, ContractData, TokenInfo, AbiItem, ExplainedFunction, SearchResultItem, Transaction, TokenBalance, DexScreenerData } from '../../types';
import { fetchContract, fetchTokenInfo, search, fetchReadMethods, fetchCreatorTransactions, fetchAddressTokenBalances, fetchAddressInfo, fetchDexScreenerData } from '../../services/pulsechainService';
import { pulsechainApiService } from '../../services/pulsechainApiService';
import { useApiKey } from '../../lib/hooks/useApiKey';
import { useGemini } from '../../lib/hooks/useGemini';
import UnverifiedContractRisksModal from '@/components/UnverifiedContractRisksModal';
import { ContainerTextFlip } from '@/components/ui/container-text-flip';
import { WobbleCard } from '@/components/ui/wobble-card';
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';
import CreatorTab from '@/components/CreatorTab';
import SourceCodeTab from '@/components/SourceCodeTab';
import ApiResponseTab from '@/components/ApiResponseTab';
import LiquidityTab from '@/components/LiquidityTab';
import SendIcon from '@/components/icons/SendIcon';

// Note: API key is handled server-side in API routes

type TabId = 'creator' | 'code' | 'api' | 'chart' | 'chat' | 'info' | 'holders' | 'liquidity';







// Splash Screen Modal Component
const SplashModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 backdrop-blur-sm border border-slate-600/50 rounded-xl shadow-2xl max-w-md w-full p-6">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Before You Continue...</h2>
                    <p className="text-slate-400 text-sm">Important information about AI-powered contract analysis</p>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-xs font-bold">NEW</span>
                        </div>
                        <p className="text-slate-300 text-sm">AI Contract Analyzer is in Beta. It will undergo frequent improvements.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">You may need a valid <span className="text-blue-400 font-medium">Gemini API Key</span> to generate responses.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">We do not store your API key on our servers.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-yellow-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">AI analysis only supports <span className="text-blue-400 font-medium">Chat Completion</span> mode at the moment.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">Don&apos;t assume answers are correct or use them for security audits.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">Remember: the answers are generated by an AI, not by PulseChain.</p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                >
                    Understand and Continue
                </button>
            </div>
        </div>
    );
};

// Main App Component
const App: React.FC = () => {
  // State management
  const [contractAddress, setContractAddress] = useState<string>('0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'); // Default for demo
  const [contractData, setContractData] = useState<ContractData | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [dexScreenerData, setDexScreenerData] = useState<DexScreenerData | null>(null);
  const [explainedFunctions, setExplainedFunctions] = useState<ExplainedFunction[] | null>(null);
  
  // Creator Tab State
  const [creatorTransactions, setCreatorTransactions] = useState<Transaction[] | null>(null);
  const [creatorTokenBalance, setCreatorTokenBalance] = useState<TokenBalance | null>(null);

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
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [apiResponses, setApiResponses] = useState<Record<string, unknown>>({});
  
  // Missing state variables
  const [chatInput, setChatInput] = useState<string>('');
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [activeTabbedContent, setActiveTabbedContent] = useState<number>(0);
  const [isLoadingCreatorInfo, setIsLoadingCreatorInfo] = useState<boolean>(false);
  
  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { getApiKey } = useApiKey();
  const { analyzeContract } = useGemini();

  // Derived state
  const abiReadFunctions = contractData?.abi?.filter(item => item.type === 'function' && item.stateMutability === 'view') || [];
  const abiWriteFunctions = contractData?.abi?.filter(item => item.type === 'function' && item.stateMutability !== 'view') || [];

  // Splash screen state
  const [showSplash, setShowSplash] = useState<boolean>(true);
  
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
    if (!contractData || !getApiKey) return;

    setIsAnalyzingAI(true);
    try {
      const result = await analyzeContract(contractData.source_code, getApiKey());
      
      if (result.success && result.data) {
        const mergedFunctions = result.data.map((func: ExplainedFunctionFromAI) => ({
          name: func.name,
          explanation: func.explanation
        }));
        
        setExplainedFunctions(mergedFunctions);
      }
    } catch (e) {
      setError(`AI analysis failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
      console.error(e);
    } finally {
      setIsAnalyzingAI(false);
    }
  }, [contractData, getApiKey, analyzeContract]);
  
  // Handle contract loading
  const handleLoadContract = useCallback(async () => {
    if (!contractAddress) {
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
    setCreatorTransactions(null);
    setCreatorTokenBalance(null);
    setHolders(null);
    setApiResponses({});

    try {
      const [contractResult, tokenResult, dexResult] = await Promise.all([
        fetchContract(contractAddress),
        fetchTokenInfo(contractAddress),
        fetchDexScreenerData(contractAddress)
      ]);

      setContractData(contractResult.data);
      setTokenInfo(tokenResult.data);
      setDexScreenerData(dexResult.data);
      setApiResponses({
        contract: contractResult.data,
        token: tokenResult.data,
        dex: dexResult.data
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
      setShowSplash(false);
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

  // Fetch creator info when contract data is loaded
  useEffect(() => {
    if (!contractData || !contractAddress) return;

    const fetchCreatorData = async () => {
      // setIsLoadingCreatorInfo(true); // This line was removed
      try {
        const [transactionsResult, balanceResult] = await Promise.all([
          fetchCreatorTransactions(contractAddress),
          fetchAddressTokenBalances(contractAddress)
        ]);

        setCreatorTransactions(transactionsResult.data);
        setCreatorTokenBalance(balanceResult.data);
      } catch (e) {
        console.error("Could not fetch creator data:", e);
        setCreatorTransactions(null);
        setCreatorTokenBalance(null);
      } finally {
        // setIsLoadingCreatorInfo(false); // This line was removed
      }
    };

    fetchCreatorData();
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
    setAddressSet(true); // This triggers the auto-loading useEffect
  };

  const explainedReadFunctions = explainedFunctions?.filter(f => f.type === 'read') || [];
  const explainedWriteFunctions = explainedFunctions?.filter(f => f.type === 'write') || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black relative">
      {/* Futuristic Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_30%,rgba(120,119,198,0.05)_50%,transparent_70%)]"></div>
      
      <SplashModal isOpen={showSplash} onClose={() => setShowSplash(false)} />
      <UnverifiedContractRisksModal 
        isOpen={showUnverifiedRisksModal} 
        onClose={() => setShowUnverifiedRisksModal(false)} 
      />
      <div
        className="relative flex flex-col gap-4 items-center justify-start w-full min-h-screen max-w-none overflow-y-auto"
      >
        {/* ContainerTextFlip Demo - Top Half with Even Padding - Only on Initial Load */}
        {!contractData && !addressSet && (
          <div className="w-full flex items-center justify-center p-8 md:p-12 lg:p-16 min-h-[50vh]">
            <ContainerTextFlip />
          </div>
        )}

        {/* WobbleCard Demo Component - Temporarily disabled due to API mismatch */}
        {/* {!addressSet && (
          <WobbleCard>
            <div>Tutorial content would go here</div>
          </WobbleCard>
        )} */}

        {/* Navigation Menu - Fixed at top */}
        {!addressSet && (
          <NavigationMenu className="fixed top-0 left-0 right-0 z-30 bg-black/20 backdrop-blur-xl border-b border-white/10 h-16 md:h-18 w-full max-w-none shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <NavigationMenuList className="relative flex items-center w-full px-3 md:px-4 h-full gap-4">
            {/* Back Button - Left */}
            <NavigationMenuItem className="flex-shrink-0">
              <NavigationMenuLink
                href="/"
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-slate-700/30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm font-medium hidden sm:inline">Back to Home</span>
              </NavigationMenuLink>
            </NavigationMenuItem>

            {/* Spacer to push search to right */}
            <div className="flex-1" />

            {/* Right-aligned Search Bar with PlaceholdersAndVanishInput */}
            <NavigationMenuItem className="flex-shrink-0">
              <div className="relative w-60 lg:w-[32rem] xl:w-[40rem]" ref={searchInputRef}>
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
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto">
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
                        className="flex items-center gap-3 p-3 hover:bg-slate-700 cursor-pointer transition-colors"
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
                )}
              </div>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        )}

                <div className={`w-full max-w-none p-3 md:p-6 lg:p-8 pb-32 md:pb-16 ${addressSet ? 'pt-4' : 'pt-20 md:pt-24'} relative`}>

        {error && (
            <div className="bg-red-900/20 backdrop-blur-xl border border-red-500/30 text-red-200 px-4 py-3 rounded-xl relative mb-6 shadow-[0_8px_32px_rgba(239,68,68,0.2)]" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}



        </div>

        {isLoadingContract && (
            <div className="flex flex-col items-center justify-center text-center p-6 md:p-8 bg-black/20 backdrop-blur-xl rounded-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <LoaderThree className="w-8 h-8 md:w-10 md:h-8 text-purple-400" />
              <p className="mt-4 text-base md:text-lg font-semibold text-white">Loading contract data...</p>
              <p className="text-slate-300 text-sm md:text-base">Fetching from PulseChain Scan API.</p>
            </div>
        )}

        {contractData && (
          <main className={`flex flex-col ${addressSet ? 'h-full' : 'h-[calc(100vh-6rem)] pb-20 md:pb-0'} max-w-7xl mx-auto w-full px-4`}>
            <div className="flex flex-col h-full">
              <div className="relative flex-grow bg-black/20 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden h-full shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                   <GlowingEffect disabled={false} glow={true} />
                   
                   {/* Simple shadcn/ui Tabs Component */}
                   <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                     {contractData && (
                     <TabsList className="grid w-full grid-cols-8 bg-black/20 backdrop-blur-xl border-b border-white/10">
                         <TabsTrigger value="creator" className="text-xs text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-400">Creator</TabsTrigger>
                         <TabsTrigger value="code" className="text-xs text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-400">Source Code</TabsTrigger>
                         <TabsTrigger value="api" className="text-xs text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-400">API Response</TabsTrigger>
                         <TabsTrigger value="chart" className="text-xs text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-400">Chart</TabsTrigger>
                         <TabsTrigger value="chat" className="text-xs text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-400">Chat with AI</TabsTrigger>
                         <TabsTrigger value="info" className="text-xs text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-400">Info</TabsTrigger>
                       <TabsTrigger value="holders" className="text-xs text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-400">Holders</TabsTrigger>
                         <TabsTrigger value="liquidity" className="text-xs text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-400">Liquidity</TabsTrigger>
                       </TabsList>
                     )}
                     
                     <TabsContent value="creator" className="flex-1 overflow-y-auto p-4">
                       <CreatorTab
                         creatorAddress={contractData.creator_address_hash}
                         creationTxHash={contractData.creation_tx_hash}
                         tokenBalance={creatorTokenBalance}
                         transactions={creatorTransactions}
                         tokenInfo={tokenInfo}
                         isLoading={isLoadingCreatorInfo}
                       />
                     </TabsContent>
                     
                     <TabsContent value="code" className="flex-1 overflow-y-auto p-4">
                       <SourceCodeTab 
                         sourceCode={contractData.source_code} 
                         readFunctions={abiReadFunctions}
                         writeFunctions={abiWriteFunctions}
                         isAnalyzingAI={isAnalyzingAI}
                       />
                     </TabsContent>
                     
                     <TabsContent value="api" className="flex-1 overflow-y-auto p-4">
                       <ApiResponseTab responses={apiResponses} />
                     </TabsContent>
                     
                     <TabsContent value="chart" className="flex-1 overflow-y-auto min-h-[800px]">
                       {dexScreenerData && dexScreenerData.pairs.length > 0 ? (
                         <div className="h-full flex flex-col min-h-[800px]">
                           {/* Header */}
                           <div className="p-3 md:p-4 border-b border-white/10 bg-black/10 backdrop-blur-sm">
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2 md:gap-3">
                                 <div className="text-sm font-medium text-white">
                                   {dexScreenerData.pairs[0].baseToken.symbol}/{dexScreenerData.pairs[0].quoteToken.symbol}
                                 </div>
                                 <div className="text-xs text-slate-400">
                                   {dexScreenerData.pairs[0].dexId}
                                 </div>
                               </div>
                               <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm">
                                 <div className="text-slate-400">
                                   ${parseFloat(dexScreenerData.pairs[0].priceUsd || '0').toFixed(6)}
                                 </div>
                                 <div className={`font-medium ${(dexScreenerData.pairs[0].priceChange?.h24 || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                   {(dexScreenerData.pairs[0].priceChange?.h24 || 0) >= 0 ? '+' : ''}{(dexScreenerData.pairs[0].priceChange?.h24 || 0).toFixed(2)}%
                                 </div>
                                 <a 
                                   href={dexScreenerData.pairs[0].url} 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   className="text-blue-400 hover:text-blue-300"
                                 >
                                   Open Full Chart →
                                 </a>
                               </div>
                             </div>
                           </div>
                           
                           {/* Chart */}
                           <div className="flex-1 min-h-[700px]">
                             <iframe
                               src={`${dexScreenerData.pairs[0].url}?theme=dark`}
                               className="w-full h-full border-0"
                               title={`${dexScreenerData.pairs[0].baseToken.symbol}/${dexScreenerData.pairs[0].quoteToken.symbol} Chart`}
                               sandbox="allow-scripts allow-same-origin allow-forms"
                               style={{ minWidth: '100%', width: '100%', minHeight: '700px' }}
                             />
                           </div>
                           
                           {/* Stats */}
                           <div className="p-3 md:p-4 bg-black/20 backdrop-blur-xl border-t border-white/10">
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-xs md:text-sm">
                               <div>
                                 <div className="text-slate-400">Price WPLS</div>
                                 <div className="text-white font-medium">{parseFloat(dexScreenerData.pairs[0].priceNative || '0').toFixed(8)}</div>
                               </div>
                               <div>
                                 <div className="text-slate-400">24h Volume</div>
                                 <div className="text-white font-medium">${(dexScreenerData.pairs[0].volume?.h24 || 0).toLocaleString()}</div>
                               </div>
                               <div>
                                 <div className="text-slate-400">Liquidity USD</div>
                                 <div className="text-white font-medium">${(dexScreenerData.pairs[0].liquidity?.usd || 0).toLocaleString()}</div>
                               </div>
                               <div>
                                 <div className="text-slate-400">FDV</div>
                                 <div className="text-white font-medium">${(dexScreenerData.pairs[0].fdv || 0).toLocaleString()}</div>
                               </div>
                             </div>
                           </div>
                         </div>
                       ) : (
                         <div className="text-center text-slate-400 py-6 md:py-8">
                           <div className="text-base md:text-lg mb-2">No chart data available</div>
                           <div className="text-xs md:text-sm">DEXScreener data will appear here when available.</div>
                         </div>
                       )}
                     </TabsContent>
                     
                     <TabsContent value="chat" className="flex-1 flex flex-col p-4">
                       <div ref={chatContainerRef} className="flex-grow overflow-y-auto space-y-3 md:space-y-4 pb-20 md:pb-0">
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
                                     "How much control does owner hold if Owner is not the 0x Dead Address?",
                                     "Does this contract interact with any proxy contracts?",
                                     "Is this contract unique?",
                                     "Audit this code"
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
                           <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                             <div className={`max-w-[85%] md:max-w-md lg:max-w-2xl rounded-xl px-3 md:px-4 py-2 md:py-3 ${msg.sender === 'user' ? 'bg-purple-700 text-white' : 'bg-slate-700 backdrop-blur-sm text-slate-200 border border-slate-600/50'}`}>
                               {msg.sender === 'user' ? (
                                 <div className="text-white text-sm md:text-base">
                                   {msg.text}
                                 </div>
                               ) : (
                                 <div className="space-y-2">
                                   {msg.text === '...' ? (
                                     <LoaderThree className="w-4 h-4 md:w-5 md:h-5" />
                                   ) : (
                                     renderMessageText(msg.text)
                                   )}
                                 </div>
                               )}
                             </div>
                           </div>
                         ))}
                         {isLoadingChat && messages[messages.length - 1]?.sender === 'user' && (
                           <div className="flex justify-start">
                             <div className="max-w-[85%] md:max-w-md lg:max-w-lg rounded-xl px-3 md:px-4 py-2 bg-slate-700 text-slate-200">
                               <LoaderThree className="w-4 h-4 md:w-5 md:h-5" />
                             </div>
                           </div>
                         )}
                       </div>
                       <form onSubmit={handleSendMessage} className="border-t border-white/10 flex items-center gap-2 md:gap-3 bg-black/20 backdrop-blur-xl flex-shrink-0 p-4">
                         <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask about the contract..." className="flex-grow bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg px-3 md:px-4 py-2 text-white placeholder-slate-300 focus:ring-2 focus:ring-purple-500 focus:outline-none transition text-sm md:text-base" disabled={isLoadingChat} />
                         <button type="submit" disabled={isLoadingChat || !chatInput.trim()} className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors" title="Send message"><SendIcon className="w-4 h-4 md:w-5 md:h-5"/></button>
                       </form>
                     </TabsContent>
                     
                     
                     <TabsContent value="info" className="flex-1 overflow-y-auto p-4">
                       <div className="h-full flex items-center justify-center">
                         <div className="text-center">
                           <div className="text-4xl mb-4">🔍</div>
                           <p className="text-slate-400">Info tab removed</p>
                         </div>
                       </div>
                     </TabsContent>
                      
                      {/* Holders Tab */}
                      <TabsContent value="holders" className="flex-1 overflow-y-auto p-4">
                        <HoldersTabContent 
                          contractAddress={contractAddress}
                          tokenInfo={tokenInfo}
                        />
                      </TabsContent>
                     
                     <TabsContent value="liquidity" className="flex-1 overflow-y-auto p-4">
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

        {/* Mobile Sidebar - Floating Tabs Button */}
        <div className="md:hidden fixed bottom-16 right-4 z-50">
          {/* Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
            title="Toggle navigation menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Collapsible Sidebar */}
          {isSidebarOpen && (
            <div 
              className="absolute bottom-16 right-0 bg-black/20 backdrop-blur-xl border border-white/10 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-2 min-w-[200px]"
            >
              <div className="space-y-1">
                {[
                  { tabId: 'chat' as TabId, name: 'Chat with AI' },
                  { tabId: 'creator' as TabId, name: 'Creator' },
                  { tabId: 'code' as TabId, name: 'Source Code' },
                  { tabId: 'api' as TabId, name: 'API Response' },
                  { tabId: 'chart' as TabId, name: 'Chart' },
                  { tabId: 'info' as TabId, name: 'Info' },
                  { tabId: 'holders' as TabId, name: 'Holders' },
                  { tabId: 'liquidity' as TabId, name: 'Liquidity' }
                ].map(({ tabId, name }, index) => (
                  <button
                    key={tabId}
                    onClick={() => {
                      setActiveTab(tabId);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center px-3 py-2 rounded-md transition-all duration-200 text-left ${
                      activeTab === tabId
                        ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="text-sm font-medium">{name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Click outside to close sidebar */}
        {isSidebarOpen && (
          <div 
            className="md:hidden fixed inset-0 z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default App;
 
// Holders Tab Content (local to this page)
const HoldersTabContent: React.FC<{ contractAddress: string; tokenInfo: TokenInfo | null }>
  = ({ contractAddress, tokenInfo }) => {
  const [list, setList] = useState<Array<{ address: string; value: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchTopHolders = async () => {
      if (!contractAddress) return;
      setLoading(true);
      try {
        console.log('Fetching holders for:', contractAddress);
        
        // Debug: Show what endpoint we're calling
        console.log('Calling endpoint:', `/tokens/${contractAddress}/holders`);
        
        // Try the standard token holders endpoint first
        const res = await pulsechainApiService.getTokenHolders(contractAddress, 1, 50);
        console.log('Holders API response:', res);
        
        // Also try a direct fetch to see what's happening
        try {
          console.log('Trying direct fetch to debug...');
          const directResponse = await fetch(`/api/pulsechain-proxy?endpoint=/tokens/${contractAddress}/holders&page=1&limit=50`);
          console.log('Direct response status:', directResponse.status);
          if (directResponse.ok) {
            const directData = await directResponse.json();
            console.log('Direct response data:', directData);
          } else {
            const errorText = await directResponse.text();
            console.log('Direct response error:', errorText);
          }
        } catch (directError) {
          console.error('Direct fetch error:', directError);
        }
        
        // Check if the response has the expected structure
        let items: Array<{ address: string; value: string }> = [];
        
        if (Array.isArray(res)) {
          // Direct array response
          items = res.map((h: any) => ({ 
            address: h.address?.hash || '', 
            value: h.value || '0' 
          })).filter(item => item.address && item.value);
        } else if (res.data && Array.isArray(res.data)) {
          // Response with data array
          items = res.data.map((h: any) => ({ 
            address: h.address?.hash || '', 
            value: h.value || '0' 
          })).filter(item => item.address && item.value);
        } else if (res.items && Array.isArray(res.items)) {
          // Response with items array
          items = res.items.map((h: any) => ({ 
            address: h.address?.hash || '', 
            value: h.value || '0' 
          })).filter(item => item.address && item.value);
        }
        
        console.log('Processed items:', items);
        console.log('Sample item structure:', items[0]);
        
        if (!cancelled) setList(items);
      } catch (error) {
        console.error('Error fetching holders:', error);
        
        // Log the full error details
        if (error instanceof Error) {
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
        }
        
        // Try alternative approach - get token info first to see if it's a valid token
        try {
          console.log('Trying to get token info as fallback...');
          const tokenInfo = await pulsechainApiService.getTokenInfo(contractAddress);
          console.log('Token info:', tokenInfo);
          
          // Try to get token counters to see holder count
          try {
            const counters = await pulsechainApiService.getTokenCounters(contractAddress);
            console.log('Token counters:', counters);
          } catch (countersError) {
            console.error('Could not get token counters:', countersError);
          }
          
          if (tokenInfo.holders > 0) {
            console.log(`Token has ${tokenInfo.holders} holders, but couldn't fetch individual holder data`);
            // Set empty list but show the total count
            if (!cancelled) setList([]);
          } else {
            if (!cancelled) setList([]);
          }
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
          if (!cancelled) setList([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTopHolders();
    return () => { cancelled = true; };
  }, [contractAddress]);

  const decimals = tokenInfo?.decimals ? Number(tokenInfo.decimals) : 18;
  const totalSupply = tokenInfo?.total_supply ? Number(tokenInfo.total_supply) : 0;

  const percentOfSupply = (raw: string): number => {
    if (!totalSupply) return 0;
    const bal = Number(raw);
    if (!Number.isFinite(bal)) return 0;
    return (bal / totalSupply) * 100;
  };

  const formatAmount = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return '0';
    const v = n / Math.pow(10, decimals);
    return v.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Top 50 Holders</h3>
        {tokenInfo?.symbol && (
          <div className="text-slate-400 text-sm">Token: {tokenInfo.symbol}</div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoaderThree className="w-6 h-6" />
        </div>
      ) : list.length === 0 ? (
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
              {list.map((h, idx) => {
                const pct = percentOfSupply(h.value);
                return (
                  <tr key={h.address || idx} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2">
                      <code className="font-mono text-purple-300">
                        {h.address ? `${h.address.slice(0, 10)}...${h.address.slice(-6)}` : 'Unknown Address'}
                      </code>
                    </td>
                    <td className="px-4 py-2 text-white">{formatAmount(h.value)} {tokenInfo?.symbol}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{pct.toFixed(4)}%</span>
                        <div className="flex-1 h-2 bg-white/10 rounded-full">
                          <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};