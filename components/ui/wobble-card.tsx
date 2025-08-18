"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const WobbleCard = ({
  children,
  containerClassName,
  className,
}: {
  children: React.ReactNode;
  containerClassName?: string;
  className?: string;
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [neonIntensity, setNeonIntensity] = useState(0.3);

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
    const { clientX, clientY } = event;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (clientX - (rect.left + rect.width / 2)) / 20;
    const y = (clientY - (rect.top + rect.height / 2)) / 20;
    setMousePosition({ x, y });
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
    setNeonIntensity(0.6);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setNeonIntensity(0.3);
    setMousePosition({ x: 0, y: 0 });
  };
      return (
      <motion.section
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      style={{
        transform: isHovering
          ? `translate3d(${mousePosition.x}px, ${mousePosition.y}px, 0) scale3d(1, 1, 1)`
          : "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
        transition: "transform 0.1s ease-out",
      }}
      className={cn(
        "mx-auto w-full bg-black/20 backdrop-blur-xl border border-white/10 relative rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)] neon-cyan neon-purple",
        "before:absolute before:inset-0 before:rounded-2xl before:border before:border-cyan-400/30 before:pointer-events-none",
        "after:absolute after:inset-0 after:rounded-2xl after:border after:border-purple-400/20 after:pointer-events-none",
        containerClassName
      )}
      style={{
        '--neon-cyan-shadow': `0 0 ${20 * neonIntensity}px rgba(34,211,238,${neonIntensity})`,
        '--neon-purple-shadow': `0 0 ${15 * neonIntensity}px rgba(168,85,247,${neonIntensity * 0.7})`,
      } as React.CSSProperties}
    >
              <div
          className="relative h-full bg-black/10 backdrop-blur-sm sm:mx-0 sm:rounded-2xl overflow-hidden"
          style={{
            boxShadow:
              "0 10px 32px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(255, 255, 255, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.05), 0 4px 6px rgba(0, 0, 0, 0.1), 0 24px 108px rgba(0, 0, 0, 0.15)",
            '--neon-cyan-shadow': `0 0 ${20 * neonIntensity}px rgba(34,211,238,${neonIntensity})`,
            '--neon-purple-shadow': `0 0 ${15 * neonIntensity}px rgba(168,85,247,${neonIntensity * 0.7})`,
          } as React.CSSProperties}
        >
          <style jsx>{`
            .neon-cyan::before {
              box-shadow: var(--neon-cyan-shadow) !important;
            }
            .neon-purple::after {
              box-shadow: var(--neon-purple-shadow) !important;
            }
          `}</style>
        <motion.div
          style={{
            transform: isHovering
              ? `translate3d(${-mousePosition.x}px, ${-mousePosition.y}px, 0) scale3d(1.03, 1.03, 1)`
              : "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
            transition: "transform 0.1s ease-out",
          }}
          className={cn("h-full px-4 py-20 sm:px-10", className)}
        >
          <Noise />
          {children}
        </motion.div>
      </div>
    </motion.section>
  );
};

const Noise = () => {
  return (
    <div
      className="absolute inset-0 w-full h-full scale-[1.2] transform opacity-10 [mask-image:radial-gradient(#fff,transparent,75%)]"
      style={{
        backgroundImage: "url(/noise.webp)",
        backgroundSize: "30%",
      }}
    ></div>
  );
};
