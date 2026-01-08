import React from 'react';
import { motion } from 'motion/react';
import { IconTerminal, IconExternalLink, IconCode, IconBrain, IconRobot } from '@tabler/icons-react';

export default function AICodingWebsitesTab() {
  const aiWebsites = [
    {
      name: 'ChatGPT',
      icon: <IconRobot className="h-8 w-8 text-green-500" />,
      url: 'https://chat.openai.com/',
      description: 'Most popular AI assistant for coding. Excellent for explanations, debugging, and generating code from natural language descriptions.',
      strengths: ['Natural conversation', 'Code explanation', 'Debugging assistance', 'Multiple programming languages'],
      bestFor: 'Beginners, code reviews, learning explanations, rapid prototyping'
    },
    {
      name: 'GitHub Copilot',
      icon: <IconCode className="h-8 w-8 text-blue-500" />,
      url: 'https://github.com/features/copilot',
      description: 'AI-powered code completion tool integrated into VS Code and other editors. Suggests entire functions and code blocks in real-time.',
      strengths: ['Real-time suggestions', 'Context awareness', 'Multi-language support', 'IDE integration'],
      bestFor: 'Professional development, code completion, productivity enhancement'
    },
    {
      name: 'Claude by Anthropic',
      icon: <IconBrain className="h-8 w-8 text-orange-500" />,
      url: 'https://claude.ai/',
      description: 'Advanced AI assistant focused on being helpful, honest, and capable. Excellent for complex reasoning and long-form code generation.',
      strengths: ['Complex reasoning', 'Long-form responses', 'Safety-focused', 'Research assistance'],
      bestFor: 'Complex problems, system design, architecture decisions, detailed explanations'
    },
    {
      name: 'Gemini (Google AI)',
      icon: <IconBrain className="h-8 w-8 text-cyan-500" />,
      url: 'https://gemini.google.com/',
      description: 'Google\'s multimodal AI assistant. Strong in code generation, data analysis, and integration with Google Workspace tools.',
      strengths: ['Multimodal capabilities', 'Google integration', 'Data analysis', 'Creative coding'],
      bestFor: 'Data science, Google ecosystem, creative projects, multimodal applications'
    },
    {
      name: 'Replit AI',
      icon: <IconTerminal className="h-8 w-8 text-purple-500" />,
      url: 'https://replit.com/',
      description: 'AI-powered online IDE with built-in coding assistance. Perfect for collaborative coding and quick prototyping.',
      strengths: ['Online collaboration', 'Multiplayer coding', 'Instant deployment', 'No setup required'],
      bestFor: 'Team collaboration, quick prototypes, learning environments, remote development'
    },
    {
      name: 'Cursor',
      icon: <IconCode className="h-8 w-8 text-indigo-500" />,
      url: 'https://cursor.sh/',
      description: 'AI-first code editor built on VS Code. Features advanced AI chat, code generation, and intelligent refactoring capabilities.',
      strengths: ['AI-first design', 'Advanced chat interface', 'Multi-file editing', 'Custom AI models'],
      bestFor: 'AI-assisted development, complex refactoring, productivity-focused workflows'
    },
    {
      name: 'Codeium',
      icon: <IconCode className="h-8 w-8 text-red-500" />,
      url: 'https://codeium.com/',
      description: 'Free AI coding assistant with advanced code completion, search, and chat features. Works across multiple IDEs.',
      strengths: ['Free tier available', 'Multi-IDE support', 'Advanced completion', 'Code search'],
      bestFor: 'Cost-conscious developers, multi-IDE users, code discovery and navigation'
    },
    {
      name: 'Tabnine',
      icon: <IconCode className="h-8 w-8 text-yellow-500" />,
      url: 'https://www.tabnine.com/',
      description: 'AI code completion tool that learns from your codebase. Provides context-aware suggestions and supports team learning.',
      strengths: ['Team learning', 'Context awareness', 'Codebase understanding', 'Enterprise features'],
      bestFor: 'Team development, large codebases, enterprise environments, consistent code style'
    },
    {
      name: 'Amazon Q',
      icon: <IconBrain className="h-8 w-8 text-orange-600" />,
      url: 'https://aws.amazon.com/q/',
      description: 'AWS-integrated AI assistant for cloud development. Specializes in AWS services, infrastructure as code, and cloud architecture.',
      strengths: ['AWS expertise', 'Infrastructure knowledge', 'Cloud architecture', 'Security best practices'],
      bestFor: 'Cloud development, AWS ecosystem, infrastructure automation, DevOps'
    },
    {
      name: 'Phind',
      icon: <IconTerminal className="h-8 w-8 text-blue-600" />,
      url: 'https://www.phind.com/',
      description: 'AI search engine specifically for developers. Combines web search with AI reasoning for finding solutions and documentation.',
      strengths: ['Developer-focused search', 'Documentation lookup', 'Code examples', 'Stack Overflow integration'],
      bestFor: 'Finding solutions, documentation research, debugging help, learning new technologies'
    },
    {
      name: 'Sourcegraph Cody',
      icon: <IconCode className="h-8 w-8 text-green-600" />,
      url: 'https://sourcegraph.com/cody',
      description: 'AI coding assistant that understands your entire codebase. Provides context-aware suggestions and code navigation.',
      strengths: ['Codebase understanding', 'Large context windows', 'Code navigation', 'Refactoring assistance'],
      bestFor: 'Large codebases, code understanding, refactoring, enterprise development'
    },
    {
      name: 'Perplexity AI',
      icon: <IconBrain className="h-8 w-8 text-purple-600" />,
      url: 'https://www.perplexity.ai/',
      description: 'AI-powered search engine with real-time web access. Great for staying updated with latest coding trends and technologies.',
      strengths: ['Real-time information', 'Web search integration', 'Current trends', 'Research capabilities'],
      bestFor: 'Staying updated, technology research, current best practices, industry news'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="rounded-lg border border-white/10 bg-white/5 p-6"
    >
      <h2 className="mb-6 text-2xl font-bold text-[#FA4616]">Best AI Coding Websites & Tools</h2>
      <p className="mb-6 text-white/70">
        Essential AI-powered tools and platforms for modern development. Each tool offers unique capabilities
        for different aspects of the coding workflow.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {aiWebsites.map((site, index) => (
          <div key={site.name} className="rounded-lg border border-white/20 bg-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              {site.icon}
              <div>
                <h3 className="font-semibold text-white">{site.name}</h3>
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#FA4616] hover:text-[#FA4616]/80 flex items-center gap-1"
                >
                  Visit <IconExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-3">
              {site.description}
            </p>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white/90">Key Strengths:</h4>
              <ul className="text-xs text-white/60 space-y-1">
                {site.strengths.map((strength, idx) => (
                  <li key={idx}>• {strength}</li>
                ))}
              </ul>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-[#FA4616] font-semibold">{site.bestFor}</p>
            </div>
          </div>
        ))}
      </div>

      {/* AI Integration Best Practices */}
      <div className="mt-8 rounded-lg border border-white/20 bg-white/5 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">AI Integration Best Practices</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">Effective Prompting</h4>
            <ul className="text-sm text-white/80 space-y-2">
              <li>• Be specific about your requirements</li>
              <li>• Include context about your tech stack</li>
              <li>• Mention PulseChain-specific needs</li>
              <li>• Ask for explanations, not just code</li>
              <li>• Request best practices and security considerations</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">Workflow Integration</h4>
            <ul className="text-sm text-white/80 space-y-2">
              <li>• Use AI for planning and architecture</li>
              <li>• Generate boilerplate code efficiently</li>
              <li>• Debug with AI assistance</li>
              <li>• Get code reviews and optimization suggestions</li>
              <li>• Learn new technologies and frameworks</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Getting Started Tips */}
      <div className="mt-6 rounded-lg border border-white/20 bg-white/5 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Getting Started with AI Coding</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-[#FA4616] rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-white font-bold">1</span>
            </div>
            <h4 className="font-semibold text-white mb-1">Choose Your Tool</h4>
            <p className="text-sm text-white/70">Start with 1-2 AI tools that match your workflow</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-[#FA4616] rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-white font-bold">2</span>
            </div>
            <h4 className="font-semibold text-white mb-1">Learn Prompting</h4>
            <p className="text-sm text-white/70">Practice writing clear, specific instructions</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-[#FA4616] rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-white font-bold">3</span>
            </div>
            <h4 className="font-semibold text-white mb-1">Iterate & Learn</h4>
            <p className="text-sm text-white/70">Review AI suggestions and learn from corrections</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
