"use client";
import { motion } from "framer-motion";
import { GlowingEffect } from "@/components/ui/glowing-effect";
// Simple SVG icon components
const IconFileText = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconCode = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const IconShieldCheck = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const IconHeart = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const IconBrain = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const IconMail = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const IconHeartPulse = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
  </svg>
);

const IconCrown = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const IconChartBar = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconBarChart = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h2l3 9h6l3-9h2M9 4v16m6-16v16" />
  </svg>
);

const IconHex = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.5 3.5L22 12l-4.5 8.5h-11L2 12l4.5-8.5h11zm-1 2h-9L4 12l3.5 6.5h9L20 12 16.5 5.5z" />
  </svg>
);

const agents = [
  {
    id: 1,
    name: "AI Code Reader/Chat Agent",
    description: "PulseChainAI's Most Powerful AI Agent which allows user to interact with Solidity Smart Contract like never before! (Warning: Still in Beta. Use with Caution)",
    icon: IconFileText,
    color: "from-pink-500 to-purple-500",
    size: "col-span-1 md:col-span-2 row-span-1 md:row-span-2"
  },
  {
    id: 5,
    name: "Blockchain Analyzer",
    description: "Advanced blockchain analysis tool for deep insights into PulseChain transactions, token movements, and network activity",
    icon: IconChartBar,
    color: "from-blue-500 to-cyan-500",
    size: "col-span-1 md:col-span-2 row-span-1 md:row-span-2"
  },
  {
    id: 4,
    name: "Talk to Richard Heart!",
    description: "AI-powered conversation with the tone, knowledge, wit and persona of crypto founder Richard Heart",
    icon: IconCrown,
    color: "from-yellow-500 to-orange-500",
    size: "col-span-1 row-span-1"
  },
  {
    id: 2,
    name: "Positive Vibes Only",
    description: "Transform negative thoughts into positive, uplifting messages with AI",
    icon: IconHeart,
    color: "from-red-500 to-pink-500",
    size: "col-span-1 row-span-1"
  },
  {
    id: 3,
    name: "AI Therapist",
    description: "Dr. Sarah Chen - Compassionate AI therapy and emotional support",
    icon: IconHeartPulse,
    color: "from-pink-500 to-rose-500",
    size: "col-span-1 md:col-span-2 row-span-1"
  },
  {
    id: 6,
    name: "Stat Counter Builder",
    description: "Create custom stat counters for any PulseChain token. Build, preview, and embed real-time statistics",
    icon: IconBarChart,
    color: "from-emerald-500 to-teal-500",
    size: "col-span-1 row-span-1"
  },
  {
    id: 7,
    name: "HEX Stats",
    description: "Complete HEX daily statistics dashboard with historical data from Ethereum and PulseChain networks",
    icon: IconHex,
    color: "from-orange-500 to-red-500",
    size: "col-span-1 md:col-span-1 row-span-1"
  },
  {
    id: 8,
    name: "LookIntoRH Clone",
    description: "Track Richard Heart's treasury movements and analyze transaction history from sacrifice wallets and alleged ETH purchases",
    icon: IconChartBar,
    color: "from-purple-500 to-indigo-500",
    size: "col-span-1 md:col-span-1 row-span-1"
  }
];

export default function AIAgentsSection() {
  return (
    <section className="min-h-screen bg-black py-12 md:py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div 
          className="text-center mb-12 md:mb-16 px-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 md:mb-6">
            AI Agents
          </h2>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
            Powerful AI tools designed to analyze and interact with the PulseChain ecosystem
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto">
          {agents.map((agent, index) => (
            <motion.div
              key={agent.id}
              className={`relative group cursor-pointer ${agent.size}`}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 0.5, 
                delay: index * 0.1,
                ease: "easeOut"
              }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.02 }}
              onClick={() => {
                if (agent.name === "AI Code Reader/Chat Agent") {
                  window.location.href = "/ai-agent";
                } else if (agent.name === "Blockchain Analyzer") {
                  window.location.href = "/blockchain-analyzer";
                } else if (agent.name === "Positive Vibes Only") {
                  window.location.href = "/happy-pulse";
                } else if (agent.name === "AI Therapist") {
                  window.location.href = "/therapist";
                } else if (agent.name === "Talk to Richard Heart!") {
                  window.location.href = "/richard-heart";
                } else if (agent.name === "Stat Counter Builder") {
                  window.location.href = "/stat-counter-builder";
                } else if (agent.name === "HEX Stats") {
                  window.location.href = "/hex-dashboard";
                } else if (agent.name === "LookIntoRH Clone") {
                  window.location.href = "/look-into-rh";
                }
              }}
            >
              <div className="relative h-full rounded-2xl border border-gray-800 p-2">
                <GlowingEffect
                  spread={40}
                  glow={true}
                  disabled={false}
                  proximity={64}
                  inactiveZone={0.01}
                />
                
                <div className="relative flex h-full flex-col justify-between gap-4 md:gap-6 overflow-hidden rounded-xl p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm">
                  {/* Content */}
                  <div className="relative flex flex-1 flex-col justify-between gap-3">
                    <div className="flex items-center mb-3 md:mb-4">
                      <div className={`p-2 md:p-3 rounded-xl bg-gradient-to-br ${agent.color} mr-3 md:mr-4`}>
                        <agent.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                      </div>
                      <h3 className="text-lg md:text-xl font-semibold text-white">
                        {agent.name}
                      </h3>
                    </div>
                    
                    <p className="text-gray-400 text-sm leading-relaxed flex-grow">
                      {agent.description}
                    </p>
                    
                    <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-800">
                      <div className="flex items-center text-xs text-gray-500">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        AI Agent Ready
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
} 