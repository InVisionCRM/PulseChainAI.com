import React from 'react';
import { motion } from 'motion/react';
import { IconExternalLink, IconBrandReact, IconBrandNextjs, IconBrandTypescript, IconTerminal, IconCode, IconDatabase } from '@tabler/icons-react';

export default function ResourcesTab() {
  const resourceCategories = [
    {
      title: 'React & Next.js Libraries',
      icon: <IconBrandReact className="h-6 w-6 text-cyan-500" />,
      resources: [
        { name: 'Framer Motion', url: 'https://www.framer.com/motion/', desc: 'Production-ready motion library for React' },
        { name: 'React Hook Form', url: 'https://react-hook-form.com/', desc: 'Performant forms with easy validation' },
        { name: 'Zustand', url: 'https://zustand-demo.pmnd.rs/', desc: 'Small, fast state management' },
        { name: 'React Query', url: 'https://tanstack.com/query/latest', desc: 'Powerful data synchronization for React' },
        { name: 'Next.js Learn', url: 'https://nextjs.org/learn', desc: 'Official Next.js interactive tutorial' },
        { name: 'React DevTools', url: 'https://react.dev/learn/react-developer-tools', desc: 'Essential debugging tools' },
        { name: 'React Icons', url: 'https://react-icons.github.io/react-icons/', desc: 'Popular icon library' },
        { name: 'React Table', url: 'https://tanstack.com/table/v8', desc: 'Headless UI for building tables' }
      ]
    },
    {
      title: 'UI Component Libraries',
      icon: <IconBrandNextjs className="h-6 w-6 text-white" />,
      resources: [
        { name: 'shadcn/ui', url: 'https://ui.shadcn.com/', desc: 'Beautiful components built with Radix UI and Tailwind' },
        { name: 'Radix UI', url: 'https://www.radix-ui.com/', desc: 'Unstyled, accessible UI primitives' },
        { name: 'Headless UI', url: 'https://headlessui.com/', desc: 'Completely unstyled, fully accessible UI components' },
        { name: 'Chakra UI', url: 'https://chakra-ui.com/', desc: 'Simple, modular accessible component library' },
        { name: 'Mantine', url: 'https://mantine.dev/', desc: 'React components and hooks library with TypeScript' },
        { name: 'Ant Design', url: 'https://ant.design/', desc: 'Enterprise-class UI design language and React components' },
        { name: 'Material-UI', url: 'https://mui.com/', desc: 'React components implementing Google\'s Material Design' },
        { name: 'React Bootstrap', url: 'https://react-bootstrap.github.io/', desc: 'Bootstrap components built with React' }
      ]
    },
    {
      title: 'Blockchain & Web3 Libraries',
      icon: <IconCode className="h-6 w-6 text-orange-500" />,
      resources: [
        { name: 'ethers.js', url: 'https://docs.ethers.org/', desc: 'Complete Ethereum library and wallet implementation' },
        { name: 'web3.js', url: 'https://web3js.readthedocs.io/', desc: 'Ethereum JavaScript API library' },
        { name: 'wagmi', url: 'https://wagmi.sh/', desc: 'React hooks for Ethereum' },
        { name: 'viem', url: 'https://viem.sh/', desc: 'TypeScript interface for Ethereum' },
        { name: 'Hardhat', url: 'https://hardhat.org/', desc: 'Ethereum development environment' },
        { name: 'OpenZeppelin', url: 'https://openzeppelin.com/', desc: 'Secure smart contract library' },
        { name: 'IPFS', url: 'https://ipfs.tech/', desc: 'Peer-to-peer hypermedia protocol' },
        { name: 'The Graph', url: 'https://thegraph.com/', desc: 'Decentralized data indexing protocol' }
      ]
    },
    {
      title: 'Development Tools & Utilities',
      icon: <IconTerminal className="h-6 w-6 text-green-500" />,
      resources: [
        { name: 'ESLint', url: 'https://eslint.org/', desc: 'JavaScript and TypeScript linting tool' },
        { name: 'Prettier', url: 'https://prettier.io/', desc: 'Opinionated code formatter' },
        { name: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/', desc: 'Official TypeScript documentation' },
        { name: 'Biome', url: 'https://biomejs.dev/', desc: 'Fast linter and code formatter' },
        { name: 'Vite', url: 'https://vitejs.dev/', desc: 'Fast build tool and development server' },
        { name: 'Turborepo', url: 'https://turbo.build/', desc: 'High-performance build system' },
        { name: 'Storybook', url: 'https://storybook.js.org/', desc: 'UI component development environment' },
        { name: 'Playwright', url: 'https://playwright.dev/', desc: 'End-to-end testing framework' }
      ]
    },
    {
      title: 'Learning Platforms & Documentation',
      icon: <IconBrandTypescript className="h-6 w-6 text-blue-500" />,
      resources: [
        { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/', desc: 'Comprehensive web development documentation' },
        { name: 'React Docs', url: 'https://react.dev/', desc: 'Official React documentation' },
        { name: 'Next.js Docs', url: 'https://nextjs.org/docs', desc: 'Official Next.js documentation' },
        { name: 'TypeScript Docs', url: 'https://www.typescriptlang.org/docs/', desc: 'Official TypeScript documentation' },
        { name: 'freeCodeCamp', url: 'https://www.freecodecamp.org/', desc: 'Free coding education platform' },
        { name: 'Codecademy', url: 'https://www.codecademy.com/', desc: 'Interactive coding lessons' },
        { name: 'Egghead.io', url: 'https://egghead.io/', desc: 'Bite-sized web development tutorials' },
        { name: 'Frontend Masters', url: 'https://frontendmasters.com/', desc: 'Advanced web development courses' }
      ]
    },
    {
      title: 'Database & Backend Tools',
      icon: <IconDatabase className="h-6 w-6 text-purple-500" />,
      resources: [
        { name: 'Prisma', url: 'https://www.prisma.io/', desc: 'Next-generation ORM for TypeScript & Node.js' },
        { name: 'Supabase', url: 'https://supabase.com/', desc: 'Open source Firebase alternative' },
        { name: 'PlanetScale', url: 'https://planetscale.com/', desc: 'Serverless MySQL platform' },
        { name: 'MongoDB Atlas', url: 'https://www.mongodb.com/atlas', desc: 'Cloud database service' },
        { name: 'Redis', url: 'https://redis.io/', desc: 'In-memory data structure store' },
        { name: 'PostgreSQL', url: 'https://www.postgresql.org/', desc: 'Advanced open source relational database' },
        { name: 'SQLite', url: 'https://www.sqlite.org/', desc: 'Self-contained, file-based SQL database' },
        { name: 'Firebase', url: 'https://firebase.google.com/', desc: 'Google\'s mobile and web app development platform' }
      ]
    },
    {
      title: 'PulseChain Specific Resources',
      icon: <IconCode className="h-6 w-6 text-[#FA4616]" />,
      resources: [
        { name: 'PulseChain Docs', url: 'https://docs.pulsechain.com/', desc: 'Official PulseChain documentation' },
        { name: 'Scan.PulseChain.com', url: 'https://scan.pulsechain.com/', desc: 'PulseChain blockchain explorer' },
        { name: 'DexScreener', url: 'https://dexscreener.com/pulsechain', desc: 'DEX trading pairs and liquidity data' },
        { name: 'PulseChain Discord', url: 'https://discord.gg/pulsechain', desc: 'Official PulseChain community' },
        { name: 'PulseChain GitHub', url: 'https://github.com/pulsechaincom', desc: 'Official PulseChain repositories' },
        { name: 'HEX Staking', url: 'https://hex.com/', desc: 'High-yield blockchain certificate of deposit' },
        { name: 'PulseX', url: 'https://pulsex.com/', desc: 'Leading DEX on PulseChain' },
        { name: 'PulseChain Bridge', url: 'https://bridge.pulsechain.com/', desc: 'Cross-chain bridge service' }
      ]
    },
    {
      title: 'Design & Prototyping Tools',
      icon: <IconExternalLink className="h-6 w-6 text-pink-500" />,
      resources: [
        { name: 'Figma', url: 'https://www.figma.com/', desc: 'Collaborative interface design tool' },
        { name: 'Tailwind CSS', url: 'https://tailwindcss.com/', desc: 'Utility-first CSS framework' },
        { name: 'Tailwind UI', url: 'https://tailwindui.com/', desc: 'Beautiful UI components for Tailwind CSS' },
        { name: 'Dribbble', url: 'https://dribbble.com/', desc: 'Design inspiration and community' },
        { name: 'Coolors', url: 'https://coolors.co/', desc: 'Color palette generator' },
        { name: 'Unsplash', url: 'https://unsplash.com/', desc: 'Free high-quality photos' },
        { name: 'Heroicons', url: 'https://heroicons.com/', desc: 'Beautiful hand-crafted SVG icons' },
        { name: 'Tabler Icons', url: 'https://tabler.io/icons', desc: 'Free and open source icons' }
      ]
    },
    {
      title: 'Testing & Quality Assurance',
      icon: <IconCode className="h-6 w-6 text-green-600" />,
      resources: [
        { name: 'Jest', url: 'https://jestjs.io/', desc: 'Delightful JavaScript testing framework' },
        { name: 'React Testing Library', url: 'https://testing-library.com/docs/react-testing-library/intro/', desc: 'Simple and complete React testing utilities' },
        { name: 'Cypress', url: 'https://www.cypress.io/', desc: 'Fast, easy and reliable testing for anything in a web browser' },
        { name: 'Vitest', url: 'https://vitest.dev/', desc: 'Fast unit test framework powered by Vite' },
        { name: 'MSW', url: 'https://mswjs.io/', desc: 'Mock Service Worker - API mocking library' },
        { name: 'Lighthouse', url: 'https://developers.google.com/web/tools/lighthouse', desc: 'Automated tool for improving web page quality' },
        { name: 'WebPageTest', url: 'https://www.webpagetest.org/', desc: 'Free website speed test and optimization tool' },
        { name: 'Bundle Analyzer', url: 'https://github.com/webpack-contrib/webpack-bundle-analyzer', desc: 'Webpack plugin for analyzing bundle size' }
      ]
    },
    {
      title: 'Performance & Optimization',
      icon: <IconTerminal className="h-6 w-6 text-yellow-500" />,
      resources: [
        { name: 'Next.js Performance', url: 'https://nextjs.org/docs/basic-features/pages#performance', desc: 'Next.js performance optimization guide' },
        { name: 'Web Vitals', url: 'https://web.dev/vitals/', desc: 'Core metrics for healthy user experience' },
        { name: 'PageSpeed Insights', url: 'https://pagespeed.web.dev/', desc: 'Google\'s tool for measuring page performance' },
        { name: 'Webpack Bundle Analyzer', url: 'https://github.com/webpack-contrib/webpack-bundle-analyzer', desc: 'Visualize size of webpack output files' },
        { name: 'Image Optimization', url: 'https://nextjs.org/docs/basic-features/image-optimization', desc: 'Next.js built-in image optimization' },
        { name: 'React DevTools Profiler', url: 'https://react.dev/learn/react-developer-tools#the-profiler-api', desc: 'Performance profiling for React apps' },
        { name: 'Lighthouse CI', url: 'https://github.com/GoogleChrome/lighthouse-ci', desc: 'Run Lighthouse in CI environments' },
        { name: 'Core Web Vitals', url: 'https://web.dev/learn-core-web-vitals/', desc: 'Learn about Core Web Vitals' }
      ]
    },
    {
      title: 'Security & Best Practices',
      icon: <IconCode className="h-6 w-6 text-red-500" />,
      resources: [
        { name: 'OWASP', url: 'https://owasp.org/', desc: 'Open Web Application Security Project' },
        { name: 'Helmet.js', url: 'https://helmetjs.github.io/', desc: 'Help secure Express apps with various HTTP headers' },
        { name: 'Snyk', url: 'https://snyk.io/', desc: 'Find and fix vulnerabilities in your code' },
        { name: 'npm audit', url: 'https://docs.npmjs.com/cli/v8/commands/npm-audit', desc: 'Scan for security vulnerabilities' },
        { name: 'Content Security Policy', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP', desc: 'CSP implementation guide' },
        { name: 'JWT.io', url: 'https://jwt.io/', desc: 'Learn about JSON Web Tokens' },
        { name: 'bcrypt', url: 'https://www.npmjs.com/package/bcrypt', desc: 'Password hashing library' },
        { name: 'Rate Limiting', url: 'https://www.npmjs.com/package/express-rate-limit', desc: 'Basic rate-limiting middleware for Express' }
      ]
    },
    {
      title: 'Community & Learning',
      icon: <IconExternalLink className="h-6 w-6 text-blue-600" />,
      resources: [
        { name: 'Stack Overflow', url: 'https://stackoverflow.com/', desc: 'Q&A community for programmers' },
        { name: 'Reddit r/reactjs', url: 'https://www.reddit.com/r/reactjs/', desc: 'React community discussions' },
        { name: 'Reddit r/nextjs', url: 'https://www.reddit.com/r/nextjs/', desc: 'Next.js community' },
        { name: 'Dev.to', url: 'https://dev.to/', desc: 'Community of software developers' },
        { name: 'CSS-Tricks', url: 'https://css-tricks.com/', desc: 'Web design and development articles' },
        { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/', desc: 'Web design and development articles' },
        { name: 'JavaScript Weekly', url: 'https://javascriptweekly.com/', desc: 'Weekly JavaScript newsletter' },
        { name: 'React Status', url: 'https://react.statuscode.com/', desc: 'Weekly React newsletter' }
      ]
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="rounded-lg border border-white/10 bg-white/5 p-6"
    >
      <h2 className="mb-6 text-2xl font-bold text-[#FA4616]">Comprehensive Resources</h2>
      <p className="mb-6 text-white/70">
        Curated collection of essential libraries, tools, documentation, and learning resources
        for modern web development and PulseChain DApp creation.
      </p>

      <div className="space-y-8">
        {resourceCategories.map((category, categoryIndex) => (
          <div key={categoryIndex} className="rounded-lg border border-white/20 bg-white/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              {category.icon}
              <h3 className="text-xl font-semibold text-white">{category.title}</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {category.resources.map((resource, resourceIndex) => (
                <div key={resourceIndex} className="bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#FA4616] hover:text-[#FA4616]/80 flex items-center gap-1 mb-1"
                      >
                        {resource.name}
                        <IconExternalLink className="h-3 w-3" />
                      </a>
                      <p className="text-xs text-white/70">{resource.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Start Templates */}
      <div className="mt-8 rounded-lg border border-white/20 bg-white/5 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Quick Start Templates</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">Next.js Templates</h4>
            <ul className="text-sm text-white/80 space-y-2">
              <li>• <a href="https://github.com/vercel/next.js/tree/canary/examples" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">Official Next.js Examples</a></li>
              <li>• <a href="https://create.t3.gg/" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">T3 Stack (Next.js + TypeScript + tRPC)</a></li>
              <li>• <a href="https://nextjs.org/docs/api-reference/create-next-app" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">Create Next App</a></li>
              <li>• <a href="https://vercel.com/templates" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">Vercel Templates</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">PulseChain DApp Templates</h4>
            <ul className="text-sm text-white/80 space-y-2">
              <li>• <a href="https://github.com/wagmi-dev/wagmi/tree/main/examples" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">wagmi Examples</a></li>
              <li>• <a href="https://github.com/solidity-templates" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">Solidity Templates</a></li>
              <li>• <a href="https://hardhat.org/guides/create-task.html" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">Hardhat Project Setup</a></li>
              <li>• <a href="https://github.com/NomicFoundation/hardhat-boilerplate" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">Hardhat Boilerplate</a></li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
