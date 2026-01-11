'use client';

import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { IconTerminal } from '@tabler/icons-react';

// Import all tab components
import IntroductionTab from './tabs/IntroductionTab';
import BasicsTab from './tabs/BasicsTab';
import AddressesTab from './tabs/AddressesTab';
import IDEsTab from './tabs/IDEsTab';
import SystemInstructionsTab from './tabs/SystemInstructionsTab';
import BackendsTab from './tabs/BackendsTab';
import APIsTab from './tabs/APIsTab';
import GlossaryTab from './tabs/GlossaryTab';
import AICodingWebsitesTab from './tabs/AICodingWebsitesTab';
import HostingTab from './tabs/HostingTab';
import DeploymentTab from './tabs/DeploymentTab';
import ResourcesTab from './tabs/ResourcesTab';

export default function LearnAIPage() {
  return (
    <div className="min-h-screen bg-[#0C2340] text-white">
      {/* Header Section */}
      <div className="border-b border-white/10 bg-gradient-to-r from-[#0C2340] to-[#1a365d] px-4 py-8 md:px-6 md:py-12">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h1 className="mb-3 text-3xl font-bold tracking-tight md:mb-4 md:text-5xl lg:text-6xl">
              Learn AI Development
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-white/80 md:text-lg lg:max-w-3xl lg:text-xl">
              A comprehensive course for AI-powered development on PulseChain. Master DApp creation from start to deployment.
            </p>
            <div className="mt-4 flex justify-center md:mt-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FA4616]/10 px-4 py-2 text-sm text-[#FA4616]">
                <IconTerminal className="h-4 w-4" />
                <span>PulseChain Blockchain Development</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <Tabs defaultValue="introduction" className="w-full">
          {/* Course Progress Indicator */}
          <div className="mb-6 md:mb-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">
              Course Curriculum
            </h2>

            {/* Tab Navigation - Horizontal scroll on mobile, wrapped on desktop */}
            <div className="relative">
              <TabsList className="flex h-auto w-full flex-wrap gap-2 bg-transparent p-0 md:gap-3">
                <TabsTrigger
                  value="introduction"
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm transition-all hover:bg-white/10 data-[state=active]:bg-[#FA4616] data-[state=active]:text-white md:min-w-0 md:flex-initial md:px-4"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">1</span>
                  <span>Introduction</span>
                </TabsTrigger>
                <TabsTrigger
                  value="basics"
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm transition-all hover:bg-white/10 data-[state=active]:bg-[#FA4616] data-[state=active]:text-white md:min-w-0 md:flex-initial md:px-4"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">2</span>
                  <span>Basics</span>
                </TabsTrigger>
                <TabsTrigger
                  value="addresses"
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm transition-all hover:bg-white/10 data-[state=active]:bg-[#FA4616] data-[state=active]:text-white md:min-w-0 md:flex-initial md:px-4"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">3</span>
                  <span>Addresses</span>
                </TabsTrigger>
                <TabsTrigger
                  value="ides"
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm transition-all hover:bg-white/10 data-[state=active]:bg-[#FA4616] data-[state=active]:text-white md:min-w-0 md:flex-initial md:px-4"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">4</span>
                  <span>IDEs</span>
                </TabsTrigger>
                <TabsTrigger
                  value="system-instructions"
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm transition-all hover:bg-white/10 data-[state=active]:bg-[#FA4616] data-[state=active]:text-white md:min-w-0 md:flex-initial md:px-4"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">5</span>
                  <span>AI Setup</span>
                </TabsTrigger>
                <TabsTrigger
                  value="backends"
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm transition-all hover:bg-white/10 data-[state=active]:bg-[#FA4616] data-[state=active]:text-white md:min-w-0 md:flex-initial md:px-4"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">6</span>
                  <span>Backends</span>
                </TabsTrigger>
                <TabsTrigger
                  value="apis"
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm transition-all hover:bg-white/10 data-[state=active]:bg-[#FA4616] data-[state=active]:text-white md:min-w-0 md:flex-initial md:px-4"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">7</span>
                  <span>APIs</span>
                </TabsTrigger>
                <TabsTrigger
                  value="glossary"
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm transition-all hover:bg-white/10 data-[state=active]:bg-[#FA4616] data-[state=active]:text-white md:min-w-0 md:flex-initial md:px-4"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">8</span>
                  <span>Glossary</span>
                </TabsTrigger>
                <TabsTrigger
                  value="ai-websites"
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm transition-all hover:bg-white/10 data-[state=active]:bg-[#FA4616] data-[state=active]:text-white md:min-w-0 md:flex-initial md:px-4"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">9</span>
                  <span>AI Sites</span>
                </TabsTrigger>
                <TabsTrigger
                  value="hosting"
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm transition-all hover:bg-white/10 data-[state=active]:bg-[#FA4616] data-[state=active]:text-white md:min-w-0 md:flex-initial md:px-4"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">10</span>
                  <span>Hosting</span>
                </TabsTrigger>
                <TabsTrigger
                  value="deployment"
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm transition-all hover:bg-white/10 data-[state=active]:bg-[#FA4616] data-[state=active]:text-white md:min-w-0 md:flex-initial md:px-4"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">11</span>
                  <span>Deploy</span>
                </TabsTrigger>
                <TabsTrigger
                  value="resources"
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm transition-all hover:bg-white/10 data-[state=active]:bg-[#FA4616] data-[state=active]:text-white md:min-w-0 md:flex-initial md:px-4"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">12</span>
                  <span>Resources</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Tab Content */}
          <TabsContent value="introduction" className="space-y-6">
            <IntroductionTab />
          </TabsContent>
          <TabsContent value="basics" className="space-y-6">
            <BasicsTab />
          </TabsContent>
          <TabsContent value="addresses" className="space-y-6">
            <AddressesTab />
          </TabsContent>
          <TabsContent value="ides" className="space-y-6">
            <IDEsTab />
          </TabsContent>
          <TabsContent value="system-instructions" className="space-y-6">
            <SystemInstructionsTab />
          </TabsContent>
          <TabsContent value="backends" className="space-y-6">
            <BackendsTab />
          </TabsContent>
          <TabsContent value="apis" className="space-y-6">
            <APIsTab />
          </TabsContent>
          <TabsContent value="glossary" className="space-y-6">
            <GlossaryTab />
          </TabsContent>
          <TabsContent value="ai-websites" className="space-y-6">
            <AICodingWebsitesTab />
          </TabsContent>
          <TabsContent value="hosting" className="space-y-6">
            <HostingTab />
          </TabsContent>
          <TabsContent value="deployment" className="space-y-6">
            <DeploymentTab />
          </TabsContent>
          <TabsContent value="resources" className="space-y-6">
            <ResourcesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
