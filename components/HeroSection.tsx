"use client";
import { Boxes } from "@/components/ui/background-boxes";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import ColourfulText from "@/components/ui/colourful-text";

export default function HeroSection() {
  const titleColors = [
    "text-pink-500", // P
    "text-pink-400", // u
    "text-pink-300", // l
    "text-purple-500", // s
    "text-purple-400", // e
    "text-purple-300", // C
    "text-blue-500", // h
    "text-blue-400", // a
    "text-blue-300", // i
    "text-red-500", // n
    "text-red-400", // A
    "text-red-300", // I
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const letterVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  return (
    <div className="min-h-screen relative w-full overflow-hidden bg-black flex flex-col items-center justify-center">
      <div className="absolute inset-0 w-full h-full bg-black z-20 [mask-image:radial-gradient(transparent,white)] pointer-events-none" />
      
      <Boxes />
      
      <motion.h1 
        className={cn("md:text-8xl text-6xl relative z-20 font-bold flex items-center")}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <ColourfulText text="PulseChain" />
        <motion.span 
          className="text-white"
          variants={letterVariants}
          whileHover={{
            scale: 1.1,
            transition: { duration: 0.2 },
          }}
          style={{
            textShadow: "0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.6), 0 0 60px rgba(255,255,255,0.4)",
            filter: "drop-shadow(0 0 10px rgba(255,255,255,0.5))"
          }}
        >
          AI
        </motion.span>
      </motion.h1>
      <motion.p 
        className="text-center mt-2 text-neutral-300 relative z-20 text-xl md:text-2xl max-w-2xl mx-auto px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
      >
        Your comprehensive dashboard for blockchain analytics and AI-powered insights
      </motion.p>
    </div>
  );
} 