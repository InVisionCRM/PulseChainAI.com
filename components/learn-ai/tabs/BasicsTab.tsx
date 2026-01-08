import React from 'react';
import { motion } from 'motion/react';
import { IconCode, IconTerminal, IconDatabase, IconApi, IconSettings, IconWorld, IconExternalLink } from '@tabler/icons-react';

export default function BasicsTab() {
  const basics = [
    {
      title: "Programming Fundamentals",
      icon: <IconCode className="h-6 w-6 text-blue-500" />,
      concepts: [
        "Variables & Data Types - containers for storing information",
        "Functions & Methods - reusable blocks of code",
        "Control Flow - conditional statements and loops",
        "Objects & Arrays - structured data storage",
        "Error Handling - managing and responding to errors"
      ]
    },
    {
      title: "Web Technologies",
      icon: <IconWorld className="h-6 w-6 text-green-500" />,
      concepts: [
        "HTML - structure and content of web pages",
        "CSS - styling and layout of web elements",
        "JavaScript - programming language for interactivity",
        "DOM - Document Object Model for page manipulation",
        "Responsive Design - websites that work on all devices"
      ]
    },
    {
      title: "Development Tools",
      icon: <IconTerminal className="h-6 w-6 text-purple-500" />,
      concepts: [
        "Code Editors - software for writing and editing code",
        "Version Control - tracking changes in code over time",
        "Package Managers - installing and managing dependencies",
        "Terminal/Command Line - text-based computer control",
        "Browser Developer Tools - debugging and inspecting web pages"
      ]
    },
    {
      title: "APIs & Data",
      icon: <IconApi className="h-6 w-6 text-orange-500" />,
      concepts: [
        "HTTP Methods - GET, POST, PUT, DELETE operations",
        "REST APIs - standard for web service communication",
        "JSON - format for exchanging data between systems",
        "Authentication - verifying user identity and permissions",
        "Rate Limiting - controlling how often APIs can be called"
      ]
    },
    {
      title: "Development Environment",
      icon: <IconSettings className="h-6 w-6 text-cyan-500" />,
      concepts: [
        "Node.js - JavaScript runtime for server-side development",
        "npm/yarn - package managers for JavaScript projects",
        "Git - distributed version control system",
        "GitHub - platform for hosting and collaborating on code",
        "Local Development Server - testing applications locally"
      ]
    },
    {
      title: "Deployment & Hosting",
      icon: <IconDatabase className="h-6 w-6 text-red-500" />,
      concepts: [
        "Web Hosting - servers that store and serve websites",
        "Cloud Platforms - scalable hosting solutions",
        "Build Process - converting code into production-ready files",
        "Environment Variables - configuration settings for different environments",
        "Domain Names - human-readable addresses for websites"
      ]
    }
  ];

  const keyTerms = [
    { term: "Framework", definition: "Pre-built structure and tools that make development faster" },
    { term: "Library", definition: "Collection of reusable code that performs specific functions" },
    { term: "Component", definition: "Reusable piece of UI that can be used across an application" },
    { term: "State", definition: "Data that can change over time in an application" },
    { term: "Props", definition: "Data passed from parent to child components" },
    { term: "Hook", definition: "Function that lets you use state and lifecycle features in React" },
    { term: "Middleware", definition: "Software that sits between applications to provide services" },
    { term: "Database", definition: "Organized collection of data that can be accessed and managed" },
    { term: "API", definition: "Set of rules and protocols for accessing a web-based software application" },
    { term: "Frontend", definition: "Part of application that users interact with directly" },
    { term: "Backend", definition: "Part of application that handles logic, database, and server operations" },
    { term: "Full-Stack", definition: "Development covering both frontend and backend of applications" },
    { term: "Responsive", definition: "Design that adapts to different screen sizes and devices" },
    { term: "Version Control", definition: "System that records changes to files over time" },
    { term: "Deployment", definition: "Process of making application available for users" }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="rounded-lg border border-white/10 bg-white/5 p-6"
    >
      <h2 className="mb-6 text-2xl font-bold text-[#FA4616]">The Basics</h2>
      <p className="mb-8 text-white/70 text-lg">
        Fundamental concepts and terminology that form the foundation of modern web development.
        Understanding these basics will help you communicate effectively and learn new technologies faster.
      </p>

      {/* Core Concepts */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {basics.map((category, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="bg-white/5 p-6 rounded-lg border border-white/20"
          >
            <div className="flex items-center gap-3 mb-4">
              {category.icon}
              <h3 className="text-lg font-semibold text-white">{category.title}</h3>
            </div>
            <ul className="space-y-2">
              {category.concepts.map((concept, idx) => (
                <li key={idx} className="text-sm text-white/80 flex items-start gap-2">
                  <span className="text-[#FA4616] mt-1">•</span>
                  <span>{concept}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      {/* Key Terms */}
      <div className="bg-white/5 p-6 rounded-lg border border-white/20 mb-8">
        <h3 className="text-xl font-semibold text-white mb-6">Essential Terminology</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {keyTerms.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="bg-black/20 p-4 rounded-lg"
            >
              <h4 className="font-semibold text-[#FA4616] mb-2">{item.term}</h4>
              <p className="text-sm text-white/80">{item.definition}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Learning Path */}
      <div className="bg-white/5 p-6 rounded-lg border border-white/20 mb-8">
        <h3 className="text-xl font-semibold text-white mb-6">Suggested Learning Order</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#FA4616] rounded-full flex items-center justify-center text-white font-bold">
              1
            </div>
            <div>
              <h4 className="font-semibold text-white">Start with HTML & CSS</h4>
              <p className="text-sm text-white/70">Learn the building blocks of web pages</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#FA4616] rounded-full flex items-center justify-center text-white font-bold">
              2
            </div>
            <div>
              <h4 className="font-semibold text-white">Add JavaScript</h4>
              <p className="text-sm text-white/70">Make your pages interactive</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#FA4616] rounded-full flex items-center justify-center text-white font-bold">
              3
            </div>
            <div>
              <h4 className="font-semibold text-white">Learn a Framework</h4>
              <p className="text-sm text-white/70">React, Vue, or Angular for structured development</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#FA4616] rounded-full flex items-center justify-center text-white font-bold">
              4
            </div>
            <div>
              <h4 className="font-semibold text-white">Explore Advanced Topics</h4>
              <p className="text-sm text-white/70">APIs, databases, deployment, and best practices</p>
            </div>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="text-center py-8 border-t border-white/20">
        <h3 className="text-xl font-semibold text-white mb-4">Where to Learn More</h3>
        <p className="text-white/70 mb-6">
          These fundamentals will serve you well regardless of which technologies or frameworks you choose to specialize in.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="https://developer.mozilla.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#FA4616] text-white px-6 py-3 rounded-lg hover:bg-[#FA4616]/80 transition-colors"
          >
            MDN Web Docs <IconExternalLink className="h-4 w-4" />
          </a>
          <a
            href="https://www.freecodecamp.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-[#FA4616] text-[#FA4616] px-6 py-3 rounded-lg hover:bg-[#FA4616]/10 transition-colors"
          >
            freeCodeCamp <IconExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
