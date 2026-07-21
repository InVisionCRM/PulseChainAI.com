"use client";
import { motion } from "framer-motion";
import React from "react";

export const LoaderOne = () => {
  const transition = (x: number) => {
    return {
      duration: 1,
      repeat: Infinity,
      repeatType: "loop" as const,
      delay: x * 0.2,
      ease: "easeInOut",
    };
  };
  return (
    <div className="flex items-center gap-2">
      <motion.div
        initial={{
          y: 0,
        }}
        animate={{
          y: [0, 10, 0],
        }}
        transition={transition(0)}
        className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300"
      />
      <motion.div
        initial={{
          y: 0,
        }}
        animate={{
          y: [0, 10, 0],
        }}
        transition={transition(1)}
        className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300"
      />
      <motion.div
        initial={{
          y: 0,
        }}
        animate={{
          y: [0, 10, 0],
        }}
        transition={transition(2)}
        className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300"
      />
    </div>
  );
};

export const LoaderTwo = () => {
  const transition = (x: number) => {
    return {
      duration: 2,
      repeat: Infinity,
      repeatType: "loop" as const,
      delay: x * 0.2,
      ease: "easeInOut",
    };
  };
  return (
    <div className="flex items-center">
      <motion.div
        transition={transition(0)}
        initial={{
          x: 0,
        }}
        animate={{
          x: [0, 20, 0],
        }}
        className="h-4 w-4 rounded-full bg-neutral-200 shadow-md dark:bg-[var(--surface-2)]"
      />
      <motion.div
        initial={{
          x: 0,
        }}
        animate={{
          x: [0, 20, 0],
        }}
        transition={transition(0.4)}
        className="h-4 w-4 -translate-x-2 rounded-full bg-neutral-200 shadow-md dark:bg-[var(--surface-2)]"
      />
      <motion.div
        initial={{
          x: 0,
        }}
        animate={{
          x: [0, 20, 0],
        }}
        transition={transition(0.8)}
        className="h-4 w-4 -translate-x-4 rounded-full bg-neutral-200 shadow-md dark:bg-[var(--surface-2)]"
      />
    </div>
  );
};

// App-wide loading mark. Chain-neutral: the Morbius shield, gently breathing
// with a soft purple glow. The mark PNG has a transparent background so it sits
// on any surface. Keeps the 200×200 footprint every caller (and the scale-75
// small variant) already relies on.
export const LoaderThree = () => {
  return (
    <motion.div
      className="relative h-[200px] w-[200px]"
      role="status"
      aria-label="Loading"
      initial={{ opacity: 0.85, scale: 0.94 }}
      animate={{ opacity: [0.85, 1, 0.85], scale: [0.94, 1, 0.94] }}
      transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
    >
      <div
        className="pointer-events-none absolute inset-0 blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.45), transparent 65%)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/morbius-mark.png"
        alt="Morbius"
        className="relative h-full w-full object-contain drop-shadow-[0_0_18px_rgba(124,58,237,0.55)]"
      />
    </motion.div>
  );
};

export const LoaderFour = ({ text = "Loading..." }: { text?: string }) => {
  return (
    <div className="relative font-bold text-slate-950 [perspective:1000px] dark:text-[var(--text)]">
      <motion.span
        animate={{
          skew: [0, -40, 0],
          scaleX: [1, 2, 1],
        }}
        transition={{
          duration: 0.05,
          repeat: Infinity,
          repeatType: "reverse",
          repeatDelay: 2,
          ease: "linear",
          times: [0, 0.2, 0.5, 0.8, 1],
        }}
        className="relative z-20 inline-block"
      >
        {text}
      </motion.span>
      <motion.span
        className="absolute inset-0 text-[var(--up)] blur-[0.5px] dark:text-[var(--up)]"
        animate={{
          x: [-2, 4, -3, 1.5, -2],
          y: [-2, 4, -3, 1.5, -2],
          opacity: [0.3, 0.9, 0.4, 0.8, 0.3],
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "linear",
          times: [0, 0.2, 0.5, 0.8, 1],
        }}
      >
        {text}
      </motion.span>
      <motion.span
        className="absolute inset-0 text-[#8b00ff]/50 dark:text-[#8b00ff]"
        animate={{
          x: [0, 1, -1.5, 1.5, -1, 0],
          y: [0, -1, 1.5, -0.5, 0],
          opacity: [0.4, 0.8, 0.3, 0.9, 0.4],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "linear",
          times: [0, 0.3, 0.6, 0.8, 1],
        }}
      >
        {text}
      </motion.span>
    </div>
  );
};

export const LoaderFive = ({ text }: { text: string }) => {
  return (
    <div className="font-sans font-bold [--shadow-color:var(--color-neutral-500)] dark:[--shadow-color:var(--color-neutral-100)]">
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{
            scale: [1, 1.1, 1],
            textShadow: [
              "0 0 0 var(--shadow-color)",
              "0 0 1px var(--shadow-color)",
              "0 0 0 var(--shadow-color)",
            ],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: "loop",
            delay: i * 0.05,
            ease: "easeInOut",
            repeatDelay: 2,
          }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </div>
  );
};
