'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import StatDocHeader from '@/components/stat-docs/StatDocHeader';
import ParametersSection from '@/components/stat-docs/ParametersSection';
import CodeExamplesSection from '@/components/stat-docs/CodeExamplesSection';
import LiveStatTester from '@/components/stat-docs/LiveStatTester';
import RealApiEndpointsSection from '@/components/stat-docs/RealApiEndpointsSection';
import ImplementationCodeSection from '@/components/stat-docs/ImplementationCodeSection';
import FullApiResponsesSection from '@/components/stat-docs/FullApiResponsesSection';
import StatusCodesSection from '@/components/stat-docs/StatusCodesSection';
import MorbiusBanner from '@/components/stat-docs/MorbiusBanner';
import { detectStatParameters } from '@/lib/stat-docs/parameter-detector';
import { generateCodeExamples } from '@/lib/stat-docs/code-generator';
import { availableStats } from '@/lib/stats';

interface PageProps {
  params: Promise<{ statId: string }>;
}

export default function StatDocumentationPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  
  // Find the stat configuration
  const statConfig = availableStats.find(s => s.id === resolvedParams.statId);
  
  if (!statConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--app-bg)] via-[var(--panel)] to-[var(--app-bg)] p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-2">Stat Not Found</h1>
            <p className="text-[var(--text-muted)] mb-4">
              The stat "{resolvedParams.statId}" does not exist.
            </p>
            <button
              onClick={() => router.push('/stat-docs')}
              className="px-4 py-2 bg-[var(--panel)] hover:bg-[var(--surface-2)] text-[var(--text)] rounded transition-colors"
            >
              View All Stats
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Detect parameters for this stat
  const parameters = detectStatParameters(resolvedParams.statId);
  
  // Generate code examples
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com';
  const codeExamples = generateCodeExamples(
    resolvedParams.statId,
    statConfig.name,
    parameters,
    baseUrl
  );
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--app-bg)] via-[var(--panel)] to-[var(--app-bg)]">
      {/* Morbius Banner */}
      <MorbiusBanner />
      
      {/* Header */}
      <div className="border-b border-[var(--line)] bg-[var(--app-bg)] backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/stat-docs')}
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              ← Back to All Stats
            </button>
            <span className="text-gray-600">|</span>
            <h1 className="text-sm font-semibold text-[var(--text)]">Stat Documentation</h1>
          </div>
          <a
            href="/admin-stats"
            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-[var(--text)] rounded transition-colors"
          >
            Try in Admin Panel
          </a>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header Section */}
        <StatDocHeader
          statName={statConfig.name}
          statId={statConfig.id}
          description={statConfig.description}
          category="PulseChain Stats" // You can enhance this by categorizing stats
        />
        
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Left Column - Parameters */}
          <div>
            <ParametersSection parameters={parameters} />
          </div>
          
          {/* Right Column - Code Examples */}
          <div>
            <CodeExamplesSection 
              examples={codeExamples}
              statId={resolvedParams.statId}
              tokenAddress={parameters.find(p => p.key === 'address')?.example || '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'}
            />
          </div>
        </div>
        
        {/* Live Testing Section */}
        <div className="mb-12">
          <LiveStatTester
            statId={resolvedParams.statId}
            statName={statConfig.name}
            parameters={parameters}
          />
        </div>
        
        {/* Full Width Sections */}
        <div className="space-y-12">
          <RealApiEndpointsSection 
            statId={resolvedParams.statId}
            tokenAddress={parameters.find(p => p.key === 'address')?.example || '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'}
          />
          <FullApiResponsesSection statId={resolvedParams.statId} />
          <ImplementationCodeSection statId={resolvedParams.statId} />
          <StatusCodesSection />
        </div>
        
        {/* Footer CTA */}
        <div className="mt-12 bg-gradient-to-r from-purple-900/20 via-blue-900/20 to-cyan-900/20 border border-purple-500/30 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-[var(--text)] mb-3">Ready to Test This Stat?</h2>
          <p className="text-[var(--text-muted)] mb-6">
            Try this stat live in the Admin Stats Panel with real PulseChain data
          </p>
          <a
            href={`/admin-stats?stat=${resolvedParams.statId}`}
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-[var(--text)] font-semibold rounded-lg transition-colors"
          >
            Open in Admin Panel →
          </a>
        </div>
      </div>
    </div>
  );
}


