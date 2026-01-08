import React from 'react';
import { motion } from 'motion/react';
import { IconTerminal, IconBrain, IconCode, IconRocket } from '@tabler/icons-react';

export default function IntroductionTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="rounded-lg border border-white/10 bg-white/5 p-6"
    >
      <h2 className="mb-6 text-2xl font-bold text-[#FA4616]">Introduction to AI Coding</h2>

      <div className="space-y-8">
        {/* What is AI Coding */}
        <div className="rounded-lg border border-white/20 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <IconBrain className="h-6 w-6 text-[#FA4616]" />
            <h3 className="text-xl font-semibold text-white">What is AI-Assisted Coding?</h3>
          </div>
          <p className="text-white/80 leading-relaxed mb-4">
            AI-assisted coding revolutionizes software development by providing intelligent code suggestions,
            automated debugging, and contextual guidance. Modern AI tools can understand your intent,
            generate boilerplate code, and even explain complex algorithms in simple terms.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <div className="bg-black/20 p-4 rounded-lg">
              <h4 className="font-semibold text-[#FA4616] mb-2">Code Generation</h4>
              <p className="text-sm text-white/70">
                AI generates complete functions, components, and boilerplate code based on natural language descriptions.
              </p>
            </div>
            <div className="bg-black/20 p-4 rounded-lg">
              <h4 className="font-semibold text-[#FA4616] mb-2">Intelligent Debugging</h4>
              <p className="text-sm text-white/70">
                AI identifies bugs, suggests fixes, and explains error messages in plain language.
              </p>
            </div>
            <div className="bg-black/20 p-4 rounded-lg">
              <h4 className="font-semibold text-[#FA4616] mb-2">Contextual Learning</h4>
              <p className="text-sm text-white/70">
                AI learns your coding style and preferences, providing increasingly personalized assistance.
              </p>
            </div>
          </div>
        </div>

        {/* Why PulseChain */}
        <div className="rounded-lg border border-white/20 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <IconRocket className="h-6 w-6 text-[#FA4616]" />
            <h3 className="text-xl font-semibold text-white">Why PulseChain for AI Developers?</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-white/90 mb-3">Technical Advantages</h4>
              <ul className="space-y-2 text-white/80">
                <li className="flex items-start gap-2">
                  <span className="text-[#FA4616] mt-1">•</span>
                  <span>3-second block times for rapid development iteration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FA4616] mt-1">•</span>
                  <span>Ultra-low gas fees enabling complex smart contracts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FA4616] mt-1">•</span>
                  <span>Ethereum-compatible for seamless migration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FA4616] mt-1">•</span>
                  <span>Rich ecosystem of DeFi protocols and tools</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white/90 mb-3">AI Development Benefits</h4>
              <ul className="space-y-2 text-white/80">
                <li className="flex items-start gap-2">
                  <span className="text-[#FA4616] mt-1">•</span>
                  <span>Fast feedback loops for AI-generated code testing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FA4616] mt-1">•</span>
                  <span>Cost-effective deployment of AI-generated DApps</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FA4616] mt-1">•</span>
                  <span>Active developer community for AI collaboration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FA4616] mt-1">•</span>
                  <span>Comprehensive tooling ecosystem</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Getting Started Path */}
        <div className="rounded-lg border border-white/20 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <IconCode className="h-6 w-6 text-[#FA4616]" />
            <h3 className="text-xl font-semibold text-white">Your AI Coding Journey</h3>
          </div>
          <div className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-[#FA4616] rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-bold">1</span>
                </div>
                <h4 className="font-semibold text-white mb-1">Setup Environment</h4>
                <p className="text-sm text-white/70">Choose your IDE and configure AI assistance</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-[#FA4616] rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-bold">2</span>
                </div>
                <h4 className="font-semibold text-white mb-1">Learn Basics</h4>
                <p className="text-sm text-white/70">Master fundamental concepts and tools</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-[#FA4616] rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-bold">3</span>
                </div>
                <h4 className="font-semibold text-white mb-1">Build Projects</h4>
                <p className="text-sm text-white/70">Create DApps with AI assistance</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-[#FA4616] rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-bold">4</span>
                </div>
                <h4 className="font-semibold text-white mb-1">Deploy & Scale</h4>
                <p className="text-sm text-white/70">Launch and grow your applications</p>
              </div>
            </div>
          </div>
        </div>

        {/* Prerequisites */}
        <div className="rounded-lg border border-white/20 bg-white/5 p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Prerequisites</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-[#FA4616] mb-3">Technical Requirements</h4>
              <ul className="space-y-2 text-white/80">
                <li>• Basic understanding of programming concepts</li>
                <li>• Familiarity with command line interfaces</li>
                <li>• Web browser for development tools</li>
                <li>• Internet connection for AI services</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-[#FA4616] mb-3">Mindset Requirements</h4>
              <ul className="space-y-2 text-white/80">
                <li>• Willingness to learn and experiment</li>
                <li>• Curiosity about emerging technologies</li>
                <li>• Patience with AI limitations</li>
                <li>• Collaborative problem-solving approach</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center py-8">
          <p className="text-white/80 mb-4">
            Ready to begin your AI-assisted development journey on PulseChain?
          </p>
          <p className="text-[#FA4616] font-semibold">
            Start with the Basics tab to build your foundation →
          </p>
        </div>
      </div>
    </motion.div>
  );
}
