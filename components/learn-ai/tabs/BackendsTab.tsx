import React from 'react';
import { motion } from 'motion/react';
import { IconDatabase, IconBrandNodejs, IconBrandNextjs, IconBrandPython, IconBrandRust } from '@tabler/icons-react';

export default function BackendsTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="rounded-lg border border-white/10 bg-white/5 p-6"
    >
      <h2 className="mb-6 text-2xl font-bold text-[#FA4616]">Backend Architecture for PulseChain DApps</h2>

      <div className="space-y-8">
        {/* Node.js/Express */}
        <div className="rounded-lg border border-white/20 bg-white/5 p-6">
          <div className="flex items-center gap-4 mb-4">
            <IconBrandNodejs className="h-10 w-10 text-green-500" />
            <div>
              <h3 className="text-xl font-semibold text-white">Node.js + Express</h3>
              <a
                href="https://expressjs.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#FA4616] hover:text-[#FA4616]/80 flex items-center gap-1"
              >
                expressjs.com
              </a>
            </div>
          </div>
          <p className="text-white/70 mb-4">
            Fast, unopinionated web framework for Node.js. Perfect for building REST APIs and
            handling blockchain data with JavaScript/TypeScript.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-white/90 mb-2">Use Cases:</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• RESTful API services</li>
                <li>• Real-time blockchain data feeds</li>
                <li>• Webhook processing</li>
                <li>• Token price aggregators</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white/90 mb-2">Real-world Examples:</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• DEX price oracles</li>
                <li>• Wallet notification services</li>
                <li>• Staking reward calculators</li>
                <li>• Multi-chain data aggregators</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Next.js API Routes */}
        <div className="rounded-lg border border-white/20 bg-white/5 p-6">
          <div className="flex items-center gap-4 mb-4">
            <IconBrandNextjs className="h-10 w-10 text-white" />
            <div>
              <h3 className="text-xl font-semibold text-white">Next.js API Routes</h3>
              <a
                href="https://nextjs.org/docs/api-routes/introduction"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#FA4616] hover:text-[#FA4616]/80 flex items-center gap-1"
              >
                nextjs.org
              </a>
            </div>
          </div>
          <p className="text-white/70 mb-4">
            Built-in API routes in Next.js applications. Ideal for full-stack applications
            where frontend and backend share the same codebase.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-white/90 mb-2">Use Cases:</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• Full-stack DApps</li>
                <li>• Server-side rendering with APIs</li>
                <li>• Static generation with dynamic data</li>
                <li>• Hybrid applications</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white/90 mb-2">Real-world Examples:</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• DeFi dashboard applications</li>
                <li>• NFT marketplace platforms</li>
                <li>• Blockchain explorers</li>
                <li>• Wallet interfaces</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Python/FastAPI */}
        <div className="rounded-lg border border-white/20 bg-white/5 p-6">
          <div className="flex items-center gap-4 mb-4">
            <IconBrandPython className="h-10 w-10 text-yellow-500" />
            <div>
              <h3 className="text-xl font-semibold text-white">Python + FastAPI</h3>
              <a
                href="https://fastapi.tiangolo.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#FA4616] hover:text-[#FA4616]/80 flex items-center gap-1"
              >
                fastapi.tiangolo.com
              </a>
            </div>
          </div>
          <p className="text-white/70 mb-4">
            Modern, fast web framework for building APIs with Python. Excellent for data processing,
            machine learning integration, and complex business logic.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-white/90 mb-2">Use Cases:</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• Data analysis services</li>
                <li>• ML/AI integration</li>
                <li>• Complex calculations</li>
                <li>• Scientific computing</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white/90 mb-2">Real-world Examples:</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• DeFi yield optimization</li>
                <li>• Risk assessment systems</li>
                <li>• Market analysis tools</li>
                <li>• Automated trading systems</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Go/Gin */}
        <div className="rounded-lg border border-white/20 bg-white/5 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-10 w-10 bg-cyan-500 rounded text-sm flex items-center justify-center font-bold text-white">Go</div>
            <div>
              <h3 className="text-xl font-semibold text-white">Go + Gin</h3>
              <a
                href="https://gin-gonic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#FA4616] hover:text-[#FA4616]/80 flex items-center gap-1"
              >
                gin-gonic.com
              </a>
            </div>
          </div>
          <p className="text-white/70 mb-4">
            High-performance web framework for Go. Perfect for microservices, high-throughput
            applications, and systems requiring low latency.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-white/90 mb-2">Use Cases:</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• High-performance APIs</li>
                <li>• Microservices architecture</li>
                <li>• Real-time systems</li>
                <li>• System tools</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white/90 mb-2">Real-world Examples:</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• Blockchain node services</li>
                <li>• High-frequency trading</li>
                <li>• Real-time data processors</li>
                <li>• API gateways</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Rust/Axum */}
        <div className="rounded-lg border border-white/20 bg-white/5 p-6">
          <div className="flex items-center gap-4 mb-4">
            <IconBrandRust className="h-10 w-10 text-orange-600" />
            <div>
              <h3 className="text-xl font-semibold text-white">Rust + Axum</h3>
              <a
                href="https://docs.rs/axum/latest/axum/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#FA4616] hover:text-[#FA4616]/80 flex items-center gap-1"
              >
                docs.rs/axum
              </a>
            </div>
          </div>
          <p className="text-white/70 mb-4">
            Memory-safe, high-performance web framework for Rust. Ideal for mission-critical
            systems requiring maximum reliability and performance.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-white/90 mb-2">Use Cases:</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• Mission-critical systems</li>
                <li>• High-reliability services</li>
                <li>• Performance-critical APIs</li>
                <li>• System programming</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white/90 mb-2">Real-world Examples:</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• Core blockchain infrastructure</li>
                <li>• Financial trading systems</li>
                <li>• Critical DeFi protocols</li>
                <li>• High-stakes data processing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
