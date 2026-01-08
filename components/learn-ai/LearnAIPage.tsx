'use client';

import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { motion } from 'motion/react';
import {
  IconTerminal,
  IconCode,
  IconDatabase,
  IconApi,
  IconAddressBook,
  IconVocabulary,
  IconBrandNodejs,
  IconBrandNextjs,
  IconBrandPython,
  IconBrandReact,
  IconBrandTypescript,
  IconBrandRust,
  IconExternalLink,
} from '@tabler/icons-react';

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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="border-b border-white/10 bg-gradient-to-r from-[#0C2340] to-[#1a365d] px-6 py-12"
      >
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-6xl">
              Learn AI
            </h1>
            <p className="mx-auto max-w-3xl text-lg leading-relaxed text-white/80 md:text-xl">
              A comprehensive guide to getting started with AI-powered development on PulseChain.
              Master the fundamentals of DApp creation, from coding environments to deployment.
            </p>
            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center rounded-full bg-[#FA4616]/10 px-4 py-2 text-sm text-[#FA4616]">
                <IconTerminal className="mr-2 h-4 w-4" />
                PulseChain Blockchain Development
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <Tabs defaultValue="introduction" className="w-full">
          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
          >
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 lg:grid-cols-13 bg-white/5 p-1 gap-1">
              <TabsTrigger
                value="introduction"
                className="flex items-center gap-2 text-xs md:text-sm data-[state=active]:bg-[#FA4616] data-[state=active]:text-white px-2 py-2"
              >
                <IconTerminal className="h-4 w-4" />
                <span className="hidden sm:inline">Intro</span>
              </TabsTrigger>
              <TabsTrigger
                value="basics"
                className="flex items-center gap-2 text-xs md:text-sm data-[state=active]:bg-[#FA4616] data-[state=active]:text-white px-2 py-2"
              >
                <IconCode className="h-4 w-4" />
                <span className="hidden sm:inline">Basics</span>
              </TabsTrigger>
              <TabsTrigger
                value="addresses"
                className="flex items-center gap-2 text-xs md:text-sm data-[state=active]:bg-[#FA4616] data-[state=active]:text-white px-2 py-2"
              >
                <IconAddressBook className="h-4 w-4" />
                <span className="hidden sm:inline">Addresses</span>
              </TabsTrigger>
              <TabsTrigger
                value="ides"
                className="flex items-center gap-2 text-xs md:text-sm data-[state=active]:bg-[#FA4616] data-[state=active]:text-white px-2 py-2"
              >
                <IconCode className="h-4 w-4" />
                <span className="hidden sm:inline">IDEs</span>
              </TabsTrigger>
              <TabsTrigger
                value="system-instructions"
                className="flex items-center gap-2 text-xs md:text-sm data-[state=active]:bg-[#FA4616] data-[state=active]:text-white px-2 py-2"
              >
                <IconTerminal className="h-4 w-4" />
                <span className="hidden sm:inline">AI Setup</span>
              </TabsTrigger>
              <TabsTrigger
                value="backends"
                className="flex items-center gap-2 text-xs md:text-sm data-[state=active]:bg-[#FA4616] data-[state=active]:text-white px-2 py-2"
              >
                <IconDatabase className="h-4 w-4" />
                <span className="hidden sm:inline">Backends</span>
              </TabsTrigger>
              <TabsTrigger
                value="apis"
                className="flex items-center gap-2 text-xs md:text-sm data-[state=active]:bg-[#FA4616] data-[state=active]:text-white px-2 py-2"
              >
                <IconApi className="h-4 w-4" />
                <span className="hidden sm:inline">APIs</span>
              </TabsTrigger>
              <TabsTrigger
                value="glossary"
                className="flex items-center gap-2 text-xs md:text-sm data-[state=active]:bg-[#FA4616] data-[state=active]:text-white px-2 py-2"
              >
                <IconVocabulary className="h-4 w-4" />
                <span className="hidden sm:inline">Glossary</span>
              </TabsTrigger>
              <TabsTrigger
                value="ai-websites"
                className="flex items-center gap-2 text-xs md:text-sm data-[state=active]:bg-[#FA4616] data-[state=active]:text-white px-2 py-2"
              >
                <IconTerminal className="h-4 w-4" />
                <span className="hidden sm:inline">AI Sites</span>
              </TabsTrigger>
              <TabsTrigger
                value="hosting"
                className="flex items-center gap-2 text-xs md:text-sm data-[state=active]:bg-[#FA4616] data-[state=active]:text-white px-2 py-2"
              >
                <IconDatabase className="h-4 w-4" />
                <span className="hidden sm:inline">Hosting</span>
              </TabsTrigger>
              <TabsTrigger
                value="deployment"
                className="flex items-center gap-2 text-xs md:text-sm data-[state=active]:bg-[#FA4616] data-[state=active]:text-white px-2 py-2"
              >
                <IconCode className="h-4 w-4" />
                <span className="hidden sm:inline">Deploy</span>
              </TabsTrigger>
              <TabsTrigger
                value="resources"
                className="flex items-center gap-2 text-xs md:text-sm data-[state=active]:bg-[#FA4616] data-[state=active]:text-white px-2 py-2"
              >
                <IconExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Resources</span>
              </TabsTrigger>
            </TabsList>
          </motion.div>

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
