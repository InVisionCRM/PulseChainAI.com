import React from 'react';
import { motion } from 'motion/react';
import { IconCode, IconExternalLink } from '@tabler/icons-react';

export default function IDEsTab() {
  const ides = [
    {
      name: 'Visual Studio Code',
      icon: <IconCode className="h-8 w-8 text-blue-500" />,
      url: 'https://code.visualstudio.com/',
      description: 'Most popular code editor with excellent TypeScript/JavaScript support, extensive plugin ecosystem, and built-in Git integration.',
      extensions: ['TypeScript and JavaScript Language Features', 'Solidity (for smart contract development)', 'Prettier (code formatting)', 'ESLint (code linting)', 'GitLens (Git integration)'],
      bestFor: 'Professional development, large projects, team collaboration'
    },
    {
      name: 'Cursor',
      icon: <IconCode className="h-8 w-8 text-purple-500" />,
      url: 'https://cursor.sh/',
      description: 'AI-first code editor built on VS Code. Features built-in AI chat, code generation, and intelligent code suggestions powered by GPT-4.',
      extensions: ['Built-in AI assistant', 'GitHub Copilot integration', 'Multi-file editing', 'Custom AI model support'],
      bestFor: 'AI-assisted development, rapid prototyping, beginners learning to code'
    },
    {
      name: 'IntelliJ IDEA',
      icon: <IconCode className="h-8 w-8 text-purple-500" />,
      url: 'https://www.jetbrains.com/idea/',
      description: 'Professional IDE with advanced refactoring tools, excellent debugging capabilities, and comprehensive support for web development.',
      extensions: ['Database tools', 'Docker integration', 'Kubernetes support', 'VCS integrations'],
      bestFor: 'Large-scale applications, complex refactoring tasks, advanced debugging workflows, enterprise development'
    },
    {
      name: 'WebStorm',
      icon: <IconCode className="h-8 w-8 text-blue-600" />,
      url: 'https://www.jetbrains.com/webstorm/',
      description: 'Specialized IDE for JavaScript, TypeScript, and web technologies. Built-in support for React, Vue, Angular, Node.js, and more.',
      extensions: ['Framework-specific plugins', 'Testing tools integration', 'Performance profiling', 'Remote development'],
      bestFor: 'Full-stack web development, modern JavaScript frameworks, complex web applications'
    },
    {
      name: 'Sublime Text',
      icon: <IconCode className="h-8 w-8 text-orange-500" />,
      url: 'https://www.sublimetext.com/',
      description: 'Lightweight and fast text editor with powerful search and replace features, multiple selections, and extensive customization options.',
      extensions: ['Package Control for plugins', 'Theme customization', 'Macro recording', 'Split editing'],
      bestFor: 'Quick editing tasks, performance-critical workflows, simple projects, minimal resource usage'
    },
    {
      name: 'Atom',
      icon: <IconCode className="h-8 w-8 text-green-500" />,
      url: 'https://atom.io/',
      description: 'Hackable text editor built by GitHub with a rich ecosystem of packages and themes, ideal for customization and extensibility.',
      extensions: ['Teletype for collaboration', 'Git integration', 'Package ecosystem', 'Theme gallery'],
      bestFor: 'Highly customizable workflows, GitHub integration, community-driven development, open-source projects'
    },
    {
      name: 'Vim/Neovim',
      icon: <IconCode className="h-8 w-8 text-green-600" />,
      url: 'https://neovim.io/',
      description: 'Highly configurable text editor built for efficiency. Once you learn it, you can edit text at incredible speeds with keyboard shortcuts.',
      extensions: ['Plugin managers (vim-plug, packer)', 'LSP support', 'Tree-sitter integration', 'Custom keybindings'],
      bestFor: 'Efficiency-focused developers, long-term coding careers, server administration, advanced users'
    },
    {
      name: 'Replit',
      icon: <IconCode className="h-8 w-8 text-orange-600" />,
      url: 'https://replit.com/',
      description: 'Online IDE that runs in your browser. Perfect for beginners, collaborative coding, and quick prototyping without installation.',
      extensions: ['Built-in hosting', 'Multiplayer coding', 'Database integration', 'API deployment'],
      bestFor: 'Beginners, online collaboration, quick prototyping, learning environments, no-install development'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="rounded-lg border border-white/10 bg-white/5 p-6"
    >
      <h2 className="mb-6 text-2xl font-bold text-[#FA4616]">Development Environments</h2>
      <p className="mb-6 text-white/70">
        Choose the right development environment for your AI-assisted coding journey. Each IDE offers unique features and learning curves.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {ides.map((ide, index) => (
          <div key={ide.name} className="rounded-lg border border-white/20 bg-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              {ide.icon}
              <div>
                <h3 className="font-semibold text-white">{ide.name}</h3>
                <a
                  href={ide.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#FA4616] hover:text-[#FA4616]/80 flex items-center gap-1"
                >
                  Download <IconExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-3">
              {ide.description}
            </p>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white/90">Key Features:</h4>
              <ul className="text-xs text-white/60 space-y-1">
                {ide.extensions.map((feature, idx) => (
                  <li key={idx}>• {feature}</li>
                ))}
              </ul>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-[#FA4616] font-semibold">{ide.bestFor}</p>
            </div>
          </div>
        ))}
      </div>

      {/* AI Integration Tips */}
      <div className="mt-8 rounded-lg border border-white/20 bg-white/5 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">AI Integration Tips</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-2">Cursor-Specific Features</h4>
            <ul className="text-sm text-white/80 space-y-1">
              <li>• Built-in AI chat interface</li>
              <li>• Code generation from natural language</li>
              <li>• Multi-file context understanding</li>
              <li>• Custom AI model configuration</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-2">VS Code AI Extensions</h4>
            <ul className="text-sm text-white/80 space-y-1">
              <li>• GitHub Copilot for code completion</li>
              <li>• Tabnine for intelligent suggestions</li>
              <li>• CodeStream for AI code reviews</li>
              <li>• IntelliCode for context-aware help</li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
