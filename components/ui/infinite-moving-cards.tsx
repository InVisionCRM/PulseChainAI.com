"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";

export const InfiniteMovingCards = ({
  items,
  direction = "left",
  speed = "normal",
  pauseOnHover = true,
  className,
  onItemClick,
}: {
  items: {
    quote: string;
    name: string;
    logo?: string | null;
    changeColor?: string;
    changeText?: string;
    tokenAddress?: string | null;
  }[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  pauseOnHover?: boolean;
  className?: string;
  onItemClick?: (tokenAddress: string) => void;
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLUListElement>(null);

  useEffect(() => {
    addAnimation();
  }, []);
  
  const [start, setStart] = useState(false);
  
  function addAnimation() {
    if (containerRef.current && scrollerRef.current) {
      const scrollerContent = Array.from(scrollerRef.current.children);

      scrollerContent.forEach((item) => {
        const duplicatedItem = item.cloneNode(true);
        if (scrollerRef.current) {
          scrollerRef.current.appendChild(duplicatedItem);
        }
      });

      getDirection();
      getSpeed();
      setStart(true);
    }
  }
  
  const getDirection = () => {
    if (containerRef.current) {
      if (direction === "left") {
        containerRef.current.style.setProperty(
          "--animation-direction",
          "forwards"
        );
      } else {
        containerRef.current.style.setProperty(
          "--animation-direction",
          "reverse"
        );
      }
    }
  };
  
  const getSpeed = () => {
    if (containerRef.current) {
      if (speed === "fast") {
        containerRef.current.style.setProperty("--animation-duration", "80s");
      } else if (speed === "normal") {
        containerRef.current.style.setProperty("--animation-duration", "120s");
      } else {
        containerRef.current.style.setProperty("--animation-duration", "120s");
      }
    }
  };
  
  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-20 overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]",
        className
      )}
    >
      <ul
        ref={scrollerRef}
        className={cn(
          "flex min-w-full shrink-0 gap-1 py-2 w-max flex-nowrap",
          start && "animate-scroll",
          pauseOnHover && "hover:[animation-play-state:paused]"
        )}
      >
        {items.map((item, idx) => (
          <li
            className="w-auto relative flex-shrink-0 px-2"
            style={{ background: 'transparent' }}
            key={idx}
            onClick={() => {
              if (onItemClick && item.tokenAddress) {
                onItemClick(item.tokenAddress);
              }
            }}
          >
            <blockquote 
              style={{ background: 'transparent' }}
              className={item.tokenAddress ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
            >
              <div className="flex items-center gap-2">
                {item.logo && (
                  <img 
                    src={item.logo} 
                    alt="" 
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <span className="relative z-20 text-sm leading-[1.6] font-normal whitespace-nowrap text-white/90">
                  {item.quote}
                </span>
                {item.changeText && (
                  <span 
                    className="relative z-20 text-sm leading-[1.6] font-semibold whitespace-nowrap"
                    style={{ color: item.changeColor }}
                  >
                    {item.changeText}
                  </span>
                )}
                <span className="text-white/30 mx-1">•</span>
              </div>
            </blockquote>
          </li>
        ))}
      </ul>
    </div>
  );
};
