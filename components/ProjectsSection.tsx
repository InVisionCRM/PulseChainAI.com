"use client";
import React from "react";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { Button } from "@/components/ui/moving-border";

const gradients = [
  "from-yellow-400 to-orange-500",
  "from-teal-400 to-cyan-500", 
  "from-purple-400 to-pink-500",
  "from-blue-400 to-indigo-500",
  "from-green-400 to-emerald-500",
  "from-red-400 to-pink-500",
  "from-indigo-400 to-purple-500",
  "from-cyan-400 to-blue-500"
];

export default function ProjectsSection() {
  return (
    <section className="min-h-screen bg-black py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Projects We Like
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Revolutionary blockchain projects that are changing the world
          </p>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((id) => (
            <div key={id}>
              <BackgroundGradient 
                className="rounded-[22px] p-8 sm:p-12 bg-white dark:bg-zinc-900 h-96"
                spread={20}
                glow={true}
              >
                <div className="flex justify-center mb-4">
                  <div className={`w-16 h-16 bg-gradient-to-br ${gradients[id-1]} rounded-xl flex items-center justify-center`}>
                    <span className="text-white text-2xl">🚀</span>
                  </div>
                </div>
                
                <p className="text-base sm:text-xl text-black mt-4 mb-2 dark:text-neutral-200 font-bold">
                  Project {id}
                </p>

                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  This is a sample project description for testing purposes.
                </p>
                
                <Button
                  borderRadius="1.75rem"
                  className="mt-4 bg-black text-white border-neutral-200 dark:border-slate-800 text-xs font-bold hover:bg-zinc-700 transition-colors"
                >
                  <span>Learn More</span>
                  <span className="bg-zinc-700 rounded-full text-[0.6rem] px-2 py-0 text-white ml-2">
                    $0.01
                  </span>
                </Button>
              </BackgroundGradient>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
} 