"use client";

import React, { useState } from 'react';
import { motion } from "motion/react";
import ApiKeyModal from './ApiKeyModal';
import { useApiKey } from '../lib/hooks/useApiKey';

const LoaderThreeSVG = () => (
  <motion.svg
  xmlns="http://www.w3.org/2000/svg"
  width="32"
  height="32"
  viewBox="133 149 433 402"
  fill="none"
  stroke="url(#gradient)"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
  className="h-[32px] w-[32px]"
>
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="rgb(131, 179, 32)" />
      <stop offset="10%" stopColor="rgb(47, 195, 106)" />
      <stop offset="20%" stopColor="rgb(42, 169, 210)" />
      <stop offset="30%" stopColor="rgb(4, 112, 202)" />
      <stop offset="40%" stopColor="rgb(107, 10, 255)" />
      <stop offset="50%" stopColor="rgb(183, 0, 218)" />
      <stop offset="60%" stopColor="rgb(218, 0, 171)" />
      <stop offset="70%" stopColor="rgb(230, 64, 92)" />
      <stop offset="80%" stopColor="rgb(232, 98, 63)" />
      <stop offset="90%" stopColor="rgb(249, 129, 47)" />
      <stop offset="100%" stopColor="rgb(131, 179, 32)" />
    </linearGradient>
  </defs>
  <motion.path
    initial={{ pathLength: 0 }}
    animate={{ pathLength: 1 }}
    transition={{
      duration: 3,
      ease: "easeInOut",
      repeat: Infinity,
      repeatType: "reverse",
    }}
    stroke="url(#gradient)"
    strokeWidth="3"
    fill="none"
    d="M565.598765,372.951028 C565.598765,375.002407 565.123895,376.952504 564.22332,378.644848 L471.558363,539.145156 C467.628442,545.95198 460.365648,550.145156 452.505805,550.145156 L246.592961,550.145156 C238.733118,550.145156 231.470323,545.95198 227.540402,539.145156 L134.86679,378.629552 C133.968844,376.940022 133.5,374.999302 133.5,372.951028 C133.5,366.307901 138.885318,360.922583 145.528445,360.922583 L247.199342,360.922583 L272.965382,404.687949 L273.123755,404.949452 C276.56213,410.470142 283.796681,412.269462 289.433324,408.951035 L289.433324,408.951035 L289.725027,408.773687 C292.323961,407.142692 294.205446,404.576775 294.976025,401.597905 L294.976025,401.597905 L327.807505,274.677705 L355.998349,479.011885 L356.041062,479.296747 C357.082331,485.72482 363.072426,490.1783 369.557845,489.283548 L369.557845,489.283548 L369.85245,489.239203 C374.548041,488.473143 378.362876,485.004494 379.559058,480.380352 L379.559058,480.380352 L419.133013,327.39653 L435.381735,354.996566 L435.543066,355.262694 C437.735954,358.77701 441.59028,360.922583 445.747249,360.922583 L445.747249,360.922583 L553.57032,360.922583 L553.57032,360.922583 C560.213447,360.922583 565.598765,366.307901 565.598765,372.951028 Z M452.505805,149.493649 C460.365648,149.493649 467.628442,153.686825 471.558363,160.493649 L564.229106,321.001259 C565.125282,322.691832 565.598765,324.640838 565.598765,326.687777 C565.598765,333.330904 560.213447,338.716222 553.57032,338.716222 L451.566328,338.716222 L425.800288,294.950856 L425.62294,294.659153 C423.991945,292.060218 421.426028,290.178734 418.447158,289.408155 L418.447158,289.408155 L418.167463,289.339295 C411.826545,287.85703 405.429227,291.702682 403.789645,298.040901 L403.789645,298.040901 L370.95724,424.960175 L342.767321,220.62692 L342.722976,220.332314 C341.956916,215.636723 338.488267,211.821889 333.864125,210.625707 C327.432698,208.962014 320.870306,212.827026 319.206612,219.258453 L319.206612,219.258453 L279.631731,372.24135 L263.383935,344.64224 L263.222604,344.376112 C261.029716,340.861796 257.17539,338.716222 253.018421,338.716222 L253.018421,338.716222 L145.528445,338.716222 L145.528445,338.716222 C138.885318,338.716222 133.5,333.330904 133.5,326.687777 C133.5,324.65653 133.956256,322.735416 134.837658,321.056157 L227.540402,160.493649 C231.470323,153.686825 238.733118,149.493649 246.592961,149.493649 L452.505805,149.493649 Z"
  />
</motion.svg>
);

export default function GlobalHeader() {
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const { apiKey, saveApiKey, hasApiKey } = useApiKey();

  return (
    <>
      <ApiKeyModal 
        isOpen={showApiKeyModal} 
        onClose={() => setShowApiKeyModal(false)}
        onApiKeySet={saveApiKey}
        currentApiKey={apiKey}
      />
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-sm border-b border-slate-700/30"
      >
              <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left side - LoaderThree SVG */}
        <motion.div
          className="flex items-center"
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.2 }}
        >
          <LoaderThreeSVG />
        </motion.div>
        
        {/* Center - Links */}
        <div className="flex items-center gap-4">
          <motion.a
            href="https://pulsechain.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-white transition-colors duration-200 text-sm font-medium px-3 py-1 rounded-lg hover:bg-slate-700/30"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            PulseChain.com
          </motion.a>
          <motion.a
            href="https://hex.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-white transition-colors duration-200 text-sm font-medium px-3 py-1 rounded-lg hover:bg-slate-700/30"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            HEX.com
          </motion.a>
        </div>
        
        {/* Right side - API Key */}
        <motion.button
          onClick={() => setShowApiKeyModal(true)}
          className={`flex items-center gap-2 text-slate-300 hover:text-white transition-colors duration-200 text-sm font-medium px-3 py-1 rounded-lg hover:bg-slate-700/30 ${
            hasApiKey() ? 'bg-green-900/30 border border-green-700/50' : 'bg-slate-700/30 border border-slate-600/50'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={hasApiKey() ? 'Personal API Key Configured' : 'Configure API Key'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          {hasApiKey() ? (
            <span className="text-green-400">API Key</span>
          ) : (
            <span>API Key</span>
          )}
        </motion.button>
      </div>
      </motion.header>
    </>
  );
} 