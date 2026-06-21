import React from 'react';
import { motion } from 'motion/react';
import { IconCode, IconExternalLink, IconGitBranch, IconTerminal } from '@tabler/icons-react';

export default function DeploymentTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6"
    >
      <h2 className="mb-6 text-2xl font-bold text-[#FA4616]">Deployment & GitHub</h2>
      <p className="mb-6 text-[var(--text-muted)]">
        Complete guide to deploying your PulseChain DApps and mastering version control with GitHub.
      </p>

      <div className="space-y-8">
        {/* GitHub Basics */}
        <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <IconGitBranch className="h-6 w-6 text-[#FA4616]" />
            <h3 className="text-xl font-semibold text-[var(--text)]">GitHub Essentials</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-[var(--text)] mb-3">Repository Setup</h4>
              <div className="space-y-3">
                <div className="bg-[var(--surface)] p-3 rounded-lg">
                  <h5 className="font-semibold text-[#FA4616] text-sm mb-1">Create Repository</h5>
                  <p className="text-xs text-[var(--text-muted)]">
                    Use descriptive names, add README, choose license, and initialize with .gitignore for Node.js projects.
                  </p>
                </div>
                <div className="bg-[var(--surface)] p-3 rounded-lg">
                  <h5 className="font-semibold text-[#FA4616] text-sm mb-1">Branch Strategy</h5>
                  <p className="text-xs text-[var(--text-muted)]">
                    Use main/master as production, create feature branches for new work, use pull requests for code review.
                  </p>
                </div>
                <div className="bg-[var(--surface)] p-3 rounded-lg">
                  <h5 className="font-semibold text-[#FA4616] text-sm mb-1">Commit Messages</h5>
                  <p className="text-xs text-[var(--text-muted)]">
                    Write clear, descriptive commit messages. Use present tense and be specific about changes.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-[var(--text)] mb-3">Collaboration Features</h4>
              <div className="space-y-3">
                <div className="bg-[var(--surface)] p-3 rounded-lg">
                  <h5 className="font-semibold text-[#FA4616] text-sm mb-1">Pull Requests</h5>
                  <p className="text-xs text-[var(--text-muted)]">
                    Propose changes, request reviews, discuss modifications, and merge approved code.
                  </p>
                </div>
                <div className="bg-[var(--surface)] p-3 rounded-lg">
                  <h5 className="font-semibold text-[#FA4616] text-sm mb-1">Issues & Projects</h5>
                  <p className="text-xs text-[var(--text-muted)]">
                    Track bugs, plan features, organize work with kanban boards and automated workflows.
                  </p>
                </div>
                <div className="bg-[var(--surface)] p-3 rounded-lg">
                  <h5 className="font-semibold text-[#FA4616] text-sm mb-1">GitHub Actions</h5>
                  <p className="text-xs text-[var(--text-muted)]">
                    Automate testing, building, and deployment with CI/CD workflows.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deployment Strategies */}
        <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <IconTerminal className="h-6 w-6 text-[#FA4616]" />
            <h3 className="text-xl font-semibold text-[var(--text)]">Deployment Strategies</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-[var(--surface)] p-4 rounded-lg">
              <h4 className="font-semibold text-[#FA4616] mb-2">Git-Based Deployment</h4>
              <p className="text-sm text-[var(--text)] mb-2">
                Automatic deployment triggered by Git pushes. Vercel, Netlify, and Railway excel at this.
              </p>
              <ul className="text-xs text-[var(--text-muted)] space-y-1">
                <li>• Push to main branch</li>
                <li>• Automatic build & deploy</li>
                <li>• Preview deployments</li>
                <li>• Rollback capability</li>
              </ul>
            </div>
            <div className="bg-[var(--surface)] p-4 rounded-lg">
              <h4 className="font-semibold text-[#FA4616] mb-2">Container Deployment</h4>
              <p className="text-sm text-[var(--text)] mb-2">
                Deploy using Docker containers for consistent environments across development and production.
              </p>
              <ul className="text-xs text-[var(--text-muted)] space-y-1">
                <li>• Docker build process</li>
                <li>• Environment consistency</li>
                <li>• Scaling capabilities</li>
                <li>• Platform independence</li>
              </ul>
            </div>
            <div className="bg-[var(--surface)] p-4 rounded-lg">
              <h4 className="font-semibold text-[#FA4616] mb-2">Manual Deployment</h4>
              <p className="text-sm text-[var(--text)] mb-2">
                Direct server deployment for maximum control. Requires more setup but offers full customization.
              </p>
              <ul className="text-xs text-[var(--text-muted)] space-y-1">
                <li>• Server provisioning</li>
                <li>• Build optimization</li>
                <li>• Custom configurations</li>
                <li>• Performance tuning</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CI/CD with GitHub Actions */}
        <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <IconCode className="h-6 w-6 text-[#FA4616]" />
            <h3 className="text-xl font-semibold text-[var(--text)]">CI/CD with GitHub Actions</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-[var(--text)] mb-3">Workflow Examples</h4>
              <div className="space-y-2">
                <div className="bg-[var(--surface-2)] p-3 rounded-lg">
                  <code className="text-sm text-[var(--text)] block mb-1">.github/workflows/deploy.yml</code>
                  <span className="text-xs text-[var(--text-muted)]">Basic deployment workflow</span>
                </div>
                <div className="bg-[var(--surface-2)] p-3 rounded-lg">
                  <code className="text-sm text-[var(--text)] block mb-1">.github/workflows/test.yml</code>
                  <span className="text-xs text-[var(--text-muted)]">Automated testing pipeline</span>
                </div>
                <div className="bg-[var(--surface-2)] p-3 rounded-lg">
                  <code className="text-sm text-[var(--text)] block mb-1">.github/workflows/lint.yml</code>
                  <span className="text-xs text-[var(--text-muted)]">Code quality checks</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-[var(--text)] mb-3">Common Actions</h4>
              <ul className="space-y-2 text-[var(--text)]">
                <li>• <strong>actions/checkout</strong> - Clone repository</li>
                <li>• <strong>actions/setup-node</strong> - Setup Node.js</li>
                <li>• <strong>actions/cache</strong> - Cache dependencies</li>
                <li>• <strong>actions/deploy</strong> - Deploy to hosting</li>
                <li>• <strong>actions/test</strong> - Run test suites</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Environment Management */}
        <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-6">
          <h3 className="text-xl font-semibold text-[var(--text)] mb-4">Environment Management</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-[#FA4616] mb-3">Environment Variables</h4>
              <div className="space-y-2">
                <div className="bg-[var(--surface)] p-2 rounded text-sm">
                  <code className="text-[var(--text)]">NEXT_PUBLIC_API_URL</code>
                  <span className="text-[var(--text-muted)] ml-2">Public API endpoints</span>
                </div>
                <div className="bg-[var(--surface)] p-2 rounded text-sm">
                  <code className="text-[var(--text)]">DATABASE_URL</code>
                  <span className="text-[var(--text-muted)] ml-2">Database connection string</span>
                </div>
                <div className="bg-[var(--surface)] p-2 rounded text-sm">
                  <code className="text-[var(--text)]">RPC_URL</code>
                  <span className="text-[var(--text-muted)] ml-2">PulseChain RPC endpoint</span>
                </div>
                <div className="bg-[var(--surface)] p-2 rounded text-sm">
                  <code className="text-[var(--text)]">PRIVATE_KEY</code>
                  <span className="text-[var(--text-muted)] ml-2">Never commit private keys!</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-[#FA4616] mb-3">Security Best Practices</h4>
              <ul className="space-y-2 text-[var(--text)]">
                <li>• Never commit secrets to Git</li>
                <li>• Use environment-specific configs</li>
                <li>• Rotate API keys regularly</li>
                <li>• Use GitHub Secrets for CI/CD</li>
                <li>• Implement proper access controls</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Deployment Checklist */}
        <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-6">
          <h3 className="text-xl font-semibold text-[var(--text)] mb-4">Pre-Deployment Checklist</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-[#FA4616] mb-3">Code Quality</h4>
              <ul className="space-y-2 text-[var(--text)]">
                <li className="flex items-center gap-2">
                  <span className="text-[var(--up)]">✓</span>
                  <span>All tests passing</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--up)]">✓</span>
                  <span>Code linting clean</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--up)]">✓</span>
                  <span>TypeScript errors resolved</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--up)]">✓</span>
                  <span>Security audit passed</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--up)]">✓</span>
                  <span>Performance optimized</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-[#FA4616] mb-3">Deployment Ready</h4>
              <ul className="space-y-2 text-[var(--text)]">
                <li className="flex items-center gap-2">
                  <span className="text-[var(--up)]">✓</span>
                  <span>Environment variables configured</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--up)]">✓</span>
                  <span>Build process tested</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--up)]">✓</span>
                  <span>Domain configured</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--up)]">✓</span>
                  <span>SSL certificate ready</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--up)]">✓</span>
                  <span>Monitoring setup</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* GitHub Resources */}
        <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-6">
          <h3 className="text-xl font-semibold text-[var(--text)] mb-4">Essential GitHub Resources</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-[#FA4616] mb-2">Learning Resources</h4>
              <ul className="text-sm text-[var(--text)] space-y-1">
                <li>• <a href="https://docs.github.com/" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">GitHub Docs</a> - Official documentation</li>
                <li>• <a href="https://lab.github.com/" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">GitHub Learning Lab</a> - Interactive tutorials</li>
                <li>• <a href="https://github.com/github/gitignore" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">GitIgnore Templates</a> - Project-specific ignores</li>
                <li>• <a href="https://github.com/marketplace" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">GitHub Marketplace</a> - Apps and integrations</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-[#FA4616] mb-2">Community Resources</h4>
              <ul className="text-sm text-[var(--text)] space-y-1">
                <li>• <a href="https://github.com/explore" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">GitHub Explore</a> - Discover projects</li>
                <li>• <a href="https://github.com/topics" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">Topics</a> - Find projects by technology</li>
                <li>• <a href="https://github.com/trending" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">Trending</a> - Popular repositories</li>
                <li>• <a href="https://github.com/readme" target="_blank" rel="noopener noreferrer" className="text-[#FA4616] hover:text-[#FA4616]/80">Awesome Lists</a> - Curated resource lists</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
