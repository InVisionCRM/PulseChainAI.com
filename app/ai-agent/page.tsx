'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from "motion/react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { LoaderThree } from "@/components/ui/loader";
import { GlowingEffect } from "@/components/ui/glowing-effect";

import type { Message, ContractData, TokenInfo, AbiItem, ExplainedFunction, AbiItemInput, SearchResultItem, Transaction, TokenBalance, DexScreenerData } from '../../types';
import { fetchContract, fetchTokenInfo, search, fetchReadMethods, fetchCreatorTransactions, fetchAddressTokenBalances, fetchAddressInfo, fetchDexScreenerData } from '../../services/pulsechainService';
import LoadingSpinner from '@/components/icons/LoadingSpinner';
import SendIcon from '@/components/icons/SendIcon';
import PulseChainLogo from '@/components/icons/PulseChainLogo';
import TokenInfoCard from '@/components/TokenInfoCard';
import AbiFunctionsList from '@/components/AbiFunctionsList';
import CreatorTab from '@/components/CreatorTab';
import ApiResponseTab from '@/components/ApiResponseTab';
import SourceCodeTab from '@/components/SourceCodeTab';
import UnverifiedContractRisksModal from '@/components/UnverifiedContractRisksModal';
import ColourfulText from '@/components/ui/colourful-text';
import { useApiKey } from '../../lib/hooks/useApiKey';

// Note: API key is handled server-side in API routes

type TabId = 'creator' | 'code' | 'api' | 'chart' | 'chat';

const TabButton: React.FC<{ name: string; tabId: TabId; activeTab: string; onClick: (tabId: TabId) => void; }> = ({ name, tabId, activeTab, onClick }) => {
    const isActive = activeTab === tabId;
    return (
        <button
            onClick={() => onClick(tabId)}
            className={`px-2 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors focus:outline-none whitespace-nowrap ${isActive ? 'text-white bg-slate-700/50 border-b-2 border-purple-500' : 'text-slate-400 hover:text-white'}`}
        >
            {name}
        </button>
    );
};

// Tabbed Content Component
const TabbedContent: React.FC<{ tabs: { title: string; content: string }[]; renderMarkdown: (content: string) => React.ReactNode }> = ({ tabs, renderMarkdown }) => {
  const [activeTabbedContent, setActiveTabbedContent] = useState(0);

  return (
    <div className="my-4">
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
      <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-600/30">
        {renderMarkdown(tabs[activeTabbedContent].content)}
      </div>
    </div>
  );
};

// Splash Screen Modal Component
const SplashModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-slate-800/90 backdrop-blur-sm border border-slate-600/50 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
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
                        <p className="text-slate-300 text-sm">Don't assume answers are correct or use them for security audits.</p>
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
            </motion.div>
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
  
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Splash screen state
  const [showSplash, setShowSplash] = useState<boolean>(true);
  
  // Unverified contract risks modal state
  const [showUnverifiedRisksModal, setShowUnverifiedRisksModal] = useState<boolean>(false);
  
  // Track if address is set for glow effect
  const [addressSet, setAddressSet] = useState<boolean>(false);
  
  // Mobile search visibility state
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(true);
  
  // API key management
  const { getApiKey } = useApiKey();



  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Debounced search effect
  useEffect(() => {
    const query = contractAddress.trim();
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(query);

    if (query.length < 2 || isAddress) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handler = setTimeout(async () => {
      const results = await search(query);
      setSearchResults(results);
      setIsSearching(false);
    }, 300); // 300ms debounce

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
          (method: any) => method.name.toLowerCase() === 'owner' && method.inputs.length === 0
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

            const contractCreations = transactionsResult.data.filter((tx: any) => tx.is_contract_creation);
            setCreatorTransactions(contractCreations);

            const relevantBalance = balancesResult.data.find((b: any) => b.token.address.toLowerCase() === contractAddress.toLowerCase());
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
          const userApiKey = getApiKey();
          const headers: Record<string, string> = {
              'Content-Type': 'application/json',
          };
          
          if (userApiKey) {
              headers['x-user-api-key'] = userApiKey;
          }

          const response = await fetch('/api/analyze', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                  abi: functionsToExplain,
                  sourceCode: sourceCode
              }),
          });

          if (!response.ok) {
              throw new Error(`Analysis API error: ${response.status}`);
          }

          const result = await response.json();
          
          interface ExplainedFunctionFromAI {
            name: string;
            explanation: string;
          }

          const explained = result.functions as ExplainedFunctionFromAI[];
          
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
  }, [getApiKey]);


  const handleLoadContract = useCallback(async () => {
    if (!contractAddress) {
      setError('Please enter a contract address.');
      return;
    }
    setIsLoadingContract(true);
    setError(null);
    setAddressSet(false); // Reset glow effect when loading starts
    setContractData(null);
    setTokenInfo(null);
    setDexScreenerData(null);
    setExplainedFunctions(null);
    setOwnerAddress(null);
    setMessages([]);
    setCreatorTransactions(null);
    setCreatorTokenBalance(null);
    setApiResponses({});
    setActiveTab('chat');

    try {
      const [contractResult, tokenResult, addressInfoResult, dexScreenerResult] = await Promise.all([
        fetchContract(contractAddress),
        fetchTokenInfo(contractAddress),
        fetchAddressInfo(contractAddress),
        fetchDexScreenerData(contractAddress)
      ]);

      setApiResponses({
          contract: contractResult.raw,
          tokenInfo: tokenResult?.raw,
          addressInfo: addressInfoResult?.raw,
          dexScreener: dexScreenerResult?.raw
      });

      const finalContractData = contractResult.data;
      if (finalContractData && addressInfoResult?.data) {
          finalContractData.creator_address_hash = addressInfoResult.data.creator_address_hash;
          finalContractData.creation_tx_hash = addressInfoResult.data.creation_tx_hash;
      }
      
              setContractData(finalContractData);
      setTokenInfo(tokenResult?.data || null);
      setDexScreenerData(dexScreenerResult?.data || null);

      if (finalContractData?.abi && finalContractData?.source_code) {
        analyzeAndExplainAbi(finalContractData.abi, finalContractData.source_code);
      }

    } catch (e) {
      const errorMessage = (e as Error).message;
      setError(errorMessage);
      setContractData(null);
      setTokenInfo(null);
      
      // Check if it's a 500 error (server error) which often indicates unverified contract
      if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error') || errorMessage.includes('Server Error')) {
        setShowUnverifiedRisksModal(true);
      }
    } finally {
      setIsLoadingContract(false);
      
      // Collapse search on mobile after loading contract
      if (window.innerWidth < 768) {
        setIsSearchVisible(false);
      }
    }
  }, [contractAddress, analyzeAndExplainAbi]);

    const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoadingChat || !contractData) return;

    const userMessage: Message = { id: Date.now().toString(), text: messageText, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setIsLoadingChat(true);

    try {
      const userApiKey = getApiKey();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (userApiKey) {
        headers['x-user-api-key'] = userApiKey;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: messageText,
          history: messages,
          contract: {
            name: contractData.name,
            source_code: contractData.source_code
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const aiMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: aiMessageId, text: '...', sender: 'ai' }]);

      let aiResponseText = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        aiResponseText += chunk;
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, text: aiResponseText } : msg
        ));
      }

      if (aiResponseText.length === 0) {
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, text: "I'm sorry, I could not generate a response. Please try again." } : msg
        ));
      }

    } catch (e) {
      const errorMessage = (e as Error).message;
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: `Error: ${errorMessage}`, sender: 'ai' }]);
    } finally {
      setIsLoadingChat(false);
    }
  }, [isLoadingChat, contractData, messages, getApiKey]);

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
        
        return <TabbedContent key="tabbed-content" tabs={tabs} renderMarkdown={renderMarkdown} />;
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
    setSearchResults([]);
    setIsSearchDropdownVisible(false);
  };

  const readFunctions = explainedFunctions?.filter(f => f.type === 'read') || [];
  const writeFunctions = explainedFunctions?.filter(f => f.type === 'write') || [];

  return (
    <AuroraBackground className="min-h-screen">
      <SplashModal isOpen={showSplash} onClose={() => setShowSplash(false)} />
      <UnverifiedContractRisksModal 
        isOpen={showUnverifiedRisksModal} 
        onClose={() => setShowUnverifiedRisksModal(false)} 
      />
      <motion.div
        initial={{ opacity: 0.0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.8,
          ease: "easeInOut",
        }}
        className="relative flex flex-col gap-4 items-center justify-start px-4 w-full min-h-screen pt-20"
      >
        <div className="container mx-auto p-3 md:p-6 lg:p-8 max-w-7xl w-full pb-32 md:pb-16">
          
          <header className="flex items-center justify-between mb-4 md:mb-6 pb-3 md:pb-4 border-b border-slate-700">
            {/* Back to Home Button */}
            <a
              href="/"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-slate-700/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Back to Home</span>
            </a>
            
            {/* Centered Title */}
            <div className="flex flex-col items-center">
            </div>
            
            {/* Mobile Search Toggle Button */}
            <button
              onClick={() => setIsSearchVisible(!isSearchVisible)}
              className="md:hidden text-white hover:text-purple-400 transition-colors duration-200"
              title="Toggle Search"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </header>

        {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}




        {/* Search Section - Collapsible on Mobile */}
        <div className={`bg-slate-800/30 backdrop-blur-sm p-3 md:p-4 lg:p-6 rounded-xl shadow-lg border border-slate-700/50 mb-6 md:mb-8 transition-all duration-300 ${isSearchVisible ? 'block' : 'hidden md:block'}`}>
            <div className="flex flex-col gap-3 md:gap-4">
                <div className="flex flex-col gap-3 md:gap-4">
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
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 md:px-4 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none transition text-sm md:text-base"
                            disabled={isLoadingContract}
                            autoComplete="off"
                        />
                        {isSearchDropdownVisible && (isSearching || searchResults.length > 0) && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/90 backdrop-blur-sm border border-slate-600/50 rounded-lg shadow-xl z-10 max-h-80 overflow-y-auto">
                                {isSearching && <div className="p-3 text-slate-400 flex items-center gap-2"><LoadingSpinner className="w-4 h-4" /><span>Searching...</span></div>}
                                {!isSearching && searchResults.map(item => (
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
                    <button
                        onClick={handleLoadContract}
                        disabled={isLoadingContract || !contractAddress}
                        className={`w-full flex items-center justify-center gap-2 bg-transparent border border-white/30 text-white font-semibold px-4 md:px-6 py-2 md:py-3 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base hover:border-white/50 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] ${
                            addressSet && contractAddress ? 'shadow-[0_0_20px_rgba(255,255,255,0.2)] ring-2 ring-white/20' : ''
                        }`}
                        style={{
                            textShadow: "0 0 10px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.3)",
                            boxShadow: addressSet && contractAddress ? "0 0 20px rgba(255,255,255,0.2), inset 0 0 20px rgba(255,255,255,0.05)" : "inset 0 0 20px rgba(255,255,255,0.05)"
                        }}
                    >
                        {isLoadingContract ? <LoadingSpinner /> : 'Load Contract'}
                    </button>
                </div>
                
                {/* Quick Search Buttons */}
                <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                        {[
                            { ticker: 'WPLS', address: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27', color: 'purple' },
                            { ticker: 'HEX', address: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39', color: 'orange' },
                            { ticker: 'PLSX', address: '0x95B303987A60C71504D99Aa1b13B4DA07b0790ab', color: 'red' },
                            { ticker: 'INC', address: '0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d', color: 'green' }
                        ].map(({ ticker, address, color }) => (
                            <button
                                key={ticker}
                                onClick={() => {
                                    setContractAddress(address);
                                    setIsSearchDropdownVisible(false);
                                    setAddressSet(true);
                                }}
                                className={`px-2 py-1.5 md:px-3 md:py-2 bg-transparent text-${color}-400 text-xs md:text-sm font-medium rounded-md md:rounded-lg border border-${color}-500/50 hover:border-${color}-400/70 transition-all duration-200 hover:scale-105 shadow-[0_0_10px_rgba(var(--${color}-500-rgb),0.3)] hover:shadow-[0_0_15px_rgba(var(--${color}-500-rgb),0.5)]`}
                                style={{
                                    '--purple-500-rgb': '168, 85, 247',
                                    '--orange-500-rgb': '249, 115, 22',
                                    '--red-500-rgb': '239, 68, 68',
                                    '--green-500-rgb': '34, 197, 94'
                                } as React.CSSProperties}
                            >
                                {ticker}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
        
        {isLoadingContract && (
            <div className="flex flex-col items-center justify-center text-center p-6 md:p-8 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
              <LoadingSpinner className="w-8 h-8 md:w-10 md:h-10 text-purple-400" />
              <p className="mt-4 text-base md:text-lg font-semibold text-white">Loading contract data...</p>
              <p className="text-slate-400 text-sm md:text-base">Fetching from PulseChain Scan API.</p>
            </div>
        )}

        {contractData && (
          <main className={`grid grid-cols-1 gap-6 md:gap-8 ${activeTab === 'creator' ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
            {activeTab === 'creator' && (
              <div className="lg:col-span-1 space-y-6 md:space-y-8">
                 <div className="relative bg-slate-800/30 backdrop-blur-sm p-3 md:p-4 lg:p-6 rounded-xl shadow-lg border border-slate-700/50">
                 <GlowingEffect disabled={false} glow={true} />
                     <h3 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">{contractData.name}</h3>
                     <div className="space-y-2 text-sm">
                         <div className="flex justify-between items-center"><span className="text-slate-400">Verified</span><span className={`px-2 py-0.5 rounded-full text-xs ${contractData.is_verified ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'}`}>{contractData.is_verified ? 'Yes' : 'No'}</span></div>
                         <div className="flex justify-between items-center"><span className="text-slate-400">Compiler</span><span className="font-mono text-xs md:text-sm">{contractData.compiler_version}</span></div>
                         <div className="flex justify-between items-center"><span className="text-slate-400">Optimization</span><span className={`px-2 py-0.5 rounded-full text-xs ${contractData.optimization_enabled ? 'bg-green-800 text-green-200' : 'bg-yellow-800 text-yellow-200'}`}>{contractData.optimization_enabled ? 'Enabled' : 'Disabled'}</span></div>
                         <div className="flex justify-between items-center pt-1">
                             <span className="text-slate-400">Owner</span>
                             <div className="flex items-center gap-2">
                                 {isFetchingOwner && <LoadingSpinner className="w-4 h-4" />}
                                 {!isFetchingOwner && (
                                     ownerAddress ?
                                     <a href={`https://scan.pulsechain.com/address/${ownerAddress}`} target="_blank" rel="noopener noreferrer" title={ownerAddress} className="font-mono text-purple-400 hover:text-purple-300 transition-colors break-all text-right text-xs md:text-sm">
                                         {`${ownerAddress.substring(0, 6)}...${ownerAddress.substring(ownerAddress.length - 4)}`}
                                     </a>
                                     : <span className="text-slate-500 text-xs md:text-sm">Not Found</span>
                                 )}
                             </div>
                         </div>
                     </div>
                 <TokenInfoCard tokenInfo={tokenInfo} />
                 </div>
              </div>
            )}

            <div className={`flex flex-col h-[70vh] md:min-h-[70vh] pb-20 md:pb-0 ${activeTab === 'creator' ? 'lg:col-span-2' : 'lg:col-span-1'}`}>
                {/* Desktop Tabs */}
                <div className="hidden md:flex border-b border-slate-700" role="tablist" aria-label="Contract Details">
                    <TabButton name="Creator" tabId="creator" activeTab={activeTab} onClick={setActiveTab} />
                    <TabButton name="Source Code" tabId="code" activeTab={activeTab} onClick={setActiveTab} />
                    <TabButton name="API Response" tabId="api" activeTab={activeTab} onClick={setActiveTab} />
                    <TabButton name="Chart" tabId="chart" activeTab={activeTab} onClick={setActiveTab} />
                    <TabButton name="Chat with AI" tabId="chat" activeTab={activeTab} onClick={setActiveTab} />
                </div>
                
                <div className="relative flex-grow bg-slate-800/30 backdrop-blur-sm rounded-b-xl border border-t-0 border-slate-700/50 overflow-hidden h-full">
                  <GlowingEffect disabled={false} glow={true} />
                    <div role="tabpanel" hidden={activeTab !== 'creator'} className="h-full overflow-y-auto">
                        <CreatorTab
                            creatorAddress={contractData.creator_address_hash}
                            creationTxHash={contractData.creation_tx_hash}
                            tokenBalance={creatorTokenBalance}
                            transactions={creatorTransactions}
                            tokenInfo={tokenInfo}
                            isLoading={isLoadingCreatorInfo}
                        />
                    </div>

                    <div role="tabpanel" hidden={activeTab !== 'code'} className="h-full">
                       <SourceCodeTab 
                         sourceCode={contractData.source_code} 
                         readFunctions={readFunctions}
                         writeFunctions={writeFunctions}
                         isAnalyzingAI={isAnalyzingAI}
                       />
                    </div>

                    <div role="tabpanel" hidden={activeTab !== 'api'} className="h-full">
                       <ApiResponseTab responses={apiResponses} />
                    </div>
                    <div role="tabpanel" hidden={activeTab !== 'chart'} className="h-full overflow-y-auto">
                        {dexScreenerData ? (
                            <div className="space-y-4 md:space-y-6 p-3 md:p-4">
                                {/* Desktop Header - Hidden on Mobile */}
                                <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0">
                                    <h3 className="text-base md:text-lg font-semibold text-white">Top Trading Pair</h3>
                                    <div className="text-xs md:text-sm text-slate-400">
                                        {dexScreenerData.wplsPairs > 0 ? 'Showing top pair by liquidity' : 'No pairs found'} • {dexScreenerData.totalPairs} total pairs
                                    </div>
                                </div>
                                
                                {dexScreenerData.pairs.length > 0 ? (
                                    <div className="space-y-4 md:space-y-6">
                                        {dexScreenerData.pairs.map((pair, index) => (
                                            <div key={index} className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
                                                {/* Desktop Pair Header - Hidden on Mobile */}
                                                <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between p-3 md:p-4 border-b border-slate-700/50 gap-2 md:gap-0">
                                                    <div className="flex items-center gap-2 md:gap-3">
                                                        <div className="text-sm font-medium text-white">
                                                            {pair.baseToken.symbol}/{pair.quoteToken.symbol}
                                                        </div>
                                                        <div className="text-xs text-slate-400">
                                                            {pair.dexId}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-xs md:text-sm">
                                                        <div className="text-slate-400">
                                                            ${parseFloat(pair.priceUsd || '0').toFixed(6)}
                                                        </div>
                                                        <div className={`font-medium ${(pair.priceChange?.h24 || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {(pair.priceChange?.h24 || 0) >= 0 ? '+' : ''}{(pair.priceChange?.h24 || 0).toFixed(2)}%
                                                        </div>
                                                        <a 
                                                            href={pair.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-blue-400 hover:text-blue-300"
                                                        >
                                                            Open Full Chart →
                                                        </a>
                                                    </div>
                                                </div>
                                                
                                                <div className="w-full h-[calc(70vh-100px)] md:h-[calc(75vh-200px)]">
                                                    <iframe
                                                        src={`${pair.url}?theme=dark`}
                                                        className="w-full h-full border-0"
                                                        title={`${pair.baseToken.symbol}/${pair.quoteToken.symbol} Chart`}
                                                        sandbox="allow-scripts allow-same-origin allow-forms"
                                                        style={{ minWidth: '100%', width: '100%', minHeight: '100%' }}
                                                    />
                                                </div>
                                                
                                                {/* Desktop Stats - Hidden on Mobile */}
                                                <div className="hidden md:block p-3 md:p-4 bg-slate-900/30">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-xs md:text-sm">
                                                        <div>
                                                            <div className="text-slate-400">Price WPLS</div>
                                                            <div className="text-white font-medium">{parseFloat(pair.priceNative || '0').toFixed(8)}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-slate-400">24h Volume</div>
                                                            <div className="text-white font-medium">${(pair.volume?.h24 || 0).toLocaleString()}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-slate-400">Liquidity USD</div>
                                                            <div className="text-white font-medium">${(pair.liquidity?.usd || 0).toLocaleString()}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-slate-400">FDV</div>
                                                            <div className="text-white font-medium">${(pair.fdv || 0).toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 py-6 md:py-8">
                                        <div className="text-base md:text-lg mb-2">No trading pairs found</div>
                                        <div className="text-xs md:text-sm">This token may not have any active trading pairs on DEXScreener.</div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-slate-400 py-6 md:py-8">
                                <div className="text-base md:text-lg mb-2">No chart data available</div>
                                <div className="text-xs md:text-sm">DEXScreener data will appear here when available.</div>
                            </div>
                        )}
                    </div>
                    <div role="tabpanel" hidden={activeTab !== 'chat'} className="flex flex-col h-full">
                        <div ref={chatContainerRef} className="flex-grow p-3 md:p-4 overflow-y-auto space-y-3 md:space-y-4 pb-20 md:pb-0">
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
                                    <div className={`max-w-[85%] md:max-w-md lg:max-w-2xl rounded-xl px-3 md:px-4 py-2 md:py-3 ${msg.sender === 'user' ? 'bg-purple-700 text-white' : 'bg-slate-700/80 backdrop-blur-sm text-slate-200 border border-slate-600/50'}`}>
                                        {msg.sender === 'user' ? (
                                            <div className="text-white text-sm md:text-base">
                                                {msg.text}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {msg.text === '...' ? (
                                                    <LoadingSpinner className="w-4 h-4 md:w-5 md:h-5" />
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
                                        <LoadingSpinner className="w-4 h-4 md:w-5 md:h-5" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-slate-700/50 flex items-center gap-2 md:gap-3 bg-slate-800/30 backdrop-blur-sm flex-shrink-0">
                            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask about the contract..." className="flex-grow bg-slate-700 border border-slate-600 rounded-lg px-3 md:px-4 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none transition text-sm md:text-base" disabled={isLoadingChat} />
                            <button type="submit" disabled={isLoadingChat || !chatInput.trim()} className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"><SendIcon className="w-4 h-4 md:w-5 md:h-5"/></button>
                        </form>
                    </div>
                </div>
            </div>
          </main>
        )}

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700/50 z-40 pb-safe">
          <div className="flex justify-around items-center py-2">
            {[
              { tabId: 'creator' as TabId, name: 'Creator', icon: '👤' },
              { tabId: 'code' as TabId, name: 'Code', icon: '📄' },
              { tabId: 'api' as TabId, name: 'API', icon: '🔧' },
              { tabId: 'chart' as TabId, name: 'Chart', icon: '📊' },
              { tabId: 'chat' as TabId, name: 'Chat', icon: '💬' }
            ].map(({ tabId, name, icon }) => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`flex flex-col items-center justify-center py-2 px-1 min-w-0 flex-1 transition-all duration-200 ${
                  activeTab === tabId
                    ? 'text-purple-400 bg-purple-500/10 rounded-lg'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <span className="text-lg mb-1">{icon}</span>
                <span className="text-xs font-medium truncate">{name}</span>
              </button>
            ))}
          </div>
        </div>
        </div>
      </motion.div>
    </AuroraBackground>
  );
};

export default App;