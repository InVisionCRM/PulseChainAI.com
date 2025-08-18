"use client";
import { motion } from "framer-motion";
import React from "react";

export const HappyFaceLoader = () => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="100"
      height="100"
      viewBox="0 0 100 100"
      fill="none"
      stroke="url(#happyGradient)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[100px] w-[100px]"
    >
      <defs>
        <linearGradient id="happyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(255, 193, 7)" />
          <stop offset="25%" stopColor="rgb(255, 152, 0)" />
          <stop offset="50%" stopColor="rgb(255, 87, 34)" />
          <stop offset="75%" stopColor="rgb(233, 30, 99)" />
          <stop offset="100%" stopColor="rgb(156, 39, 176)" />
        </linearGradient>
      </defs>
      
      {/* Happy Face Circle */}
      <motion.circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="url(#happyGradient)"
        strokeWidth="3"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          duration: 2,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse",
        }}
      />
      
      {/* Left Eye */}
      <motion.circle
        cx="35"
        cy="40"
        r="4"
        fill="url(#happyGradient)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1] }}
        transition={{
          duration: 1,
          delay: 0.5,
          ease: "easeOut",
          repeat: Infinity,
          repeatType: "reverse",
          repeatDelay: 1,
        }}
      />
      
      {/* Right Eye */}
      <motion.circle
        cx="65"
        cy="40"
        r="4"
        fill="url(#happyGradient)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1] }}
        transition={{
          duration: 1,
          delay: 0.7,
          ease: "easeOut",
          repeat: Infinity,
          repeatType: "reverse",
          repeatDelay: 1,
        }}
      />
      
      {/* Happy Mouth */}
      <motion.path
        d="M 30 60 Q 50 75 70 60"
        fill="none"
        stroke="url(#happyGradient)"
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          duration: 1.5,
          delay: 1,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse",
          repeatDelay: 0.5,
        }}
      />
      
      {/* Sparkles around the face */}
      <motion.path
        d="M 15 25 L 18 28 L 21 25 L 18 22 Z"
        fill="url(#happyGradient)"
        initial={{ scale: 0, rotate: 0 }}
        animate={{ 
          scale: [0, 1, 0], 
          rotate: [0, 180, 360],
          opacity: [0, 1, 0]
        }}
        transition={{
          duration: 2,
          delay: 0.2,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 1,
        }}
      />
      
      <motion.path
        d="M 85 25 L 88 28 L 91 25 L 88 22 Z"
        fill="url(#happyGradient)"
        initial={{ scale: 0, rotate: 0 }}
        animate={{ 
          scale: [0, 1, 0], 
          rotate: [0, 180, 360],
          opacity: [0, 1, 0]
        }}
        transition={{
          duration: 2,
          delay: 0.8,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 1,
        }}
      />
      
      <motion.path
        d="M 20 80 L 23 83 L 26 80 L 23 77 Z"
        fill="url(#happyGradient)"
        initial={{ scale: 0, rotate: 0 }}
        animate={{ 
          scale: [0, 1, 0], 
          rotate: [0, 180, 360],
          opacity: [0, 1, 0]
        }}
        transition={{
          duration: 2,
          delay: 1.4,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 1,
        }}
      />
      
      <motion.path
        d="M 80 80 L 83 83 L 86 80 L 83 77 Z"
        fill="url(#happyGradient)"
        initial={{ scale: 0, rotate: 0 }}
        animate={{ 
          scale: [0, 1, 0], 
          rotate: [0, 180, 360],
          opacity: [0, 1, 0]
        }}
        transition={{
          duration: 2,
          delay: 2,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 1,
        }}
      />
    </motion.svg>
  );
};

export default HappyFaceLoader; 