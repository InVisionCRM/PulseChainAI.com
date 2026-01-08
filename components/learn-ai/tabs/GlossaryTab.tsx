import React from 'react';
import { motion } from 'motion/react';
import { IconVocabulary } from '@tabler/icons-react';

export default function GlossaryTab() {
  const terms = [
    {
      term: "Algorithm",
      definition: "A finite sequence of well-defined, computer-implementable instructions for solving a problem or performing a computation.",
      example: "A recipe for making cookies is like an algorithm - it gives step-by-step instructions that anyone can follow to get the same result.",
      category: "core"
    },
    {
      term: "Data Structure",
      definition: "A specialized format for organizing, processing, retrieving, and storing data in computer memory.",
      example: "A phone's contact list is a data structure - it organizes names and numbers so you can quickly find the right person to call.",
      category: "core"
    },
    {
      term: "Abstraction",
      definition: "The process of hiding complex implementation details while exposing only essential features of an object or system.",
      example: "Driving a car - you only need to know how to use the steering wheel and pedals; you don't need to understand how the engine works internally.",
      category: "core"
    },
    {
      term: "Polymorphism",
      definition: "The ability of a programming language to present the same interface for different underlying data types.",
      example: "The same 'drive' button works for cars, trucks, and motorcycles - each vehicle responds differently but uses the same interface.",
      category: "core"
    },
    {
      term: "Recursion",
      definition: "A programming technique where a function calls itself directly or indirectly to solve a problem.",
      example: "Standing in front of mirrors facing each other creates infinite reflections - each mirror 'calls itself' to create the next reflection.",
      category: "core"
    },
    {
      term: "RESTful API",
      definition: "An architectural style for designing networked applications using HTTP methods and stateless operations.",
      example: "Like ordering food at a restaurant - you ask the waiter (API) to get food (data) using simple commands like 'get menu' or 'order pizza.'",
      category: "web"
    },
    {
      term: "Middleware",
      definition: "Software components that intercept and process requests/responses in web applications, enabling cross-cutting concerns.",
      example: "A hotel concierge who checks your ID before letting you into your room - middleware verifies requests before they reach the main application.",
      category: "web"
    },
    {
      term: "Server-Side Rendering (SSR)",
      definition: "A technique where web pages are rendered on the server rather than in the client's browser.",
      example: "Getting a pre-made sandwich from a store vs. making one yourself - the server prepares the complete page before sending it to you.",
      category: "web"
    },
    {
      term: "State Management",
      definition: "The process of managing and synchronizing application state across components and user sessions.",
      example: "Keeping track of items in your shopping cart across different pages of an online store - state management remembers what's in your cart.",
      category: "web"
    },
    {
      term: "Progressive Web App (PWA)",
      definition: "Web applications that provide native app-like experiences with offline functionality and push notifications.",
      example: "A website that works even without internet and can be added to your phone's home screen, just like a real app from an app store.",
      category: "web"
    },
    {
      term: "Decentralized Finance (DeFi)",
      definition: "Financial services built on blockchain networks without centralized intermediaries, enabling peer-to-peer transactions.",
      example: "Like lending money directly to friends instead of going through a bank - DeFi lets people borrow, lend, and trade money without middlemen.",
      category: "blockchain"
    },
    {
      term: "Smart Contract",
      definition: "Self-executing contracts with terms directly written into code, automatically enforcing agreements on blockchain networks.",
      example: "A vending machine that automatically gives you a soda after you pay - smart contracts execute themselves when conditions are met.",
      category: "blockchain"
    },
    {
      term: "Non-Fungible Token (NFT)",
      definition: "Unique digital assets representing ownership of specific items or content, verified through blockchain technology.",
      example: "A one-of-a-kind trading card that's digitally unique - unlike regular dollars that are all the same, each NFT is completely unique.",
      category: "blockchain"
    },
    {
      term: "Gas Fee",
      definition: "The fee required to execute transactions and smart contract operations on blockchain networks.",
      example: "Like paying a delivery fee when you order pizza - gas fees are small payments made to process your blockchain transactions.",
      category: "blockchain"
    },
    {
      term: "Consensus Mechanism",
      definition: "The process by which blockchain networks achieve agreement on the state of the distributed ledger.",
      example: "A group vote where everyone must agree on the final decision - consensus ensures all computers on the network agree on transaction history.",
      category: "blockchain"
    },
    {
      term: "Functional Programming",
      definition: "A programming paradigm that treats computation as the evaluation of mathematical functions and avoids changing state.",
      example: "Like a calculator that always gives the same answer for the same inputs - functions don't have hidden side effects or memories.",
      category: "advanced"
    },
    {
      term: "Microservices Architecture",
      definition: "An architectural approach where applications are structured as a collection of loosely coupled, independently deployable services.",
      example: "A restaurant kitchen where different chefs specialize in appetizers, main courses, and desserts - each service works independently but together they make a meal.",
      category: "advanced"
    },
    {
      term: "Event-Driven Architecture",
      definition: "A software architecture pattern where system components communicate through events rather than direct method calls.",
      example: "A doorbell that triggers multiple actions (lights turn on, music plays, camera starts recording) - one event causes many reactions.",
      category: "advanced"
    },
    {
      term: "Container Orchestration",
      definition: "The automated deployment, scaling, and management of containerized applications across clusters of machines.",
      example: "A shipping company that automatically routes and loads containers onto the right ships - orchestration manages where applications run and how they scale.",
      category: "advanced"
    },
    {
      term: "Zero-Knowledge Proof",
      definition: "A cryptographic method allowing one party to prove knowledge of a secret without revealing the secret itself.",
      example: "Proving you have the right key to open a door without showing the key to anyone - you prove knowledge without revealing the secret.",
      category: "advanced"
    },
    {
      term: "ACID Properties",
      definition: "Atomicity, Consistency, Isolation, Durability - fundamental properties guaranteeing reliable database transactions.",
      example: "Like baking a cake - either the whole cake gets baked perfectly (all steps complete) or nothing happens at all (transaction rolls back).",
      category: "database"
    },
    {
      term: "NoSQL Database",
      definition: "Non-relational databases designed for flexible schemas and horizontal scaling, optimized for specific data models.",
      example: "A flexible filing cabinet where you can add new drawer types anytime, unlike a rigid filing system that needs planning in advance.",
      category: "database"
    },
    {
      term: "Indexing Strategy",
      definition: "Database optimization technique creating data structures to enable fast data retrieval operations.",
      example: "A book's index helps you quickly find specific topics - database indexes help computers find data much faster than searching page by page.",
      category: "database"
    },
    {
      term: "Data Normalization",
      definition: "The process of organizing data to minimize redundancy and improve data integrity in relational databases.",
      example: "Organizing your recipe collection so ingredients aren't repeated in every recipe - store ingredients once and reference them everywhere.",
      category: "database"
    },
    {
      term: "Caching Layer",
      definition: "A high-speed data storage layer that stores frequently accessed data in memory for rapid retrieval.",
      example: "Keeping your favorite coffee mug on the counter instead of in a high cabinet - frequently used data is kept in fast 'memory' for quick access.",
      category: "database"
    }
  ];

  const categories = [
    { id: 'core', name: 'Core Programming Concepts', color: 'text-blue-400' },
    { id: 'web', name: 'Web Development', color: 'text-cyan-400' },
    { id: 'blockchain', name: 'Blockchain & Cryptocurrency', color: 'text-orange-400' },
    { id: 'advanced', name: 'Advanced Concepts', color: 'text-purple-400' },
    { id: 'database', name: 'Database & Storage', color: 'text-green-400' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="rounded-lg border border-white/10 bg-white/5 p-6"
    >
      <h2 className="mb-6 text-2xl font-bold text-[#FA4616]">Comprehensive Coding Glossary</h2>
      <p className="mb-6 text-white/70">
        Essential terminology for modern software development, blockchain technology, and DApp creation.
        Each term includes academic-level definitions with practical examples.
      </p>

      {categories.map(category => (
        <div key={category.id} className="mb-8">
          <h3 className={`text-xl font-semibold mb-4 border-b border-white/20 pb-2 ${category.color}`}>
            {category.name}
          </h3>

          <div className="grid gap-6 md:grid-cols-2">
            {terms.filter(term => term.category === category.id).map((term, index) => (
              <div key={index} className="bg-white/5 p-4 rounded-lg">
                <h4 className="font-semibold text-[#FA4616] mb-2">{term.term}</h4>
                <p className="text-sm text-white/80 mb-2">
                  {term.definition}
                </p>
                <p className="text-xs text-white/60 italic">
                  {term.example}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}
