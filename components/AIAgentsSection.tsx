"use client";
import { motion } from "framer-motion";

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

const IconChartBar = ({ className }: { className?: string }) => (
  <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconBarChart = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h2l3 9h6l3-9h2M9 4v16m6-16v16" />
  </svg>
);

const IconHex = ({ className }: { className?: string }) => (
  <svg className={className || "w-6 h-6"} fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.5 3.5L22 12l-4.5 8.5h-11L2 12l4.5-8.5h11zm-1 2h-9L4 12l3.5 6.5h9L20 12 16.5 5.5z" />
  </svg>
);

interface Agent {
  id: number;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  src: string;
  category: string;
  videoUrl: string | null;
  hasMovingGradient: boolean;
  isComingSoon: boolean;
  useSvgBackground?: boolean;
}

const agents: Agent[] = [
  {
    id: 1,
    name: "AI Code Reader/Chat Agent",
    description: "PulseChainAI's Most Powerful AI Agent which allows user to interact with Solidity Smart Contract like never before! (Warning: Still in Beta. Use with Caution)",
    icon: IconFileText,
    color: "from-pink-500 to-blue-500",
    src: "/api/placeholder/400/600/pink/blue",
    category: "AI Agent",
    videoUrl: "https://dvba8d38nfde7nic.public.blob.vercel-storage.com/Ai-code-reader",
    hasMovingGradient: false,
    isComingSoon: false
  },
  {
    id: 5,
    name: "Blockchain Analyzer",
    description: "Advanced blockchain analysis tool for deep insights into PulseChain transactions, token movements, and network activity",
    icon: IconChartBar,
    color: "from-blue-500 to-cyan-500",
    src: "/api/placeholder/400/600/blue/cyan",
    category: "Analysis Tool",
    videoUrl: "https://dvba8d38nfde7nic.public.blob.vercel-storage.com/BlockChain-Analyst",
    hasMovingGradient: false,
    isComingSoon: false
  },
  {
    id: 6,
    name: "Stat Counter Builder",
    description: "Create custom stat counters for any PulseChain token. Build, preview, and embed real-time statistics",
    icon: IconBarChart,
    color: "from-emerald-500 to-teal-500",
    src: "/api/placeholder/400/600/emerald/teal",
    category: "Builder Tool",
    videoUrl: "https://dvba8d38nfde7nic.public.blob.vercel-storage.com/Stat-card",
    hasMovingGradient: false,
    isComingSoon: false
  },
  {
    id: 9,
    name: "Quick API Calls",
    description: "Comprehensive token analytics and statistics dashboard for advanced PulseChain analysis and monitoring",
    icon: IconChartBar,
    color: "from-indigo-500 to-blue-500",
    src: "/api/placeholder/400/600/indigo/blue",
    category: "Admin Tool",
    videoUrl: "https://dvba8d38nfde7nic.public.blob.vercel-storage.com/Stat-card",
    hasMovingGradient: false,
    isComingSoon: false
  },
  // Commented out Coming Soon cards
  /*
  {
    id: 4,
    name: "Talk to Richard Heart!",
    description: "AI-powered conversation with the tone, knowledge, wit and persona of crypto founder Richard Heart",
    icon: IconCrown,
    color: "from-yellow-500 to-orange-500",
    src: "/api/placeholder/400/600/yellow/orange",
    category: "AI Chat",
    videoUrl: null,
    hasMovingGradient: true,
    isComingSoon: true
  },
  {
    id: 2,
    name: "Positive Vibes Only",
    description: "Transform negative thoughts into positive, uplifting messages with AI",
    icon: IconHeart,
    color: "from-red-500 to-pink-500",
    src: "/api/placeholder/400/600/red/pink",
    category: "AI Therapy",
    videoUrl: null,
    hasMovingGradient: true,
    isComingSoon: true
  },
  {
    id: 3,
    name: "AI Therapist",
    description: "Dr. Sarah Chen - Compassionate AI therapy and emotional support",
    icon: IconHeartPulse,
    color: "from-pink-500 to-rose-500",
    src: "/api/placeholder/400/600/pink/rose",
    category: "AI Therapy",
    videoUrl: null,
    hasMovingGradient: true,
    isComingSoon: true
  },
  {
    id: 8,
    name: "Debank",
    description: "Track Richard Heart's treasury movements and analyze transaction history from sacrifice wallets and alleged ETH purchases",
    icon: IconChartBar,
    color: "from-blue-500 to-indigo-500",
    src: "/api/placeholder/400/600/blue/indigo",
    category: "Analysis Tool",
    videoUrl: null,
    hasMovingGradient: true,
    isComingSoon: true
  }
  */
]; 

export default function AIAgentsSection() {
  return (
    <section className="min-h-screen py-12 md:py-20 px-4" style={{ backgroundColor: '#0C2340' }}>
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16 px-4">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 md:mb-6">
            AI Agents
          </h2>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
            Powerful AI tools designed to analyze and interact with the PulseChain ecosystem
          </p>
        </div>

        {/* Regular Grid - Show on all screen sizes */}
        <div className="mb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-6xl mx-auto">
            {agents.map((agent, index) => (
              <div
                key={agent.id}
                className="relative group cursor-pointer"
                onClick={() => {
                  if (agent.name === "AI Code Reader/Chat Agent") {
                    window.location.href = "/ai-agent";
                  } else if (agent.name === "Blockchain Analyzer") {
                    window.location.href = "/blockchain-analyzer";
                  } else if (agent.name === "AI Therapist") {
                    window.location.href = "/therapist";
                  } else if (agent.name === "Stat Counter Builder") {
                    window.location.href = "/stat-counter-builder";
                  } else if (agent.name === "Quick API Calls") {
                    window.location.href = "/admin-stats";
                  }
                }}
              >
                <motion.div 
                  className="relative w-full aspect-[4/5] rounded-2xl p-2 overflow-hidden"
                  style={{ borderWidth: '2px', borderColor: '#FA4616' }}
                >
                  <div className="relative flex h-full flex-col justify-between gap-4 md:gap-6 overflow-hidden rounded-xl p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm">
                    
                    {/* Video Background */}
                    {agent.videoUrl && (
                      <video
                        className="absolute inset-0 z-10 object-cover w-full h-full transition-all duration-500 group-hover:grayscale-0 grayscale"
                        muted
                        loop
                        playsInline
                        preload="metadata"
                      >
                        <source src={agent.videoUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    )}
                    
                    {/* SVG Background for specific cards */}
                    {!agent.videoUrl && agent.useSvgBackground && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center">
                        <img
                          src={agent.src}
                          alt={agent.name}
                          className="w-full h-full object-contain opacity-20 transition-all duration-500 group-hover:grayscale-0 group-hover:opacity-40 grayscale"
                          style={{ filter: 'grayscale(100%) brightness(0.8)' }}
                        />
                      </div>
                    )}
                    
                    {/* Fallback Image for cards without videos or SVG backgrounds */}
                    {!agent.videoUrl && !agent.useSvgBackground && (
                      <img
                        src={agent.src}
                        alt={agent.name}
                        className="absolute inset-0 z-10 object-cover w-full h-full transition-all duration-500 group-hover:grayscale-0 grayscale"
                        style={{ filter: 'grayscale(100%) brightness(0.8)' }}
                      />
                    )}
                    
                    {/* Subtle overlay for better text readability */}
                    <div className="absolute inset-0 z-15 bg-slate-950/20" />
                    
                    {/* Card Content - Simplified */}
                    <div className="relative z-40 flex flex-col h-full justify-between">
                      <div className="flex-grow" />
                      
                      <div className="text-center">
                        <h3 className="text-xl md:text-2xl font-bold mb-2" style={{ color: '#FA4616' }}>
                          {agent.name}
                        </h3>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Games Section */}
      <div className="mt-20 md:mt-32">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16 px-4">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 md:mb-6">
            Games
          </h2>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
            Interactive gaming experiences built on the PulseChain ecosystem
          </p>
        </div>

        {/* Games Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-6xl mx-auto">
          {/* HEXtroids Card */}
          <div
            className="relative group cursor-pointer"
            onClick={() => {
              window.open("https://hextroids.vercel.app", "_blank");
            }}
          >
            <motion.div 
              className="relative w-full aspect-[4/5] rounded-2xl p-2 overflow-hidden"
              style={{ borderWidth: '2px', borderColor: '#FA4616' }}
            >
              <div className="relative flex h-full flex-col justify-between gap-4 md:gap-6 overflow-hidden rounded-xl p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm">
                {/* HEXtroids Image Background */}
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <img
                    src="/HEXagon (1).svg"
                    alt="HEXtroids"
                    className="w-full h-full object-cover opacity-20 transition-all duration-500 group-hover:grayscale-0 group-hover:opacity-40 grayscale"
                    style={{ filter: 'grayscale(100%) brightness(0.8)' }}
                  />
                </div>
                
                {/* Subtle overlay for better text readability */}
                <div className="absolute inset-0 z-15 bg-slate-950/20" />
                
                {/* Content */}
                <div className="relative z-40 flex flex-1 flex-col justify-between gap-3">
                  <div className="flex-grow" />
                  
                  <div className="text-center">
                    <h3 className="text-xl md:text-2xl font-semibold mb-2" style={{ color: '#FA4616' }}>
                      HEXtroids
                    </h3>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Coming Soon Game 1 - Commented out */}
          {/*
          <div
            className="relative group col-span-1 row-span-1"
          >
            <div className="relative h-full rounded-2xl border border-gray-800 p-2">
              <div className="relative flex h-full flex-col justify-between gap-4 md:gap-6 overflow-hidden rounded-xl p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm">
                <div className="relative flex flex-1 flex-col justify-between gap-3">
                  <div className="flex-grow" />
                  
                  <div className="text-center">
                    <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">
                      HEX Runner
                    </h3>
                  </div>
                </div>
                
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-2">Coming Soon</div>
                    <div className="text-sm text-gray-300">This game is under development</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          */}

          {/* Coming Soon Game 2 - Commented out */}
          {/*
          <div
            className="relative group col-span-1 row-span-1"
          >
            <div className="relative h-full rounded-2xl border border-gray-800 p-2">
              <div className="relative flex h-full flex-col justify-between gap-4 md:gap-6 overflow-hidden rounded-xl p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm">
                <div className="relative flex flex-1 flex-col justify-between gap-3">
                  <div className="flex-grow" />
                  
                  <div className="text-center">
                    <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">
                      Pulse Defender
                    </h3>
                  </div>
                </div>
                
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-2">Coming Soon</div>
                    <div className="text-sm text-gray-300">This game is under development</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          */}
        </div>
      </div>
    </section>
  );
}