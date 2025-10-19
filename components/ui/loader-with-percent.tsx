"use client";

import React from "react";
import { LoaderThree } from "./loader";
import { NumberTicker } from "@/components/magicui/number-ticker";

interface LoaderWithPercentProps {
  label?: string; // kept for API compatibility, ignored visually per request
  progress?: number; // 0-100; if omitted, simulate up to 95 until unmount
  small?: boolean;
  className?: string;
}

export function LoaderWithPercent({ label = "Loading", progress, small = false, className }: LoaderWithPercentProps) {
  const [internal, setInternal] = React.useState(0);

  React.useEffect(() => {
    if (typeof progress === "number") return; // external control
    setInternal(0);
    const id = setInterval(() => {
      setInternal((p) => {
        if (p >= 95) return p; // don't complete; caller unmounts
        // Ease toward 95
        const increment = Math.max(0.5, (95 - p) * 0.06);
        return Math.min(95, p + increment);
      });
    }, 200);
    return () => clearInterval(id);
  }, [progress]);

  const value = Math.round(typeof progress === "number" ? progress : internal);

  return (
    <div className={`relative inline-flex items-center justify-center ${className || ""}`}>
      {/* Numbers only, positioned top-center 5px above loader */}
      <span className="absolute left-1/2 -translate-x-1/2 pointer-events-none" style={{ top: "-5px" }}>
        <NumberTicker value={value} startValue={0} decimalPlaces={0} className="text-xs md:text-sm font-semibold text-white" />
      </span>
      <div className={small ? "scale-75" : undefined}><LoaderThree /></div>
    </div>
  );
}


