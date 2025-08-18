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
        className="h-4 w-4 rounded-full bg-neutral-200 shadow-md dark:bg-neutral-500"
      />
      <motion.div
        initial={{
          x: 0,
        }}
        animate={{
          x: [0, 20, 0],
        }}
        transition={transition(0.4)}
        className="h-4 w-4 -translate-x-2 rounded-full bg-neutral-200 shadow-md dark:bg-neutral-500"
      />
      <motion.div
        initial={{
          x: 0,
        }}
        animate={{
          x: [0, 20, 0],
        }}
        transition={transition(0.8)}
        className="h-4 w-4 -translate-x-4 rounded-full bg-neutral-200 shadow-md dark:bg-neutral-500"
      />
    </div>
  );
};

export const LoaderThree = () => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="300"
      height="300"
      viewBox="133 149 433 402"
      fill="none"
      stroke="url(#gradient)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[300px] w-[300px]"
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
      <motion.path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: 4,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse",
        }}
        stroke="url(#gradient)"
        strokeWidth="2"
        fill="none"
        d="M565.598765,372.951028 C565.598765,375.002407 565.123895,376.952504 564.22332,378.644848 L471.558363,539.145156 C467.628442,545.95198 460.365648,550.145156 452.505805,550.145156 L246.592961,550.145156 C238.733118,550.145156 231.470323,545.95198 227.540402,539.145156 L134.86679,378.629552 C133.968844,376.940022 133.5,374.999302 133.5,372.951028 C133.5,366.307901 138.885318,360.922583 145.528445,360.922583 L247.199342,360.922583 L272.965382,404.687949 L273.123755,404.949452 C276.56213,410.470142 283.796681,412.269462 289.433324,408.951035 L289.433324,408.951035 L289.725027,408.773687 C292.323961,407.142692 294.205446,404.576775 294.976025,401.597905 L294.976025,401.597905 L327.807505,274.677705 L355.998349,479.011885 L356.041062,479.296747 C357.082331,485.72482 363.072426,490.1783 369.557845,489.283548 L369.557845,489.283548 L369.85245,489.239203 C374.548041,488.473143 378.362876,485.004494 379.559058,480.380352 L379.559058,480.380352 L419.133013,327.39653 L435.381735,354.996566 L435.543066,355.262694 C437.735954,358.77701 441.59028,360.922583 445.747249,360.922583 L445.747249,360.922583 L553.57032,360.922583 L553.57032,360.922583 C560.213447,360.922583 565.598765,366.307901 565.598765,372.951028 Z M452.505805,149.493649 C460.365648,149.493649 467.628442,153.686825 471.558363,160.493649 L564.229106,321.001259 C565.125282,322.691832 565.598765,324.640838 565.598765,326.687777 C565.598765,333.330904 560.213447,338.716222 553.57032,338.716222 L451.566328,338.716222 L425.800288,294.950856 L425.62294,294.659153 C423.991945,292.060218 421.426028,290.178734 418.447158,289.408155 L418.447158,289.408155 L418.167463,289.339295 C411.826545,287.85703 405.429227,291.702682 403.789645,298.040901 L403.789645,298.040901 L370.95724,424.960175 L342.767321,220.62692 L342.722976,220.332314 C341.956916,215.636723 338.488267,211.821889 333.864125,210.625707 C327.432698,208.962014 320.870306,212.827026 319.206612,219.258453 L319.206612,219.258453 L279.631731,372.24135 L263.383935,344.64224 L263.222604,344.376112 C261.029716,340.861796 257.17539,338.716222 253.018421,338.716222 L253.018421,338.716222 L145.528445,338.716222 L145.528445,338.716222 C138.885318,338.716222 133.5,333.330904 133.5,326.687777 C133.5,324.65653 133.956256,322.735416 134.837658,321.056157 L227.540402,160.493649 C231.470323,153.686825 238.733118,149.493649 246.592961,149.493649 L452.505805,149.493649 Z"
      />
    </motion.svg>
  );
};

export const LoaderFour = ({ text = "Loading..." }: { text?: string }) => {
  return (
    <div className="relative font-bold text-black [perspective:1000px] dark:text-white">
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
        className="absolute inset-0 text-[#00e571]/50 blur-[0.5px] dark:text-[#00e571]"
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
