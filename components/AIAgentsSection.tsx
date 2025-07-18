"use client";
import { motion } from "motion/react";
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

const agents = [
  {
    id: 1,
    name: "HEX WhitePaper/Audits/Code",
    description: "Analyze HEX documentation, audits, and smart contract code",
    icon: IconFileText,
    color: "from-pink-500 to-purple-500",
    size: "col-span-2 row-span-2"
  },
  {
    id: 2,
    name: "PulseChain Code",
    description: "Deep dive into PulseChain blockchain implementation",
    icon: IconCode,
    color: "from-blue-500 to-cyan-500",
    size: "col-span-1 row-span-1"
  },
  {
    id: 3,
    name: "Solidity Contract Audits",
    description: "Comprehensive smart contract security analysis",
    icon: IconShieldCheck,
    color: "from-green-500 to-emerald-500",
    size: "col-span-1 row-span-1"
  },
  {
    id: 4,
    name: "HappyPulse",
    description: "Community sentiment and social media analysis",
    icon: IconHeart,
    color: "from-red-500 to-pink-500",
    size: "col-span-1 row-span-1"
  },
  {
    id: 5,
    name: "What Would Richard Do",
    description: "AI-powered insights based on Richard Heart's philosophy",
    icon: IconBrain,
    color: "from-purple-500 to-indigo-500",
    size: "col-span-1 row-span-1"
  },
  {
    id: 6,
    name: "Emailer",
    description: "Automated email composition and management",
    icon: IconMail,
    color: "from-cyan-500 to-blue-500",
    size: "col-span-2 row-span-1"
  }
];

export default function AIAgentsSection() {
  return (
    <section className="min-h-screen bg-black py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            AI Agents
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Powerful AI tools designed to analyze and interact with the PulseChain ecosystem
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
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
                if (agent.name === "HEX WhitePaper/Audits/Code") {
                  window.location.href = "/ai-agent";
                } else if (agent.name === "HappyPulse") {
                  window.location.href = "/happy-pulse";
                } else if (agent.name === "Solidity Contract Audits") {
                  window.location.href = "/solidity-audit";
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
                
                <div className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-xl p-6 bg-gray-900/50 backdrop-blur-sm">
                  {/* Content */}
                  <div className="relative flex flex-1 flex-col justify-between gap-3">
                    <div className="flex items-center mb-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${agent.color} mr-4`}>
                        <agent.icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-white">
                        {agent.name}
                      </h3>
                    </div>
                    
                    <p className="text-gray-400 text-sm leading-relaxed flex-grow">
                      {agent.description}
                    </p>
                    
                    <div className="mt-4 pt-4 border-t border-gray-800">
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