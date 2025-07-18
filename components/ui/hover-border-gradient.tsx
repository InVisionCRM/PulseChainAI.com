"use client";
import React, { useState, useEffect, useRef } from "react";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT";

export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Tag = "button",
  duration = 1,
  clockwise = true,
  disabled,
  ...props
}: React.PropsWithChildren<
  {
    as?: React.ElementType;
    containerClassName?: string;
    className?: string;
    duration?: number;
    clockwise?: boolean;
    disabled?: boolean;
  } & React.HTMLAttributes<HTMLElement>
>) {
  const [hovered, setHovered] = useState<boolean>(false);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const containerRef = useRef<HTMLElement>(null);

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      setMousePosition({ x, y });
    }
  };

  const getGradientPosition = () => {
    return `radial-gradient(20% 50% at ${mousePosition.x}% ${mousePosition.y}%, hsl(0, 0%, 100%) 0%, rgba(255, 255, 255, 0) 100%)`;
  };

  const highlight = `radial-gradient(75% 181.15942028985506% at ${mousePosition.x}% ${mousePosition.y}%, #8b5cf6 0%, rgba(255, 255, 255, 0) 100%)`;

  return (
    <Tag
      ref={containerRef}
      onMouseEnter={(event: React.MouseEvent<HTMLDivElement>) => {
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMouseMove}
      disabled={disabled}
      className={cn(
        "relative flex rounded-lg border content-center bg-transparent hover:bg-transparent transition duration-500 items-center justify-center overflow-visible p-px decoration-clone",
        containerClassName
      )}
      {...props}
    >
      <div
        className={cn(
          "w-auto text-white z-10 bg-transparent px-4 py-2 rounded-[inherit]",
          className
        )}
      >
        {children}
      </div>
      <motion.div
        className={cn(
          "flex-none inset-0 overflow-hidden absolute z-0 rounded-[inherit]"
        )}
        style={{
          filter: "blur(2px)",
          position: "absolute",
          width: "100%",
          height: "100%",
        }}
        initial={{ background: getGradientPosition() }}
        animate={{
          background: hovered
            ? [getGradientPosition(), highlight]
            : getGradientPosition(),
        }}
        transition={{ ease: "linear", duration: 0.1 }}
      />
      <div className="bg-transparent absolute z-1 flex-none inset-[2px] rounded-lg" />
    </Tag>
  );
} 