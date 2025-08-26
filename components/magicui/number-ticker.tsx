"use client";

import { ComponentPropsWithoutRef, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Try to import motion with fallback
let useInView: any, useMotionValue: any, useSpring: any;
try {
  const motionModule = require("motion/react");
  useInView = motionModule.useInView;
  useMotionValue = motionModule.useMotionValue;
  useSpring = motionModule.useSpring;
} catch (error) {
  console.warn("Motion library not available, using fallback");
  useInView = () => true;
  useMotionValue = (val: any) => ({ set: () => {}, on: () => () => {} });
  useSpring = (val: any) => ({ on: () => () => {} });
}

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  
  // Fallback for when motion is not available
  if (!useInView || !useMotionValue || !useSpring) {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-block tabular-nums tracking-wider text-white dark:text-white",
          className,
        )}
        {...props}
      >
        {Intl.NumberFormat("en-US", {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        }).format(value)}
      </span>
    );
  }
  
  const motionValue = useMotionValue(direction === "down" ? value : startValue);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value);
      }, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [motionValue, isInView, delay, value, direction, startValue]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat("en-US", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)));
        }
      }),
    [springValue, decimalPlaces],
  );

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block tabular-nums tracking-wider text-white dark:text-white",
        className,
      )}
      {...props}
    >
      {startValue}
    </span>
  );
}
