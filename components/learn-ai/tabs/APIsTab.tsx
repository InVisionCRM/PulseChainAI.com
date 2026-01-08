import React from 'react';
import { motion } from 'motion/react';
import { IconApi, IconExternalLink } from '@tabler/icons-react';

export default function APIsTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="rounded-lg border border-white/10 bg-white/5 p-6"
    >
      <h2 className="mb-6 text-2xl font-bold text-[#FA4616]">Blockchain APIs & Integration</h2>
      <p className="mb-6 text-white/70">
        Complete guide to PulseChain and DexScreener APIs with practical examples and tips.
      </p>

      {/* API Basics */}
      <div className="rounded-lg border border-white/20 bg-white/5 p-6 mb-6">
        <h3 className="text-xl font-semibold text-white mb-4">Understanding APIs</h3>
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-[#FA4616] mb-2">What is an API?</h4>
              <p className="text-sm text-white/80 mb-3">
                An Application Programming Interface (API) is like a waiter in a restaurant. You (the client) ask for data or actions, and the API (server) brings you what you requested without showing you how the kitchen works.
              </p>
              <p className="text-xs text-white/60 italic">Example: When you check crypto prices on an app, you're using APIs to fetch data from blockchain networks.</p>
            </div>

            <div>
              <h4 className="font-semibold text-[#FA4616] mb-2">What is an Endpoint?</h4>
              <p className="text-sm text-white/80 mb-3">
                An endpoint is a specific URL where you can access particular data or functionality. It's like a specific table in a restaurant menu.
              </p>
              <p className="text-xs text-white/60 italic">Example: /api/tokens/0x123... is an endpoint that gives you information about a specific token.</p>
            </div>

            <div>
              <h4 className="font-semibold text-[#FA4616] mb-2">What is a Response?</h4>
              <p className="text-sm text-white/80 mb-3">
                A response is the data the API sends back to you, usually in JSON format. It's like the food the waiter brings after you place your order.
              </p>
              <p className="text-xs text-white/60 italic">Example: A token API might respond with price, supply, holders, and other token data.</p>
            </div>

            <div>
              <h4 className="font-semibold text-[#FA4616] mb-2">HTTP Methods</h4>
              <p className="text-sm text-white/80 mb-3">
                GET (read data), POST (create data), PUT (update data), DELETE (remove data). Most blockchain APIs use GET for reading information.
              </p>
              <p className="text-xs text-white/60 italic">Example: GET /api/transactions gets transaction history, POST /api/transfer sends tokens.</p>
            </div>
          </div>
        </div>
      </div>

      {/* API Best Practices */}
      <div className="rounded-lg border border-white/20 bg-white/5 p-6 mb-6">
        <h3 className="text-xl font-semibold text-white mb-4">API Integration Tips</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-2">Error Handling</h4>
            <ul className="text-sm text-white/80 space-y-1">
              <li>• Always wrap API calls in try/catch blocks</li>
              <li>• Handle network timeouts (10-30 seconds)</li>
              <li>• Check response status codes</li>
              <li>• Provide fallback data for failures</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-[#FA4616] mb-2">Rate Limiting</h4>
            <ul className="text-sm text-white/80 space-y-1">
              <li>• Respect API rate limits to avoid blocks</li>
              <li>• Implement exponential backoff for retries</li>
              <li>• Cache responses when possible</li>
              <li>• Use WebSocket for real-time data when available</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-[#FA4616] mb-2">Security</h4>
            <ul className="text-sm text-white/80 space-y-1">
              <li>• Never expose API keys in frontend code</li>
              <li>• Use HTTPS for all API calls</li>
              <li>• Validate all input data</li>
              <li>• Store sensitive data securely</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-[#FA4616] mb-2">Performance</h4>
            <ul className="text-sm text-white/80 space-y-1">
              <li>• Cache frequently accessed data</li>
              <li>• Use pagination for large datasets</li>
              <li>• Compress API responses</li>
              <li>• Monitor API response times</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Scan.PulseChain.com API */}
      <div className="rounded-lg border border-white/20 bg-white/5 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Scan.PulseChain.com API</h3>
          <a
            href="https://scan.pulsechain.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#FA4616] hover:text-[#FA4616]/80 flex items-center gap-1"
          >
            scan.pulsechain.com <IconExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="space-y-4">
          {/* Token Endpoints */}
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">Token Endpoints</h4>
            <div className="space-y-2">
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/tokens/{'{address}'}</code>
                <span className="text-xs text-white/60">Get token information (supply, decimals, symbol, etc.)</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/tokens/{'{address}'}/holders</code>
                <span className="text-xs text-white/60">Get token holders (paginated)</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/tokens/{'{address}'}/transfers</code>
                <span className="text-xs text-white/60">Get token transfer history</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/tokens/{'{address}'}/logs</code>
                <span className="text-xs text-white/60">Get token event logs</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/tokens/{'{address}'}/counters</code>
                <span className="text-xs text-white/60">Get token statistics counters</span>
              </div>
            </div>
          </div>

          {/* Address Endpoints */}
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">Address Endpoints</h4>
            <div className="space-y-2">
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/addresses/{'{address}'}</code>
                <span className="text-xs text-white/60">Get address information and balance</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/addresses/{'{address}'}/transactions</code>
                <span className="text-xs text-white/60">Get address transaction history</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/addresses/{'{address}'}/token-balances</code>
                <span className="text-xs text-white/60">Get token balances for an address</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/addresses/{'{address}'}/internal-transactions</code>
                <span className="text-xs text-white/60">Get internal transactions</span>
              </div>
            </div>
          </div>

          {/* Transaction Endpoints */}
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">Transaction Endpoints</h4>
            <div className="space-y-2">
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/transactions/{'{hash}'}</code>
                <span className="text-xs text-white/60">Get transaction details</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/transactions/{'{hash}'}/token-transfers</code>
                <span className="text-xs text-white/60">Get token transfers in a transaction</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/transactions/{'{hash}'}/internal-transactions</code>
                <span className="text-xs text-white/60">Get internal transactions in a tx</span>
              </div>
            </div>
          </div>

          {/* Smart Contract Endpoints */}
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">Smart Contract Endpoints</h4>
            <div className="space-y-2">
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /api/v2/smart-contracts/{'{address}'}</code>
                <span className="text-xs text-white/60">Get smart contract information</span>
              </div>
            </div>
          </div>

          {/* Base URL */}
          <div className="bg-black/30 p-3 rounded-lg">
            <h4 className="font-semibold text-[#FA4616] mb-2">Base URL</h4>
            <code className="text-sm text-white/80">https://api.scan.pulsechain.com/api/v2</code>
          </div>
        </div>
      </div>

      {/* DexScreener API */}
      <div className="rounded-lg border border-white/20 bg-white/5 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">DexScreener API</h3>
          <a
            href="https://dexscreener.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#FA4616] hover:text-[#FA4616]/80 flex items-center gap-1"
          >
            dexscreener.com <IconExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="space-y-4">
          {/* DEX Endpoints */}
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">DEX Endpoints</h4>
            <div className="space-y-2">
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /latest/dex/tokens/{'{tokenAddress}'}</code>
                <span className="text-xs text-white/60">Get token pairs and trading data</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /latest/dex/pairs/{'{chainId}'}/{'{pairAddress}'}</code>
                <span className="text-xs text-white/60">Get specific trading pair information</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /latest/dex/search?q={'{query}'}</code>
                <span className="text-xs text-white/60">Search for tokens and pairs</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <code className="text-sm text-white/80 block mb-1">GET /latest/dex/tokens/pulsechain/{'{tokenAddress}'}</code>
                <span className="text-xs text-white/60">Get PulseChain-specific token data</span>
              </div>
            </div>
          </div>

          {/* Response Example */}
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">Response Example (Token Data)</h4>
            <div className="bg-black/30 p-3 rounded-lg">
              <pre className="text-xs text-white/80 overflow-x-auto">
{`{
  "schemaVersion": "1.0.0",
  "pairs": [
    {
      "chainId": "369",
      "dexId": "pulsex",
      "url": "https://dexscreener.com/pulsechain/0x...",
      "pairAddress": "0x...",
      "baseToken": {
        "address": "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
        "name": "HEX",
        "symbol": "HEX"
      },
      "quoteToken": {
        "address": "0xA1077a294dDE1B09bB078844df40758a5D0f9a27",
        "name": "Wrapped Pulse",
        "symbol": "WPLS"
      },
      "priceNative": "0.002345",
      "priceUsd": "0.002345",
      "liquidity": {
        "usd": 2345000,
        "base": 1000000,
        "quote": 2345
      }
    }
  ]
}`}
              </pre>
            </div>
          </div>

          {/* Base URL */}
          <div className="bg-black/30 p-3 rounded-lg">
            <h4 className="font-semibold text-[#FA4616] mb-2">Base URL</h4>
            <code className="text-sm text-white/80">https://api.dexscreener.com/latest/dex</code>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
