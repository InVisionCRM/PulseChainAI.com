"use client";
import { Boxes } from "@/components/ui/background-boxes";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import ColourfulText from "@/components/ui/colourful-text";

export default function HeroSection() {


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
        <motion.div
          variants={letterVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
          style={{
            textShadow: "0 0 20px rgba(236, 19, 172, 0.3), 0 0 40px rgba(54, 74, 255, 0.2), 0 0 60px rgba(239, 16, 145, 0.1)",
            fontFamily: "'Inter', 'Roboto', 'Arial', sans-serif",
            fontWeight: 900,
            letterSpacing: "0.1em"
          }}
        >
          <ColourfulText text="PulseChain" />
        </motion.div>
        <motion.span 
          className="text-white ml-4"
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
      <motion.p 
        className="text-center mt-2 text-neutral-400 relative z-20 text-sm md:text-base max-w-2xl mx-auto px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.5 }}
      >
        Made by <span className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer" onClick={() => window.open('https://superstake.win', '_blank')}>SuperStake.Win</span>
      </motion.p>
    </div>
  );
} 