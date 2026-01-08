import React from 'react';
import { motion } from 'motion/react';
import { IconDatabase, IconExternalLink, IconCloud, IconBrandVercel } from '@tabler/icons-react';

export default function HostingTab() {
  const hostingProviders = [
    {
      name: 'Vercel',
      icon: <IconBrandVercel className="h-8 w-8 text-white" />,
      url: 'https://vercel.com/',
      description: 'Frontend cloud platform for static sites and serverless functions. Perfect for Next.js applications with automatic deployments from Git.',
      pricing: 'Free tier available, generous limits',
      strengths: ['Next.js optimized', 'Global CDN', 'Automatic HTTPS', 'Serverless functions', 'Git integration'],
      bestFor: 'Next.js apps, React applications, static sites, Jamstack projects'
    },
    {
      name: 'Netlify',
      icon: <IconCloud className="h-8 w-8 text-cyan-500" />,
      url: 'https://netlify.com/',
      description: 'All-in-one platform for modern web projects. Offers hosting, serverless functions, and form handling with excellent developer experience.',
      pricing: 'Free tier + affordable paid plans',
      strengths: ['Form handling', 'Serverless functions', 'Split testing', 'Large file support', 'Build previews'],
      bestFor: 'Static sites, Jamstack applications, marketing sites, small to medium web apps'
    },
    {
      name: 'Railway',
      icon: <IconDatabase className="h-8 w-8 text-green-500" />,
      url: 'https://railway.app/',
      description: 'Infrastructure platform that makes it easy to deploy any application. Supports databases, Docker, and multiple programming languages.',
      pricing: 'Free tier for small projects',
      strengths: ['Database hosting', 'Docker support', 'Multi-language', 'Easy scaling', 'Built-in monitoring'],
      bestFor: 'Full-stack apps, database-driven applications, containerized apps, rapid prototyping'
    },
    {
      name: 'Render',
      icon: <IconCloud className="h-8 w-8 text-blue-500" />,
      url: 'https://render.com/',
      description: 'Unified cloud platform for static sites, web services, and databases. Simple deployment with automatic SSL and global CDN.',
      pricing: 'Free tier for static sites',
      strengths: ['Free SSL', 'Global CDN', 'Managed databases', 'Background workers', 'Cron jobs'],
      bestFor: 'Web services, APIs, background jobs, static sites, small databases'
    },
    {
      name: 'Fly.io',
      icon: <IconCloud className="h-8 w-8 text-purple-500" />,
      url: 'https://fly.io/',
      description: 'Platform for running full-stack apps close to your users. Excellent for globally distributed applications with low latency.',
      pricing: 'Generous free tier',
      strengths: ['Global distribution', 'Low latency', 'Docker native', 'Persistent volumes', 'Private networking'],
      bestFor: 'Global applications, real-time apps, geographically distributed users, high-performance needs'
    },
    {
      name: 'Heroku',
      icon: <IconCloud className="h-8 w-8 text-purple-600" />,
      url: 'https://heroku.com/',
      description: 'Platform as a Service (PaaS) for deploying and scaling applications. Supports multiple languages with add-on ecosystem.',
      pricing: 'Free tier available',
      strengths: ['Add-on ecosystem', 'Multi-language support', 'Easy scaling', 'Built-in monitoring', 'Rollback capability'],
      bestFor: 'Rapid deployment, proof-of-concept apps, small to medium applications, team collaboration'
    },
    {
      name: 'DigitalOcean App Platform',
      icon: <IconCloud className="h-8 w-8 text-blue-600" />,
      url: 'https://digitalocean.com/products/app-platform',
      description: 'Platform for building, deploying, and scaling apps quickly. Supports static sites, APIs, and background workers.',
      pricing: 'Free tier for static sites',
      strengths: ['Static site hosting', 'API deployment', 'Background jobs', 'Database integration', 'CI/CD pipeline'],
      bestFor: 'Static sites, APIs, background processing, small to medium applications'
    },
    {
      name: 'GitHub Pages',
      icon: <IconExternalLink className="h-8 w-8 text-gray-400" />,
      url: 'https://pages.github.com/',
      description: 'Free hosting for static websites directly from your GitHub repositories. Perfect for documentation, portfolios, and simple sites.',
      pricing: 'Completely free',
      strengths: ['Free hosting', 'GitHub integration', 'Custom domains', 'HTTPS included', 'Jekyll support'],
      bestFor: 'Documentation, portfolios, personal websites, project pages, simple static sites'
    },
    {
      name: 'Surge',
      icon: <IconCloud className="h-8 w-8 text-orange-500" />,
      url: 'https://surge.sh/',
      description: 'Static web publishing for frontend developers. Simple command-line tool for deploying static sites with custom domains.',
      pricing: 'Free for basic use',
      strengths: ['Command-line deployment', 'Custom domains', 'HTTPS included', 'Fast deployment', 'Simple workflow'],
      bestFor: 'Frontend prototypes, static sites, quick deployments, personal projects'
    },
    {
      name: 'AWS Amplify',
      icon: <IconCloud className="h-8 w-8 text-orange-600" />,
      url: 'https://aws.amazon.com/amplify/',
      description: 'Complete solution for hosting web apps with CI/CD, authentication, and API integration. Part of the AWS ecosystem.',
      pricing: 'Generous free tier',
      strengths: ['CI/CD pipelines', 'Authentication', 'API Gateway', 'Storage solutions', 'Global CDN'],
      bestFor: 'Full-stack apps, enterprise applications, scalable web apps, AWS ecosystem integration'
    },
    {
      name: 'Firebase Hosting',
      icon: <IconCloud className="h-8 w-8 text-yellow-500" />,
      url: 'https://firebase.google.com/products/hosting',
      description: 'Fast, secure hosting for static and dynamic web apps. Part of Google Firebase platform with additional services available.',
      pricing: 'Generous free tier',
      strengths: ['Global CDN', 'SSL certificates', 'Fast deployment', 'Rollback capability', 'Firebase integration'],
      bestFor: 'Progressive Web Apps, single-page applications, Firebase ecosystem, rapid prototyping'
    },
    {
      name: 'Cloudflare Pages',
      icon: <IconCloud className="h-8 w-8 text-orange-400" />,
      url: 'https://pages.cloudflare.com/',
      description: 'JAMstack platform for frontend developers. Fast global network with built-in security and performance optimizations.',
      pricing: 'Free tier available',
      strengths: ['Global network', 'Security features', 'Build optimization', 'Edge computing', 'Analytics included'],
      bestFor: 'JAMstack sites, high-performance needs, global distribution, security-conscious projects'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="rounded-lg border border-white/10 bg-white/5 p-6"
    >
      <h2 className="mb-6 text-2xl font-bold text-[#FA4616]">Hosting & Deployment Platforms</h2>
      <p className="mb-6 text-white/70">
        Choose the right hosting platform for your PulseChain DApps. From free tiers for learning to enterprise-grade solutions.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {hostingProviders.map((provider, index) => (
          <div key={provider.name} className="rounded-lg border border-white/20 bg-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              {provider.icon}
              <div>
                <h3 className="font-semibold text-white">{provider.name}</h3>
                <a
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#FA4616] hover:text-[#FA4616]/80 flex items-center gap-1"
                >
                  Visit <IconExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-3">
              {provider.description}
            </p>
            <div className="mb-3">
              <span className="text-xs font-semibold text-green-400 bg-green-400/10 px-2 py-1 rounded">
                {provider.pricing}
              </span>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white/90">Key Features:</h4>
              <ul className="text-xs text-white/60 space-y-1">
                {provider.strengths.map((strength, idx) => (
                  <li key={idx}>• {strength}</li>
                ))}
              </ul>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-[#FA4616] font-semibold">{provider.bestFor}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Hosting Decision Guide */}
      <div className="mt-8 rounded-lg border border-white/20 bg-white/5 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Choosing the Right Hosting Platform</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">For Learning & Prototyping</h4>
            <ul className="text-sm text-white/80 space-y-2">
              <li>• <strong>Vercel</strong> - Best for Next.js projects</li>
              <li>• <strong>Netlify</strong> - Excellent for static sites</li>
              <li>• <strong>GitHub Pages</strong> - Completely free for simple sites</li>
              <li>• <strong>Surge</strong> - Quick static site deployment</li>
              <li>• <strong>Railway</strong> - Full-stack with database support</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">For Production DApps</h4>
            <ul className="text-sm text-white/80 space-y-2">
              <li>• <strong>Vercel</strong> - Scalable Next.js deployments</li>
              <li>• <strong>AWS Amplify</strong> - Enterprise-grade with CI/CD</li>
              <li>• <strong>Firebase</strong> - Real-time features and hosting</li>
              <li>• <strong>Fly.io</strong> - Global distribution for low latency</li>
              <li>• <strong>Render</strong> - Reliable web services hosting</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Deployment Best Practices */}
      <div className="mt-6 rounded-lg border border-white/20 bg-white/5 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Deployment Best Practices</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-2">Environment Setup</h4>
            <ul className="text-sm text-white/80 space-y-1">
              <li>• Use environment variables</li>
              <li>• Separate dev/staging/prod</li>
              <li>• Secure API keys</li>
              <li>• Configure build settings</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-2">Performance</h4>
            <ul className="text-sm text-white/80 space-y-1">
              <li>• Enable compression</li>
              <li>• Use CDN for assets</li>
              <li>• Optimize images</li>
              <li>• Implement caching</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-2">Monitoring</h4>
            <ul className="text-sm text-white/80 space-y-1">
              <li>• Set up error tracking</li>
              <li>• Monitor performance</li>
              <li>• Log important events</li>
              <li>• Set up alerts</li>
            </ul>
          </div>
        </div>
      </div>

      {/* PulseChain-Specific Considerations */}
      <div className="mt-6 rounded-lg border border-white/20 bg-white/5 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">PulseChain DApp Hosting Considerations</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">Frontend Hosting</h4>
            <p className="text-sm text-white/80 mb-3">
              Your React/Next.js frontend can be hosted on any modern platform. Focus on fast global delivery.
            </p>
            <ul className="text-sm text-white/70 space-y-1">
              <li>• Vercel for Next.js optimization</li>
              <li>• Netlify for static generation</li>
              <li>• Cloudflare for global performance</li>
              <li>• Firebase for real-time features</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-[#FA4616] mb-3">API & Backend Hosting</h4>
            <p className="text-sm text-white/80 mb-3">
              Backend services need reliable hosting with good uptime for blockchain interactions.
            </p>
            <ul className="text-sm text-white/70 space-y-1">
              <li>• Railway for full-stack simplicity</li>
              <li>• Render for managed services</li>
              <li>• Fly.io for global distribution</li>
              <li>• AWS/Heroku for enterprise needs</li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
