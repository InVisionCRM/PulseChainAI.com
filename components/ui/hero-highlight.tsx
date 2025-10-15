"use client";
import { cn } from "@/lib/utils";
import { useMotionValue, motion, useMotionTemplate } from "framer-motion";
import React from "react";
import { ThreeDMarquee } from "./3d-marquee";

export const HeroHighlight = ({
  children,
  className,
  containerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) => {
  const appPicsImages = [
    "/app-pics/ai-therapist.png",
    "/app-pics/clean.png",
    "/app-pics/eth-banner.png",
    "/app-pics/eth-logo.png",
    "/app-pics/hex-on-eth.jpg",
    "/app-pics/hex-pulse-staking.jpg",
    "/app-pics/IMG_0371.JPG",
    "/app-pics/pls-hex.png",
    "/app-pics/positive-vibes-only.png",
    "/app-pics/Screenshot 2025-08-05 at 10.23.58 AM.png",
    "/app-pics/talk-to-richard.png"
  ];

  return (
    <div
      className={cn(
        "group relative flex w-full items-center justify-center bg-white dark:bg-black",
        containerClassName,
      )}
      style={{
        background: 'transparent',
      }}
    >
      <div className="absolute inset-0 z-10">
        <ThreeDMarquee images={appPicsImages} className="h-full" />
      </div>

      <div className={cn("relative z-20", className)}>{children}</div>
    </div>
  );
};

export const Highlight = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <motion.span
      initial={{
        backgroundSize: "0% 100%",
      }}
      animate={{
        backgroundSize: "100% 100%",
      }}
      transition={{
        duration: 2,
        ease: "linear",
        delay: 0.5,
      }}
      style={{
        backgroundRepeat: "no-repeat",
        backgroundPosition: "left center",
        display: "inline",
      }}
      className={cn(
        `relative inline-block rounded-lg bg-gradient-to-r from-indigo-300 to-purple-300 from-cyan-300 to-cyan-800 px-1 pb-1 dark:from-indigo-500 dark:to-purple-500`,
        className,
      )}
    >
      {children}
    </motion.span>
  );
};
