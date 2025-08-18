"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { IconSearch, IconPlus, IconX, IconBrain, IconApi, IconCheck } from "@tabler/icons-react";
import { generateGeminiResponse } from "../lib/gemini";
import { pulsechainApi } from "../services";

interface ApiCallPlan {
  endpoint: string;
  description: string;
  required: boolean;
  parameters?: Record<string, any>;
}

interface SelectedAddress {
  address: string;
  name?: string;
  symbol?: string;
  type: 'token' | 'address';
}

export default function AIApiOrchestrator() {
  const [userQuestion, setUserQuestion] = useState("");
  const [selectedAddresses, setSelectedAddresses] = useState<SelectedAddress[]>([]);
  const [currentSearch, setCurrentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [apiPlan, setApiPlan] = useState<ApiCallPlan[]>([]);
  const [selectedApis, setSelectedApis] = useState<Set<string>>(new Set());
  const [apiResults, setApiResults] = useState<Record<string, any>>({});
  const [aiAnswer, setAiAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"input" | "plan" | "results">("input");

  // Debounced search
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const results = await pulsechainApi.search(query);
      setSearchResults(results.data?.items || []);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setCurrentSearch(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleAddAddress = () => {
    if (!currentSearch.trim() || selectedAddresses.length >= 5) return;
    
    // Find the selected result or use the search input as address
    const selectedResult = searchResults.find((result: any) => 
      result.address?.toLowerCase() === currentSearch.toLowerCase() ||
      result.name?.toLowerCase() === currentSearch.toLowerCase() ||
      result.symbol?.toLowerCase() === currentSearch.toLowerCase()
    );
    
    const newAddress: SelectedAddress = {
      address: selectedResult?.address || currentSearch,
      name: selectedResult?.name,
      symbol: selectedResult?.symbol,
       type: selectedResult?.token_type ? 'token' : 'address'
    };
    
    // Check if already selected
    if (selectedAddresses.some(addr => addr.address.toLowerCase() === newAddress.address.toLowerCase())) {
      return;
    }
    
    setSelectedAddresses(prev => [...prev, newAddress]);
    setCurrentSearch("");
    setSearchResults([]);
  };

  const handleRemoveAddress = (addressToRemove: string) => {
    setSelectedAddresses(prev => prev.filter(addr => addr.address !== addressToRemove));
  };

  const handleSelectSearchResult = (result: any) => {
    const newAddress: SelectedAddress = {
      address: result.address,
      name: result.name,
      symbol: result.symbol,
      type: result.token_type ? 'token' : 'address'
    };
    
    // Check if already selected
    if (selectedAddresses.some(addr => addr.address.toLowerCase() === newAddress.address.toLowerCase())) {
      return;
    }
    
    setSelectedAddresses(prev => [...prev, newAddress]);
    setCurrentSearch("");
    setSearchResults([]);
  };

  const handleSubmitQuestion = async () => {
    if (!userQuestion.trim() || selectedAddresses.length === 0) {
      setError("Please provide a question and select at least one address/token.");
      return;
    }

    setLoading(true);
    setError("");
    setStep("plan");

    try {
      const addressesInfo = selectedAddresses.map(addr => ({
        address: addr.address,
        name: addr.name || "Unknown",
        symbol: addr.symbol || "Unknown",
        type: addr.type
      }));

      const prompt = `You are an AI assistant that helps users analyze blockchain data. The user has selected these addresses/tokens:

${addressesInfo.map(addr => `- ${addr.name} (${addr.symbol}) - ${addr.address} (${addr.type})`).join('\n')}

User Question: "${userQuestion}"

Based on the user's question and the selected addresses, determine which API endpoints need to be called to gather the necessary data. 

Available API endpoints (from scan.pulsechain.com):
- GET /tokens/{address_hash} - Get token info
- GET /tokens/{address_hash}/holders - Get token holders
- GET /tokens/{address_hash}/counters - Get token counters
- GET /tokens/{address_hash}/transfers - Get token transfers
- GET /addresses/{address_hash} - Get address info
- GET /addresses/{address_hash}/counters - Get address counters
- GET /addresses/{address_hash}/transactions - Get address transactions
- GET /addresses/{address_hash}/token-transfers - Get address token transfers
- GET /addresses/{address_hash}/token-balances - Get address token balances
- GET /search - Search for addresses/tokens

Return a JSON array of API calls needed, with this exact format:
[
  {
    "endpoint": "endpoint_path",
    "description": "What this API call will provide",
    "required": true/false,
    "parameters": {"param_name": "value"}
  }
]

Only include endpoints that are actually needed to answer the user's question.`;

      const planResponse = await generateGeminiResponse(prompt);
      
      let plan: ApiCallPlan[] = [];
      try {
        // Remove code block markers and whitespace
        let cleaned = planResponse
          .replace(/```json|```/gi, '')
          .replace(/```/g, '')
          .trim();
        // Find the first [ and last ] to extract the JSON array
        const jsonStart = cleaned.indexOf('[');
        const jsonEnd = cleaned.lastIndexOf(']') + 1;
        if (jsonStart !== -1 && jsonEnd !== -1) {
          cleaned = cleaned.slice(jsonStart, jsonEnd);
          plan = JSON.parse(cleaned);
        } else {
          throw new Error('No JSON array found in AI response.');
        }
      } catch (e) {
        setError('Failed to parse API plan from AI.');
        setLoading(false);
        return;
      }

      setApiPlan(plan);
      setSelectedApis(new Set(plan.map(p => p.endpoint)));
      setLoading(false);
    } catch (error) {
      setError('Failed to generate API plan.');
      setLoading(false);
    }
  };

  const handleToggleApi = (endpoint: string) => {
    const newSelected = new Set(selectedApis);
    if (newSelected.has(endpoint)) {
      newSelected.delete(endpoint);
    } else {
      newSelected.add(endpoint);
    }
    setSelectedApis(newSelected);
  };

  const handleConfirmPlan = async () => {
    if (selectedApis.size === 0) {
      setError("Please select at least one API to call.");
      return;
    }

    setLoading(true);
    setError("");
    setStep("results");

    try {
      const results: Record<string, any> = {};
      
      // Map endpoints to service functions
      const endpointToFunction: Record<string, (address: string) => Promise<any>> = {
        "/tokens/{address_hash}": (addr) => pulsechainApi.getTokenInfo(addr),
        "/tokens/{address_hash}/holders": (addr) => pulsechainApi.getTokenHolders(addr),
        "/tokens/{address_hash}/counters": (addr) => pulsechainApi.getTokenCounters(addr),
        "/tokens/{address_hash}/transfers": (addr) => pulsechainApi.getTokenTransfers(addr),
        "/addresses/{address_hash}": (addr) => pulsechainApi.getAddressInfo(addr),
        "/addresses/{address_hash}/counters": (addr) => pulsechainApi.getAddressCounters(addr),
        "/addresses/{address_hash}/transactions": (addr) => pulsechainApi.getAddressTransactions(addr),
        "/addresses/{address_hash}/token-transfers": (addr) => pulsechainApi.getAddressTokenTransfers(addr),
        "/addresses/{address_hash}/token-balances": (addr) => pulsechainApi.getAddressTokenBalances(addr),
      };

      // Execute selected APIs for each address
      for (const address of selectedAddresses) {
        for (const endpoint of selectedApis) {
          const func = endpointToFunction[endpoint];
          if (func) {
            try {
              const result = await func(address.address);
              results[`${endpoint}_${address.address}`] = result;
            } catch (error) {
              console.error(`Error calling ${endpoint} for ${address.address}:`, error);
              results[`${endpoint}_${address.address}`] = { error: "API call failed" };
            }
          }
        }
      }

      setApiResults(results);

      // Generate AI answer
      const analysisPrompt = `Based on the following API results, provide a comprehensive answer to the user's question: "${userQuestion}"

Selected addresses/tokens:
${selectedAddresses.map(addr => `- ${addr.name} (${addr.symbol}) - ${addr.address}`).join('\n')}

API Results:
${JSON.stringify(results, null, 2)}

Please provide a clear, human-readable answer that directly addresses the user's question. Include relevant data points and insights from the API results.`;

      const answer = await generateGeminiResponse(analysisPrompt);
      setAiAnswer(answer);
      setLoading(false);
    } catch (error) {
      setError('Failed to execute API calls or generate answer.');
      setLoading(false);
    }
  };

  const resetOrchestrator = () => {
    setUserQuestion("");
    setSelectedAddresses([]);
    setCurrentSearch("");
    setSearchResults([]);
    setApiPlan([]);
    setSelectedApis(new Set());
    setApiResults({});
    setAiAnswer("");
    setError("");
    setStep("input");
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <IconBrain className="h-6 w-6" />
          AI-Powered Blockchain Analysis
        </h2>
        <p className="text-purple-100">
          Ask questions about blockchain data and let AI determine which APIs to call for you.
        </p>
      </div>

      {step === "input" && (
        <div className="space-y-6">
          {/* Address/Token Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <IconSearch className="h-5 w-5" />
              Select Addresses/Tokens (1-5)
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Search Section */}
              <div className="lg:col-span-2 space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={currentSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search for tokens, addresses, or names..."
                    className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg max-h-60 overflow-y-auto">
                    {searchResults.map((result, index) => (
                      <div
                        key={index}
                        onClick={() => handleSelectSearchResult(result)}
                        className="p-3 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {result.name || result.symbol || "Unknown"}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {result.address}
                            </div>
                          </div>
                          <div className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                            {result.token_type || "Address"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Button */}
                <button
                  onClick={handleAddAddress}
                  disabled={!currentSearch.trim() || selectedAddresses.length >= 5 || isSearching}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconPlus className="h-4 w-4" />
                  Add Address ({selectedAddresses.length}/5)
                </button>
              </div>

              {/* Selected Addresses Side Menu */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Selected Addresses</h4>
                {selectedAddresses.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No addresses selected yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedAddresses.map((address, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-600 rounded border">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {address.name || address.symbol || "Unknown"}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {address.address}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveAddress(address.address)}
                          className="ml-2 p-1 text-red-500 hover:text-red-700"
                          title="Remove address"
                          aria-label={`Remove ${address.name || address.symbol || 'address'}`}
                        >
                          <IconX className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Question Input */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Ask Your Question</h3>
            <textarea
              value={userQuestion}
              onChange={(e) => setUserQuestion(e.target.value)}
              placeholder="e.g., How many holders does HEX have? What tokens do these addresses hold in common?"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={4}
            />
            <button
              onClick={handleSubmitQuestion}
              disabled={!userQuestion.trim() || selectedAddresses.length === 0 || loading}
              className="mt-4 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconBrain className="h-5 w-5" />
              {loading ? "Analyzing..." : "Analyze with AI"}
            </button>
          </div>
        </div>
      )}

      {step === "plan" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <IconApi className="h-5 w-5" />
              AI-Generated API Plan
            </h3>
            
            <div className="space-y-3">
              {apiPlan.map((api, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <input
                    type="checkbox"
                    checked={selectedApis.has(api.endpoint)}
                    onChange={() => handleToggleApi(api.endpoint)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                    title={`Select ${api.endpoint}`}
                    aria-label={`Select ${api.endpoint} - ${api.description}`}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">{api.endpoint}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{api.description}</div>
                  </div>
                  {api.required && (
                    <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded">
                      Required
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleConfirmPlan}
                disabled={selectedApis.size === 0 || loading}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconCheck className="h-5 w-5" />
                {loading ? "Executing..." : "Execute Selected APIs"}
              </button>
              <button
                onClick={() => setStep("input")}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "results" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">AI Analysis Results</h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Generating analysis...</p>
              </div>
            ) : (
              <div className="prose dark:prose-invert max-w-none">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                  <h4 className="font-medium mb-2">Question:</h4>
                  <p className="text-gray-700 dark:text-gray-300">{userQuestion}</p>
                </div>
                
                {aiAnswer && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <h4 className="font-medium mb-2 text-green-800 dark:text-green-200">AI Answer:</h4>
                    <div className="text-green-700 dark:text-green-300 whitespace-pre-wrap">{aiAnswer}</div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={resetOrchestrator}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Start New Analysis
              </button>
              <button
                onClick={() => setStep("plan")}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back to Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
} 