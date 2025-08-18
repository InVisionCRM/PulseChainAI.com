'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";

import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { LoaderThree } from "@/components/ui/loader";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useMobileOptimization } from '@/lib/hooks/useMobileOptimization';
import { useApiKey } from '@/lib/hooks/useApiKey';
import LoadingSpinner from '@/components/icons/LoadingSpinner';
import SendIcon from '@/components/icons/SendIcon';
import PulseChainLogo from '@/components/icons/PulseChainLogo';
import ColourfulText from '@/components/ui/colourful-text';
import { HolderDistributionChart, TransactionFlowDiagram, CorrelationMatrix } from '@/components/charts';
import { pulsechainApi } from '@/services';
import type { SearchResultItem } from '@/types';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  data?: any;
  endpoints?: string[];
}

interface AnalysisData {
  tokenInfo?: any;
  holders?: any[];
  transfers?: any[];
  addressInfo?: any;
  transaction?: any;
  whaleMovements?: any;
  holderOverlap?: any;
  networkStats?: any;
  priceHistory?: any[];
}

interface ContextItem {
  id: string;
  address: string;
  name: string;
  symbol?: string;
  type: 'token' | 'address' | 'contract';
  icon_url?: string | null;
}

interface EndpointOption {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  method?: string;
  path?: string;
  isRealEndpoint?: boolean;
}

const endpointOptions: EndpointOption[] = [
  // Real API Endpoints from scan.csv
  {
    id: 'search',
    name: 'Search',
    description: 'Search for tokens, addresses, blocks, transactions',
    category: 'Discovery',
    icon: '🔍',
    color: 'from-blue-500 to-cyan-500',
    method: 'GET',
    path: '/search',
    isRealEndpoint: true
  },
  {
    id: 'token-info',
    name: 'Token Information',
    description: 'Get detailed token information and metadata',
    category: 'Tokens',
    icon: '🪙',
    color: 'from-yellow-500 to-orange-500',
    method: 'GET',
    path: '/tokens/{address_hash}',
    isRealEndpoint: true
  },
  {
    id: 'token-holders',
    name: 'Token Holders',
    description: 'Analyze token holder distribution and patterns',
    category: 'Tokens',
    icon: '👥',
    color: 'from-green-500 to-emerald-500',
    method: 'GET',
    path: '/tokens/{address_hash}/holders',
    isRealEndpoint: true
  },
  {
    id: 'token-transfers',
    name: 'Token Transfers',
    description: 'Track token transfer history and movements',
    category: 'Tokens',
    icon: '🔄',
    color: 'from-purple-500 to-pink-500',
    method: 'GET',
    path: '/tokens/{address_hash}/transfers',
    isRealEndpoint: true
  },
  {
    id: 'token-counters',
    name: 'Token Counters',
    description: 'Get token statistics and counters',
    category: 'Tokens',
    icon: '📊',
    color: 'from-indigo-500 to-blue-500',
    method: 'GET',
    path: '/tokens/{address_hash}/counters',
    isRealEndpoint: true
  },
  {
    id: 'address-info',
    name: 'Address Information',
    description: 'Get comprehensive address details and balances',
    category: 'Addresses',
    icon: '📍',
    color: 'from-indigo-500 to-blue-500',
    method: 'GET',
    path: '/addresses/{address_hash}',
    isRealEndpoint: true
  },
  {
    id: 'address-transactions',
    name: 'Address Transactions',
    description: 'View transaction history for specific addresses',
    category: 'Addresses',
    icon: '📋',
    color: 'from-teal-500 to-cyan-500',
    method: 'GET',
    path: '/addresses/{address_hash}/transactions',
    isRealEndpoint: true
  },
  {
    id: 'address-token-balances',
    name: 'Token Balances',
    description: 'Check token balances for addresses',
    category: 'Addresses',
    icon: '💰',
    color: 'from-amber-500 to-yellow-500',
    method: 'GET',
    path: '/addresses/{address_hash}/token-balances',
    isRealEndpoint: true
  },
  {
    id: 'address-token-transfers',
    name: 'Address Token Transfers',
    description: 'Get token transfers for specific addresses',
    category: 'Addresses',
    icon: '🔄',
    color: 'from-purple-500 to-pink-500',
    method: 'GET',
    path: '/addresses/{address_hash}/token-transfers',
    isRealEndpoint: true
  },
  {
    id: 'transaction-details',
    name: 'Transaction Details',
    description: 'Get detailed transaction information and logs',
    category: 'Transactions',
    icon: '📄',
    color: 'from-red-500 to-pink-500',
    method: 'GET',
    path: '/transactions/{transaction_hash}',
    isRealEndpoint: true
  },
  {
    id: 'transaction-token-transfers',
    name: 'Transaction Token Transfers',
    description: 'Get token transfers for specific transactions',
    category: 'Transactions',
    icon: '🔄',
    color: 'from-purple-500 to-pink-500',
    method: 'GET',
    path: '/transactions/{transaction_hash}/token-transfers',
    isRealEndpoint: true
  },
  {
    id: 'block-info',
    name: 'Block Information',
    description: 'Analyze block data and gas usage',
    category: 'Blocks',
    icon: '🧱',
    color: 'from-gray-500 to-slate-500',
    method: 'GET',
    path: '/blocks/{block_number_or_hash}',
    isRealEndpoint: true
  },
  {
    id: 'block-transactions',
    name: 'Block Transactions',
    description: 'Get transactions for specific blocks',
    category: 'Blocks',
    icon: '📋',
    color: 'from-teal-500 to-cyan-500',
    method: 'GET',
    path: '/blocks/{block_number_or_hash}/transactions',
    isRealEndpoint: true
  },
  {
    id: 'network-stats',
    name: 'Network Statistics',
    description: 'Get overall network statistics and metrics',
    category: 'Network',
    icon: '📊',
    color: 'from-violet-500 to-purple-500',
    method: 'GET',
    path: '/stats',
    isRealEndpoint: true
  },
  {
    id: 'market-charts',
    name: 'Market Charts',
    description: 'Access price and volume chart data',
    category: 'Market',
    icon: '📈',
    color: 'from-emerald-500 to-green-500',
    method: 'GET',
    path: '/stats/charts/market',
    isRealEndpoint: true
  },
  {
    id: 'transaction-charts',
    name: 'Transaction Charts',
    description: 'Get transaction chart data',
    category: 'Market',
    icon: '📈',
    color: 'from-emerald-500 to-green-500',
    method: 'GET',
    path: '/stats/charts/transactions',
    isRealEndpoint: true
  },
  {
    id: 'smart-contracts',
    name: 'Smart Contracts',
    description: 'Analyze smart contract details and interactions',
    category: 'Contracts',
    icon: '⚡',
    color: 'from-orange-500 to-red-500',
    method: 'GET',
    path: '/smart-contracts/{address_hash}',
    isRealEndpoint: true
  }
];

interface EndpointResponse {
  endpoint: string;
  method: string;
  path: string;
  status: 'loading' | 'success' | 'error';
  data?: any;
  error?: string;
  timestamp: string;
}

const BlockchainAnalyzer: React.FC = () => {
  const mobileConfig = useMobileOptimization();
  const { getApiKey } = useApiKey();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisData | null>(null);
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([]);
  const [showEndpointPicker, setShowEndpointPicker] = useState<boolean>(false);
  
  // Token/Address Adder State
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSearchDropdownVisible, setIsSearchDropdownVisible] = useState<boolean>(false);
  const [showContextAdder, setShowContextAdder] = useState<boolean>(false);
  
  // Endpoint Loading State
  const [endpointResponses, setEndpointResponses] = useState<EndpointResponse[]>([]);
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState<boolean>(false);
  const [showEndpointResponses, setShowEndpointResponses] = useState<boolean>(false);
  
  // Auto-loading state
  const [autoLoadedEndpoints, setAutoLoadedEndpoints] = useState<string[]>([]);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  
  // Progress tracking state
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [progressDetails, setProgressDetails] = useState<string>('');
  
  // Two-step analysis state
  const [analysisStep, setAnalysisStep] = useState<'plan' | 'execute' | null>(null);
  const [pendingPlan, setPendingPlan] = useState<any>(null);
  
  // @mention functionality
  const [mentionQuery, setMentionQuery] = useState<string>('');
  const [mentionResults, setMentionResults] = useState<SearchResultItem[]>([]);
  const [isMentionSearching, setIsMentionSearching] = useState<boolean>(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState<boolean>(false);
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState<number>(0);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  // Quick query templates
  const quickQueries = [
    "Compare HEX, WPLS, and PLSX holders",
    "Show transactions from last week",
    "Find addresses with >1000 HEX and >10000 WPLS",
    "Analyze whale movements in the last 24 hours",
    "Show me the top 10 HEX holders",
    "What's the correlation between HEX and WPLS?",
    "Find large transactions above $100K",
    "Analyze this address: 0x1234...abcd"
  ];

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await pulsechainApi.search(searchQuery);
        setSearchResults(results.data?.items || []);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // @mention search effect
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (mentionQuery.trim().length < 1) {
        setMentionResults([]);
        setIsMentionSearching(false);
        setShowMentionDropdown(false);
        return;
      }

      setIsMentionSearching(true);
      try {
        const results = await pulsechainApi.search(mentionQuery);
                        setMentionResults((results.data?.items || []).slice(0, 10)); // Limit to 10 results
        setShowMentionDropdown(true);
        setSelectedMentionIndex(0);
      } catch (error) {
        console.error('Mention search failed:', error);
        setMentionResults([]);
        setShowMentionDropdown(false);
      } finally {
        setIsMentionSearching(false);
      }
    }, 200); // Faster response for mentions

    return () => clearTimeout(timeoutId);
  }, [mentionQuery]);

  // Handle clicks outside of search to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchDropdownVisible(false);
      }
      if (mentionDropdownRef.current && !mentionDropdownRef.current.contains(event.target as Node)) {
        setShowMentionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleEndpoint = (endpointId: string) => {
    setSelectedEndpoints(prev => 
      prev.includes(endpointId) 
        ? prev.filter(id => id !== endpointId)
        : [...prev, endpointId]
    );
  };

  const selectAllEndpoints = () => {
    setSelectedEndpoints(endpointOptions.map(option => option.id));
  };

  const clearAllEndpoints = () => {
    setSelectedEndpoints([]);
  };

  const getEndpointDescription = () => {
    if (selectedEndpoints.length === 0) {
      return "No endpoints selected - AI will choose automatically";
    }
    if (selectedEndpoints.length === endpointOptions.length) {
      return "All endpoints selected";
    }
    return `${selectedEndpoints.length} endpoints selected`;
  };

  const handleSelectSearchResult = (item: SearchResultItem) => {
    const newContextItem: ContextItem = {
      id: `${item.address}-${Date.now()}`,
      address: item.address,
      name: item.name,
      symbol: item.symbol,
      type: item.type as 'token' | 'address' | 'contract',
      icon_url: item.icon_url
    };

    // Check if item already exists
    const exists = contextItems.some(existing => existing.address === item.address);
    if (!exists) {
      setContextItems(prev => [...prev, newContextItem]);
    }

    setSearchQuery('');
    setSearchResults([]);
    setIsSearchDropdownVisible(false);
  };

  const removeContextItem = (id: string) => {
    setContextItems(prev => prev.filter(item => item.id !== id));
  };

  const clearAllContextItems = () => {
    setContextItems([]);
  };

  const getContextDescription = () => {
    if (contextItems.length === 0) {
      return "No items in context";
    }
    const tokens = contextItems.filter(item => item.type === 'token').length;
    const addresses = contextItems.filter(item => item.type === 'address').length;
    const contracts = contextItems.filter(item => item.type === 'contract').length;
    
    const parts = [];
    if (tokens > 0) parts.push(`${tokens} token${tokens > 1 ? 's' : ''}`);
    if (addresses > 0) parts.push(`${addresses} address${addresses > 1 ? 'es' : ''}`);
    if (contracts > 0) parts.push(`${contracts} contract${contracts > 1 ? 's' : ''}`);
    
    return parts.join(', ');
  };

  // @mention functions
  const detectMention = (text: string, cursorPosition: number): { query: string; startIndex: number } | null => {
    const beforeCursor = text.slice(0, cursorPosition);
    const mentionMatch = beforeCursor.match(/@([a-zA-Z0-9]*)$/);
    
    if (mentionMatch) {
      return {
        query: mentionMatch[1],
        startIndex: mentionMatch.index!
      };
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;
    
    setInputValue(value);
    
    // Check for @mention
    const mention = detectMention(value, cursorPosition);
    if (mention) {
      setMentionQuery(mention.query);
      setMentionStartIndex(mention.startIndex);
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
    }
  };

  const handleMentionSelect = (item: SearchResultItem) => {
    if (mentionStartIndex === -1) return;
    
    const beforeMention = inputValue.slice(0, mentionStartIndex);
    const afterMention = inputValue.slice(mentionStartIndex + mentionQuery.length + 1); // +1 for @
    const newValue = `${beforeMention}@${item.symbol || item.name} (${item.address}) ${afterMention}`;
    
    setInputValue(newValue);
    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
    setSelectedMentionIndex(0);
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPosition = mentionStartIndex + (item.symbol || item.name).length + item.address.length + 4; // +4 for " () "
      inputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionDropdown && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < mentionResults.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : mentionResults.length - 1
        );
      } else if (e.key === 'Enter' && mentionResults.length > 0) {
        e.preventDefault();
        handleMentionSelect(mentionResults[selectedMentionIndex]);
      } else if (e.key === 'Escape') {
        setShowMentionDropdown(false);
        setMentionQuery('');
        setMentionStartIndex(-1);
      }
    }
  };

  // Progress tracking functions
  const updateProgress = (step: string, details?: string) => {
    setCurrentStep(step);
    if (details) {
      setProgressDetails(details);
    }
    setProgressSteps(prev => {
      const newSteps = [...prev, step];
      return newSteps;
    });
  };

  // Dynamic progress updates for more engaging experience
  const [dynamicProgress, setDynamicProgress] = useState<string>('');
  
  useEffect(() => {
    if (isLoading) {
      const progressMessages = [
        'Analyzing blockchain patterns...',
        'Processing token data...',
        'Calculating holder overlaps...',
        'Generating insights...',
        'Preparing analysis...',
        'Validating data integrity...',
        'Cross-referencing addresses...',
        'Computing statistics...',
        'Finalizing results...'
      ];
      
      let messageIndex = 0;
      const interval = setInterval(() => {
        setDynamicProgress(progressMessages[messageIndex % progressMessages.length]);
        messageIndex++;
      }, 2000);
      
      return () => clearInterval(interval);
    } else {
      setDynamicProgress('');
    }
  }, [isLoading]);

  const resetProgress = () => {
    setProgressSteps([]);
    setCurrentStep('');
    setProgressDetails('');
  };

  const loadEndpointData = async () => {
    if (contextItems.length === 0) {
      setError('No tokens or addresses in context. Please add some items first.');
      return;
    }

    setIsLoadingEndpoints(true);
    setEndpointResponses([]);
    setError(null);
    
    // Add progress tracking for manual endpoint loading
    updateProgress('🔧 Loading selected endpoints', `Fetching data for ${contextItems.length} items`);

    const newResponses: EndpointResponse[] = [];
    const baseUrl = 'https://api.scan.pulsechain.com/api/v2';

    for (const item of contextItems) {
      // Only call selected endpoints, or if none selected, call token-holders for tokens
      const endpointsToCall = selectedEndpoints.length > 0 
        ? endpointOptions.filter(option => selectedEndpoints.includes(option.id))
        : endpointOptions.filter(option => option.id === 'token-holders'); // Default to token-holders only

      for (const endpoint of endpointsToCall) {
        // Create unique identifier for this specific endpoint call
        const responseId = `${item.address}-${endpoint.id}`;
        
        const response: EndpointResponse = {
          endpoint: responseId,
          method: endpoint.method || 'GET',
          path: endpoint.path || '',
          status: 'loading',
          timestamp: new Date().toISOString()
        };

        newResponses.push(response);
        setEndpointResponses([...newResponses]);

        try {
          // Replace placeholders in path
          let url = `${baseUrl}${endpoint.path}`;
          url = url.replace('{address_hash}', item.address);
          url = url.replace('{transaction_hash}', item.address);
          url = url.replace('{block_number_or_hash}', item.address);


          const apiResponse = await fetch(url);
          const data = await apiResponse.json();

          // Update the response using the unique identifier
          const responseIndex = newResponses.findIndex(r => r.endpoint === responseId);
          if (responseIndex !== -1) {
            newResponses[responseIndex] = {
              ...response,
              status: apiResponse.ok ? 'success' : 'error',
              data: apiResponse.ok ? data : undefined,
              error: apiResponse.ok ? undefined : `HTTP ${apiResponse.status}: ${data.message || 'Unknown error'}`
            };
          }
        } catch (error) {
          // Update the response with error using the unique identifier
          const responseIndex = newResponses.findIndex(r => r.endpoint === responseId);
          if (responseIndex !== -1) {
            newResponses[responseIndex] = {
              ...response,
              status: 'error',
              error: (error as Error).message
            };
          }
        }

        setEndpointResponses([...newResponses]);
      }
    }

    setIsLoadingEndpoints(false);
    setShowEndpointResponses(true);
    
    // Update progress for completion
    updateProgress('✅ Endpoints loaded', `Successfully loaded ${newResponses.filter(r => r.status === 'success').length} endpoints`);
  };

  const executePlan = useCallback(async () => {
    if (!pendingPlan || isLoading) return;
    
    setIsLoading(true);
    setIsAutoLoading(true);
    setError(null);
    
    // Start progress tracking for execution
    updateProgress('🌐 Connecting to PulseChain API', 'Establishing connection to blockchain data sources');

    try {
      const userApiKey = getApiKey();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (userApiKey) {
        headers['x-user-api-key'] = userApiKey;
      }

      // Step 2: Execute the analysis
      updateProgress('🌐 Connecting to PulseChain API', 'Establishing connection to blockchain data sources');

      const executeResponse = await fetch('/api/blockchain-analysis', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: pendingPlan.query || '',
          contextItems: contextItems.length > 0 ? contextItems : undefined,
          history: messages.map(msg => ({
            role: msg.sender,
            content: msg.text
          })),
          step: 'execute'
        }),
      });

      updateProgress('📊 Fetching blockchain data', 'Retrieving token information, holders (with pagination), and transaction data');

      if (!executeResponse.ok) {
        throw new Error(`Analysis failed: ${executeResponse.status}`);
      }

      const result = await executeResponse.json();
      
      updateProgress('🤖 AI Analysis', 'Processing blockchain data and generating insights');
      
      // Show auto-loaded endpoints
      if (result.requiredEndpoints && result.requiredEndpoints.requiredEndpoints) {
        setAutoLoadedEndpoints(result.requiredEndpoints.requiredEndpoints);
      }
      
      const aiMessage: Message = {
        id: (Date.now() + 2).toString(),
        text: result.analysis || 'No analysis available',
        sender: 'ai',
        data: result.data,
        endpoints: result.endpoints
      };

      updateProgress('✅ Analysis Complete', 'Finalizing results and preparing response');
      
      setMessages(prev => [...prev, aiMessage]);
      setCurrentAnalysis(result.data);
      
      // Clear the pending plan
      setPendingPlan(null);
      setAnalysisStep(null);

    } catch (e) {
      const errorMessage = (e as Error).message;
      setError(errorMessage);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: `Error: ${errorMessage}`,
        sender: 'ai'
      }]);
    } finally {
      setIsLoading(false);
      setIsAutoLoading(false);
      // Keep the final progress step visible for a moment
      setTimeout(() => {
        resetProgress();
      }, 2000);
    }
  }, [pendingPlan, isLoading, messages, getApiKey, contextItems]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    // Check if user is confirming a pending plan
    const isConfirmingPlan = pendingPlan && (
      messageText.toLowerCase().includes('yes') ||
      messageText.toLowerCase().includes('proceed') ||
      messageText.toLowerCase().includes('execute') ||
      messageText.toLowerCase().includes('confirm') ||
      messageText.toLowerCase().includes('go ahead') ||
      messageText.toLowerCase().includes('ok') ||
      messageText.toLowerCase().includes('sure')
    );

    if (isConfirmingPlan) {
      // User is confirming the plan, execute it
      const userMessage: Message = { 
        id: Date.now().toString(), 
        text: messageText, 
        sender: 'user' 
      };
      
      setMessages(prev => [...prev, userMessage]);
      await executePlan();
      return;
    }

    // Reset progress tracking
    resetProgress();

    // Extract mentioned tokens from the message
    const mentionedTokens: ContextItem[] = [];
    const mentionRegex = /@([^()]+)\s*\(([^)]+)\)/g;
    let match;
    
    while ((match = mentionRegex.exec(messageText)) !== null) {
      const tokenName = match[1].trim();
      const address = match[2].trim();
      
      // Check if this token is already in context
      const existingItem = contextItems.find(item => item.address === address);
      if (!existingItem) {
        mentionedTokens.push({
          id: `mention-${Date.now()}-${Math.random()}`,
          address,
          name: tokenName,
          symbol: tokenName.split(' ')[0], // Use first word as symbol
          type: 'token'
        });
      }
    }

    // Add mentioned tokens to context
    const updatedContextItems = [...contextItems, ...mentionedTokens];
    if (mentionedTokens.length > 0) {
      setContextItems(updatedContextItems);
    }

    const userMessage: Message = { 
      id: Date.now().toString(), 
      text: messageText, 
      sender: 'user' 
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    setIsAutoLoading(true);

    // Start progress tracking
    updateProgress('🔍 Analyzing query', 'Extracting tokens and determining required data sources');
    
    // Add immediate progress update for testing
    setTimeout(() => {
      updateProgress('🌐 Connecting to PulseChain API', 'Establishing connection to blockchain data sources');
    }, 1000);

    try {
      const userApiKey = getApiKey();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (userApiKey) {
        headers['x-user-api-key'] = userApiKey;
      }

      // Update progress for API call
      updateProgress('🌐 Connecting to PulseChain API', 'Establishing connection to blockchain data sources');

      // Step 1: Get endpoint plan
      updateProgress('🔍 Analyzing query', 'Determining required API endpoints and data limits');

      const planResponse = await fetch('/api/blockchain-analysis', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: messageText,
          contextItems: updatedContextItems.length > 0 ? updatedContextItems : undefined,
          history: messages.map(msg => ({
            role: msg.sender,
            content: msg.text
          })),
          step: 'plan'
        }),
      });

      if (!planResponse.ok) {
        throw new Error(`Plan failed: ${planResponse.status}`);
      }

      const planResult = await planResponse.json();
      
      // Store the plan for user confirmation
      setPendingPlan({
        ...planResult,
        query: messageText
      });
      setAnalysisStep('plan');
      
      // Show the plan to the user
      const planMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: planResult.message || 'No plan message available',
        sender: 'ai',
        data: planResult.plan,
        endpoints: planResult.plan?.requiredEndpoints
      };

      setMessages(prev => [...prev, planMessage]);
      
      // Stop here and wait for user confirmation
      setIsLoading(false);
      setIsAutoLoading(false);
      resetProgress();
      return; // Exit early, don't auto-execute

      const executeResponse = await fetch('/api/blockchain-analysis', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: messageText,
          contextItems: updatedContextItems.length > 0 ? updatedContextItems : undefined,
          history: messages.map(msg => ({
            role: msg.sender,
            content: msg.text
          })),
          step: 'execute'
        }),
      });

      updateProgress('📊 Fetching blockchain data', 'Retrieving token information, holders (with pagination), and transaction data');

      if (!executeResponse.ok) {
        throw new Error(`Analysis failed: ${executeResponse.status}`);
      }

      const result = await executeResponse.json();
      
      updateProgress('🤖 AI Analysis', 'Processing blockchain data and generating insights');
      
      // Show auto-loaded endpoints
      if (result.requiredEndpoints && result.requiredEndpoints.requiredEndpoints) {
        setAutoLoadedEndpoints(result.requiredEndpoints.requiredEndpoints);
      }
      
      const aiMessage: Message = {
        id: (Date.now() + 2).toString(),
        text: result.analysis || 'No analysis available',
        sender: 'ai',
        data: result.data,
        endpoints: result.endpoints
      };

      updateProgress('✅ Analysis Complete', 'Finalizing results and preparing response');
      
      setMessages(prev => [...prev, aiMessage]);
      setCurrentAnalysis(result.data);

    } catch (e) {
      const errorMessage = (e as Error).message;
      setError(errorMessage);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: `Error: ${errorMessage}`,
        sender: 'ai'
      }]);
    } finally {
      setIsLoading(false);
      setIsAutoLoading(false);
      // Keep the final progress step visible for a moment
      setTimeout(() => {
        resetProgress();
      }, 2000);
    }
  }, [isLoading, messages, getApiKey, contextItems, pendingPlan]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    const messageText = inputValue;
    setInputValue('');
    await sendMessage(messageText);
  }, [inputValue, sendMessage]);

  const handleQuickQuery = useCallback((query: string) => {
    setInputValue(query);
    inputRef.current?.focus();
  }, []);

  const renderMessageText = (text: string) => {
    // Add null/undefined check for text parameter
    if (!text || typeof text !== 'string') {
      return <span className="text-slate-400">No message content</span>;
    }
    
    // Enhanced markdown parser
    const renderMarkdown = (content: string) => {
      // Add null/undefined check
      if (!content || typeof content !== 'string') {
        return <span className="text-slate-400">No content available</span>;
      }
      
      // Split by code blocks
      const codeBlockParts = content.split(/(```[\s\S]*?```)/g);
      
      return codeBlockParts.map((block, blockIndex) => {
        if (block.startsWith('```') && block.endsWith('```')) {
          // Handle code blocks
          const code = block.slice(3, -3);
          const languageMatch = code.match(/^[a-zA-Z]+\n/);
          const language = languageMatch ? languageMatch[0].trim().toLowerCase() : 'json';
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

  const renderDataCard = (data: any, endpoints: string[]) => {
    if (!data) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/30 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50 mt-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white">📊 Analysis Data</h4>
          <div className="text-xs text-slate-400">
            {endpoints.length} endpoints used
          </div>
        </div>

        {/* Enhanced Data Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {data.tokenInfo && (
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
              <div className="text-xs text-slate-400 mb-1">Token Info</div>
              <div className="font-semibold text-white">{data.tokenInfo.name}</div>
              <div className="text-xs text-slate-300">{data.tokenInfo.symbol}</div>
              <div className="text-xs text-slate-500">{data.tokenInfo.address}</div>
            </div>
          )}

          {data.holders && (
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
              <div className="text-xs text-slate-400 mb-1">Holders</div>
              <div className="text-lg font-bold text-purple-400">{data.holders.length}</div>
              <div className="text-xs text-slate-300">Total holders</div>
            </div>
          )}

          {data.whaleMovements && (
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
              <div className="text-xs text-slate-400 mb-1">Whale Activity</div>
              <div className="text-lg font-bold text-blue-400">{data.whaleMovements.whaleCount}</div>
              <div className="text-xs text-slate-300">Whales detected</div>
              <div className="text-xs text-slate-500">${data.whaleMovements.totalVolume} volume</div>
            </div>
          )}

          {data.holderOverlap && (
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
              <div className="text-xs text-slate-400 mb-1">Holder Overlap</div>
              <div className="text-lg font-bold text-green-400">{data.holderOverlap.overlapPercentage.toFixed(1)}%</div>
              <div className="text-xs text-slate-300">Overlap with WPLS</div>
            </div>
          )}

          {data.networkStats && (
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
              <div className="text-xs text-slate-400 mb-1">Network Stats</div>
              <div className="text-lg font-bold text-cyan-400">{data.networkStats.total_transactions.toLocaleString()}</div>
              <div className="text-xs text-slate-300">Total transactions</div>
            </div>
          )}

          {data.addressInfo && (
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
              <div className="text-xs text-slate-400 mb-1">Address</div>
              <div className="font-mono text-xs text-slate-300 break-all">{data.addressInfo.hash}</div>
              <div className="text-xs text-slate-500">{data.addressInfo.coin_balance} PPLS</div>
            </div>
          )}

          {/* Enhanced Data Types */}
          {data.multiTokenComparison && (
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
              <div className="text-xs text-slate-400 mb-1">Multi-Token Analysis</div>
              <div className="text-lg font-bold text-indigo-400">
                {Object.keys(data.multiTokenComparison).filter(key => key !== 'overlaps').length}
              </div>
              <div className="text-xs text-slate-300">Tokens compared</div>
            </div>
          )}

          {data.timeFilter && (
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
              <div className="text-xs text-slate-400 mb-1">Time Filter</div>
              <div className="text-lg font-bold text-orange-400">Last {data.timeFilter.days}</div>
              <div className="text-xs text-slate-300">Days analyzed</div>
            </div>
          )}

          {data.advancedSearch && (
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
              <div className="text-xs text-slate-400 mb-1">Advanced Search</div>
              <div className="text-lg font-bold text-pink-400">
                {Object.keys(data.advancedSearch).length}
              </div>
              <div className="text-xs text-slate-300">Criteria applied</div>
            </div>
          )}
        </div>

        {/* Data Visualizations */}
        <div className="space-y-6">
          {/* Holder Distribution Chart */}
          {data.holders && data.holders.length > 0 && (
            <HolderDistributionChart
              holders={data.holders}
              tokenSymbol={data.tokenInfo?.symbol || 'TOKEN'}
            />
          )}

          {/* Transaction Flow Diagram */}
          {data.transfers && data.transfers.length > 0 && (
            <TransactionFlowDiagram
              transfers={data.transfers}
              tokenSymbol={data.tokenInfo?.symbol || 'TOKEN'}
            />
          )}

          {/* Correlation Matrix for Multi-Token Analysis */}
          {data.multiTokenComparison && data.multiTokenComparison.overlaps && (
            <CorrelationMatrix
              tokens={Object.entries(data.multiTokenComparison)
                .filter(([key]) => key !== 'overlaps')
                .map(([symbol, data]: [string, any]) => ({
                  symbol,
                  address: data.address,
                  holders: data.holders || []
                }))}
            />
          )}
        </div>
      </motion.div>
    );
  };

    return (
    <div className="min-h-screen bg-black">
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
          
          {/* Header */}
          <header className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
            <a
              href="/"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-slate-700/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Back to Home</span>
            </a>
            
            <div className="flex flex-col items-center">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                🔍 <ColourfulText text="PulseChain" /> AI Analyst
              </h1>
              <p className="text-slate-400 text-sm md:text-base">Your comprehensive blockchain analysis assistant</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-slate-400">Live</span>
            </div>
          </header>

          {/* Endpoint Picker */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white">🔧 Data Sources</h3>
                <button
                  onClick={() => setShowEndpointPicker(!showEndpointPicker)}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {showEndpointPicker ? 'Hide' : 'Configure'}
                </button>
              </div>
              <div className="text-sm text-slate-400">
                {getEndpointDescription()}
              </div>
            </div>

            <AnimatePresence>
              {showEndpointPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 mb-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-white">Select Data Sources</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllEndpoints}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={clearAllEndpoints}
                        className="text-xs px-2 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
                      >
                        Clear All
                      </button>
                      <button
                        onClick={loadEndpointData}
                        disabled={isLoadingEndpoints || contextItems.length === 0}
                        className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded transition-colors"
                        title={contextItems.length === 0 ? 'Add tokens/addresses to context first' : 'Call selected endpoints for context items'}
                      >
                        {isLoadingEndpoints ? 'Loading...' : 'Load Data'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {endpointOptions.map((option) => {
                      const isSelected = selectedEndpoints.includes(option.id);
                      return (
                        <motion.button
                          key={option.id}
                          onClick={() => toggleEndpoint(option.id)}
                          className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                            isSelected
                              ? 'bg-gradient-to-br ' + option.color + ' border-transparent text-white'
                              : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{option.icon}</span>
                            <span className="font-medium text-sm">{option.name}</span>
                            {isSelected && (
                              <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div className="text-xs opacity-80">{option.description}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="text-xs opacity-60">{option.category}</div>
                            {option.isRealEndpoint && (
                              <div className="text-xs font-mono opacity-50">
                                {option.method} {option.path}
                              </div>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="mt-4 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <p className="text-xs text-slate-400">
                      <strong>Tip:</strong> Select specific endpoints to call, or leave empty to call only token-holders. Use "Load Data" to make actual API calls for items in your context.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Endpoint Responses Display */}
            {showEndpointResponses && endpointResponses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 mt-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-white">API Responses</h4>
                  <button
                    onClick={() => setShowEndpointResponses(false)}
                    className="text-xs px-2 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
                  >
                    Hide
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {endpointResponses.map((response, index) => {
                    // Extract token/address info from response ID
                    const [address, endpointId] = response.endpoint.split('-');
                    const contextItem = contextItems.find(item => item.address === address);
                    const endpointOption = endpointOptions.find(option => option.id === endpointId);
                    
                    return (
                      <div
                        key={index}
                        className="p-3 rounded-lg border border-slate-600/30 bg-slate-700/30"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-slate-600 px-2 py-1 rounded">
                              {response.method}
                            </span>
                            <span className="text-xs text-slate-300 font-mono">
                              {response.path}
                            </span>
                            {contextItem && (
                              <span className="text-xs bg-purple-600 px-2 py-1 rounded">
                                {contextItem.symbol || contextItem.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              response.status === 'loading' ? 'bg-yellow-600 text-yellow-100' :
                              response.status === 'success' ? 'bg-green-600 text-green-100' :
                              'bg-red-600 text-red-100'
                            }`}>
                              {response.status}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(response.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>

                        {response.status === 'loading' && (
                          <div className="flex items-center gap-2 text-slate-400">
                            <LoadingSpinner className="w-4 h-4" />
                            <span className="text-xs">Loading...</span>
                          </div>
                        )}

                        {response.status === 'success' && response.data && (
                          <div className="space-y-2">
                            <div className="text-xs text-slate-400">
                              Response Data:
                            </div>
                            <pre className="text-xs bg-slate-900 p-2 rounded border border-slate-600 overflow-x-auto max-h-32 overflow-y-auto">
                              {JSON.stringify(response.data, null, 2)}
                            </pre>
                          </div>
                        )}

                        {response.status === 'error' && response.error && (
                          <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-600/30">
                            Error: {response.error}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                  <p className="text-xs text-slate-400">
                    <strong>API Info:</strong> Real API calls to PulseChain scan endpoints. Data is fetched for tokens and addresses in your context.
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Context Adder */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white">📋 Analysis Context</h3>
                <button
                  onClick={() => setShowContextAdder(!showContextAdder)}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {showContextAdder ? 'Hide' : 'Add Items'}
                </button>
              </div>
              <div className="text-sm text-slate-400">
                {getContextDescription()}
              </div>
            </div>

            {/* Context Items Display */}
            {contextItems.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Context Items:</span>
                  <button
                    onClick={clearAllContextItems}
                    className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {contextItems.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg border border-slate-600/30"
                    >
                      <div className="flex items-center gap-2 flex-grow">
                        {item.icon_url ? (
                          <img src={item.icon_url} alt={item.name} className="w-4 h-4 rounded" />
                        ) : (
                          <div className="w-4 h-4 bg-slate-600 rounded flex items-center justify-center">
                            <span className="text-xs text-slate-400">
                              {item.type === 'token' ? '🪙' : item.type === 'address' ? '📍' : '⚡'}
                            </span>
                          </div>
                        )}
                        <div className="flex-grow min-w-0">
                          <div className="text-sm font-medium text-white truncate">{item.name}</div>
                          <div className="text-xs text-slate-400 truncate">{item.address}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeContextItem(item.id)}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {showContextAdder && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 mb-4"
                >
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-white mb-2">Add Tokens & Addresses</h4>
                    <p className="text-xs text-slate-400 mb-3">
                      Search for tokens, addresses, or contracts to include in your analysis context
                    </p>
                  </div>

                  <div className="relative" ref={searchContainerRef}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setIsSearchDropdownVisible(true)}
                      placeholder="Search for tokens, addresses, or contracts..."
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none transition text-sm"
                      autoComplete="off"
                    />
                    
                    {isSearchDropdownVisible && (isSearching || searchResults.length > 0) && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/90 backdrop-blur-sm border border-slate-600/50 rounded-lg shadow-xl z-10 max-h-80 overflow-y-auto">
                        {isSearching && (
                          <div className="p-3 text-slate-400 flex items-center gap-2">
                            <LoadingSpinner className="w-4 h-4" />
                            <span>Searching...</span>
                          </div>
                        )}
                        {!isSearching && searchResults.map(item => (
                          <div
                            key={item.address}
                            onClick={() => handleSelectSearchResult(item)}
                            className="flex items-center gap-3 p-3 hover:bg-slate-700 cursor-pointer transition-colors"
                          >
                            {item.icon_url ? (
                              <img src={item.icon_url} alt={item.name} className="w-6 h-6 rounded" />
                            ) : (
                              <div className="w-6 h-6 bg-slate-600 rounded flex items-center justify-center">
                                <span className="text-xs text-slate-400">
                                  {item.type === 'token' ? '🪙' : item.type === 'address' ? '📍' : '⚡'}
                                </span>
                              </div>
                            )}
                            <div className="flex-grow min-w-0">
                              <div className="text-sm font-medium text-white truncate">{item.name}</div>
                              <div className="text-xs text-slate-400 truncate">
                                {item.symbol && `${item.symbol} • `}{item.address}
                              </div>
                            </div>
                            <div className="text-xs text-slate-500 capitalize">{item.type}</div>
                          </div>
                        ))}
                        {!isSearching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
                          <div className="p-3 text-slate-400 text-sm">No results found</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <p className="text-xs text-slate-400">
                      <strong>Tip:</strong> Add multiple tokens and addresses to compare them in your analysis. The AI will use these items as context for more detailed insights.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6"
              role="alert"
            >
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </motion.div>
          )}

          {/* Main Chat Interface */}
          <div className="flex flex-col h-[70vh] md:min-h-[70vh] bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
            <GlowingEffect disabled={false} glow={true} />
            
            {/* Chat Messages */}
            <div 
              ref={chatContainerRef}
              className="flex-grow p-4 overflow-y-auto space-y-4"
            >
              {messages.length === 0 && (
                <div className="text-center text-slate-400 h-full flex flex-col items-center justify-center gap-6">
                  <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center">
                    <PulseChainLogo className="w-8 h-8 text-purple-400" />
                  </div>
                  
                                                <div className="max-w-md">
                                <h3 className="text-lg font-semibold text-white mb-2">Welcome to PulseChain AI Analyst</h3>
                                <p className="text-sm text-slate-400 mb-6">
                                  Ask me anything about PulseChain data. I can analyze tokens, addresses, transactions, and more.
                                </p>
                                
                                {/* New Features Highlight */}
                                <div className="bg-slate-700/30 rounded-lg p-3 mb-4 border border-slate-600/30">
                                  <h4 className="text-sm font-semibold text-white mb-2">✨ New Features</h4>
                                  <div className="space-y-1 text-xs text-slate-300">
                                    <div>• Multi-token comparison analysis</div>
                                    <div>• Time-based filtering (last week, month, etc.)</div>
                                    <div>• Advanced search with criteria (e.g., &gt;1000 HEX)</div>
                                    <div>• Interactive data visualizations</div>
                                  </div>
                                </div>
                    
                    {/* Quick Query Templates */}
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 mb-3">Quick Analysis Examples:</p>
                      {quickQueries.map((query, index) => (
                        <button
                          key={index}
                          onClick={() => handleQuickQuery(query)}
                          className="w-full text-left p-3 rounded-lg transition-all duration-200 text-sm text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 border border-slate-600/30 hover:border-slate-500/50"
                        >
                          {query}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] md:max-w-md lg:max-w-2xl rounded-xl px-4 py-3 ${
                    msg.sender === 'user' 
                      ? 'bg-purple-700 text-white' 
                      : 'bg-slate-700/80 backdrop-blur-sm text-slate-200 border border-slate-600/50'
                  }`}>
                    {msg.sender === 'user' ? (
                      <div className="text-white text-sm md:text-base">
                        {msg.text}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {renderMessageText(msg.text || '')}
                        {msg.data && msg.endpoints && renderDataCard(msg.data, msg.endpoints)}
                        
                        {/* Confirmation Button for Plan */}
                        {pendingPlan && msg.data?.plan && (
                          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-600/30">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-white">📋 Analysis Plan Ready</h4>
                              <div className="flex space-x-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={executePlan}
                                  disabled={isLoading}
                                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-600 disabled:to-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2"
                                >
                                  {isLoading ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      Executing...
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-lg">🚀</span>
                                      Execute Analysis
                                    </>
                                  )}
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setPendingPlan(null);
                                    setAnalysisStep(null);
                                  }}
                                  disabled={isLoading}
                                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-800 text-slate-300 rounded-lg font-medium transition-all duration-200"
                                >
                                  Cancel
                                </button>
                              </div>
                              
                                                              <div className="text-xs text-slate-400">
                                  <strong>Note:</strong> This will fetch real blockchain data and may take a few moments to complete.
                                  <br />
                                  <strong>Tip:</strong> You can also type "yes", "proceed", or "execute" to confirm.
                                </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] md:max-w-md lg:max-w-2xl rounded-xl px-4 py-3 bg-slate-700/90 backdrop-blur-sm text-slate-200 border border-slate-600/50 relative overflow-hidden">
                    {/* Animated Background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 animate-pulse"></div>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 animate-pulse"></div>
                    
                    {/* Progress Header with Animation */}
                    <div className="flex items-center gap-3 mb-4 relative z-10">
                      <div className="relative">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center animate-spin">
                          <div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center">
                            <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-pulse"></div>
                          </div>
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white flex items-center gap-2">
                          <span className="animate-bounce">🤖</span>
                          {isAutoLoading ? 'AI Analysis in Progress' : 'Blockchain Analysis'}
                          <span className="text-xs bg-purple-600 px-2 py-1 rounded-full animate-pulse">LIVE</span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <div className="flex space-x-1">
                            <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"></div>
                            <div className="w-1 h-1 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                          {currentStep || 'Initializing analysis...'}
                        </div>
                      </div>
                    </div>

                    {/* Current Step Details with Animation */}
                    {progressDetails && (
                      <div className="mb-4 p-3 bg-slate-800/50 rounded border border-slate-600/30 relative z-10 backdrop-blur-sm">
                        <div className="text-xs text-slate-300 font-medium mb-2 flex items-center gap-2">
                          <span className="animate-pulse">💭</span>
                          Current Action:
                          <div className="flex space-x-1 ml-auto">
                            <div className="w-1 h-1 bg-green-400 rounded-full animate-ping"></div>
                            <div className="w-1 h-1 bg-blue-400 rounded-full animate-ping" style={{animationDelay: '0.2s'}}></div>
                            <div className="w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{animationDelay: '0.4s'}}></div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 leading-relaxed">
                          {progressDetails}
                        </div>
                        {dynamicProgress && (
                          <div className="mt-2 text-xs text-purple-300 animate-pulse">
                            {dynamicProgress}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Animated Progress Steps */}
                    {progressSteps.length > 0 && (
                      <div className="space-y-3 mb-4 relative z-10">
                        <div className="text-xs text-slate-300 font-medium flex items-center gap-2">
                          <span className="animate-pulse">✅</span>
                          Completed Steps:
                          <span className="text-xs bg-green-600 px-2 py-1 rounded-full ml-auto animate-pulse">
                            {progressSteps.length}
                          </span>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {progressSteps.map((step, index) => (
                            <div 
                              key={index} 
                              className="flex items-center gap-3 text-xs p-2 bg-slate-800/30 rounded border border-slate-600/20 hover:border-slate-500/50 transition-all duration-300"
                              style={{
                                animationDelay: `${index * 0.1}s`,
                                animation: 'fadeInLeft 0.5s ease-out forwards'
                              }}
                            >
                              <div className="relative">
                                <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0 animate-pulse"></div>
                                <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                              </div>
                              <span className="text-slate-300 flex-1">{step}</span>
                              <span className="text-xs text-slate-500">✓</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Enhanced Progress Bar */}
                    <div className="relative z-10">
                                              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                          <span>Progress</span>
                          <span className="font-medium text-purple-400">
                            {Math.round((progressSteps.length / 5) * 100)}% ({progressSteps.length}/5)
                          </span>
                        </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 relative overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 h-2 rounded-full transition-all duration-700 ease-out relative"
                          style={{ 
                            width: `${Math.min((progressSteps.length / 5) * 100, 100)}%` 
                          }}
                        >
                          <div className="absolute inset-0 progress-shimmer"></div>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 animate-pulse"></div>
                      </div>
                      
                                              {/* Progress Indicators */}
                        <div className="flex justify-between mt-2">
                          {['Query', 'API', 'Data', 'AI', 'Complete'].map((stage, index) => (
                            <div 
                              key={stage}
                              className={`text-xs px-2 py-1 rounded-full transition-all duration-300 ${
                                index < progressSteps.length 
                                  ? 'bg-green-600 text-white animate-pulse' 
                                  : 'bg-slate-700 text-slate-400'
                              }`}
                            >
                              {stage}
                            </div>
                          ))}
                        </div>
                    </div>

                    {/* Floating Animation Elements */}
                    <div className="absolute top-2 right-2 w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
                    <div className="absolute bottom-2 left-2 w-1 h-1 bg-pink-400 rounded-full animate-bounce"></div>
                    <div className="absolute top-1/2 right-4 w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
              )}

              {/* Auto-loaded endpoints indicator */}
              {autoLoadedEndpoints.length > 0 && (
                <div className="flex justify-center my-4">
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-600/50 p-4">
                    <div className="text-center">
                      <h3 className="text-sm font-semibold text-white mb-2">🤖 AI Auto-Loaded Data Sources</h3>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {autoLoadedEndpoints.map((endpoint, index) => (
                          <span
                            key={index}
                            className="text-xs bg-purple-600 text-white px-2 py-1 rounded"
                          >
                            {endpoint}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        AI automatically determined and loaded these data sources for your query
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700/50 flex items-center gap-3 bg-slate-800/30 backdrop-blur-sm flex-shrink-0 relative">
              <input 
                ref={inputRef}
                type="text" 
                value={inputValue} 
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about tokens, addresses, transactions, whale movements... Use @ to mention tokens" 
                className="flex-grow bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none transition text-sm md:text-base" 
                disabled={isLoading} 
              />
              <button 
                type="submit" 
                disabled={isLoading || !inputValue.trim()} 
                className="bg-purple-600 text-white p-3 rounded-full hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
              >
                <SendIcon className="w-5 h-5"/>
              </button>

              {/* @mention dropdown */}
              {showMentionDropdown && mentionResults.length > 0 && (
                <div 
                  ref={mentionDropdownRef}
                  className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
                >
                  <div className="p-2">
                    <div className="text-xs text-slate-400 mb-2 px-2">Search results for "@{mentionQuery}"</div>
                    {mentionResults.map((item, index) => (
                      <button
                        key={item.address}
                        onClick={() => handleMentionSelect(item)}
                        className={`w-full text-left p-2 rounded transition-colors ${
                          index === selectedMentionIndex 
                            ? 'bg-purple-600 text-white' 
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center text-xs">
                            🪙
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {item.symbol || item.name}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {item.address}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>

                                {/* Quick Actions */}
                      <div className="mt-6">
                        <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
                          <span>Quick Actions:</span>
                          <button
                            onClick={() => handleQuickQuery("Compare HEX, WPLS, and PLSX holders")}
                            className="text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            🔍 Multi-Token
                          </button>
                          <button
                            onClick={() => handleQuickQuery("Find addresses with >1000 HEX and >10000 WPLS")}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            🎯 Advanced Search
                          </button>
                          <button
                            onClick={() => handleQuickQuery("Show transactions from last week")}
                            className="text-green-400 hover:text-green-300 transition-colors"
                          >
                            ⏰ Time Filter
                          </button>
                        </div>
                      </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BlockchainAnalyzer; 