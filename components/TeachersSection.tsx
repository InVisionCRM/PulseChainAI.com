"use client";
import { motion } from "motion/react";
import { GlowingEffect } from "@/components/ui/glowing-effect";

// Teacher icon components
const IconGraduation = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
  </svg>
);

const IconBookOpen = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const IconLightbulb = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const IconUsers = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const IconChartBar = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconCode = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const IconGlobe = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconRocket = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const teachers = [
  {
    id: 1,
    name: "Dr. Marcus Johnson",
    title: "Blockchain Philosophy Expert",
    description: "Learn directly from a leading blockchain philosopher. Deep insights into blockchain philosophy, tokenomics, and the future of decentralized finance.",
    icon: IconRocket,
    color: "from-purple-500 to-pink-500",
    size: "col-span-1 md:col-span-2 row-span-1 md:row-span-2",
    specialty: "Blockchain Philosophy & Tokenomics"
  },
  {
    id: 2,
    name: "Dr. Sarah Chen",
    title: "Crypto Psychology Expert",
    description: "Master the psychology of trading and investment. Learn emotional control, risk management, and mental frameworks for crypto success.",
    icon: IconLightbulb,
    color: "from-blue-500 to-cyan-500",
    size: "col-span-1 row-span-1",
    specialty: "Trading Psychology"
  },
  {
    id: 3,
    name: "Alex Rivera",
    title: "Smart Contract Developer",
    description: "From Solidity basics to advanced DeFi protocols. Hands-on coding tutorials and real-world contract analysis.",
    icon: IconCode,
    color: "from-green-500 to-emerald-500",
    size: "col-span-1 row-span-1",
    specialty: "Smart Contract Development"
  },
  {
    id: 4,
    name: "Maya Patel",
    title: "Technical Analysis Specialist",
    description: "Master chart patterns, indicators, and market analysis. Learn to read market signals and make informed trading decisions.",
    icon: IconChartBar,
    color: "from-orange-500 to-red-500",
    size: "col-span-1 row-span-1",
    specialty: "Technical Analysis"
  },
  {
    id: 5,
    name: "James Wilson",
    title: "Community Building Expert",
    description: "Build and grow thriving crypto communities. Learn engagement strategies, governance, and community-driven development.",
    icon: IconUsers,
    color: "from-indigo-500 to-purple-500",
    size: "col-span-1 row-span-1",
    specialty: "Community Management"
  },
  {
    id: 6,
    name: "Elena Rodriguez",
    title: "DeFi Strategy Advisor",
    description: "Advanced DeFi strategies, yield farming, and protocol analysis. Maximize returns while managing risks in DeFi ecosystems.",
    icon: IconGlobe,
    color: "from-teal-500 to-blue-500",
    size: "col-span-1 md:col-span-2 row-span-1",
    specialty: "DeFi Strategies"
  }
];

export default function TeachersSection() {
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
            Teachers
          </h2>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
            Learn from the best minds in the PulseChain ecosystem and blockchain industry
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto relative">
          {/* Coming Soon Overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-10 flex items-center justify-center rounded-2xl">
            <div className="text-center">
              <h3 className="text-6xl md:text-8xl font-bold text-white mb-4 tracking-tight">
                Coming Soon
              </h3>
              <p className="text-xl md:text-2xl text-gray-300 font-medium">
                Our expert teachers are preparing their lessons
              </p>
            </div>
          </div>
          
          {teachers.map((teacher, index) => (
            <motion.div
              key={teacher.id}
              className={`relative group cursor-pointer ${teacher.size}`}
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
                if (teacher.name === "Dr. Marcus Johnson") {
                  window.location.href = "/marcus-johnson";
                } else if (teacher.name === "Dr. Sarah Chen") {
                  window.location.href = "/therapist";
                } else if (teacher.name === "Alex Rivera") {
                  window.location.href = "/alex-rivera";
                } else if (teacher.name === "Maya Patel") {
                  window.location.href = "/maya-patel";
                } else if (teacher.name === "James Wilson") {
                  window.location.href = "/james-wilson";
                } else if (teacher.name === "Elena Rodriguez") {
                  window.location.href = "/elena-rodriguez";
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
                      <div className={`p-2 md:p-3 rounded-xl bg-gradient-to-br ${teacher.color} mr-3 md:mr-4`}>
                        <teacher.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg md:text-xl font-semibold text-white">
                          {teacher.name}
                        </h3>
                        <p className="text-sm text-gray-400">{teacher.title}</p>
                      </div>
                    </div>
                    
                    <p className="text-gray-400 text-sm leading-relaxed flex-grow">
                      {teacher.description}
                    </p>
                    
                    <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-xs text-gray-500">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                          Expert Teacher
                        </div>
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                          {teacher.specialty}
                        </span>
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